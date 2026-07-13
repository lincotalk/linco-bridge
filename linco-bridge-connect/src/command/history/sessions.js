
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_CODEX_CHATS_LIMIT,
  DEFAULT_CODEX_SESSION_SCAN_LIMIT,
  MAX_LOCAL_SESSIONS_LIMIT,
  MAX_REALPATH_CACHE_SIZE,
} = require('./constants');
const {
  encodeClaudeProjectDir,
  isReadableDirectory,
  readJsonFile,
  safeMtimeMs,
  safeReadDir,
  safeReadFilesRecursive,
} = require('../project');
const {
  isCodexSubagentSource,
  normalizeCodexTitle,
  readClaudeSessionSummary,
  readCodexSessionIndex,
  readCodexSessionMeta,
} = require('./readers');
const {
  compareLocalSessions,
  parseTimeMs,
  sqliteTimeMs,
  stringOrEmpty,
} = require('./utils');

let BetterSqlite3 = null;
let betterSqlite3Loaded = false;
const realpathCache = new Map();

function resolveClaudeTranscriptPath(workspace, sessionId, homeDir) {
  const projectDir = encodeClaudeProjectDir(workspace || process.cwd());
  return path.join(homeDir, '.claude', 'projects', projectDir, `${sessionId}.jsonl`);
}

function findClaudeTranscriptPath(workspace, sessionId, homeDir) {
  const expected = resolveClaudeTranscriptPath(workspace, sessionId, homeDir);
  if (fs.existsSync(expected)) return { transcriptPath: expected, expectedPath: expected };

  const projectsDir = path.join(homeDir, '.claude', 'projects');
  const fileName = `${sessionId}.jsonl`;
  for (const entry of safeReadFilesRecursive(projectsDir, { extension: '.jsonl', limit: 10000 })) {
    if (path.basename(entry.fullPath) === fileName) {
      return { transcriptPath: entry.fullPath, expectedPath: expected };
    }
  }
  return { transcriptPath: '', expectedPath: expected };
}

function collectLocalProjectSessions({ agentType, workspace, homeDir, limit }) {
  const sessions = agentType === 'codex'
    ? collectCodexProjectSessions(homeDir, workspace, { limit })
    : collectClaudeProjectSessions(homeDir, workspace, { limit });
  return sessions.sort(compareLocalSessions).slice(0, limit);
}

function findLocalProjectSessionById({ agentType, workspace, homeDir, sessionId }) {
  const targetId = String(sessionId || '').trim();
  if (!targetId) return null;
  if (agentType === 'codex') {
    return findCodexProjectSessionById(homeDir, workspace, targetId) ||
      collectCodexProjectSessions(homeDir, workspace, { scanLimit: 5000 })
        .find(item => item.id === targetId) ||
      null;
  }
  const sessions = collectClaudeProjectSessions(homeDir, workspace);
  return sessions.find(item => item.id === targetId) || null;
}

function resolveCurrentHistoryTranscript({ agentType, workspace, homeDir, sessionId }) {
  if (agentType === 'claude') {
    if (sessionId.includes('/') || sessionId.includes('\\')) {
      return { ok: false, message: '当前 Claude session ID 不合法，无法读取历史。' };
    }
    const { transcriptPath, expectedPath } = findClaudeTranscriptPath(workspace, sessionId, homeDir);
    if (!fs.existsSync(transcriptPath)) {
      return { ok: false, message: `未找到当前 Claude session 的历史文件。\nAgent session: ${sessionId}\n工作目录: ${workspace}\n预期历史文件: ${expectedPath}` };
    }
    return { ok: true, transcriptPath };
  }

  const matched = findLocalProjectSessionById({ agentType, workspace, homeDir, sessionId });
  if (!matched?.transcriptPath) {
    return { ok: false, message: `未找到当前 Codex session 的历史文件。\nAgent session: ${sessionId}` };
  }
  return { ok: true, transcriptPath: matched.transcriptPath };
}

