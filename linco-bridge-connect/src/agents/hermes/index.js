const crypto = require('crypto');
const { isDangerousCommand } = require('../../core/danger');
const { send, sendError, sendSystem, sendTurnEnd } = require('../../core/protocol');
const { persistAgentSessionId, stopAgentProcess: stopSessionProcess, updateAgentSessionHistory, createAgentSessionEntry, saveSessionMetadata } = require('../../core/session');
const { buildFileReferenceHint } = require('../../core/fileReferences');
const { createTextStreamBuffer, appendTextStream, flushTextStream, resetTextStream } = require('../../core/streamBuffer');
const { captureAssistantReplyText, startAssistantReplyLog } = require('../../core/conversationLog');
const {
  appendProgressiveAnswerText,
  hasPendingAnswerText,
  promotePendingProgress,
  resetProgressiveAnswer,
} = require('../../core/progressiveAnswer');
const { ensureHermesGateway, resolveHermesGatewayOptions } = require('../../gateways/hermesGateway');
const {
  clearPendingPermissions,
  getPendingPermission,
  pendingPermissionIds,
  removePendingPermission,
  setPendingPermission,
} = require('../../core/permissionState');
const {
  configuredHermesModel,
  configuredHermesModelCandidates,
  currentHermesModel,
  normalizeModelList,
  persistHermesProfileModelDefault,
  resolveHermesAgentConfig,
  resolveHermesModelInput,
  restoreHermesProfileModelDefault,
  uniqueModelNames,
} = require('./options');

const HERMES_COMPACTION_STALE_MS = 90_000;
const DEFAULT_HERMES_COMPACTION_TIMEOUT_MS = 300_000;

function extractText(input) {
  if (!Array.isArray(input)) return String(input || '');
  return input
    .filter(block => block?.type === 'text')
    .map(block => block.text || '')
    .join('\n');
}

function execute(input, ws, session, config) {
  const textForCheck = stringifyInput(input);
  if (isDangerousCommand(textForCheck) && session.autoApprove !== true) {
    const preview = textForCheck.slice(0, 200);
    session.pendingDanger = { input };
    send(ws, 'danger_warning', {
      text: `⚠️ 检测到可能的危险操作，请确认是否继续执行：\n\n"${preview}${textForCheck.length > 200 ? '...' : ''}"`,
    });
    return;
  }

  if (session.isTurnActive) {
    if (session.messageQueue.length >= config.maxMessageQueue) {
      sendError(ws, '消息队列已满，请稍后再试');
      return;
    }
    session.messageQueue.push({ input, ws });
    sendSystem(ws, `Hermes 正在处理上一条消息，已加入队列（${session.messageQueue.length}）`);
    return;
  }

  runHermesTurn(input, ws, session, config);
}

async function runHermesTurn(input, ws, session, config) {
  session.isTurnActive = true;
  session.currentInputForNoOutput = input;
  session.sawPartialAssistantText = false;
  session._lastWs = ws;
  session._lastConfig = config;
  startAssistantReplyLog(session, config, { agentType: 'hermes' });
  resetHermesAssistantText(session);

  const agentConfig = resolveHermesAgentConfig(session, config);
  const hermesSessionId = ensureHermesSessionId(session);
  const inputWithFileReferenceHint = buildFileReferenceHint(input, session);

  try {
    const gatewayUrl = await ensureHermesGateway(agentConfig, config.logger);
    session.hermesGatewayUrl = gatewayUrl;
    const run = await createRun(gatewayUrl, agentConfig, inputWithFileReferenceHint, hermesSessionId, session);
    if (!run?.run_id) throw new Error('Hermes Gateway 未返回 run_id');
    session.hermesRunId = run.run_id;
    config.logger?.info('hermes run started', { runId: run.run_id, sessionId: hermesSessionId });
    await streamRunEvents(gatewayUrl, agentConfig, run.run_id, ws, session, config);
    if (session.isTurnActive) {
      failActiveHermesCompaction(ws, session, config, 'app_server_closed', 'Hermes event stream closed during context compaction.');
      sendSystem(ws, 'Hermes 事件流已关闭。');
      finishTurn(ws, session, config);
    }
  } catch (err) {
    if (!isAbortError(err)) {
      const message = `Hermes 错误: ${err.message}`;
      failActiveHermesCompaction(ws, session, config, 'process_unavailable', message);
      sendError(ws, message);
      if (session.isTurnActive) sendTurnEnd(ws, session, 'error', { error: message });
    }
    finishTurn(ws, session, config, { drain: !isAbortError(err) });
  }
}

