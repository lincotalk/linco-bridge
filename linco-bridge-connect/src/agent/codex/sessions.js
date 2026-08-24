'use strict';

const {
  extractCodexAssistantFiles,
  extractCodexMentionedUserFiles,
  normalizeCodexUserText,
  sanitizeCodexHistoryAssistantText,
} = require('../../command/history/readers');

const DEFAULT_SOURCE_KINDS = ['cli', 'vscode', 'appServer', 'exec'];

function mapThreadListItem(thread, workspace) {
  const id = stringValue(thread?.id);
  if (!id) return null;
  const title = stringValue(thread?.name)
    || stringValue(thread?.preview)
    || stringValue(thread?.title)
    || id;
  const updatedAt = timestampMs(thread?.recencyAt)
    || timestampMs(thread?.updatedAt)
    || timestampMs(thread?.createdAt)
    || 0;
  const statusType = stringValue(thread?.status?.type).toLowerCase();
  const forkedFromId = stringValue(thread?.forkedFromId || thread?.forked_from_id);
  return {
    id,
    title,
    firstMessage: stringValue(thread?.preview) || title,
    updatedAt,
    workspace: stringValue(thread?.cwd) || workspace,
    running: statusType === 'active',
    ...(forkedFromId ? { forkedFromId } : {}),
    source: 'codex-app-server',
  };
}

function mapTurnsToRounds(turns, options = {}) {
  const rounds = [];
  const includeThinking = options.includeThinking === true;
  const list = Array.isArray(turns) ? turns : [];

  for (let index = 0; index < list.length; index += 1) {
    const turn = list[index];
    const items = Array.isArray(turn?.items) ? turn.items : [];
    let rawUser = '';
    let rawAssistant = '';
    let userTimestamp = null;
    let assistantTimestamp = null;
    const thinkingItems = [];

    for (const item of items) {
      const type = stringValue(item?.type).toLowerCase();
      if (type === 'usermessage' || type === 'user_message') {
        const text = extractItemText(item);
        if (text) rawUser = rawUser ? `${rawUser}\n\n${text}` : text;
        userTimestamp = itemTimestamp(item) || userTimestamp;
        continue;
      }
      if (type === 'agentmessage' || type === 'agent_message' || type === 'message') {
        const phase = stringValue(item?.phase).toLowerCase();
        if (phase && phase !== 'final_answer') {
          if (includeThinking) {
            const progress = sanitizeCodexHistoryAssistantText(extractItemText(item));
            if (progress) {
              thinkingItems.push({
                text: progress,
                mode: 'progress',
                timestamp: itemTimestamp(item),
              });
            }
          }
          continue;
        }
        const text = extractItemText(item);
        if (text) rawAssistant = rawAssistant ? `${rawAssistant}\n\n${text}` : text;
        assistantTimestamp = itemTimestamp(item) || assistantTimestamp;
        continue;
      }
      if (includeThinking && (type.includes('reasoning') || type.includes('thinking'))) {
        const text = extractItemText(item);
        if (text) {
          thinkingItems.push({
            text,
            mode: 'summary',
            timestamp: itemTimestamp(item),
          });
        }
      }
    }

    const enriched = enrichCodexRoundFromRawMessages({
      rawUser,
      rawAssistant,
      userTimestamp,
      assistantTimestamp,
      turnId: stringValue(turn?.id),
      ordinal: rounds.length + 1,
      includeThinking,
      thinkingItems,
    });
    if (enriched) rounds.push(enriched);
  }

  return rounds;
}

function enrichCodexRoundFromRawMessages(input = {}) {
  const rawUser = String(input.rawUser || '');
  const rawAssistant = String(input.rawAssistant || '');
  const user = normalizeCodexUserText(rawUser);
  const userFiles = extractCodexMentionedUserFiles(rawUser);
  const assistant = sanitizeCodexHistoryAssistantText(rawAssistant);
  const assistantFiles = extractCodexAssistantFiles(assistant);
  if (!user && !assistant && userFiles.length === 0 && assistantFiles.length === 0) {
    return null;
  }
  const round = {
    ordinal: Number.isInteger(input.ordinal) && input.ordinal > 0 ? input.ordinal : 1,
    turnId: stringValue(input.turnId),
    user,
    userFiles,
    assistant,
    assistantFiles,
    userTimestamp: input.userTimestamp || null,
    assistantTimestamp: input.assistantTimestamp || null,
  };
  if (input.includeThinking === true) {
    round.thinkingItems = Array.isArray(input.thinkingItems) ? input.thinkingItems : [];
  }
  return round;
}

