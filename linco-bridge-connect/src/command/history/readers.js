
const fs = require('fs');
const path = require('path');
const { StringDecoder } = require('string_decoder');
const { _internal: agentPromptInternals } = require('../../core/agentPrompt');
const { candidatePathsFromMarkdownLinks, mimeFromFilename } = require('../../core/fileReferences');
const { SESSION_SUMMARY_SCAN_LIMIT } = require('./constants');
const { sanitizeCodexHostDirectives } = require('../../agent/codex/hostDirectives');
const {
  extractHistoryTimestamp,
  stringOrEmpty,
} = require('./utils');

const INTERNAL_HINT_PATTERN = new RegExp(
  `\\s*(?:${escapeRegExp(agentPromptInternals.BRIDGE_INPUT_HINT_MARKER)}|System note: The user is asking to send or deliver a file\\/image\\.|系统提示：用户正在要求发送或获取文件\\/图片。)`,
  'u'
);

function readClaudeSessionSummary(filePath) {
  const result = { firstMessage: '', lastMessage: '', title: '' };
  readJsonlRecordsUntil(filePath, SESSION_SUMMARY_SCAN_LIMIT, item => {
    if (item?.type === 'user') {
      const text = extractTextFromMessageContent(item.message?.content || item.content);
      if (text) {
        if (!result.firstMessage) result.firstMessage = text;
        result.lastMessage = text;
        return false;
      }
    }
    if (item?.type === 'last-prompt' && typeof item.lastPrompt === 'string' && item.lastPrompt.trim()) {
      result.lastMessage = item.lastPrompt.trim();
    }
    return true;
  });
  result.title = result.firstMessage || result.lastMessage;
  return result;
}

function isCodexSubagentSource(threadSource, source) {
  if (stringOrEmpty(threadSource).trim().toLowerCase() === 'subagent') return true;
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    return Object.prototype.hasOwnProperty.call(source, 'subagent');
  }
  const text = stringOrEmpty(source).trim();
  if (!text) return false;
  try {
    const parsed = JSON.parse(text);
    return !!parsed && typeof parsed === 'object' &&
      Object.prototype.hasOwnProperty.call(parsed, 'subagent');
  } catch {
    return false;
  }
}

function readCodexSessionMeta(filePath) {
  const result = { id: '', cwd: '', firstMessage: '', source: undefined };
  let fallbackFirstMessage = '';
  readJsonlRecordsUntil(filePath, SESSION_SUMMARY_SCAN_LIMIT, item => {
    if (item?.type === 'session_meta') {
      result.id = stringOrEmpty(item.payload?.id || item.id) || result.id;
      result.cwd = stringOrEmpty(item.payload?.cwd || item.cwd) || result.cwd;
      if (Object.prototype.hasOwnProperty.call(item.payload || {}, 'source')) {
        result.source = item.payload.source;
      }
    }

    if (!result.firstMessage) {
      result.firstMessage = extractCodexEventUserText(item);
    }
    if (!fallbackFirstMessage) {
      fallbackFirstMessage = extractCodexUserText(item);
    }
    return !(result.id && result.cwd && result.firstMessage);
  });
  result.firstMessage = result.firstMessage || fallbackFirstMessage;
  return result;
}

function readCodexSessionIndex(filePath) {
  const index = new Map();
  for (const item of readJsonlRecords(filePath, 5000)) {
    const id = stringOrEmpty(item?.id);
    if (!id) continue;
    index.set(id, {
      threadName: stringOrEmpty(item.thread_name || item.threadName),
      updatedAt: stringOrEmpty(item.updated_at || item.updatedAt),
    });
  }
  return index;
}

function readJsonlRecords(filePath, maxRecords = 100) {
  const records = [];
  readJsonlRecordsUntil(filePath, maxRecords, item => {
    records.push(item);
    return records.length < maxRecords;
  });
  return records;
}

function readJsonlRecordsUntil(filePath, maxRecords = 100, visitor = () => true) {
  if (!Number.isFinite(maxRecords) || maxRecords <= 0) return;
  const limit = Math.floor(maxRecords);
  const buffer = Buffer.allocUnsafe(64 * 1024);
  const decoder = new StringDecoder('utf8');
  let fd;
  let pending = '';
  let records = 0;

  try {
    fd = fs.openSync(filePath, 'r');
    while (records < limit) {
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead <= 0) break;
      const text = pending + decoder.write(buffer.subarray(0, bytesRead));
      const lines = text.split('\n');
      pending = lines.pop() || '';
      if (!visitJsonlLines(lines, visitor, () => records++, () => records >= limit)) return;
    }
    const tail = pending + decoder.end();
    if (tail && records < limit) {
      visitJsonlLines([tail], visitor, () => records++, () => records >= limit);
    }
  } catch {
    return;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // Ignore close failures while reading local history.
      }
    }
  }
}

