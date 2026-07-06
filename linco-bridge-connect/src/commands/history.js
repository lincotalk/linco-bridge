const fs = require('fs');
const os = require('os');
const path = require('path');
const { StringDecoder } = require('string_decoder');
const { createAgentSessionEntry, saveSessionMetadata } = require('../core/session');
const { sendError, sendSystem } = require('../core/protocol');
const { splitCommandArgs } = require('./args');
const { rejectLockedIdentityChange, sessionIdentityLocked } = require('./agentSelection');
const { buildPcResumeCommand } = require('./pc');
const {
  encodeClaudeProjectDir,
  isReadableDirectory,
  projectAction,
  quoteProjectPath,
  readJsonFile,
  resolveWorkspacePath,
  safeMtimeMs,
  safeReadDir,
  safeReadFilesRecursive,
} = require('./project');

const DEFAULT_LOCAL_SESSIONS_LIMIT = 5;
const MAX_LOCAL_SESSIONS_LIMIT = 50;
const DEFAULT_CODEX_CHATS_LIMIT = 10;
const DEFAULT_CODEX_SESSION_SCAN_LIMIT = 1000;
const SESSION_SUMMARY_SCAN_LIMIT = 80;
const DEFAULT_HISTORY_ROUNDS_LIMIT = 10;
const MAX_HISTORY_ROUNDS_LIMIT = 50;
const MAX_REALPATH_CACHE_SIZE = 4096;
const realpathCache = new Map();
let BetterSqlite3 = null;
let betterSqlite3Loaded = false;

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

function sendSlashCommandResult(ws, command, data = {}) {
  const { send } = require('../core/protocol');
  send(ws, 'slash_command_result', {
    command,
    version: 1,
    data,
  });
}

function handleSessions(rawArg, ws, session, options = {}) {
  const agentType = session.agentType || 'claude';
  if (!['claude', 'codex'].includes(agentType)) {
    sendError(ws, `/sessions 目前只支持 Claude 和 Codex 模式，当前是 ${agentType}。`);
    return;
  }

  const parsed = parseSessionsArgs(rawArg);
  if (!parsed.ok) {
    sendError(ws, parsed.message);
    return;
  }

  const workspace = resolveSlashProjectWorkspace(parsed.projectPath, session.workspace);
  if (!isReadableDirectory(workspace)) {
    sendError(ws, `当前工作目录不可访问: ${workspace}`);
    return;
  }

  const sessions = collectLocalProjectSessions({
    agentType,
    workspace,
    homeDir: options.homeDir || os.homedir(),
    limit: parsed.limit,
  });

  if (sessions.length === 0) {
    sendSlashCommandResult(ws, 'sessions', buildSessionsPayload(agentType, workspace, [], [], parsed.limit));
    return;
  }

  const actions = buildBindActions(sessions, parsed.projectPath ? workspace : '');
  sendSlashCommandResult(ws, 'sessions', buildSessionsPayload(agentType, workspace, sessions, actions, parsed.limit));
}

function handleChats(rawArg, ws, session, options = {}) {
  const agentType = session.agentType || 'claude';
  if (agentType !== 'codex') {
    sendError(ws, `/chats only supports Codex mode. Current mode is ${agentType}.`);
    return;
  }

  const parsed = parseChatsArgs(rawArg);
  if (!parsed.ok) {
    sendError(ws, parsed.message);
    return;
  }

  const chats = collectCodexProjectlessChats(options.homeDir || os.homedir(), { limit: parsed.limit });
  const actions = buildChatBindActions(chats);
  sendSlashCommandResult(ws, 'chats', buildChatsPayload(chats, actions, parsed.limit));
}