async function createRun(gatewayUrl, agentConfig, input, sessionId, session) {
  const body = {
    input: buildHermesInput(input),
    session_id: sessionId,
  };
  const model = currentHermesModel(session, agentConfig);
  if (model) body.model = model;
  if (agentConfig.instructions) body.instructions = agentConfig.instructions;

  const response = await fetchJson(`${gatewayUrl}/v1/runs`, agentConfig, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return response;
}

async function streamRunEvents(gatewayUrl, agentConfig, runId, ws, session, config) {
  const controller = new AbortController();
  session.hermesAbortController = controller;
  session.agentProcess = createHermesProcessHandle(gatewayUrl, agentConfig, runId, controller);

  const response = await fetch(`${gatewayUrl}/v1/runs/${encodeURIComponent(runId)}/events`, {
    method: 'GET',
    headers: buildHeaders(agentConfig),
    signal: controller.signal,
  });

  if (!response.ok) {
    throw new Error(await responseErrorText(response));
  }

  let buffer = '';
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() || '';
    for (const frame of frames) {
      const event = parseSseFrame(frame);
      if (event) handleHermesEvent(event, ws, session, config);
      if (!session.isTurnActive) return;
    }
  }

  if (buffer.trim()) {
    const event = parseSseFrame(buffer);
    if (event) handleHermesEvent(event, ws, session, config);
  }
}