function visitJsonlLines(lines, visitor, countRecord, shouldStop) {
  for (const rawLine of lines) {
    const trimmed = String(rawLine || '').replace(/\r$/u, '').trim();
    if (!trimmed) continue;
    try {
      const item = JSON.parse(trimmed);
      countRecord();
      if (visitor(item) === false || shouldStop()) return false;
    } catch {
      // Ignore malformed transcript lines.
    }
  }
  return true;
}

function extractCodexUserText(item) {
  if (item?.type === 'response_item' && item.payload?.type === 'message' && item.payload?.role === 'user') {
    return normalizeCodexUserText(extractTextFromMessageContent(item.payload.content));
  }
  if (item?.type === 'message' && item.role === 'user') {
    return normalizeCodexUserText(extractTextFromMessageContent(item.content));
  }
  return '';
}

function extractCodexEventUserText(item) {
  if (item?.type !== 'event_msg' || item.payload?.type !== 'user_message') return '';
  return normalizeCodexUserText(item.payload.message);
}

function normalizeCodexUserText(text) {
  const value = stripCodexFileReferenceHint(unwrapCodexUserRequest(stringOrEmpty(text)));
  if (!value) return '';
  if (isCodexSyntheticUserContext(value)) return '';
  return value;
}

function unwrapCodexUserRequest(text) {
  const value = stringOrEmpty(text);
  if (!value) return '';
  const marker = value.match(/^##\s+My request for Codex:\s*$/im);
  if (!marker || marker.index === undefined) return value;
  const request = value.slice(marker.index + marker[0].length).trim();
  return request || value;
}

function stripCodexFileReferenceHint(text) {
  const value = stringOrEmpty(text);
  if (!value) return '';
  return value.split(INTERNAL_HINT_PATTERN)[0].trim();
}

function normalizeCodexTitle(text) {
  return normalizeCodexUserText(text);
}

function isCodexSyntheticUserContext(text) {
  return /^<environment_context>\s*[\s\S]*<\/environment_context>$/u.test(String(text || '').trim());
}

function extractTextFromMessageContent(content) {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  const parts = [];
  for (const part of content) {
    if (typeof part === 'string') {
      parts.push(part);
    } else if (typeof part?.text === 'string') {
      parts.push(part.text);
    } else if (typeof part?.content === 'string') {
      parts.push(part.content);
    } else if (typeof part?.input_text === 'string') {
      parts.push(part.input_text);
    }
  }
  return parts.join(' ').trim();
}

function parseClaudeHistoryRounds(filePath) {
  const rounds = [];
  let current = null;

  for (const item of readJsonlRecords(filePath, Number.MAX_SAFE_INTEGER)) {
    if (isClaudeActualUserRecord(item)) {
      const userPayload = extractClaudeUserPayload(item);
      current = {
        ordinal: rounds.length + 1,
        user: userPayload.text,
        userFiles: userPayload.files,
        assistant: '',
        assistantFiles: [],
        userTimestamp: extractHistoryTimestamp(item),
      };
      if (userPayload.text || userPayload.files.length > 0) rounds.push(current);
      continue;
    }

    if (!current || !isClaudeAssistantRecord(item)) continue;
    const content = item?.message?.content;
    const text = extractClaudeAssistantText(item);
    const files = extractClaudeContentFiles(content);
    if (text) {
      current.assistant = text;
      current.assistantTimestamp = extractHistoryTimestamp(item);
    }
    if (files.length > 0) {
      current.assistantFiles = files;
    }
  }

  return rounds.filter(round => round.user || round.assistant || round.userFiles?.length || round.assistantFiles?.length);
}

function isClaudeActualUserRecord(item) {
  if (item?.type !== 'user' || item.message?.role !== 'user') return false;
  if (item.toolUseResult || item.sourceToolAssistantUUID) return false;
  const content = item.message?.content ?? item.content;
  if (Array.isArray(content) && content.some(block => block?.type === 'tool_result')) return false;
  const payload = extractClaudeUserPayload(item);
  return !!payload.text || payload.files.length > 0;
}

function extractClaudeContentFiles(content) {
  if (!Array.isArray(content)) return [];
  const files = [];
  let imageIndex = 0;

  for (const block of content) {
    if (block?.type === 'image' && block.source?.type === 'base64') {
      imageIndex += 1;
      const mimeType = stringOrEmpty(block.source.media_type) || 'image/png';
      const base64 = stringOrEmpty(block.source.data);
      if (!base64) continue;
      files.push({
        name: `image-${imageIndex}.${mimeType.includes('jpeg') ? 'jpg' : 'png'}`,
        mimeType,
        base64,
      });
      continue;
    }

    if (block?.type === 'document' && block.source?.type === 'base64') {
      const mimeType = stringOrEmpty(block.source.media_type) || 'application/octet-stream';
      const base64 = stringOrEmpty(block.source.data);
      if (!base64) continue;
      files.push({
        name: stringOrEmpty(block.name) || 'document',
        mimeType,
        base64,
      });
    }
  }

  return files;
}

function extractClaudeUserPayload(item) {
  const content = item?.message?.content ?? item?.content;
  if (typeof content === 'string') {
    return { text: content.trim(), files: [] };
  }
  if (!Array.isArray(content)) {
    return { text: '', files: [] };
  }
  const text = content
    .filter(block => block?.type === 'text')
    .map(block => block.text || '')
    .join('\n')
    .trim();
  return {
    text,
    files: extractClaudeContentFiles(content),
  };
}

function extractClaudeUserPrompt(item) {
  return extractClaudeUserPayload(item).text;
}

function isClaudeAssistantRecord(item) {
  return item?.type === 'assistant' && item.message?.role === 'assistant';
}

function extractClaudeAssistantText(item) {
  const content = item?.message?.content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(block => block?.type === 'text' && block.text)
    .map(block => block.text)
    .join('\n')
    .trim();
}

function readLocalHistoryFileAttachment(filePath, maxBytes = 4 * 1024 * 1024) {
  try {
    const resolved = path.resolve(String(filePath || '').trim());
    const stat = fs.statSync(resolved);
    if (!stat.isFile() || stat.size <= 0 || stat.size > maxBytes) return null;
    const name = path.basename(resolved);
    return {
      name,
      mimeType: mimeFromFilename(name),
      base64: fs.readFileSync(resolved).toString('base64'),
    };
  } catch {
    return null;
  }
}

function extractCodexMentionedUserFiles(message) {
  const text = stringOrEmpty(message);
  if (!text.includes('# Files mentioned by the user:')) return [];

  const files = [];
  for (const line of text.split(/\r\n|\n|\r/)) {
    const match = line.match(/^##\s+([^:]+):\s+(.+)$/);
    if (!match) continue;
    const label = match[1].trim();
    const filePath = match[2].trim();
    const attachment = readLocalHistoryFileAttachment(filePath);
    if (attachment) {
      files.push({ ...attachment, name: label || attachment.name });
    }
  }
  return files;
}

function extractCodexAssistantFiles(text) {
  const files = [];
  const seen = new Set();
  for (const filePath of candidatePathsFromMarkdownLinks(text)) {
    const resolved = path.resolve(filePath);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    const attachment = readLocalHistoryFileAttachment(resolved);
    if (attachment) files.push(attachment);
  }
  return files;
}

function parseCodexHistoryRounds(filePath) {
  const rounds = [];
  let current = null;

  for (const item of readJsonlRecords(filePath, Number.MAX_SAFE_INTEGER)) {
    const payload = item?.payload || {};
    if (item?.type !== 'event_msg') continue;

    if (payload.type === 'user_message') {
      const text = normalizeCodexUserText(payload.message);
      const userFiles = extractCodexMentionedUserFiles(payload.message);
      if (!text && userFiles.length === 0) continue;
      current = {
        ordinal: rounds.length + 1,
        user: text,
        userFiles,
        assistant: '',
        assistantFiles: [],
        userTimestamp: extractHistoryTimestamp(item),
      };
      rounds.push(current);
      continue;
    }

    if (!current) continue;
    if (payload.type === 'agent_message' && payload.phase === 'final_answer') {
      const text = sanitizeCodexHistoryAssistantText(payload.message);
      const assistantFiles = extractCodexAssistantFiles(text);
      if (text) {
        current.assistant = text;
        current.assistantTimestamp = extractHistoryTimestamp(item);
      }
      if (assistantFiles.length > 0) {
        current.assistantFiles = assistantFiles;
      }
    }
  }

  return rounds.filter(round =>
    round.user ||
    round.assistant ||
    round.userFiles?.length ||
    round.assistantFiles?.length,
  );
}

function sanitizeCodexHistoryAssistantText(value) {
  return sanitizeCodexHostDirectives(stringOrEmpty(value));
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  extractClaudeContentFiles,
  extractCodexAssistantFiles,
  extractCodexMentionedUserFiles,
  extractTextFromMessageContent,
  isCodexSubagentSource,
  normalizeCodexTitle,
  parseClaudeHistoryRounds,
  parseCodexHistoryRounds,
  readClaudeSessionSummary,
  readCodexSessionIndex,
  readCodexSessionMeta,
  readJsonlRecords,
};
