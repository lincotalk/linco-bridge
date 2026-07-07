const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ensureDir } = require('../config');
const { sendError, sendSystem, sendTurnEnd } = require('../core/protocol');

const RESERVED_WINDOWS_NAMES = new Set(['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9']);
const SUPPORTED_IMAGE_MEDIA_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const IMAGE_EXTENSION_MEDIA_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
]);

function handleMessageWithAttachments(msg, ws, session, config, executeAgentQuery) {
  const text = String(msg.text || '').trim();
  const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];

  if (!text && attachments.length === 0) return;

  let savedAttachments = [];
  try {
    savedAttachments = saveAttachments(session, attachments, config);
  } catch (err) {
    sendError(ws, `❌ 附件处理失败: ${err.message}`);
    sendTurnEnd(ws, session, 'error', { error: err.message });
    return;
  }

  const stats = summarizeAttachments(savedAttachments);
  if (savedAttachments.length > 0) {
    sendSystem(ws, buildAttachmentStatus(stats));
  }

  executeAgentQuery(withMessageMeta(buildContentWithAttachments(text, savedAttachments), msg), ws, session, config);
}

function handleLegacyImageMessage(msg, ws, session, config, executeAgentQuery) {
  const attachments = [{
    name: `image.${extensionFromMime(msg.mimeType || 'image/png').slice(1)}`,
    mimeType: msg.mimeType || 'image/png',
    base64: msg.base64,
  }];
  handleMessageWithAttachments({ text: msg.text || '', attachments }, ws, session, config, executeAgentQuery);
}

