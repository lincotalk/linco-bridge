const { sendError, sendSystem } = require('../core/protocol');
const { handleRemoveAccount, parseRemoveAccountArgs } = require('./account');
const {
  buildAgentPickerPayload,
  buildProfilePickerPayload,
  formatOpenClawAgentChoice,
  handleAgent,
  handleProfile,
  listOpenClawAgentsFromGateway,
  parseAgentArgs,
  parseHermesProfileListOutput,
  parseOpenClawAgentListOutput,
  parseProfileArgs,
  resolveWindowsShimCommand,
  validateHermesProfileName,
} = require('./agentSelection');
const { handleApprove } = require('./approve');
const { buildHelpPayload } = require('./help');
const {
  collectClaudeProjectSessions,
  collectCodexProjectSessions,
  collectCodexProjectlessChats,
  collectLocalProjectSessions,
  findCodexProjectSessionById,
  handleBind,
  handleChats,
  handleHistory,
  handleSessions,
  parseClaudeHistoryRounds,
  parseCodexHistoryRounds,
  parseHistoryArgs,
  parseSessionsArgs,
} = require('./history');
const {
  agentRunner,
  completeLocalCommand,
  completeMaybeAsyncLocalCommand,
  sendProviderWorkspaceNotice,
  sendSlashCommandResult,
  usesProviderManagedWorkspace,
} = require('./common');
const { handleGet } = require('./fileGet');
const {
  handleCompactCommand,
  handleHistoryReload,
  handleReload,
  handleUpdateCommand,
} = require('./lifecycle');
const { currentModel, parseModelArgs, validateModelName } = require('./model');
const { buildPcResumeCommand, shellQuote } = require('./pc');
const { handlePc } = require('./pcCommand');
const {
  encodeClaudeProjectDir,
  handleCd,
  handleProject,
  isSelectableProjectDirectory,
  knownProjectCandidates,
} = require('./project');
const { parseReasoningArgs, validateReasoningEffort } = require('./reasoning');
const { isGetModelsAndReasonsCommand } = require('./settings');
const {
  handleSettingsCommand,
  handleSettingsListCommand,
} = require('./settingsCommand');
const {
  handleSessionId,
  handleUsage,
  sendBaseInfo,
  sendStatus,
} = require('./status');

function isBridgeControlCommand(text) {
  return isGetModelsAndReasonsCommand(text);
}

function handleSlashCommand(text, ws, session, config) {
  const trimmed = text.trim();
  if (isGetModelsAndReasonsCommand(trimmed)) {
    return handleSettingsListCommand(ws, session, config);
  }

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const rawArg = trimmed.slice(parts[0].length).trim();

  switch (cmd) {
    case '/help':
      sendSlashCommandResult(ws, 'help', buildHelpPayload(session));
      return completeLocalCommand(ws, session);

    case '/commands':
      sendError(ws, '本地命令 /commands 已移除，请使用 /help。');
      return completeLocalCommand(ws, session);

    case '/status':
      sendStatus(ws, session, config);
      return completeLocalCommand(ws, session);

    case '/session':
      handleSessionId(ws, session);
      return completeLocalCommand(ws, session);

    case '/pwd':
      if (usesProviderManagedWorkspace(session)) {
        sendProviderWorkspaceNotice(ws, session);
        return completeLocalCommand(ws, session);
      }
      sendSystem(ws, `📂 ${session.workspace}`);
      return completeLocalCommand(ws, session);

    case '/cd':
      if (usesProviderManagedWorkspace(session)) {
        sendProviderWorkspaceNotice(ws, session);
        return completeLocalCommand(ws, session);
      }
      handleCd(rawArg, ws, session);
      return completeLocalCommand(ws, session);

    case '/project':
      if (usesProviderManagedWorkspace(session)) {
        sendProviderWorkspaceNotice(ws, session);
        return completeLocalCommand(ws, session);
      }
      handleProject(rawArg, ws, session, config);
      return completeLocalCommand(ws, session);

    case '/sessions':
      handleSessions(rawArg, ws, session, { homeDir: config?.homeDir });
      return completeLocalCommand(ws, session);

    case '/chats':
      handleChats(rawArg, ws, session, { homeDir: config?.homeDir });
      return completeLocalCommand(ws, session);

    case '/bind':
      handleBind(rawArg, ws, session, { homeDir: config?.homeDir });
      return completeLocalCommand(ws, session);

    case '/agent':
      completeMaybeAsyncLocalCommand(handleAgent(rawArg, ws, session, config), ws, session);
      return true;

    case '/profile':
      completeMaybeAsyncLocalCommand(handleProfile(rawArg, ws, session, config), ws, session);
      return true;

    case '/stop':
      agentRunner().stopAgentProcess(session, { clearAgentSession: false });
      sendSystem(ws, '⏹️ 已停止当前 Agent 进程，下次消息会尝试恢复当前会话。');
      return completeLocalCommand(ws, session);

    case '/reload':
      handleReload(ws, session, config);
      return true;

    case '/update':
    case '/upgrade':
      handleUpdateCommand(rawArg, ws, session, config);
      return true;

    case '/remove-account':
    case '/delete-account':
      handleRemoveAccount(rawArg, ws, session, config);
      return completeLocalCommand(ws, session);

    case '/refresh':
      sendError(ws, '本地命令 /refresh 已移除，请使用 /reload。');
      return completeLocalCommand(ws, session);

    case '/new':
    case '/list':
    case '/switch':
    case '/delete':
      sendError(ws, `本地命令 ${cmd} 已移除。当前 IM 会话会固定绑定一个 Agent Session；如需新会话，请在远端 IM 创建新的 session。`);
      return completeLocalCommand(ws, session);

    case '/pc':
      handlePc(ws, session, config);
      return completeLocalCommand(ws, session);

    case '/base':
      sendBaseInfo(ws, session, config);
      return completeLocalCommand(ws, session);

    case '/get':
      handleGet(text.slice(parts[0].length).trim(), ws, session, config);
      return completeLocalCommand(ws, session);

    case '/approve':
      handleApprove(parts[1], ws, session, config);
      return completeLocalCommand(ws, session);

    case '/model':
      return handleModelCommand(rawArg, ws, session, config);

    case '/reasoning':
      return handleReasoningCommand(rawArg, ws, session, config);

    case '/settings':
      return handleSettingsCommand(rawArg, ws, session, config);

    case '/usage':
      handleUsage(ws, session);
      return completeLocalCommand(ws, session);

    case '/history':
      handleHistory(rawArg, ws, session, { homeDir: config?.homeDir });
      return completeLocalCommand(ws, session);

    case '/history-reload':
    case '/sync-history':
      handleHistoryReload(rawArg, ws, session, config);
      return true;

    case '/compact':
    case '/compress':
      return handleCompactCommand(rawArg, ws, session, config);

    default:
      return false;
  }
}