function handleBind(rawArg, ws, session, options = {}) {
  const agentType = session.agentType || 'claude';
  if (!['claude', 'codex'].includes(agentType)) {
    sendError(ws, `/bind 目前只支持 Claude 和 Codex 模式，当前是 ${agentType}。`);
    return;
  }

  if (sessionIdentityLocked(session)) {
    rejectLockedIdentityChange(ws);
    return;
  }

  const parsed = parseBindArgs(rawArg);
  if (!parsed.ok) {
    sendError(ws, parsed.message);
    return;
  }

  if (parsed.chatId) {
    if (agentType !== 'codex') {
      sendError(ws, '/bind --chat only supports Codex mode.');
      return;
    }
    const matched = findCodexProjectlessChatById(options.homeDir || os.homedir(), parsed.chatId);
    if (!matched) {
      sendError(ws, `Codex chat not found: ${parsed.chatId}`);
      return;
    }
    const workspace = matched.workspace;
    if (!workspace || !isReadableDirectory(workspace)) {
      sendError(ws, `Codex chat workspace is not accessible: ${workspace || '(empty)'}`);
      return;
    }
    bindMatchedSession(ws, session, matched, workspace, 'Codex chat');
    return;
  }

  const targetId = parsed.sessionId;
  if (!targetId) {
    sendError(ws, '用法：/bind <session-id>。请先使用 /sessions 查看可接入的 PC 会话。');
    return;
  }

  const workspace = resolveSlashProjectWorkspace(parsed.projectPath, session.workspace);
  if (!isReadableDirectory(workspace)) {
    sendError(ws, `当前工作目录不可访问: ${workspace}`);
    return;
  }

  const matched = findLocalProjectSessionById({
    agentType,
    workspace,
    homeDir: options.homeDir || os.homedir(),
    sessionId: targetId,
  });
  if (!matched) {
    sendError(ws, `未找到当前项目下可接入的 ${agentType} session: ${targetId}`);
    return;
  }

  if (!session.agentSessionHistory) session.agentSessionHistory = [];
  for (const entry of session.agentSessionHistory) entry.isActive = false;
  session.workspace = workspace;
  session.agentSessionId = matched.id;
  const existing = session.agentSessionHistory.find(entry => entry.id === matched.id);
  if (existing) {
    existing.isActive = true;
    existing.lastActiveAt = new Date().toISOString();
  } else {
    const entry = createAgentSessionEntry(session, matched.id, matched.firstMessage || matched.title || '');
    entry.isActive = true;
    session.agentSessionHistory.push(entry);
  }
  saveSessionMetadata(session);

  sendSystem(ws, `已接入 PC 会话。\nAgent session: ${matched.id}\n工作目录: ${workspace}`);
}

function bindMatchedSession(ws, session, matched, workspace, label = 'PC session') {
  activateMatchedSession(session, matched, workspace);
  sendSystem(ws, `Bound ${label}.\nAgent session: ${matched.id}\nWorkspace: ${workspace}`);
}

function activateMatchedSession(session, matched, workspace) {
  if (!session.agentSessionHistory) session.agentSessionHistory = [];
  for (const entry of session.agentSessionHistory) entry.isActive = false;
  session.workspace = workspace;
  session.agentSessionId = matched.id;
  const existing = session.agentSessionHistory.find(entry => entry.id === matched.id);
  if (existing) {
    existing.isActive = true;
    existing.lastActiveAt = new Date().toISOString();
  } else {
    const entry = createAgentSessionEntry(session, matched.id, matched.firstMessage || matched.title || '');
    entry.isActive = true;
    session.agentSessionHistory.push(entry);
  }
  saveSessionMetadata(session);
}

function bindExplicitHistorySession(ws, session, input) {
  const agentSessionId = stringOrEmpty(input.agentSessionId);
  if (!agentSessionId) return { ok: true, switched: false };
  const currentAgentSessionId = stringOrEmpty(session.agentSessionId);
  if (currentAgentSessionId && currentAgentSessionId !== agentSessionId && !input.allowSwitch) {
    sendError(
      ws,
      `Cannot reload desktop history into this IM session because it is already bound to Agent session ${currentAgentSessionId}. Create a new IM session for ${agentSessionId}.`
    );
    return { ok: false, switched: false };
  }

  let matched = null;
  if (input.agentType === 'codex') {
    matched = findLocalProjectSessionById({
      agentType: input.agentType,
      workspace: input.workspace,
      homeDir: input.homeDir,
      sessionId: agentSessionId,
    });
  }
  if (!matched) {
    matched = {
      id: agentSessionId,
      title: path.basename(input.transcriptPath || agentSessionId),
      firstMessage: '',
    };
  }
  activateMatchedSession(session, matched, input.workspace);
  return { ok: true, switched: Boolean(currentAgentSessionId && currentAgentSessionId !== agentSessionId) };
}

