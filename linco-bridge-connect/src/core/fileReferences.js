const fs = require('fs');
const path = require('path');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

function buildFileReferenceSystemPrompt(session, config) {
  const agentType = session.agentType || 'claude';
  const instructions = config.agents?.[agentType]?.instructions || '';
  return `${instructions}

如果你需要把生成的文件或图片交给用户，请保存到当前工作目录或会话运行目录中，并且必须在回复里用 Markdown 文件引用返回，链接目标必须是原始本机绝对路径，例如 [report.md](D:\\path\\report.md)。不要只返回裸文件路径，不要使用相对路径作为链接目标，也不要使用 file://、file:/// 或其他 URL 形式。用户点击引用后，Linco 会通过 /get <路径> 按需取回文件。

当前工作目录: ${session.workspace}
会话运行目录: ${session.runtimeDir}
附件目录: ${session.attachmentsDir}

请使用有意义的文件名，不要引用敏感文件，除非用户明确要求。`;
}

function buildFileReferenceHint(input, session) {
  const text = extractText(input);
  if (!shouldAddFileReferenceHint(text)) return input;

  const hint = `系统提示：用户正在要求发送或获取文件/图片。请将最终文件保存到当前工作目录或会话运行目录，并且必须在回复中用 Markdown 文件引用返回，链接目标必须是原始本机绝对路径，例如 [report.md](D:\\path\\report.md)。不要只返回裸文件路径，不要使用相对路径作为链接目标，也不要使用 file://、file:/// 或其他 URL 形式；用户点击引用后会自动触发 /get <路径> 下发文件。
当前工作目录: ${session.workspace}
会话运行目录: ${session.runtimeDir}
附件目录: ${session.attachmentsDir}`;

  if (Array.isArray(input)) {
    return [...input, { type: 'text', text: hint }];
  }
  return `${String(input || '')}\n\n${hint}`;
}

function buildImageGenerationDeliveryHint(input) {
  const text = extractText(input);
  if (!isImageGenerationRequest(text)) return input;

  const hint = '系统提示：这是一条图片生成请求。如果你使用了内置图片生成工具，生成的图片会由桥接层自动作为图片附件发送给用户，不要在正文中输出本地文件路径、Markdown 文件链接、/get 命令或下载说明，只简短确认图片已生成。如果没有可用的图片生成工具、只能通过保存或下载图片文件交付，则必须把最终图片保存到当前工作目录或会话运行目录，并在回复中用 Markdown 文件引用返回本机绝对路径。';
  if (Array.isArray(input)) {
    return [...input, { type: 'text', text: hint }];
  }
  return `${String(input || '')}\n\n${hint}`;
}

function shouldAddFileReferenceHint(text) {
  const value = String(text || '');
  if (hasCodeImplementationContext(value) && !isExplicitFileDeliveryRequest(value)) {
    return false;
  }
  if (isImageGenerationRequest(value) && !isExplicitFileDeliveryRequest(value)) {
    return false;
  }
  return /(send|upload|attach|file|image|download|发送|文件|图片|发给我|下载)/i.test(String(text || ''));
}

function isImageGenerationRequest(text) {
  const value = String(text || '');
  if (hasCodeImplementationContext(value) && !hasDirectImageGenerationIntent(value)) return false;
  const hasImageSubject = /(image|picture|photo|pic|png|jpg|jpeg|webp|drawing|illustration|poster|wallpaper|图片|照片|图像|插画|海报|壁纸|头像)/i.test(value);
  const hasGenerateVerb = /(generate|create|draw|paint|make|生成|画|绘制|做|制作|创建|来一张|出一张)/i.test(value);
  return hasImageSubject && hasGenerateVerb;
}

function hasCodeImplementationContext(text) {
  return /(code|function|bug|fix|implement|support|feature|component|page|api|endpoint|route|代码|函数|方法|页面|接口|组件|修复|实现|支持|功能|开发|按钮|前端|后端)/i.test(String(text || ''));
}

function hasDirectImageGenerationIntent(text) {
  return /(直接|现在|马上|立即|给我|发给我|生成一张|画一张|来一张|出一张|draw me|generate an? image|create an? image)/i.test(String(text || ''));
}

function isExplicitFileDeliveryRequest(text) {
  return /(file|download|attach|保存到|保存成|保存为|文件|下载|附件|路径|链接|本地)/i.test(String(text || ''));
}

function resolveGetTarget(rawTarget, session) {
  const target = normalizeFileUriPath(stripWrappingQuotes(stripLineSuffix(String(rawTarget || '').trim())));
  if (!target) return null;
  return path.resolve(path.isAbsolute(target) ? target : path.join(session.workspace, target));
}

function allowedGetRoots(session) {
  return [session.workspace, session.runtimeDir, session.attachmentsDir].filter(Boolean);
}

function validateGetFile(filePath, session, config) {
  const resolved = path.resolve(filePath);
  if (!allowedGetRoots(session).some(root => isInsideOrSame(resolved, root))) {
    return { ok: false, code: 'outside_allowed_roots', message: '拒绝读取该路径：只能获取当前工作目录、运行目录或附件目录内的文件。' };
  }

  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    return { ok: false, code: 'missing', message: `文件不存在：${resolved}` };
  }

  if (!stat.isFile()) {
    return { ok: false, code: 'not_file', message: `不是普通文件：${resolved}` };
  }

  if (stat.size <= 0) {
    return { ok: false, code: 'empty', message: `文件为空：${resolved}` };
  }

  if (stat.size > config.maxOutgoingAttachmentBytes) {
    return {
      ok: false,
      code: 'too_large',
      message: `文件超过发送大小限制 ${(config.maxOutgoingAttachmentBytes / 1024 / 1024).toFixed(0)}MB：${resolved}`,
    };
  }

  if (!config.allowUnsafeAttachments && isUnsafeAttachmentPath(resolved, config)) {
    return { ok: false, code: 'unsafe', message: `出于安全原因，默认不允许下发该类型文件：${path.basename(resolved)}` };
  }

  return { ok: true, path: resolved, size: stat.size };
}