function parseSseFrame(frame) {
  const data = frame
    .split(/\r?\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trimStart())
    .join('\n')
    .trim();
  if (!data || data === '[DONE]') return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function handleHermesEvent(event, ws, session, config) {
  if (isHermesCompactionEvent(event)) {
    handleHermesCompactionEvent(event, ws, session, config);
    return;
  }
  if (session?.hermesCompaction && isHermesCompactionStatusEvent(event)) {
    return;
  }

  switch (event.event) {
    case 'message.delta':
      if (event.delta && !(session?.hermesCompaction && (session.hermesCompaction.trigger === 'manual' || isHermesCompactionStatusEvent(event)))) appendHermesAssistantText(event.delta, ws, session);
      return;
    case 'tool.started':
      flushPendingHermesReasoning(ws, session);
      promotePendingProgress(ws, session);
      flushTextStream(ws, session.streamState);
      send(ws, 'tool_call', {
        id: toolId(event),
        name: event.tool || 'Hermes Tool',
        input: event.preview || '',
      });
      markHermesAssistantBreak(session);
      return;
    case 'tool.completed':
      send(ws, 'tool_result', {
        toolUseId: toolId(event),
        output: formatToolCompleted(event),
        isError: event.error === true,
      });
      markHermesAssistantBreak(session);
      return;
    case 'reasoning.available':
      if (!session?.hermesCompaction) appendPendingHermesReasoning(event.text, session);
      return;
    case 'approval.request':
      flushPendingHermesReasoning(ws, session);
      handleApprovalRequest(event, ws, session, config);
      return;
    case 'approval.responded':
      return;
    case 'run.completed':
      completeRun(event, ws, session, config);
      return;
    case 'run.failed':
      failActiveHermesCompaction(ws, session, config, 'agent_error', event.error || 'Hermes run 执行失败');
      sendError(ws, event.error || 'Hermes run 执行失败');
      sendTurnEnd(ws, session, 'error', { error: event.error || 'Hermes run 执行失败' });
      finishTurn(ws, session, config);
      return;
    case 'run.cancelled':
      failActiveHermesCompaction(ws, session, config, 'turn_cancelled', 'Hermes run was cancelled.');
      sendSystem(ws, 'Hermes run 已停止。');
      sendTurnEnd(ws, session, 'cancelled');
      finishTurn(ws, session, config);
      return;
    default:
      return;
  }
}

function compactHermesContext(ws, session, config, options = {}) {
  session._lastWs = ws;
  session._lastConfig = config;
  const nativeCommand = options.nativeCommand || '/compress';
  const trigger = options.trigger || 'manual';

  if (session.isTurnActive) {
    if (session.messageQueue.length >= config.maxMessageQueue) {
      sendError(ws, '消息队列已满，请稍后再试');
      return true;
    }
    session.messageQueue.push({ input: nativeCommand, ws, compact: true, trigger, nativeCommand });
    sendSystem(ws, `Hermes 正在处理上一条消息，已加入队列（${session.messageQueue.length}）`);
    return true;
  }

  if (session.hermesCompaction && !session.hermesCompaction.completed) {
    failActiveHermesCompaction(ws, session, config, 'superseded', 'Another Hermes context compaction started before the previous one completed.');
  }
  handleHermesCompactionStarted({
    event: 'context_compaction.started',
    compaction_id: `hermes-compact-${Date.now()}`,
    trigger,
    nativeCommand,
  }, ws, session, config);
  execute(nativeCommand, ws, session, config);
  return true;
}

function modelHermesContext(ws, session, config, options = {}) {
  session._lastWs = ws;
  session._lastConfig = config;
  const command = options.command || 'show';

  if (session.isTurnActive || session.hermesCompaction) {
    if (session.messageQueue.length >= config.maxMessageQueue) {
      sendError(ws, '消息队列已满，请稍后再试');
      return true;
    }
    session.messageQueue.push({
      input: options.nativeCommand || '/model',
      ws,
      modelCommand: true,
      modelOptions: options,
    });
    sendSystem(ws, `Hermes 正在处理上一条消息，已加入 /model 队列（${session.messageQueue.length}）`);
    return true;
  }

  if (command === 'list') {
    sendHermesModelList(ws, session, config);
    return true;
  }
  if (command === 'show') {
    sendHermesModelStatus(ws, session, config);
    return true;
  }
  if (command === 'clear') {
    const previous = session.hermesModelOverride || '(none)';
    session.hermesModelOverride = null;
    let restoredDefault = '';
    try {
      restoredDefault = restoreHermesProfileModelDefault(session, config);
    } catch (err) {
      sendError(ws, `Hermes model override cleared locally, but restoring the Hermes profile model failed: ${err.message}`);
      saveSessionMetadata(session);
      sendTurnEnd(ws, session, 'error', { error: err.message });
      return true;
    }
    saveSessionMetadata(session);
    sendSystem(ws, `Hermes model override cleared (was ${previous}). Next turn will use ${restoredDefault || configuredHermesModel(config.agents?.hermes || {}) || 'the Hermes profile default model'}.`);
    sendTurnEnd(ws, session);
    return true;
  }

  setHermesModelOverride(ws, session, config, options.model);
  return true;
}

function sendHermesModelStatus(ws, session, config) {
  const agentConfig = resolveHermesAgentConfig(session, config);
  const lines = [`Hermes model override: ${session.hermesModelOverride || '(none)'}`];
  const configured = configuredHermesModel(agentConfig);
  if (configured) lines.push(`Configured default: ${configured}`);
  lines.push('Use /model <name> to apply a model to the next Hermes run and subsequent runs in this Linco session.');
  sendSystem(ws, lines.join('\n'));
  sendTurnEnd(ws, session);
}

function sendHermesModelList(ws, session, config) {
  const agentConfig = resolveHermesAgentConfig(session, config);
  loadHermesModelNames(agentConfig)
    .then(models => {
      const current = currentHermesModel(session, agentConfig);
      const actions = models.map((model, index) => ({
        label: model === current ? `✓ ${model}` : model,
        text: `/model switch ${index + 1}`,
        command: `/model switch ${index + 1}`,
        type: 'command',
        action: 'select',
        model,
      }));
      send(ws, 'system', {
        text: formatHermesModelList(models, current),
        actions,
        quickActions: actions,
        quickReplies: actions,
      });
      sendTurnEnd(ws, session);
    })
    .catch(err => {
      const current = currentHermesModel(session, agentConfig);
      const models = configuredHermesModelCandidates(agentConfig);
      const actions = models.map((model, index) => ({
        label: model === current ? `* ${model}` : model,
        text: `/model switch ${index + 1}`,
        command: `/model switch ${index + 1}`,
        type: 'command',
        action: 'select',
        model,
      }));
      send(ws, 'system', {
        text: [
          `Current Hermes model: ${current || '(default)'}`,
          `Hermes model list failed; showing configured choices. ${err.message}`,
          '',
          ...(models.length
            ? models.map((model, index) => `${index + 1}. ${model}${model === current ? ' (current)' : ''}`)
            : ['No configured fallback models found. You can still send /model <name> manually.']),
        ].join('\n'),
        actions,
        quickActions: actions,
        quickReplies: actions,
      });
      sendTurnEnd(ws, session);
    });
}

function setHermesModelOverride(ws, session, config, modelInput) {
  const agentConfig = resolveHermesAgentConfig(session, config);
  const raw = String(modelInput || '').trim();
  if (!raw) {
    sendError(ws, 'Please specify a Hermes model.');
    sendTurnEnd(ws, session, 'error', { error: 'missing_model' });
    return;
  }

  if (/^\d+$/.test(raw)) {
    loadHermesModelNames(agentConfig)
      .then(models => setHermesModelOverride(ws, session, config, resolveHermesModelInput(raw, models)))
      .catch(err => {
        const fallback = configuredHermesModelCandidates(agentConfig);
        const resolved = resolveHermesModelInput(raw, fallback);
        if (resolved !== raw) {
          setHermesModelOverride(ws, session, config, resolved);
          return;
        }
        sendError(ws, `Hermes model selection failed: ${err.message}`);
        sendTurnEnd(ws, session, 'error', { error: err.message });
      });
    return;
  }

  const previous = currentHermesModel(session, agentConfig) || '(default)';
  try {
    persistHermesProfileModelDefault(session, config, raw);
  } catch (err) {
    sendError(ws, `Hermes model switch failed: ${err.message}`);
    sendTurnEnd(ws, session, 'error', { error: err.message });
    return;
  }
  session.hermesModelOverride = raw;
  saveSessionMetadata(session);
  sendSystem(ws, `Hermes model set for the next run: ${previous} -> ${raw}\nUpdated Hermes profile config so api_server runs use this model.`);
  sendTurnEnd(ws, session);
}

function formatHermesModelList(models, current) {
  return [
    `Current Hermes model: ${current || '(default)'}`,
    '',
    ...models.map((model, index) => `${index + 1}. ${model}${model === current ? ' (current)' : ''}`),
    '',
    'Use /model <number>, /model switch <number>, or /model <name>.',
  ].join('\n');
}

async function loadHermesModelNames(agentConfig = {}) {
  const gatewayModels = await fetchHermesGatewayModels(agentConfig).catch(() => []);
  const models = uniqueModelNames([
    ...gatewayModels,
    ...configuredHermesModelCandidates(agentConfig),
  ]);
  if (models.length > 0) return models;
  throw new Error('No Hermes models found from Gateway or profile config.');
}

async function fetchHermesGatewayModels(agentConfig = {}) {
  const gatewayUrl = resolveHermesGatewayOptions(agentConfig).gatewayUrl;
  const response = await fetch(`${gatewayUrl}/v1/models`, {
    method: 'GET',
    headers: buildHeaders(agentConfig),
  });
  if (!response.ok) throw new Error(await responseErrorText(response));
  return normalizeModelList(await response.json(), agentConfig);
}

function handleApprovalRequest(event, ws, session, config) {
  const requestId = String(
    event.requestId ||
    event.request_id ||
    event.approvalId ||
    event.approval_id ||
    event.id ||
    `hermes-${event.run_id || session.hermesRunId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  const input = event.command || event.description || event.preview || '';

  if (getPendingPermission(session, requestId, 'hermes')) return;

  setPendingPermission(session, {
    provider: 'hermes',
    requestId,
    runId: event.run_id || session.hermesRunId,
    toolName: 'exec',
    input,
    choices: event.choices || [],
  });

  if (session.autoApprove === true) {
    config.logger?.info('hermes permission auto-approved', {
      sessionId: session.id,
      requestId,
    });
    resolvePendingPermission(true, ws, session, config, requestId, { silent: true }).catch(err => {
      sendError(ws, `Hermes 自动审批失败: ${err.message}`);
    });
    return;
  }

  send(ws, 'permission_request', {
    requestId,
    toolName: 'exec',
    input,
  });
}

function completeRun(event, ws, session, config) {
  if (completeManualHermesCompaction(ws, session)) {
    sendTurnEnd(ws, session);
    finishTurn(ws, session, config);
    return;
  }
  failActiveHermesCompaction(ws, session, config, 'missing_id', 'Hermes run completed before context compaction emitted a terminal event.');
  const hadStreamedOrPendingText = session.streamState?.assistantStarted || hasPendingAnswerText(session);
  if (!hadStreamedOrPendingText && event.output) {
    appendHermesAssistantText(event.output, ws, session);
  }
  const hadOutput = hadStreamedOrPendingText || Boolean(event.output);
  flushHermesAssistantText(ws, session);
  if (hadOutput) {
    send(ws, 'assistant_end', {});
  } else {
    sendSystem(ws, 'Hermes 本次执行没有输出。');
  }
  updateHermesSessionStats(session, event.usage);
  sendTurnEnd(ws, session);
  finishTurn(ws, session, config);
}

function finishTurn(ws, session, config, options = {}) {
  const { drain = true } = options;
  if (session.hermesAbortController) {
    try {
      session.hermesAbortController.abort();
    } catch {}
  }
  session.hermesAbortController = null;
  session.hermesRunId = null;
  session.hermesGatewayUrl = null;
  session.pendingHermesReasoning = '';
  session.isTurnActive = false;
  session.currentInputForNoOutput = null;
  clearPendingPermissions(session, 'hermes');
  flushHermesAssistantText(ws, session);
  resetHermesAssistantText(session);
  if (drain) drainQueue(ws, session, config);
}

function ensureHermesSessionId(session) {
  if (!session.agentSessionId) {
    const newId = `hermes-${crypto.randomUUID().slice(0, 12)}`;
    session.agentSessionId = newId;
    // Capture the first message text from the turn input for /list display
    const firstMsg = session.currentInputForNoOutput
      ? extractText(session.currentInputForNoOutput).slice(0, 200)
      : '';
    if (!session.agentSessionHistory) session.agentSessionHistory = [];
    for (const entry of session.agentSessionHistory) {
      entry.isActive = false;
    }
    const entry = createAgentSessionEntry(session, newId, firstMsg);
    entry.isActive = true;
    session.agentSessionHistory.push(entry);
    saveSessionMetadata(session);
  }
  return session.agentSessionId;
}

function updateHermesSessionStats(session, usage = {}) {
  session.messageCount = (session.messageCount || 0) + 1;
  if (!session.usage) {
    session.usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
  }
  session.usage.inputTokens += usage.input_tokens || usage.inputTokens || 0;
  session.usage.outputTokens += usage.output_tokens || usage.outputTokens || 0;
  updateAgentSessionHistory(session);
}

function buildHermesInput(input) {
  if (!Array.isArray(input)) {
    return [{ role: 'user', content: String(input || '') }];
  }
  const contentParts = [];
  for (const block of input) {
    if (typeof block === 'string') {
      contentParts.push({ type: 'text', text: block });
    } else if (block?.type === 'text') {
      contentParts.push({ type: 'text', text: block.text || '' });
    } else if (block?.type === 'meta') {
      continue;
    } else if (block?.type === 'image') {
      const mediaType = block.source?.media_type || 'image/png';
      const data = block.source?.data;
      if (data) {
        contentParts.push({ type: 'image_url', image_url: { url: `data:${mediaType};base64,${data}` } });
      } else if (block.path) {
        contentParts.push({ type: 'text', text: `用户发送了一张图片，文件路径：${block.path}` });
      } else {
        contentParts.push({ type: 'text', text: '[图片附件]' });
      }
    } else {
      contentParts.push({ type: 'text', text: JSON.stringify(block) });
    }
  }
  return [{ role: 'user', content: contentParts }];
}

function maybeAddImageDataUrls(input) {
  if (!Array.isArray(input)) return String(input || '');
  return input.map(block => {
    if (typeof block === 'string') return block;
    if (block?.type === 'text') return block.text || '';
    if (block?.type === 'meta') return '';
    if (block?.type === 'image') {
      const mediaType = block.source?.media_type || 'image/png';
      const data = block.source?.data;
      if (data) return `用户发送了一张图片：data:${mediaType};base64,${data}`;
      if (block.path) return `用户发送了一张图片，文件路径：${block.path}`;
      return '[图片附件]';
    }
    return JSON.stringify(block);
  }).filter(Boolean).join('\n');
}

function stringifyInput(input) {
  return maybeAddImageDataUrls(input);
}

function numberFromProcessEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function hermesCompactionTimeoutMs(session, config) {
  const configured = Number(resolveHermesAgentConfig(session, config || session?._lastConfig || {}).compactionTimeoutMs);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return numberFromProcessEnv('LINCO_HERMES_COMPACTION_TIMEOUT_MS', DEFAULT_HERMES_COMPACTION_TIMEOUT_MS);
}

function isHermesCompactionEvent(event = {}) {
  const name = String(event.event || event.type || event.kind || '').toLowerCase().replace(/-/g, '_');
  const itemType = String(event.item?.type || event.item?.kind || '').toLowerCase().replace(/-/g, '_');
  const phase = normalizeCompactionPhase(event.phase || event.state || event.status || event.item?.phase || event.item?.status || phaseFromCompactionEventName(name));
  if (isExplicitCompactionEventName(name)) return Boolean(phase);
  if ((name === 'context_compaction' || name === 'context.compaction') && phase) return true;
  if ((itemType === 'contextcompaction' || itemType === 'context_compaction' || itemType === 'compaction') && phase) return true;
  return false;
}

function isExplicitCompactionEventName(name) {
  return /(^|[._])(?:context_compaction|context\.compaction|compaction)(?:[._]|$)/.test(name);
}

function isHermesCompactionStatusEvent(event = {}) {
  const name = String(event.event || event.type || event.kind || '').toLowerCase().replace(/-/g, '_');
  const role = String(event.role || '').toLowerCase();
  return name === 'status' ||
    name === 'status.delta' ||
    name === 'run.status' ||
    name === 'run.progress' ||
    name === 'progress' ||
    name === 'progress.delta' ||
    name === 'message.status' ||
    name === 'message.progress' ||
    role === 'status';
}

function phaseFromCompactionEventName(name) {
  const parts = String(name || '').split(/[._]/).filter(Boolean);
  return parts[parts.length - 1] || '';
}

function normalizeCompactionPhase(value) {
  const phase = String(value || '').toLowerCase().replace(/-/g, '_');
  if (['started', 'start', 'begin', 'running', 'in_progress', 'compacting'].includes(phase)) return 'started';
  if (['completed', 'complete', 'done', 'success', 'succeeded'].includes(phase)) return 'completed';
  if (['failed', 'fail', 'failure', 'error', 'errored', 'timeout', 'cancelled', 'canceled', 'aborted'].includes(phase)) return 'failed';
  return '';
}

function hermesCompactionId(event = {}) {
  return String(
    event.compactionId ||
    event.compaction_id ||
    event.itemId ||
    event.item_id ||
    event.item?.id ||
    event.id ||
    ''
  ).trim();
}

function hermesCompactionTrigger(event = {}) {
  return String(event.trigger || event.reason || event.source || event.item?.trigger || 'auto');
}

function matchesHermesCompactionTarget(event = {}, session) {
  if (!session) return true;
  const runId = event.run_id || event.runId || event.item?.run_id || event.item?.runId;
  const sessionId = event.session_id || event.sessionId || event.item?.session_id || event.item?.sessionId;
  if (session.hermesRunId && runId && runId !== session.hermesRunId) return false;
  if (session.agentSessionId && sessionId && sessionId !== session.agentSessionId) return false;
  return true;
}

function handleHermesCompactionEvent(event, ws, session, config) {
  if (!matchesHermesCompactionTarget(event, session)) return;
  const phase = normalizeCompactionPhase(event.phase || event.state || event.status || event.item?.phase || event.item?.status || phaseFromCompactionEventName(event.event || event.type || event.kind));
  if (phase === 'started') {
    handleHermesCompactionStarted(event, ws, session, config);
  } else if (phase === 'completed') {
    handleHermesCompactionCompleted(event, ws, session, config);
  } else if (phase === 'failed') {
    handleHermesCompactionFailed(event, ws, session, config);
  }
}

function clearHermesCompactionTimers(compaction) {
  if (!compaction) return;
  if (compaction.staleTimerId) clearTimeout(compaction.staleTimerId);
  if (compaction.timeoutTimerId) clearTimeout(compaction.timeoutTimerId);
  compaction.staleTimerId = null;
  compaction.timeoutTimerId = null;
}

function sendHermesCompactionEvent(ws, session, phase, fields = {}) {
  if (!ws) return false;
  const linco = ws.linco || session?.linco || {};
  send(ws, 'context_compaction', {
    phase,
    compactionId: fields.compactionId,
    agentType: 'hermes',
    trigger: fields.trigger,
    sessionKey: session?.id,
    agentSessionId: session?.agentSessionId,
    streamId: linco.streamId,
    requestId: linco.messageId,
    durationMs: fields.durationMs,
    result: fields.result,
    error: fields.error,
    text: fields.text,
    ts: fields.ts || Date.now(),
  });
  return true;
}

function handleHermesCompactionStarted(event, ws, session, config) {
  if (session.hermesCompaction && !session.hermesCompaction.completed) {
    if (session.hermesCompaction.trigger === 'manual') return;
    failActiveHermesCompaction(ws, session, config, 'superseded', 'Another Hermes context compaction started before the previous one completed.');
  }

  const compactionId = hermesCompactionId(event) || `hermes-compact-${Date.now()}`;
  const startedAt = Date.now();
  const compaction = {
    id: compactionId,
    trigger: hermesCompactionTrigger(event),
    nativeCommand: event.nativeCommand,
    startedAt,
    staleTimerId: null,
    timeoutTimerId: null,
    staleNotified: false,
    completed: false,
  };
  session.hermesCompaction = compaction;

  sendHermesCompactionEvent(ws, session, 'started', {
    compactionId,
    trigger: compaction.trigger,
    text: 'Compacting Hermes context...',
    ts: startedAt,
  });

  compaction.staleTimerId = setTimeout(() => {
    if (session.hermesCompaction !== compaction || compaction.completed) return;
    compaction.staleNotified = true;
    sendHermesCompactionEvent(ws, session, 'stale', {
      compactionId,
      trigger: compaction.trigger,
      durationMs: Date.now() - startedAt,
      text: 'Hermes context compaction is still running.',
    });
  }, HERMES_COMPACTION_STALE_MS);
  compaction.staleTimerId.unref?.();

  compaction.timeoutTimerId = setTimeout(() => {
    if (session.hermesCompaction !== compaction || compaction.completed) return;
    failActiveHermesCompaction(ws, session, config, 'timeout', 'Hermes context compaction timed out.');
  }, hermesCompactionTimeoutMs(session, config));
  compaction.timeoutTimerId.unref?.();
}

function handleHermesCompactionCompleted(event, ws, session, config) {
  const active = session.hermesCompaction;
  const id = hermesCompactionId(event);
  if (!active) {
    config?.logger?.warn?.('hermes context compaction completed without active state', { id });
    return;
  }
  if (id && active.id !== id) {
    config?.logger?.warn?.('hermes context compaction completed with mismatched id', { activeId: active.id, completedId: id });
    return;
  }

  active.completed = true;
  clearHermesCompactionTimers(active);
  sendHermesCompactionEvent(ws, session, 'completed', {
    compactionId: active.id,
    trigger: active.trigger,
    durationMs: Date.now() - active.startedAt,
    result: compactResultPreview(event),
    text: 'Hermes context compaction completed.',
  });
  session.hermesCompaction = null;
}

function handleHermesCompactionFailed(event, ws, session, config) {
  const code = String(event.error?.code || event.errorCode || event.status || 'agent_error');
  const message = String(event.error?.message || event.errorMessage || event.message || event.error || 'Hermes context compaction failed.');
  if (!session.hermesCompaction) {
    handleHermesCompactionStarted(event, ws, session, config);
  }
  failActiveHermesCompaction(ws, session, config, code, message);
}

function failActiveHermesCompaction(ws, session, config, code, message) {
  const active = session?.hermesCompaction;
  if (!active || active.completed) return false;
  clearHermesCompactionTimers(active);
  sendHermesCompactionEvent(ws || session?._lastWs, session, 'failed', {
    compactionId: active.id,
    trigger: active.trigger,
    durationMs: Date.now() - active.startedAt,
    error: { code, message: String(message || code) },
    text: 'Hermes context compaction failed; current session was preserved.',
  });
  session.hermesCompaction = null;
  return true;
}

function completeManualHermesCompaction(ws, session) {
  const active = session?.hermesCompaction;
  if (!active || active.completed || active.trigger !== 'manual') return false;
  active.completed = true;
  clearHermesCompactionTimers(active);
  sendHermesCompactionEvent(ws || session?._lastWs, session, 'completed', {
    compactionId: active.id,
    trigger: active.trigger,
    durationMs: Date.now() - active.startedAt,
    result: { nativeCommand: active.nativeCommand || '/compress' },
    text: 'Hermes context compaction completed.',
  });
  session.hermesCompaction = null;
  return true;
}

function compactResultPreview(event = {}) {
  const result = event.result || event.item?.result || event.metadata;
  if (!result || typeof result === 'string') return undefined;
  return result;
}

function appendPendingHermesReasoning(text, session) {
  if (!text || !session) return;
  session.pendingHermesReasoning = `${session.pendingHermesReasoning || ''}${text}`;
}

function flushPendingHermesReasoning(ws, session) {
  const text = String(session?.pendingHermesReasoning || '').trim();
  if (!session) return false;
  session.pendingHermesReasoning = '';
  if (!text || session.hermesCompaction) return false;
  send(ws, 'thinking', { text });
  return true;
}

function appendHermesAssistantText(text, ws, session) {
  appendProgressiveAnswerText(text, ws, session);
  maybeAppendHermesAssistantBreak(ws, session);
  appendHermesAssistantTextNow(text, ws, session);
}

function appendHermesAssistantTextNow(text, ws, session) {
  ensureHermesStreamState(session);
  appendTextStream(text, ws, session.streamState);
  rememberHermesAssistantText(session, text);
}

function flushHermesAssistantText(ws, session) {
  flushTextStream(ws, session.streamState);
}

function resetHermesAssistantText(session) {
  ensureHermesStreamState(session);
  resetTextStream(session.streamState);
  resetProgressiveAnswer(session);
  session.hermesNeedsAssistantBreak = false;
  session.hermesAssistantTextTail = '';
}

function maybeAppendHermesAssistantBreak(ws, session) {
  if (!session?.hermesNeedsAssistantBreak || !session.streamState?.assistantStarted) {
    if (session) session.hermesNeedsAssistantBreak = false;
    return;
  }
  session.hermesNeedsAssistantBreak = false;
  const tail = `${session.hermesAssistantTextTail || ''}${session.streamState?.pendingText || ''}`;
  if (tail.endsWith('\n\n')) return;
  appendHermesAssistantTextNow(tail.endsWith('\n') ? '\n' : '\n\n', ws, session);
}

function markHermesAssistantBreak(session) {
  if (!session?.streamState?.assistantStarted) return;
  session.hermesNeedsAssistantBreak = true;
}

function rememberHermesAssistantText(session, text) {
  captureAssistantReplyText(session, text);
  const next = `${session.hermesAssistantTextTail || ''}${text || ''}`;
  session.hermesAssistantTextTail = next.slice(-4000);
}

function ensureHermesStreamState(session) {
  if (!session.streamState) {
    session.streamState = createTextStreamBuffer({ onStart: sendHermesAssistantStart });
  }
  session.streamState.onStart = sendHermesAssistantStart;
}

function sendHermesAssistantStart(ws) {
  send(ws, 'thinking_clear');
  send(ws, 'assistant_start', {});
}

function toolId(event) {
  return `${event.run_id || 'hermes'}:${event.tool || 'tool'}`;
}

function formatToolCompleted(event) {
  const output = hermesToolOutput(event);
  if (output) return output;
  const duration = typeof event.duration === 'number' ? `，耗时 ${event.duration}s` : '';
  return `${event.tool || '工具'} ${event.error ? '执行失败' : '执行完成'}${duration}`;
}

function hermesToolOutput(event = {}) {
  const candidates = [
    event.output,
    event.result,
    event.results,
    event.stdout,
    event.stderr,
    event.data?.output,
    event.data?.result,
    event.data?.stdout,
    event.data?.stderr,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.length > 0) return value;
    if (value && typeof value !== 'string') return stringifyToolPayload(value);
  }
  return '';
}

function stringifyToolPayload(value) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value || '');
  }
}

async function resolvePendingDanger(confirmed, ws, session, config) {
  const pending = session.pendingDanger;
  if (!pending) return false;
  session.pendingDanger = null;
  if (!confirmed) {
    sendSystem(ws, '已取消危险操作。');
    return true;
  }
  execute(pending.input, ws, session, config);
  return true;
}

async function resolvePendingPermission(approved, ws, session, config, requestId, options = {}) {
  const pending = getPendingPermission(session, requestId, 'hermes');
  if (!pending) {
    config.logger?.warn('hermes permission response without pending request', {
      sessionId: session.id,
      requestId: requestId || '',
      pendingRequestIds: pendingPermissionIds(session, 'hermes'),
    });
    return false;
  }

  const agentConfig = resolveHermesAgentConfig(session, config);
  const gatewayUrl = session.hermesGatewayUrl || resolveHermesGatewayOptions(agentConfig).gatewayUrl;
  const runId = pending.runId || session.hermesRunId;
  removePendingPermission(session, pending.requestId);

  try {
    await fetchJson(`${gatewayUrl}/v1/runs/${encodeURIComponent(runId)}/approval`, agentConfig, {
      method: 'POST',
      body: JSON.stringify({ choice: approved ? 'once' : 'deny' }),
    });
    if (!options.silent) {
      sendSystem(ws, approved ? '✅ 已批准 Hermes 操作。' : '🚫 已拒绝 Hermes 操作。');
    }
  } catch (err) {
    sendError(ws, `Hermes 审批响应失败: ${err.message}`);
  }
  return true;
}

function stop(session, options = {}) {
  const agentConfig = resolveHermesAgentConfig(session, session._lastConfig || {});
  const runId = session.hermesRunId;
  if (session.hermesAbortController) {
    try {
      session.hermesAbortController.abort();
    } catch {}
  }
  if (runId) {
    const gatewayUrl = session.hermesGatewayUrl || resolveHermesGatewayOptions(agentConfig).gatewayUrl;
    fetchJson(`${gatewayUrl}/v1/runs/${encodeURIComponent(runId)}/stop`, agentConfig, { method: 'POST' }).catch(() => {});
  }
  session.hermesAbortController = null;
  session.hermesRunId = null;
  stopSessionProcess(session, options);
}

async function warmup(ws, session, config) {
  session._lastWs = ws;
  session._lastConfig = config;
  const agentConfig = resolveHermesAgentConfig(session, config);
  const gatewayUrl = await ensureHermesGateway(agentConfig, config.logger);
  session.hermesGatewayUrl = gatewayUrl;
  ensureHermesSessionId(session);
  return { supported: true, process: 'hermes gateway', gatewayUrl };
}

function createHermesProcessHandle(gatewayUrl, agentConfig, runId, controller) {
  const handle = {
    killed: false,
    exitCode: null,
    stdin: {
      destroyed: false,
      end() {
        this.destroyed = true;
        handle.kill();
      },
    },
    kill() {
      if (this.killed) return;
      this.killed = true;
      this.exitCode = 0;
      try {
        controller.abort();
      } catch {}
      fetchJson(`${gatewayUrl}/v1/runs/${encodeURIComponent(runId)}/stop`, agentConfig, { method: 'POST' }).catch(() => {});
    },
  };
  return handle;
}
function drainQueue(ws, session, config) {
  const next = session.messageQueue.shift();
  if (!next) return;
  const nextInput = next && typeof next === 'object' && Object.prototype.hasOwnProperty.call(next, 'input')
    ? next.input
    : next;
  const nextWs = next && typeof next === 'object' && next.ws ? next.ws : ws;
  if (next && typeof next === 'object' && next.compact) {
    setImmediate(() => compactHermesContext(nextWs, session, config, {
      trigger: next.trigger || 'manual',
      nativeCommand: next.nativeCommand || '/compress',
    }));
    return;
  }
  if (next && typeof next === 'object' && next.modelCommand) {
    setImmediate(() => modelHermesContext(nextWs, session, config, next.modelOptions || { command: 'show', nativeCommand: next.input }));
    return;
  }
  setImmediate(() => execute(nextInput, nextWs, session, config));
}

function buildHeaders(agentConfig) {
  const headers = { Accept: 'application/json' };
  if (agentConfig.apiKey) headers.Authorization = `Bearer ${agentConfig.apiKey}`;
  return headers;
}

async function fetchJson(url, agentConfig, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...buildHeaders(agentConfig),
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(await responseErrorText(response));
  return response.json();
}

async function responseErrorText(response) {
  const text = await response.text().catch(() => '');
  if (!text) return `${response.status} ${response.statusText}`;
  try {
    const parsed = JSON.parse(text);
    return parsed.error?.message || text;
  } catch {
    return text;
  }
}

function isAbortError(err) {
  return err?.name === 'AbortError';
}

module.exports = {
  compact: compactHermesContext,
  execute,
  model: modelHermesContext,
  resolvePendingDanger,
  resolvePendingPermission,
  stop,
  warmup,
  _internal: {
    buildHermesInput,
    compactHermesContext,
    createRun,
    currentHermesModel,
    configuredHermesModelCandidates,
    handleHermesEvent,
    loadHermesModelNames,
    resolveHermesAgentConfig,
    resolveHermesModelInput,
    stringifyInput,
    failActiveHermesCompaction,
    isHermesCompactionEvent,
    hermesCompactionTimeoutMs,
  },
};