function saveAttachments(session, attachments, config) {
  if (attachments.length > config.maxAttachmentCount) {
    throw new Error(`单次最多上传 ${config.maxAttachmentCount} 个附件`);
  }

  const attachmentsDir = session.attachmentsDir;
  ensureDir(attachmentsDir);

  let totalSize = 0;
  const saved = [];

  for (const attachment of attachments) {
    validateAttachmentShape(attachment);
    const ext = extensionFromNameOrMime(attachment.name, attachment.mimeType);
    validateType(ext, attachment.name, config);

    const buffer = attachment.base64
      ? decodeBase64(attachment.base64)
      : Buffer.from(`Remote attachment URL: ${validateAttachmentUrl(attachment.url)}\n`, 'utf8');
    if (buffer.length === 0) throw new Error(`${attachment.name || '附件'} 为空`);
    if (buffer.length > config.maxAttachmentBytes) {
      throw new Error(`${attachment.name || '附件'} 超过单文件大小限制 ${(config.maxAttachmentBytes / 1024 / 1024).toFixed(0)}MB`);
    }

    totalSize += buffer.length;
    if (totalSize > config.maxTotalAttachmentBytes) {
      throw new Error(`附件总大小超过限制 ${(config.maxTotalAttachmentBytes / 1024 / 1024).toFixed(0)}MB`);
    }

    const safeName = sanitizeFilename(attachment.name || `attachment${ext || ''}`, ext);
    const fileName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${safeName}`;
    const filePath = path.resolve(attachmentsDir, fileName);

    if (!isInside(filePath, attachmentsDir)) {
      throw new Error('附件路径非法');
    }

    const mediaType = attachment.base64 ? mediaTypeForImageAttachment(attachment, ext) : '';

    fs.writeFileSync(filePath, buffer);
    saved.push({
      originalName: attachment.name || safeName,
      name: fileName,
      mimeType: attachment.mimeType || '',
      size: buffer.length,
      path: filePath,
      kind: mediaType ? 'image' : 'file',
      mediaType,
      sourceUrl: attachment.url || undefined,
      base64: mediaType ? buffer.toString('base64') : undefined,
    });
  }

  return saved;
}

function buildPromptWithAttachmentRefs(text, savedAttachments) {
  const fileAttachments = savedAttachments.filter(file => file.kind !== 'image');
  if (fileAttachments.length === 0) return text;

  const prompt = text || '请分析这些附件。';
  const refs = fileAttachments.map(file => `- ${file.path}${file.sourceUrl ? ` (source URL: ${file.sourceUrl})` : ''}`).join('\n');
  return `${prompt}\n\n附件已保存到以下本地路径，请按需要读取：\n${refs}`;
}

function buildContentWithAttachments(text, savedAttachments) {
  const imageAttachments = savedAttachments.filter(file => file.kind === 'image');
  if (imageAttachments.length === 0) {
    return buildPromptWithAttachmentRefs(text, savedAttachments);
  }

  const fileAttachments = savedAttachments.filter(file => file.kind !== 'image');
  const content = [{
    type: 'text',
    text: text || '请描述这些图片的内容，并根据图片给出后续建议。',
  }];

  for (const image of imageAttachments) {
    content.push({
      type: 'text',
      text: `图片附件：${image.originalName}（${image.mediaType}，${formatSize(image.size)}）`,
    });
    content.push({
      type: 'image',
      path: image.path,
      source: {
        type: 'base64',
        media_type: image.mediaType,
        data: image.base64,
      },
    });
  }

  if (fileAttachments.length > 0) {
    const refs = fileAttachments.map(file => `- ${file.path}${file.sourceUrl ? ` (source URL: ${file.sourceUrl})` : ''}`).join('\n');
    content.push({
      type: 'text',
      text: `普通附件已保存到以下本地路径，请按需要读取：\n${refs}`,
    });
  }

  return content;
}

function withMessageMeta(content, msg) {
  const meta = {
    openclawAgentId: msg.openclawAgentId,
    agentId: msg.agentId,
    _lincoMeta: msg._lincoMeta,
  };
  if (!meta.openclawAgentId && !meta.agentId && !meta._lincoMeta) return content;
  if (Array.isArray(content)) return [...content, { type: 'meta', ...meta }];
  return [{ type: 'text', text: String(content || '') }, { type: 'meta', ...meta }];
}

function summarizeAttachments(savedAttachments) {
  return savedAttachments.reduce((stats, file) => {
    if (file.kind === 'image') stats.images += 1;
    else stats.files += 1;
    return stats;
  }, { images: 0, files: 0 });
}

function buildAttachmentStatus(stats) {
  const parts = [];
  if (stats.images > 0) parts.push(`${stats.images} 张图片将直接发送给当前 Agent 识别`);
  if (stats.files > 0) parts.push(`${stats.files} 个文件已保存为路径引用`);
  return `📎 已处理 ${stats.images + stats.files} 个附件：${parts.join('，')}`;
}

function mediaTypeForImageAttachment(attachment, ext) {
  const mimeType = normalizeMimeType(attachment.mimeType || '');
  if (SUPPORTED_IMAGE_MEDIA_TYPES.has(mimeType)) return mimeType;
  if (mimeType && mimeType !== 'application/octet-stream') return '';
  return IMAGE_EXTENSION_MEDIA_TYPES.get(ext) || '';
}

function normalizeMimeType(mimeType) {
  return String(mimeType || '').split(';')[0].trim().toLowerCase();
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function validateAttachmentShape(attachment) {
  if (attachment && typeof attachment === 'object' && typeof attachment.url === 'string' && attachment.url && (typeof attachment.base64 !== 'string' || !attachment.base64)) {
    validateAttachmentUrl(attachment.url);
    return;
  }
  if (!attachment || typeof attachment !== 'object') throw new Error('附件格式错误');
  if (typeof attachment.base64 !== 'string' || !attachment.base64) throw new Error(`${attachment.name || '附件'} 缺少内容`);
}

function validateAttachmentUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || ''));
  } catch {
    throw new Error('Invalid attachment URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid attachment URL');
  return parsed.toString();
}

function validateType(ext, name, config) {
  if (!ext) return;
  if (config.allowUnsafeAttachments) return;

  const unsafe = new Set(config.unsafeAttachmentExtensions || []);
  if (unsafe.has(ext.toLowerCase())) {
    throw new Error(`出于安全原因，默认不允许上传 ${ext} 文件: ${name || '附件'}`);
  }
}

function decodeBase64(base64) {
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(base64)) throw new Error('附件不是有效的 base64');
  return Buffer.from(base64, 'base64');
}

function sanitizeFilename(originalName, fallbackExt) {
  const parsed = path.parse(path.basename(originalName || `attachment${fallbackExt || ''}`));
  let base = parsed.name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/[. ]+$/g, '')
    .replace(/^[. ]+/g, '')
    .slice(0, 80);

  if (!base) base = 'attachment';
  if (RESERVED_WINDOWS_NAMES.has(base.toUpperCase())) base = `_${base}`;

  const ext = normalizeExtension(parsed.ext || fallbackExt || '');
  return `${base}${ext}`;
}

function extensionFromNameOrMime(name, mimeType) {
  const ext = normalizeExtension(path.extname(path.basename(name || '')));
  if (ext) return ext;
  return extensionFromMime(mimeType || '');
}

function extensionFromMime(mimeType) {
  switch (mimeType) {
    case 'image/png': return '.png';
    case 'image/jpeg': return '.jpg';
    case 'image/gif': return '.gif';
    case 'image/webp': return '.webp';
    case 'text/plain': return '.txt';
    case 'text/markdown': return '.md';
    case 'text/csv': return '.csv';
    case 'application/sql': return '.sql';
    case 'application/pdf': return '.pdf';
    case 'application/msword': return '.doc';
    case 'application/vnd.ms-excel': return '.xls';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return '.docx';
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': return '.xlsx';
    default: return '';
  }
}

function normalizeExtension(ext) {
  if (!ext) return '';
  return ext.toLowerCase().replace(/[^.a-z0-9_-]/g, '').slice(0, 32);
}

function isInside(filePath, dir) {
  const relative = path.relative(dir, filePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

module.exports = {
  buildContentWithAttachments,
  buildPromptWithAttachmentRefs,
  extensionFromMime,
  handleLegacyImageMessage,
  handleMessageWithAttachments,
  saveAttachments,
};