function buildThreadListParams(workspace, options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0
    ? Math.min(options.limit, 100)
    : 50;
  const cwd = pathCandidates(workspace);
  return {
    limit,
    sortKey: 'recency_at',
    sortDirection: 'desc',
    archived: false,
    useStateDbOnly: true,
    sourceKinds: DEFAULT_SOURCE_KINDS,
    ...(cwd.length === 1 ? { cwd: cwd[0] } : cwd.length > 1 ? { cwd } : {}),
    ...(options.cursor ? { cursor: options.cursor } : {}),
  };
}

function encodeHistoryCursor(sessionId, rpcCursor) {
  return Buffer.from(JSON.stringify({
    v: 1,
    k: 'codexrpc',
    s: sessionId,
    c: rpcCursor,
  }), 'utf8').toString('base64url');
}

function encodeThreadReadCursor(sessionId, turnId) {
  return Buffer.from(JSON.stringify({
    v: 1,
    k: 'codexread',
    s: sessionId,
    t: turnId,
  }), 'utf8').toString('base64url');
}

function decodeHistoryCursor(value, sessionId) {
  const cursor = stringValue(value);
  if (!cursor) return null;
  if (!/^[A-Za-z0-9_-]+$/u.test(cursor)) {
    throw new Error('Codex history cursor is invalid');
  }
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || parsed.v !== 1 || parsed.s !== sessionId) {
      throw new Error('cursor identity mismatch');
    }
    if (parsed.k === 'codexrpc' && typeof parsed.c === 'string' && parsed.c.trim()) {
      return { kind: 'rpc', sessionId, cursor: parsed.c.trim() };
    }
    if (parsed.k === 'codexread' && typeof parsed.t === 'string' && parsed.t.trim()) {
      return { kind: 'read', sessionId, turnId: parsed.t.trim() };
    }
    throw new Error('unsupported cursor kind');
  } catch {
    throw new Error('Codex history cursor is invalid');
  }
}

function buildHistoryPageInfo({ hasMore, nextCursor, snapshotId }) {
  const more = hasMore === true;
  const cursor = more && typeof nextCursor === 'string' && nextCursor.trim()
    ? nextCursor.trim()
    : null;
  return {
    hasMore: more && Boolean(cursor),
    nextCursor: more && cursor ? cursor : null,
    snapshotId: String(snapshotId || '').trim(),
  };
}

function paginateRounds(allRounds, options = {}) {
  const limit = Number(options.limit);
  const decoded = options.decoded || null;
  let endExclusive = allRounds.length;
  if (decoded?.kind === 'read' && decoded.turnId) {
    const index = allRounds.findIndex(round => round.turnId === decoded.turnId);
    endExclusive = index >= 0 ? index : allRounds.length;
  }
  const start = Math.max(0, endExclusive - limit);
  const rounds = allRounds.slice(start, endExclusive);
  const hasMore = start > 0;
  const boundaryTurnId = rounds[0]?.turnId || '';
  return {
    rounds,
    pageInfo: buildHistoryPageInfo({
      hasMore,
      nextCursor: hasMore && boundaryTurnId
        ? encodeThreadReadCursor(options.sessionId, boundaryTurnId)
        : null,
      snapshotId: options.sessionId,
    }),
  };
}

function extractItemText(item) {
  if (!item || typeof item !== 'object') return '';
  if (typeof item.text === 'string' && item.text.trim()) return item.text.trim();
  if (typeof item.message === 'string' && item.message.trim()) return item.message.trim();
  if (typeof item.summary === 'string' && item.summary.trim()) return item.summary.trim();
  if (Array.isArray(item.content)) {
    return item.content.map(part => {
      if (typeof part === 'string') return part;
      if (typeof part?.text === 'string') return part.text;
      if (typeof part?.input_text === 'string') return part.input_text;
      return '';
    }).filter(Boolean).join('\n').trim();
  }
  if (Array.isArray(item.input)) {
    return item.input.map(part => {
      if (typeof part === 'string') return part;
      if (typeof part?.text === 'string') return part.text;
      return '';
    }).filter(Boolean).join('\n').trim();
  }
  return '';
}

function itemTimestamp(item) {
  return timestampMs(item?.timestamp)
    || timestampMs(item?.createdAt)
    || timestampMs(item?.updatedAt)
    || null;
}

function timestampMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string' && value.trim()) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return timestampMs(asNumber);
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function pathCandidates(workspace) {
  const text = String(workspace || '').trim();
  if (!text) return [];
  const resolved = require('path').resolve(text);
  if (process.platform !== 'win32') return [resolved];
  const lower = resolved.toLowerCase();
  return lower === resolved ? [resolved] : [resolved, lower];
}

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

module.exports = {
  DEFAULT_SOURCE_KINDS,
  buildHistoryPageInfo,
  buildThreadListParams,
  decodeHistoryCursor,
  encodeHistoryCursor,
  encodeThreadReadCursor,
  enrichCodexRoundFromRawMessages,
  mapThreadListItem,
  mapTurnsToRounds,
  paginateRounds,
};