function handleModelCommand(rawArg, ws, session, config = {}) {
  const args = parseModelArgs(rawArg);
  const agentType = session.agentType || 'claude';
  if (args.mode === 'set') {
    const validation = validateModelName(args.model);
    if (!validation.ok) {
      sendError(ws, validation.message);
      return completeLocalCommand(ws, session);
    }
  }

  const nativeCommand = args.mode === 'set'
    ? `/model ${args.model}`
    : args.mode === 'list'
      ? '/model'
      : args.mode === 'clear'
        ? '/model --clear'
        : '/model';
  const handled = agentRunner().switchAgentModel(ws, session, config, {
    command: args.mode,
    model: args.model,
    nativeCommand,
    agentType,
  });
  if (!handled) {
    sendError(ws, 'Current agent does not support runtime /model switching.');
    return completeLocalCommand(ws, session);
  }
  return true;
}

function handleReasoningCommand(rawArg, ws, session, config = {}) {
  const args = parseReasoningArgs(rawArg);
  const agentType = session.agentType || 'claude';
  if (args.mode === 'set') {
    const validation = validateReasoningEffort(args.effort);
    if (!validation.ok) {
      sendError(ws, validation.message);
      return completeLocalCommand(ws, session);
    }
  }

  const nativeCommand = args.mode === 'set'
    ? `/reasoning ${args.effort}`
    : args.mode === 'list'
      ? '/reasoning'
      : args.mode === 'clear'
        ? '/reasoning --clear'
        : '/reasoning';
  const handled = agentRunner().switchAgentReasoning(ws, session, config, {
    command: args.mode,
    effort: args.effort,
    nativeCommand,
    agentType,
  });
  if (!handled) {
    sendError(ws, 'Current agent does not support runtime /reasoning switching.');
    return completeLocalCommand(ws, session);
  }
  return true;
}

module.exports = {
  handleSlashCommand,
  isBridgeControlCommand,
  _internal: {
    encodeClaudeProjectDir,
    isSelectableProjectDirectory,
    knownProjectCandidates,
    parseSessionsArgs,
    parseHistoryArgs,
    parseClaudeHistoryRounds,
    parseCodexHistoryRounds,
    buildAgentPickerPayload,
    buildProfilePickerPayload,
    collectClaudeProjectSessions,
    collectCodexProjectSessions,
    findCodexProjectSessionById,
    collectCodexProjectlessChats,
    collectLocalProjectSessions,
    parseAgentArgs,
    parseHermesProfileListOutput,
    parseModelArgs,
    parseReasoningArgs,
    parseRemoveAccountArgs,
    parseOpenClawAgentListOutput,
    parseProfileArgs,
    listOpenClawAgentsFromGateway,
    currentModel,
    buildPcResumeCommand,
    shellQuote,
    resolveWindowsShimCommand,
    formatOpenClawAgentChoice,
    validateHermesProfileName,
  },
};