function handleHistory(rawArg, ws, session, options = {}) {
  const agentType = session.agentType || 'claude';
  if (!['claude', 'codex'].includes(agentType)) {
    sendError(ws, `/history 目前只支持 Claude 和 Codex 模式，当前是 ${agentType}。`);
    return;
  }

  const parsed = parseHistoryArgs(rawArg);
  if (!parsed.ok) {
    sendError(ws, parsed.message);
    return;
  }

  if (parsed.chatId) {
    if (agentType !== 'codex') {
      sendError(ws, '/history --chat only supports Codex mode.');
      return;
    }
    const matched = findCodexProjectlessChatById(options.homeDir || os.homedir(), parsed.chatId);
    if (!matched?.transcriptPath) {
      sendError(ws, `Codex chat history not found: ${parsed.chatId}`);
      return;
    }
    const rounds = parseCodexHistoryRounds(matched.transcriptPath);
    const recent = rounds.slice(-parsed.limit);
    let bindResult = { ok: true, switched: false };
    if (options.bindExplicitHistorySession) {
      bindResult = bindExplicitHistorySession(ws, session, {
        agentType,
        agentSessionId: matched.id,
        workspace: matched.workspace,
        transcriptPath: matched.transcriptPath,
        homeDir: options.homeDir || os.homedir(),
        allowSwitch: options.allowExplicitHistorySessionSwitch === true,
      });
      if (!bindResult.ok) {
        return;
      }
    }
    sendSlashCommandResult(ws, 'history', buildHistoryPayload(agentType, matched.id, parsed.limit, recent, {
      workspace: matched.workspace,
      replaceConversation: options.historyReload === true,
      switchedSession: bindResult.switched,
    }));
    return;
  }

  const agentSessionId = stringOrEmpty(parsed.sessionId || session.agentSessionId);
  if (!agentSessionId) {
    sendError(ws, '当前 IM 会话还没有绑定 Agent Session。请先发送一条普通消息，或使用 /sessions 后 /bind 接入已有 PC 会话。');
    return;
  }

  const workspace = resolveSlashProjectWorkspace(parsed.projectPath, session.workspace);
  if (!isReadableDirectory(workspace)) {
    sendError(ws, `当前工作目录不可访问: ${workspace}`);
    return;
  }

  const resolved = resolveCurrentHistoryTranscript({
    agentType,
    workspace,
    homeDir: options.homeDir || os.homedir(),
    sessionId: agentSessionId,
  });
  if (!resolved.ok) {
    sendError(ws, resolved.message);
    return;
  }

  let bindResult = { ok: true, switched: false };
  if (options.bindExplicitHistorySession && parsed.sessionId) {
    bindResult = bindExplicitHistorySession(ws, session, {
      agentType,
      agentSessionId,
      workspace,
      transcriptPath: resolved.transcriptPath,
      homeDir: options.homeDir || os.homedir(),
      allowSwitch: options.allowExplicitHistorySessionSwitch === true,
    });
    if (!bindResult.ok) {
      return;
    }
  }

  const rounds = agentType === 'codex'
    ? parseCodexHistoryRounds(resolved.transcriptPath)
    : parseClaudeHistoryRounds(resolved.transcriptPath);
  const recent = rounds.slice(-parsed.limit);

  if (recent.length === 0) {
    sendSlashCommandResult(ws, 'history', buildHistoryPayload(agentType, agentSessionId, parsed.limit, [], {
      workspace,
      replaceConversation: options.historyReload === true,
      switchedSession: bindResult.switched,
    }));
    return;
  }

  sendSlashCommandResult(ws, 'history', buildHistoryPayload(agentType, agentSessionId, parsed.limit, recent, {
    workspace,
    replaceConversation: options.historyReload === true,
    switchedSession: bindResult.switched,
  }));
}

