const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildOutboundFileMessage,
  resolveGetTarget,
  validateGetFile,
} = require('../core/fileReferences');
const { repairClaudeResumeEntrypointNow } = require('../runtime/claudeTranscript');
const { send, sendError, sendSystem, sendTurnEnd } = require('../core/protocol');
const { createAgentSessionEntry, normalizeApproveMode, saveSessionMetadata } = require('../core/session');
const { pendingPermissionIds } = require('../core/permissionState');
const { handleRemoveAccount, parseRemoveAccountArgs } = require('./account');
const {
  buildAgentPickerPayload,
  buildProfilePickerPayload,
  currentHermesProfile,
  currentOpenClawAgentId,
  formatOpenClawAgentChoice,
  handleAgent,
  handleProfile,
  listOpenClawAgentsFromGateway,
  parseAgentArgs,
  parseHermesProfileListOutput,
  parseOpenClawAgentListOutput,
  parseProfileArgs,
  resolveWindowsShimCommand,
  rejectLockedIdentityChange,
  sessionIdentityLocked,
  validateHermesProfileName,
} = require('./agentSelection');
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
  encodeClaudeProjectDir,
  handleCd,
  handleProject,
  isReadableDirectory,
  isSelectableProjectDirectory,
  knownProjectCandidates,
  projectAction,
  quoteProjectPath,
  readJsonFile,
  resolveWorkspacePath,
  safeMtimeMs,
  safeReadDir,
  safeReadFilesRecursive,
} = require('./project');
const { currentModel, parseModelArgs, validateModelName } = require('./model');
const { buildPcResumeCommand, shellQuote } = require('./pc');
const { parseReasoningArgs, validateReasoningEffort } = require('./reasoning');
const {
  GET_MODELS_AND_REASONS_COMMAND,
  isGetModelsAndReasonsCommand,
  parseSettingsArgs,
  validateSettingsApplyArgs,
} = require('./settings');
const { handleUpdate } = require('./update');
const claudeAgent = require('../agents/claude');
const codexAgent = require('../agents/codex');

function agentRunner() {
  return require('../runtime/agentRunner');
}

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

function completeLocalCommand(ws, session) {
  sendTurnEnd(ws, session);
  return true;
}

function completeMaybeAsyncLocalCommand(result, ws, session) {
  if (result && typeof result.then === 'function') {
    result.finally(() => completeLocalCommand(ws, session));
    return;
  }
  completeLocalCommand(ws, session);
}

function handleCompactCommand(rawArg, ws, session, config) {
  const agentType = session.agentType || 'claude';
  const mode = String(rawArg || '').trim().toLowerCase();
  if (mode && !['native'].includes(mode)) {
    sendError(ws, '/compact currently supports native mode only. Use /compact or /compact native.');
    return completeLocalCommand(ws, session);
  }
  const nativeCommand = agentType === 'hermes' ? '/compress' : '/compact';
  const handled = agentRunner().compactAgentContext(ws, session, config, { trigger: 'manual', nativeCommand });
  if (!handled) {
    sendError(ws, 'Current agent does not support /compact.');
    return completeLocalCommand(ws, session);
  }
  return true;
}

function sendStatus(ws, session, config = {}) {
  const processRunning = !!(
    (session.agentProcess || session.claudeProcess) &&
    (session.agentProcess || session.claudeProcess).exitCode === null &&
    !(session.agentProcess || session.claudeProcess).killed
  );

  const historyCount = session.agentSessionHistory?.length || 0;
  const activeEntry = session.agentSessionHistory?.find(e => e.isActive);
  const agentType = session.agentType || 'claude';
  const model = currentModel(session, config);
  const modeDetail = agentType === 'openclaw'
    ? `\nOpenClaw Agent: ${currentOpenClawAgentId(session, config)}`
    : agentType === 'hermes'
      ? `\nHermes Profile: ${currentHermesProfile(session, config)}`
      : '';

  const workspaceLine = usesProviderManagedWorkspace(session) ? '' : `工作目录: ${session.workspace}\n`;

  sendSystem(ws, `📊 当前会话状态：
${workspaceLine}会话 ID: ${session.id}
存储 ID: ${session.storageId}
Agent 类型: ${agentType}${modeDetail}
Model: ${model || '(default)'}
Agent session: ${session.agentSessionId || '(尚未建立)'}
活跃历史条目: ${activeEntry ? `"${activeEntry.firstMessage?.slice(0, 40) || '(无)'}" (${activeEntry.id})` : '无'}
历史总数: ${historyCount}
Agent 进程: ${processRunning ? '运行中' : '未运行'}
当前 turn: ${session.isTurnActive ? '进行中' : '空闲'}
排队消息: ${session.messageQueue.length}
审批模式: ${normalizeApproveMode(session.approveMode)}
待确认: ${session.pendingPermission ? '工具权限' : session.pendingDanger ? '危险操作' : '无'}`);
}