function collectClaudeProjectSessions(homeDir, workspace, options = {}) {
  const projectDir = path.join(homeDir, '.claude', 'projects', encodeClaudeProjectDir(workspace));
  if (!isReadableDirectory(projectDir)) return [];

  let files = safeReadDir(projectDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.jsonl'))
    .map(entry => {
      const fullPath = path.join(projectDir, entry.name);
      return { entry, fullPath, updatedAt: safeMtimeMs(fullPath) };
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  if (options.limit) files = files.slice(0, options.limit);

  return files
    .map(entry => {
      const sessionId = entry.entry.name.replace(/\.jsonl$/u, '');
      const fullPath = entry.fullPath;
      const summary = readClaudeSessionSummary(fullPath);
      return {
        id: sessionId,
        title: summary.title || sessionId,
        firstMessage: summary.firstMessage || '',
        lastMessage: summary.lastMessage || '',
        updatedAt: entry.updatedAt,
        transcriptPath: fullPath,
      };
    });
}

function collectCodexProjectSessions(homeDir, workspace, options = {}) {
  const codexDir = path.join(homeDir, '.codex');
  const indexedSessions = collectCodexProjectSessionsFromState(codexDir, workspace, options);
  if (indexedSessions) return indexedSessions;

  const index = readCodexSessionIndex(path.join(codexDir, 'session_index.jsonl'));
  const scanLimit = options.scanLimit || DEFAULT_CODEX_SESSION_SCAN_LIMIT;
  const resultLimit = Number.isInteger(options.limit)
    ? Math.max(1, Math.min(options.limit, MAX_LOCAL_SESSIONS_LIMIT))
    : 0;
  const workspaceKeys = workspaceMatchKeys(workspace);
  const exactSessions = [];
  const aliasSessions = [];

  for (const file of safeReadFilesRecursive(path.join(codexDir, 'sessions'), { extension: '.jsonl', limit: scanLimit })) {
    const meta = readCodexSessionMeta(file.fullPath);
    if (isCodexSubagentSource('', meta.source)) continue;
    const matchTier = codexWorkspaceMatchTier(meta.cwd, workspaceKeys);
    if (!meta.id || !matchTier) continue;
    const indexed = index.get(meta.id) || {};
    const item = {
      id: meta.id,
      title: normalizeCodexTitle(indexed.threadName) || meta.firstMessage || meta.id,
      firstMessage: meta.firstMessage || '',
      updatedAt: parseTimeMs(indexed.updatedAt) || file.updatedAt,
      transcriptPath: file.fullPath,
    };
    if (matchTier === 'exact') {
      exactSessions.push(item);
      if (resultLimit && exactSessions.length >= resultLimit) break;
    } else if (!resultLimit || aliasSessions.length < resultLimit) {
      aliasSessions.push(item);
    }
  }

  return exactSessions.length > 0 ? exactSessions : aliasSessions;
}

function collectCodexProjectSessionsFromState(codexDir, workspace, options = {}) {
  const Database = loadBetterSqlite3();
  if (!Database) return null;

  const stateDbPath = findLatestCodexStateDb(codexDir);
  if (!stateDbPath) return null;

  let db;
  try {
    db = new Database(stateDbPath, { readonly: true, fileMustExist: true });
    db.pragma('query_only = ON');
    if (!hasSqliteTable(db, 'threads')) return null;

    const limit = Math.max(1, Math.min(options.limit || DEFAULT_LOCAL_SESSIONS_LIMIT, MAX_LOCAL_SESSIONS_LIMIT));
    const cwdCandidates = sqliteCwdCandidates(workspace);
    const queryLimit = limit * Math.max(1, cwdCandidates.length);
    const rows = db.prepare(`
      SELECT id, rollout_path, cwd, title, first_user_message, preview,
             recency_at_ms, updated_at_ms, updated_at
      FROM threads
      WHERE archived = 0 AND cwd IN (${cwdCandidates.map(() => '?').join(', ')})
      ORDER BY recency_at_ms DESC, updated_at_ms DESC, updated_at DESC, id DESC
      LIMIT ?
    `).all(...cwdCandidates, queryLimit);
    const workspaceKeys = workspaceMatchKeys(workspace);
    const exactSessions = [];
    const aliasSessions = [];

    for (const row of rows) {
      const matchTier = codexWorkspaceMatchTier(row.cwd, workspaceKeys);
      if (!matchTier) continue;
      const item = {
        id: stringOrEmpty(row.id),
        title: normalizeCodexTitle(row.title) || normalizeCodexTitle(row.preview) || stringOrEmpty(row.id),
        firstMessage: normalizeCodexTitle(row.first_user_message) || normalizeCodexTitle(row.preview) || '',
        updatedAt: sqliteTimeMs(row.recency_at_ms) || sqliteTimeMs(row.updated_at_ms) || sqliteTimeMs(row.updated_at),
        transcriptPath: stringOrEmpty(row.rollout_path),
      };
      if (matchTier === 'exact') {
        exactSessions.push(item);
        if (exactSessions.length >= limit) break;
      } else if (aliasSessions.length < limit) {
        aliasSessions.push(item);
      }
    }

    const sessions = exactSessions.length > 0 ? exactSessions : aliasSessions;
    const validSessions = sessions.filter(item => item.id).slice(0, limit);
    return validSessions.length > 0 ? validSessions : null;
  } catch {
    return null;
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
        // Ignore close failures; the JSONL fallback remains available.
      }
    }
  }
}

function loadBetterSqlite3() {
  if (betterSqlite3Loaded) return BetterSqlite3;
  betterSqlite3Loaded = true;
  try {
    BetterSqlite3 = require('better-sqlite3');
  } catch {
    BetterSqlite3 = null;
  }
  return BetterSqlite3;
}

function findLatestCodexStateDb(codexDir) {
  if (!isReadableDirectory(codexDir)) return '';
  return safeReadDir(codexDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^state_\d+\.sqlite$/u.test(entry.name))
    .map(entry => {
      const fullPath = path.join(codexDir, entry.name);
      return { fullPath, updatedAt: safeMtimeMs(fullPath) };
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]?.fullPath || '';
}

function hasSqliteTable(db, tableName) {
  try {
    const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
    return !!row;
  } catch {
    return false;
  }
}

function sqliteCwdCandidates(workspace) {
  const resolved = path.resolve(workspace || process.cwd());
  const realpath = safeRealpath(resolved);
  const values = [resolved, realpath];
  if (process.platform === 'win32') {
    values.push(`\\\\?\\${resolved}`);
    if (realpath) values.push(`\\\\?\\${realpath}`);
  }
  return Array.from(new Set(values.filter(Boolean)));
}

function findCodexProjectSessionById(homeDir, workspace, sessionId) {
  const targetId = stringOrEmpty(sessionId);
  if (!targetId) return null;

  const codexDir = path.join(homeDir, '.codex');
  const workspaceKeys = workspaceMatchKeys(workspace);
  const index = readCodexSessionIndex(path.join(codexDir, 'session_index.jsonl'));
  const candidates = findCodexTranscriptCandidates(path.join(codexDir, 'sessions'), targetId);
  let aliasMatch = null;

  for (const file of candidates) {
    const meta = readCodexSessionMeta(file.fullPath);
    const matchTier = codexWorkspaceMatchTier(meta.cwd, workspaceKeys);
    if (meta.id !== targetId || !matchTier) continue;
    const indexed = index.get(meta.id) || {};
    const matched = {
      id: meta.id,
      title: normalizeCodexTitle(indexed.threadName) || meta.firstMessage || meta.id,
      firstMessage: meta.firstMessage || '',
      updatedAt: parseTimeMs(indexed.updatedAt) || file.updatedAt,
      transcriptPath: file.fullPath,
    };
    if (matchTier === 'exact') return matched;
    if (!aliasMatch) aliasMatch = matched;
  }

  return aliasMatch;
}

function findCodexTranscriptCandidates(sessionsDir, sessionId) {
  if (!isReadableDirectory(sessionsDir)) return [];
  const wantedSuffix = `-${sessionId}.jsonl`;
  const wantedExact = `${sessionId}.jsonl`;
  const result = [];
  const stack = [sessionsDir];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of safeReadDir(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (entry.name === wantedExact || entry.name.endsWith(wantedSuffix)) {
        result.push({ fullPath, updatedAt: safeMtimeMs(fullPath) });
      }
    }
  }

  return result.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function collectCodexProjectlessChats(homeDir, options = {}) {
  const codexDir = path.join(homeDir, '.codex');
  const stateFile = path.join(codexDir, '.codex-global-state.json');
  const state = readJsonFile(stateFile);
  const chatIds = collectCodexProjectlessThreadIds(state);
  if (chatIds.length === 0) return [];

  const wanted = new Set(chatIds);
  const index = readCodexSessionIndex(path.join(codexDir, 'session_index.jsonl'));
  const scanLimit = options.scanLimit || 5000;
  const chats = [];

  for (const file of safeReadFilesRecursive(path.join(codexDir, 'sessions'), { extension: '.jsonl', limit: scanLimit })) {
    const meta = readCodexSessionMeta(file.fullPath);
    if (!meta.id || !wanted.has(meta.id)) continue;
    const indexed = index.get(meta.id) || {};
    chats.push({
      id: meta.id,
      title: normalizeCodexTitle(indexed.threadName) || meta.firstMessage || meta.id,
      firstMessage: meta.firstMessage || '',
      workspace: meta.cwd || '',
      updatedAt: parseTimeMs(indexed.updatedAt) || file.updatedAt,
      transcriptPath: file.fullPath,
      source: 'codex-chats',
    });
  }

  const byId = new Map(chats.map(chat => [chat.id, chat]));
  for (const id of chatIds) {
    if (byId.has(id)) continue;
    const indexed = index.get(id) || {};
    if (!indexed.threadName && !indexed.updatedAt) continue;
    byId.set(id, {
      id,
      title: normalizeCodexTitle(indexed.threadName) || id,
      firstMessage: '',
      workspace: '',
      updatedAt: parseTimeMs(indexed.updatedAt) || 0,
      transcriptPath: '',
      source: 'codex-chats',
    });
  }

  const limit = options.limit || DEFAULT_CODEX_CHATS_LIMIT;
  return Array.from(byId.values()).sort(compareLocalSessions).slice(0, limit);
}

function findCodexProjectlessChatById(homeDir, chatId) {
  const targetId = stringOrEmpty(chatId);
  if (!targetId) return null;
  return collectCodexProjectlessChats(homeDir, { limit: 5000, scanLimit: 10000 })
    .find(item => item.id === targetId) || null;
}

function collectCodexProjectlessThreadIds(state) {
  const result = [];
  const seen = new Set();
  const push = value => {
    if (typeof value !== 'string') return;
    const id = value.trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    result.push(id);
  };
  const direct = state?.['projectless-thread-ids'];
  if (Array.isArray(direct)) direct.forEach(push);
  const nested = state?.['electron-persisted-atom-state']?.['projectless-thread-ids'];
  if (Array.isArray(nested)) nested.forEach(push);
  return result;
}

function normalizePathKey(value) {
  if (!value || typeof value !== 'string') return '';
  const resolved = path.resolve(stripWindowsLongPathPrefix(value));
  return (safeRealpath(resolved) || resolved).toLowerCase();
}

function rawPathKey(value) {
  if (!value || typeof value !== 'string') return '';
  return path.resolve(stripWindowsLongPathPrefix(value)).toLowerCase();
}

function workspaceMatchKeys(workspace) {
  return {
    raw: rawPathKey(workspace),
    canonical: normalizePathKey(workspace),
  };
}

function codexWorkspaceMatchTier(candidateWorkspace, workspaceKeys) {
  if (!candidateWorkspace || typeof candidateWorkspace !== 'string') return '';
  if (rawPathKey(candidateWorkspace) === workspaceKeys.raw) return 'exact';
  if (normalizePathKey(candidateWorkspace) === workspaceKeys.canonical) return 'alias';
  return '';
}

function safeRealpath(value) {
  const cacheKey = path.resolve(value);
  if (realpathCache.has(cacheKey)) return realpathCache.get(cacheKey);
  try {
    const realpath = fs.realpathSync.native(value);
    if (realpathCache.size >= MAX_REALPATH_CACHE_SIZE) realpathCache.clear();
    realpathCache.set(cacheKey, realpath);
    return realpath;
  } catch {
    return '';
  }
}

function stripWindowsLongPathPrefix(value) {
  const text = String(value || '');
  if (text.startsWith('\\\\?\\UNC\\')) return `\\\\${text.slice('\\\\?\\UNC\\'.length)}`;
  if (text.startsWith('\\\\?\\')) return text.slice('\\\\?\\'.length);
  return text;
}

module.exports = {
  collectClaudeProjectSessions,
  collectCodexProjectSessions,
  collectCodexProjectlessChats,
  collectLocalProjectSessions,
  findClaudeTranscriptPath,
  findCodexProjectSessionById,
  findCodexProjectlessChatById,
  findLocalProjectSessionById,
  resolveCurrentHistoryTranscript,
  resolveClaudeTranscriptPath,
};