function parseSessionsArgs(rawArg) {
  const trimmed = String(rawArg || '').trim();
  if (!trimmed) return { ok: true, limit: DEFAULT_LOCAL_SESSIONS_LIMIT };
  if (trimmed.includes('--project')) return parseProjectSessionsArgs(trimmed);
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, message: '用法：/sessions [数量]，数量范围 1-50，例如 /sessions 10。' };
  }
  const limit = Number(trimmed);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LOCAL_SESSIONS_LIMIT) {
    return { ok: false, message: `用法：/sessions [数量]，数量范围 1-${MAX_LOCAL_SESSIONS_LIMIT}。` };
  }
  return { ok: true, limit };
}

function parseChatsArgs(rawArg) {
  const trimmed = String(rawArg || '').trim();
  if (!trimmed) return { ok: true, limit: DEFAULT_CODEX_CHATS_LIMIT };
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, message: `/chats [limit], limit range is 1-${MAX_LOCAL_SESSIONS_LIMIT}.` };
  }
  const limit = Number(trimmed);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LOCAL_SESSIONS_LIMIT) {
    return { ok: false, message: `/chats [limit], limit range is 1-${MAX_LOCAL_SESSIONS_LIMIT}.` };
  }
  return { ok: true, limit };
}

function parseProjectSessionsArgs(trimmed) {
  const parsed = splitCommandArgs(trimmed);
  if (!parsed.ok) return parsed;

  let projectPath = '';
  let limit = DEFAULT_LOCAL_SESSIONS_LIMIT;
  let sawLimit = false;
  for (let i = 0; i < parsed.args.length; i++) {
    const arg = parsed.args[i];
    if (arg === '--project') {
      const next = parsed.args[++i];
      if (!next) return { ok: false, message: '用法：/sessions --project <项目路径> [数量]。' };
      projectPath = next;
      continue;
    }
    if (arg.startsWith('--project=')) {
      projectPath = arg.slice('--project='.length);
      if (!projectPath) return { ok: false, message: '用法：/sessions --project <项目路径> [数量]。' };
      continue;
    }
    if (/^\d+$/.test(arg) && !sawLimit) {
      limit = Number(arg);
      sawLimit = true;
      continue;
    }
    return { ok: false, message: '用法：/sessions --project <项目路径> [数量]。' };
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LOCAL_SESSIONS_LIMIT) {
    return { ok: false, message: `用法：/sessions --project <项目路径> [数量]，数量范围 1-${MAX_LOCAL_SESSIONS_LIMIT}。` };
  }
  return { ok: true, limit, projectPath };
}