function handleSessionId(ws, session) {
  const agentType = session.agentType || 'claude';
  if (!['claude', 'codex'].includes(agentType)) {
    sendError(ws, `/session 目前只支持 Claude 和 Codex 模式，当前是 ${agentType}。`);
    return;
  }

  const agentSessionId = session.agentSessionId || null;
  sendSlashCommandResult(ws, 'session', {
    agentType,
    sessionKey: session.id,
    agentSessionId,
    established: Boolean(agentSessionId),
  });

  sendSystem(ws, agentSessionId
    ? `${agentType} Agent Session ID: ${agentSessionId}`
    : `当前 ${agentType} 还没有 Agent Session ID。请先发送一条消息建立会话。`);
}

function isHermesSession(session) {
  return (session.agentType || 'claude') === 'hermes';
}

function usesProviderManagedWorkspace(session) {
  const agentType = session.agentType || 'claude';
  return agentType === 'hermes' || agentType === 'openclaw';
}

function sendProviderWorkspaceNotice(ws, session) {
  const agentType = session.agentType || 'claude';
  if (agentType === 'openclaw') {
    sendSystem(ws, 'OpenClaw 模式下工作空间由 OpenClaw Agent 自身管理；请使用 /agent 选择 Agent。');
    return;
  }
  if (agentType === 'hermes') {
    sendSystem(ws, 'Hermes 模式下工作空间由 Hermes Profile/Gateway 自身管理；请使用 /profile 选择 Profile。');
    return;
  }
  sendSystem(ws, '当前模式支持 /pwd 和 /project 管理项目目录。');
}

