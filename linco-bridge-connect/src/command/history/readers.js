
const fs = require('fs');
const { StringDecoder } = require('string_decoder');
const { _internal: agentPromptInternals } = require('../../core/agentPrompt');
const { SESSION_SUMMARY_SCAN_LIMIT } = require('./constants');
const {
  extractHistoryTimestamp,
  stringOrEmpty,
} = require('./utils');

const INTERNAL_HINT_PATTERN = new RegExp(
  `\\n\\s*(?:${escapeRegExp(agentPromptInternals.BRIDGE_INPUT_HINT_MARKER)}|System note: The user is asking to send or deliver a file\\/image\\.|系统提示：用户正在要求发送或获取文件\\/图片。)`,
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

function readCodexSessionMeta(filePath) {
  const result = { id: '', cwd: '', firstMessage: '' };
  let fallbackFirstMessage = '';
  readJsonlRecordsUntil(filePath, SESSION_SUMMARY_SCAN_LIMIT, item => {
    if (item?.type === 'session_meta') {
      result.id = stringOrEmpty(item.payload?.id || item.id) || result.id;
      result.cwd = stringOrEmpty(item.payload?.cwd || item.cwd) || result.cwd;
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
      current = {
        user: extractClaudeUserPrompt(item),
        assistant: '',
        userTimestamp: extractHistoryTimestamp(item),
      };
      if (current.user) rounds.push(current);
      continue;
    }

    if (!current || !isClaudeAssistantRecord(item)) continue;
    const text = extractClaudeAssistantText(item);
    if (text) {
      current.assistant = text;
      current.assistantTimestamp = extractHistoryTimestamp(item);
    }
  }

  return rounds.filter(round => round.user || round.assistant);
}

function isClaudeActualUserRecord(item) {
  if (item?.type !== 'user' || item.message?.role !== 'user') return false;
  if (item.toolUseResult || item.sourceToolAssistantUUID) return false;
  const content = item.message?.content ?? item.content;
  if (Array.isArray(content) && content.some(block => block?.type === 'tool_result')) return false;
  return !!extractClaudeUserPrompt(item);
}

function extractClaudeUserPrompt(item) {
  const content = item?.message?.content ?? item?.content;
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .filter(block => block?.type === 'text')
    .map(block => block.text || '')
    .join('\n')
    .trim();
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

function parseCodexHistoryRounds(filePath) {
  const rounds = [];
  let current = null;

  for (const item of readJsonlRecords(filePath, Number.MAX_SAFE_INTEGER)) {
    const payload = item?.payload || {};
    if (item?.type !== 'event_msg') continue;

    if (payload.type === 'user_message') {
      const text = normalizeCodexUserText(payload.message);
      if (!text) continue;
      current = {
        user: text,
        assistant: '',
        userTimestamp: extractHistoryTimestamp(item),
      };
      rounds.push(current);
      continue;
    }

    if (!current) continue;
    if (payload.type === 'agent_message' && payload.phase === 'final_answer') {
      const text = sanitizeCodexHistoryAssistantText(payload.message);
      if (text) {
        current.assistant = text;
        current.assistantTimestamp = extractHistoryTimestamp(item);
      }
    }
  }

  return rounds.filter(round => round.user || round.assistant);
}

function sanitizeCodexHistoryAssistantText(value) {
  const text = stringOrEmpty(value);
  if (!text) return '';

  const lines = text.split(/\r\n|\n|\r/);
  let inFence = false;
  const kept = [];

  for (const line of lines) {
    if (!inFence && isCodexHostDirectiveLine(line)) {
      continue;
    }
    kept.push(line);
    if (isMarkdownFenceLine(line)) {
      inFence = !inFence;
    }
  }

  return kept.join('\n').trim();
}

function isCodexHostDirectiveLine(line) {
  return /^[ \t]{0,3}::(?:git-stage|git-commit|git-push|git-create-branch|git-create-pr|code-comment)\{.*\}[ \t]*$/.test(line);
}

function isMarkdownFenceLine(line) {
  return /^[ \t]{0,3}(```+|~~~+)/.test(line);
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  extractTextFromMessageContent,
  normalizeCodexTitle,
  parseClaudeHistoryRounds,
  parseCodexHistoryRounds,
  readClaudeSessionSummary,
  readCodexSessionIndex,
  readCodexSessionMeta,
  readJsonlRecords,
};