function parseBindArgs(rawArg) {
  const parsed = splitCommandArgs(rawArg);
  if (!parsed.ok) return parsed;
  if (parsed.args.length === 2 && parsed.args[0] === '--chat') {
    return parsed.args[1]
      ? { ok: true, chatId: parsed.args[1] }
      : { ok: false, message: 'Usage: /bind --chat <chat-id>.' };
  }
  if (parsed.args.length === 1 && parsed.args[0].startsWith('--chat=')) {
    const chatId = parsed.args[0].slice('--chat='.length);
    return chatId
      ? { ok: true, chatId }
      : { ok: false, message: 'Usage: /bind --chat <chat-id>.' };
  }

  let projectPath = '';
  let sessionId = '';
  let chatId = '';
  for (let i = 0; i < parsed.args.length; i++) {
    const arg = parsed.args[i];
    if (arg === '--project') {
      const next = parsed.args[++i];
      if (!next) return { ok: false, message: '用法：/bind [--project <项目路径>] <session-id>。' };
      projectPath = next;
      continue;
    }
    if (arg.startsWith('--project=')) {
      projectPath = arg.slice('--project='.length);
      if (!projectPath) return { ok: false, message: '用法：/bind [--project <项目路径>] <session-id>。' };
      continue;
    }
    if (arg === '--chat') {
      const next = parsed.args[++i];
      if (!next) return { ok: false, message: 'Usage: /bind --chat <chat-id>.' };
      chatId = next;
      continue;
    }
    if (arg.startsWith('--chat=')) {
      chatId = arg.slice('--chat='.length);
      if (!chatId) return { ok: false, message: 'Usage: /bind --chat <chat-id>.' };
      continue;
    }
    if (!sessionId) {
      sessionId = arg;
      continue;
    }
    return { ok: false, message: '用法：/bind [--project <项目路径>] <session-id>。' };
  }

  if (chatId) {
    if (projectPath || sessionId) return { ok: false, message: 'Usage: /bind --chat <chat-id>.' };
    return { ok: true, chatId };
  }
  if (!sessionId) return { ok: false, message: '用法：/bind <session-id>。请先使用 /sessions 查看可接入的 PC 会话。' };
  return { ok: true, projectPath, sessionId };
}

function parseHistoryArgs(rawArg) {
  const trimmed = String(rawArg || '').trim();
  if (!trimmed) return { ok: true, limit: DEFAULT_HISTORY_ROUNDS_LIMIT };
  if (trimmed.includes('--chat')) return parseChatHistoryArgs(trimmed);
  if (trimmed.includes('--project') || trimmed.includes('--session')) return parseProjectHistoryArgs(trimmed);
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, message: '用法：/history [数量]，数量范围 1-50，例如 /history 10。' };
  }
  const limit = Number(trimmed);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_HISTORY_ROUNDS_LIMIT) {
    return { ok: false, message: `用法：/history [数量]，数量范围 1-${MAX_HISTORY_ROUNDS_LIMIT}。` };
  }
  return { ok: true, limit };
}

function parseChatHistoryArgs(trimmed) {
  const parsed = splitCommandArgs(trimmed);
  if (!parsed.ok) return parsed;

  let chatId = '';
  let limit = DEFAULT_HISTORY_ROUNDS_LIMIT;
  let sawLimit = false;
  for (let i = 0; i < parsed.args.length; i++) {
    const arg = parsed.args[i];
    if (arg === '--chat') {
      const next = parsed.args[++i];
      if (!next) return { ok: false, message: 'Usage: /history --chat <chat-id> [limit].' };
      chatId = next;
      continue;
    }
    if (arg.startsWith('--chat=')) {
      chatId = arg.slice('--chat='.length);
      if (!chatId) return { ok: false, message: 'Usage: /history --chat <chat-id> [limit].' };
      continue;
    }
    if (/^\d+$/.test(arg) && !sawLimit) {
      limit = Number(arg);
      sawLimit = true;
      continue;
    }
    return { ok: false, message: 'Usage: /history --chat <chat-id> [limit].' };
  }
  if (!chatId) return { ok: false, message: 'Usage: /history --chat <chat-id> [limit].' };
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_HISTORY_ROUNDS_LIMIT) {
    return { ok: false, message: `/history --chat <chat-id> [limit], limit range is 1-${MAX_HISTORY_ROUNDS_LIMIT}.` };
  }
  return { ok: true, chatId, limit };
}