function sendBaseInfo(ws, session, config) {
  const lines = ['🗄️ Linco 运行信息：'];
  if (!usesProviderManagedWorkspace(session)) {
    lines.push(`当前工作目录: ${session.workspace}`);
  }
  lines.push(`Linco Home: ${config.lincoHome}`);
  lines.push(`会话运行目录: ${session.runtimeDir}`);
  lines.push(`附件目录: ${session.attachmentsDir}`);
  sendSystem(ws, lines.join('\n'));
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

function handleSettingsListCommand(ws, session, config = {}) {
  const agentType = session.agentType || 'claude';
  if (agentType !== 'codex' && agentType !== 'claude') {
    sendError(ws, `Current agent does not support ${GET_MODELS_AND_REASONS_COMMAND}.`);
    return completeLocalCommand(ws, session);
  }
  completeMaybeAsyncLocalCommand(
    buildBridgeSettingsPayload(session, config)
      .then(payload => sendSlashCommandResult(ws, GET_MODELS_AND_REASONS_COMMAND, payload))
      .catch(err => {
        sendError(ws, `Failed to load settings: ${err.message}`);
      }),
    ws,
    session,
  );
  return true;
}

function handleSettingsCommand(rawArg, ws, session, config = {}) {
  const args = parseSettingsArgs(rawArg);
  if (args.mode === 'apply') {
    return handleSettingsApplyCommand(args, ws, session, config);
  }

  return handleSettingsListCommand(ws, session, config);
}

function handleSettingsApplyCommand(args, ws, session, config = {}) {
  const validation = validateSettingsApplyArgs(args);
  if (!validation.ok) {
    sendError(ws, validation.message);
    return completeLocalCommand(ws, session);
  }

  const agentType = session.agentType || 'claude';
  if (agentType !== 'codex' && agentType !== 'claude') {
    sendError(ws, 'Current agent does not support /settings apply.');
    return completeLocalCommand(ws, session);
  }

  const handled = agentRunner().applyAgentSettings(ws, session, config, {
    reasoningEffort: args.reasoningEffort,
    modelId: args.modelId,
    nativeCommand: `/settings apply${args.reasoningEffort ? ` --reasoning ${args.reasoningEffort}` : ''}${args.modelId ? ` --model ${args.modelId}` : ''}`,
    agentType,
  });
  if (!handled) {
    sendError(ws, 'Current agent does not support /settings apply.');
    return completeLocalCommand(ws, session);
  }
  return true;
}

async function buildBridgeSettingsPayload(session, config = {}) {
  const agentType = session.agentType || 'claude';
  if (agentType === 'codex') return buildCodexSettingsPayload(session, config);
  return buildClaudeSettingsPayload(session, config);
}

async function buildCodexSettingsPayload(session, config = {}) {
  const agentConfig = config.agents?.codex || {};
  const currentReasoning = codexAgent._internal.currentCodexReasoningEffort(session);
  const defaultEffort = codexAgent._internal.codexDefaultReasoningEffort(agentConfig);
  const reasoningOptions = codexAgent._internal.uniqueReasoningEfforts([
    'low',
    'medium',
    'high',
    'xhigh',
  ]).map(effort => ({
    id: effort,
    label: formatReasoningLabel(effort),
    command: `/reasoning ${effort}`,
  }));
  const current = String(session.codexModelOverride || '').trim();
  const defaultModel = String(agentConfig.model || '').trim();
  let models = [];
  let listError = '';
  try {
    models = await codexAgent._internal.loadCodexActualModelNames(session, config);
  } catch (err) {
    listError = err.message;
  }
  return {
    agentType: 'codex',
    reasoning: {
      current: currentReasoning,
      defaultEffort,
      model: current || defaultModel,
      options: reasoningOptions,
    },
    model: {
      current,
      defaultModel,
      ...(listError ? { listError } : {}),
      items: models.map(model => ({
        id: model,
        label: model,
        command: `/model ${model}`,
      })),
    },
  };
}

function buildClaudeSettingsPayload(session, config = {}) {
  const agentConfig = config.agents?.claude || {};
  const currentReasoning = claudeAgent._internal.currentClaudeEffort(session, config);
  const defaultEffort = String(agentConfig.effort || 'medium').trim();
  const reasoningOptions = claudeAgent._internal.availableClaudeEfforts().map(effort => ({
    id: effort.name,
    label: formatReasoningLabel(effort.name),
    description: effort.desc,
    command: `/reasoning ${effort.name}`,
  }));
  const current = String(session.claudeModelOverride || '').trim();
  const defaultModel = String(agentConfig.model || '').trim();
  const models = claudeAgent._internal.availableClaudeModels().map(model => model.name);
  return {
    agentType: 'claude',
    reasoning: {
      current: currentReasoning,
      defaultEffort,
      model: current || defaultModel,
      options: reasoningOptions,
    },
    model: {
      current,
      defaultModel,
      items: models.map(model => ({
        id: model,
        label: model,
        command: `/model ${model}`,
      })),
    },
  };
}

function formatReasoningLabel(effort) {
  switch (String(effort || '').trim().toLowerCase()) {
    case 'low':
      return 'Low';
    case 'medium':
      return 'Medium';
    case 'high':
      return 'High';
    case 'xhigh':
      return 'Extra High';
    case 'max':
      return 'Max';
    case 'minimal':
      return 'Minimal';
    case 'none':
      return 'None';
    default:
      return String(effort || '').trim();
  }
}

function handleReload(ws, session, config) {
  runReload(ws, session, config)
    .finally(() => {
      completeLocalCommand(ws, session);
    });
}

function runReload(ws, session, config) {
  const agentType = session.agentType || 'claude';
  const resumeId = session.agentSessionId || '';
  agentRunner().stopAgentProcess(session, { clearAgentSession: false });
  sendSystem(ws, [
    `🔄 已刷新当前 ${agentType} 会话。`,
    resumeId ? `保留的 Session ID: ${resumeId}` : '当前还没有可恢复的 Session ID。',
    '下次消息会重新加载本地 Agent 历史。'
  ].join('\n'));
  return Promise.resolve(agentRunner().warmupAgentProcess(ws, session, config))
    .then(result => {
      if (result?.supported === false) {
        sendSystem(ws, `${agentType} 模式不支持空预启动，下次消息会按需启动。`);
        return;
      }
      sendSystem(ws, `${agentType} Agent 进程已预启动。`);
    })
    .catch(err => {
      sendError(ws, `${agentType} Agent 预启动失败: ${err.message}`);
    });
}

function handleHistoryReload(rawArg, ws, session, config = {}) {
  if (isSessionBusyForHistoryReload(session)) {
    return completeLocalCommand(ws, session);
  }

  runReload(ws, session, config)
    .then(() => {
      const trackingWs = trackHistoryResult(ws);
      handleHistory(rawArg, trackingWs, session, {
        homeDir: config?.homeDir,
        bindExplicitHistorySession: true,
        allowExplicitHistorySessionSwitch: true,
        historyReload: true,
      });
    })
    .finally(() => {
      completeLocalCommand(ws, session);
    });
  return true;
}

function isSessionBusyForHistoryReload(session) {
  return Boolean(
    session?.isTurnActive ||
    session?.claudeCompaction ||
    session?.codexCompaction ||
    session?.pendingCodexManualCompaction ||
    session?.pendingPermission ||
    session?.pendingDanger
  );
}

function trackHistoryResult(ws) {
  return {
    ...ws,
    linco: ws?.linco,
    sawHistoryResult: false,
    send(raw) {
      try {
        const item = JSON.parse(raw);
        if (item?.type === 'slash_command_result' && item.command === 'history') {
          this.sawHistoryResult = true;
        }
      } catch {}
      return ws.send(raw);
    },
  };
}

function handleUpdateCommand(rawArg, ws, session, config) {
  handleUpdate(rawArg, ws, session, config)
    .catch(err => {
      sendError(ws, `Linco Connect 升降级失败: ${err.message}`);
    })
    .finally(() => {
      completeLocalCommand(ws, session);
    });
}

function handlePc(ws, session, config = {}) {
  const agentType = session.agentType || 'claude';
  if (!['claude', 'codex'].includes(agentType)) {
    sendError(ws, `/pc 目前只支持 Claude 和 Codex 模式，当前是 ${agentType}。`);
    return;
  }

  const resumeId = session.agentSessionId;
  if (!resumeId) {
    sendError(ws, `当前还没有 ${agentType} Session ID。请先发送一条消息建立会话后再使用 /pc。`);
    return;
  }

  const workspace = session.workspace || process.cwd();
  const command = buildPcResumeCommand(agentType, workspace, resumeId);
  const details = [`工作目录: ${workspace}`];

  if (agentType === 'claude') {
    repairClaudeResumeEntrypointNow(session, config, { saveSessionMetadata, homeDir: config.homeDir });
    const transcriptPath = resolveClaudeTranscriptPath(workspace, resumeId, config.homeDir);
    const transcriptStatus = fs.existsSync(transcriptPath) ? 'Claude 历史文件' : 'Claude 历史文件（预计位置，当前未检测到）';
    details.push(`${transcriptStatus}: ${transcriptPath}`);
  } else if (agentType === 'codex') {
    details.push('如果该 app-server 会话 ID 不能被 Codex TUI 直接恢复，可以在 PC 端改用 `codex resume --last --include-non-interactive` 选择最近会话。');
  }

  sendSystem(ws, [
    `💻 PC 端可以复制下面的命令打开当前 ${agentType} 会话：`,
    '',
    `\`\`\`${command.language}`,
    command.text,
    '```',
    '',
    ...details,
    '',
    'PC 端聊完后，回到 IM 发送 /reload，再继续提问。'
  ].join('\n'));
}

function resolveClaudeTranscriptPath(workspace, sessionId, homeDir = os.homedir()) {
  const projectDir = encodeClaudeProjectDir(workspace || process.cwd());
  return path.join(homeDir, '.claude', 'projects', projectDir, `${sessionId}.jsonl`);
}

function handleGet(rawTarget, ws, session, config) {
  const resolved = resolveGetTarget(rawTarget, session);
  if (!resolved) {
    sendError(ws, '用法：/get <文件路径>');
    return;
  }

  const validation = validateGetFile(resolved, session, config);
  if (!validation.ok) {
    sendError(ws, validation.message);
    return;
  }

  send(ws, 'outbound_message', buildOutboundFileMessage(session, validation.path, validation.size));
}

function sendProjectMessage(ws, text, actions = [], extraPayload = {}) {
  send(ws, 'system', {
    text,
    actions,
    quickActions: actions,
    quickReplies: actions,
    ...extraPayload,
  });
}

function sendSlashCommandResult(ws, command, data = {}) {
  send(ws, 'slash_command_result', {
    command,
    version: 1,
    data,
  });
}

function formatTokenCount(n) {
  if (!n) return '0';
  return n.toLocaleString();
}

function handleUsage(ws, session) {
  if ((session.agentType || 'claude') === 'openclaw' && !(session.usage?.inputTokens || session.usage?.outputTokens)) {
    sendSystem(ws, 'OpenClaw usage data is not available yet for this session.');
    return;
  }
  if ((session.agentType || 'claude') === 'codex') {
    sendSystem(ws, '📊 Codex 当前暂不提供 Token 用量统计。');
    return;
  }

  const history = session.agentSessionHistory || [];

  const activeEntry = history.find(e => e.isActive) || (session.agentSessionId ? history.find(e => e.id === session.agentSessionId) : null);

  const current = session.usage || { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
  const total = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
  for (const entry of history) {
    total.inputTokens += entry.usage?.inputTokens || 0;
    total.outputTokens += entry.usage?.outputTokens || 0;
    total.cacheReadTokens += entry.usage?.cacheReadTokens || 0;
    total.cacheCreationTokens += entry.usage?.cacheCreationTokens || 0;
  }

  const grandTotal = total.inputTokens + total.outputTokens + total.cacheReadTokens + total.cacheCreationTokens;

  let text = `📊 Token 用量统计：\n\n`;
  text += `当前 Session:\n`;
  text += `  Input: ${formatTokenCount(current.inputTokens)} | Output: ${formatTokenCount(current.outputTokens)}`;
  if (current.cacheReadTokens || current.cacheCreationTokens) {
    text += ` | Cache Read: ${formatTokenCount(current.cacheReadTokens)} | Cache Create: ${formatTokenCount(current.cacheCreationTokens)}`;
  }
  text += `\n\n`;
  text += `全部 Session 累计:\n`;
  text += `  Input: ${formatTokenCount(total.inputTokens)} | Output: ${formatTokenCount(total.outputTokens)}`;
  if (total.cacheReadTokens || total.cacheCreationTokens) {
    text += ` | Cache Read: ${formatTokenCount(total.cacheReadTokens)} | Cache Create: ${formatTokenCount(total.cacheCreationTokens)}`;
  }
  text += `\n  总计: ${formatTokenCount(grandTotal)} tokens`;

  sendSystem(ws, text);
}

function handleApprove(mode, ws, session, config) {
  const value = String(mode || '').trim().toLowerCase();

  if (!value || value === 'status') {
    sendSystem(ws, [
      `审批模式当前为：${normalizeApproveMode(session.approveMode)}。`,
      '使用 /approve manual、/approve auto 或 /approve yolo 切换。默认 auto。',
      'manual: 手动确认权限请求；auto: 自动确认但保留默认权限边界；yolo: 跳过权限/沙箱限制。',
    ].join('\n'));
    return;
  }

  if (!['manual', 'auto', 'yolo'].includes(value)) {
    sendError(ws, '❌ /approve 参数只能是 manual、auto 或 yolo，例如 /approve auto。');
    return;
  }

  const previousMode = normalizeApproveMode(session.approveMode);
  session.approveMode = value;
  session.autoApprove = value !== 'manual';
  saveSessionMetadata(session);

  let approvedPending = 0;
  let approvedDanger = false;
  if (session.autoApprove) {
    const provider = session.agentType || 'claude';
    for (const requestId of pendingPermissionIds(session, provider)) {
      const resolved = agentRunner().resolvePendingPermission(true, ws, session, config, requestId);
      if (resolved) approvedPending += 1;
    }
    if (session.pendingDanger) {
      approvedDanger = !!agentRunner().resolvePendingDanger(true, ws, session, config);
    }
  }

  const shouldRestart = approveModeChangeRequiresRestart(previousMode, value, session);
  if (shouldRestart) {
    agentRunner().stopAgentProcess(session, { clearAgentSession: false });
  }

  const notes = [];
  if (approvedPending) notes.push(`已自动批准当前等待中的 ${approvedPending} 个权限请求。`);
  if (approvedDanger) notes.push('已自动批准当前等待中的危险操作确认。');
  if (shouldRestart) notes.push('当前 Agent 进程已停止；下一条消息会用新审批模式恢复同一会话。');

  sendSystem(ws, [`✅ 审批模式已切换：${previousMode} -> ${value}`, approveModeDescription(value), ...notes].join('\n'));
}

function approveModeDescription(mode) {
  if (mode === 'manual') return 'manual: 后续权限请求和危险操作确认会回到手动确认。';
  if (mode === 'yolo') return 'yolo: 后续会尽量使用 Agent 原生跳过权限/沙箱模式。';
  return 'auto: 后续权限请求和危险操作确认会自动允许，但保留默认权限边界。';
}

function approveModeChangeRequiresRestart(previousMode, nextMode, session) {
  if (previousMode === nextMode) return false;
  if (previousMode !== 'yolo' && nextMode !== 'yolo') return false;
  const agentType = session.agentType || 'claude';
  return agentType === 'claude' || agentType === 'codex';
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