function buildOutboundFileMessage(session, filePath, size) {
  const name = path.basename(filePath);
  return {
    messageId: `linco-get-${Date.now()}`,
    text: `文件：${name}`,
    references: [buildFileReference(filePath, session)],
    mediaName: name,
    mediaType: mimeFromFilename(name),
    mediaBase64: fs.readFileSync(filePath).toString('base64'),
    size,
  };
}

function buildFileReference(filePath, session) {
  const resolved = path.resolve(filePath);
  const relative = relativePathForReference(resolved, session);
  return {
    type: 'file',
    name: path.basename(resolved),
    path: resolved,
    relativePath: relative,
    command: `/get ${quoteGetPath(resolved)}`,
  };
}

function extractFileReferences(text, session, config) {
  const candidates = candidatePathsFromText(text, session);
  const seen = new Set();
  const references = [];

  for (const candidate of candidates) {
    const resolved = resolveGetTarget(candidate, session);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    if (validateGetFile(resolved, session, config).ok) {
      references.push(buildFileReference(resolved, session));
    }
  }

  return references;
}

function candidatePathsFromText(text, session) {
  const source = String(text || '');
  return candidatePathsFromMarkdownLinks(source);
}

function candidatePathsFromMarkdownLinks(text) {
  const candidates = [];
  const markdownLinkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
  for (const match of String(text || '').matchAll(markdownLinkPattern)) {
    const target = normalizeFileUriPath(cleanMarkdownTarget(match[1]));
    if (path.isAbsolute(target)) candidates.push(target);
  }
  return candidates;
}

function relativePathForReference(filePath, session) {
  const workspace = path.resolve(session.workspace || '');
  if (isInsideOrSame(filePath, workspace)) {
    return path.relative(workspace, filePath) || path.basename(filePath);
  }
  return filePath;
}

function quoteGetPath(value) {
  const text = String(value || '');
  if (!/\s/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function mimeFromFilename(name) {
  switch (path.extname(name).toLowerCase()) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.svg': return 'image/svg+xml';
    case '.txt': return 'text/plain; charset=utf-8';
    case '.md': return 'text/markdown; charset=utf-8';
    case '.csv': return 'text/csv; charset=utf-8';
    case '.json': return 'application/json';
    case '.pdf': return 'application/pdf';
    case '.doc': return 'application/msword';
    case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.xls': return 'application/vnd.ms-excel';
    case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.sql': return 'application/sql';
    case '.zip': return 'application/zip';
    default: return 'application/octet-stream';
  }
}

function kindFromFilename(name) {
  return IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()) ? 'image' : 'file';
}

function stripWrappingQuotes(value) {
  const text = String(value || '').trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  if (text.startsWith('<') && text.endsWith('>')) {
    return text.slice(1, -1);
  }
  return text;
}

function stripLineSuffix(value) {
  return String(value || '').replace(/:(\d+)(?::\d+)?$/, '');
}

function isUnsafeAttachmentPath(filePath, config) {
  const ext = path.extname(filePath).toLowerCase();
  return new Set(config.unsafeAttachmentExtensions || []).has(ext);
}

function isInsideOrSame(filePath, dir) {
  if (!dir) return false;
  const relative = path.relative(path.resolve(dir), path.resolve(filePath));
  return !relative || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function cleanCandidate(value) {
  return String(value || '').replace(/[.,，。；;:]+$/g, '');
}

function cleanMarkdownTarget(value) {
  const target = stripWrappingQuotes(String(value || '').trim());
  const withoutTitle = target.match(/^(\S+)\s+["'][^"']*["']$/);
  return cleanCandidate(withoutTitle ? withoutTitle[1] : target);
}

function normalizeFileUriPath(value) {
  const text = String(value || '').trim();
  if (!/^file:\/\//i.test(text)) return text;
  try {
    return decodeURIComponent(new URL(text).pathname)
      .replace(/^\/([A-Za-z]:[\\/])/, '$1')
      .replace(/\//g, path.sep);
  } catch {
    return text.replace(/^file:\/*/i, '');
  }
}

function extractText(input) {
  if (!Array.isArray(input)) return String(input || '');
  return input
    .filter(block => block?.type === 'text' || typeof block === 'string')
    .map(block => typeof block === 'string' ? block : (block.text || ''))
    .join('\n');
}

module.exports = {
  buildImageGenerationDeliveryHint,
  buildFileReference,
  buildFileReferenceHint,
  buildFileReferenceSystemPrompt,
  buildOutboundFileMessage,
  extractFileReferences,
  kindFromFilename,
  mimeFromFilename,
  resolveGetTarget,
  validateGetFile,
  _internal: {
    hasCodeImplementationContext,
    hasDirectImageGenerationIntent,
    isExplicitFileDeliveryRequest,
    isImageGenerationRequest,
    shouldAddFileReferenceHint,
  },
};