function parseProjectHistoryArgs(trimmed) {
  const parsed = splitCommandArgs(trimmed);
  if (!parsed.ok) return parsed;

  let projectPath = '';
  let sessionId = '';
  let limit = DEFAULT_HISTORY_ROUNDS_LIMIT;
  let sawLimit = false;
  for (let i = 0; i < parsed.args.length; i++) {
    const arg = parsed.args[i];
    if (arg === '--project') {
      const next = parsed.args[++i];
      if (!next) return { ok: false, message: '用法：/history --project <项目路径> --session <session-id> [数量]。' };
      projectPath = next;
      continue;
    }
    if (arg.startsWith('--project=')) {
      projectPath = arg.slice('--project='.length);
      if (!projectPath) return { ok: false, message: '用法：/history --project <项目路径> --session <session-id> [数量]。' };
      continue;
    }
    if (arg === '--session') {
      const next = parsed.args[++i];
      if (!next) return { ok: false, message: '用法：/history --project <项目路径> --session <session-id> [数量]。' };
      sessionId = next;
      continue;
    }
    if (arg.startsWith('--session=')) {
      sessionId = arg.slice('--session='.length);
      if (!sessionId) return { ok: false, message: '用法：/history --project <项目路径> --session <session-id> [数量]。' };
      continue;
    }
    if (/^\d+$/.test(arg) && !sawLimit) {
      limit = Number(arg);
      sawLimit = true;
      continue;
    }
    return { ok: false, message: '用法：/history --project <项目路径> --session <session-id> [数量]。' };
  }
  if (!projectPath || !sessionId) {
    return { ok: false, message: '浏览指定历史时需要同时提供 --project 和 --session。' };
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_HISTORY_ROUNDS_LIMIT) {
    return { ok: false, message: `用法：/history --project <项目路径> --session <session-id> [数量]，数量范围 1-${MAX_HISTORY_ROUNDS_LIMIT}。` };
  }
  return { ok: true, limit, projectPath, sessionId };
}

function resolveSlashProjectWorkspace(projectPath, currentWorkspace) {
  if (!projectPath) return path.resolve(currentWorkspace || process.cwd());
  return resolveWorkspacePath(projectPath, currentWorkspace);
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
  return value.split(/\n\s*系统提示：用户正在要求发送或获取文件\/图片。/u)[0].trim();
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

function formatLocalProjectSessions(agentType, workspace, sessions, requestedLimit) {
  const lines = sessions.map((item, index) => {
    const command = buildPcResumeCommand(agentType, workspace, item.id);
    const title = truncateText(item.title || item.firstMessage || item.id, 80);
    return [
      `${index + 1}. ${title}`,
      `   ID: ${item.id}`,
      `   更新时间: ${formatDateTime(item.updatedAt)}`,
      `   恢复: ${command.text}`,
    ].join('\n');
  });
  return `当前工作目录最近 ${sessions.length} 个 ${agentType} session（请求 ${requestedLimit} 个）：\n${workspace}\n\n${lines.join('\n\n')}`;
}

function buildSessionsPayload(agentType, workspace, sessions, actions, requestedLimit) {
  return {
    version: 1,
    agentType,
    workspace,
    requestedLimit,
    returnedCount: sessions.length,
    items: sessions.map((item, index) => {
      const resumeCommand = buildPcResumeCommand(agentType, workspace, item.id);
      return {
        index: index + 1,
        id: item.id,
        title: item.title || item.firstMessage || item.id,
        firstMessage: item.firstMessage || '',
        lastMessage: item.lastMessage || '',
        updatedAt: item.updatedAt || 0,
        updatedAtText: formatDateTime(item.updatedAt),
        transcriptPath: item.transcriptPath || '',
        bindCommand: actions[index]?.command || `/bind ${quoteProjectPath(item.id)}`,
        resumeCommand,
      };
    }),
  };
}

function buildChatsPayload(chats, actions, requestedLimit) {
  return {
    version: 1,
    agentType: 'codex',
    requestedLimit,
    returnedCount: chats.length,
    items: chats.map((item, index) => ({
      index: index + 1,
      id: item.id,
      title: item.title || item.firstMessage || item.id,
      firstMessage: item.firstMessage || '',
      workspace: item.workspace || '',
      updatedAt: item.updatedAt || 0,
      updatedAtText: formatDateTime(item.updatedAt),
      transcriptPath: item.transcriptPath || '',
      source: item.source || 'codex-chats',
      historyCommand: `/history --chat ${quoteProjectPath(item.id)}`,
      bindCommand: actions[index]?.command || `/bind --chat ${quoteProjectPath(item.id)}`,
      resumeCommand: item.workspace ? buildPcResumeCommand('codex', item.workspace, item.id) : null,
    })),
  };
}

function formatHistoryRounds(agentType, sessionId, rounds, requestedLimit) {
  const lines = rounds.map((round, index) => {
    const user = round.user || '(无用户输入)';
    const assistant = round.assistant || '(无最终输出)';
    return [
      `${index + 1}. User`,
      user,
      '',
      'Assistant',
      assistant,
    ].join('\n');
  });
  return `当前 ${agentType} session 最近 ${rounds.length} 轮聊天（请求 ${requestedLimit} 轮）：\nAgent session: ${sessionId}\n\n${lines.join('\n\n')}`;
}

function buildHistoryPayload(agentType, sessionId, requestedLimit, rounds, options = {}) {
  return {
    version: 1,
    agentType,
    agentSessionId: sessionId,
    workspace: options.workspace || undefined,
    replaceConversation: options.replaceConversation === true,
    switchedSession: options.switchedSession === true,
    requestedLimit,
    returnedRounds: rounds.length,
    rounds: rounds.map((round, index) => ({
      index: index + 1,
      timestamp: round.userTimestamp || round.assistantTimestamp || null,
      timestampMs: timestampToMs(round.userTimestamp || round.assistantTimestamp),
      user: {
        text: round.user || '',
        timestamp: round.userTimestamp || null,
        timestampMs: timestampToMs(round.userTimestamp),
      },
      assistant: {
        text: round.assistant || '',
        missing: !round.assistant,
        timestamp: round.assistantTimestamp || null,
        timestampMs: timestampToMs(round.assistantTimestamp),
      },
    })),
  };
}

function extractHistoryTimestamp(item) {
  return item?.timestamp ||
    item?.created_at ||
    item?.createdAt ||
    item?.ts ||
    item?.payload?.timestamp ||
    item?.payload?.created_at ||
    item?.payload?.createdAt ||
    item?.payload?.ts ||
    null;
}

function timestampToMs(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    return Number.isFinite(numeric) ? numeric : null;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildBindActions(sessions, workspace = '') {
  return sessions.map((item, index) => {
    const command = workspace
      ? `/bind --project ${quoteProjectPath(workspace)} ${quoteProjectPath(item.id)}`
      : `/bind ${quoteProjectPath(item.id)}`;
    return projectAction(`Bind session ${index + 1}`, command, {
      action: 'bind',
      agentSessionId: item.id,
      sessionId: item.id,
      path: workspace || undefined,
    });
  });
}

function buildChatBindActions(chats) {
  return chats.map((item, index) => projectAction(`Bind chat ${index + 1}`, `/bind --chat ${quoteProjectPath(item.id)}`, {
    action: 'bind',
    agentSessionId: item.id,
    sessionId: item.id,
    chatId: item.id,
    path: item.workspace || undefined,
  }));
}

function compareLocalSessions(a, b) {
  return (b.updatedAt || 0) - (a.updatedAt || 0);
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

function parseTimeMs(value) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function sqliteTimeMs(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return parseTimeMs(value);
  if (value > 100000000000) return value;
  if (value > 100000000) return value * 1000;
  return 0;
}

function formatDateTime(value) {
  const ms = typeof value === 'number' ? value : parseTimeMs(value);
  if (!ms) return '-';
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function truncateText(value, maxLength) {
  const text = stringOrEmpty(value).replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text || '(无标题)';
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function stringOrEmpty(value) {
  return typeof value === 'string' ? value.trim() : '';
}

module.exports = {
  handleSessions,
  handleChats,
  handleBind,
  handleHistory,
  parseSessionsArgs,
  parseHistoryArgs,
  parseClaudeHistoryRounds,
  parseCodexHistoryRounds,
  collectClaudeProjectSessions,
  collectCodexProjectSessions,
  findCodexProjectSessionById,
  collectCodexProjectlessChats,
  collectLocalProjectSessions,
};
