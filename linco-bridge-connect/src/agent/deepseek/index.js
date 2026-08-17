const crypto = require('crypto');
const path = require('path');
const WebSocket = require('ws');
const { isDangerousCommand } = require('../../core/danger');
const { send, sendAgentSession, sendError, sendSystem, sendTurnEnd } = require('../../core/protocol');
const {
  persistAgentSessionId,
  stopAgentProcess: stopSessionProcess,
  updateAgentSessionHistory,
} = require('../../core/session');
const { createTextStreamBuffer, appendTextStream, flushTextStream, resetTextStream } = require('../../core/streamBuffer');
const { captureAssistantReplyText, startAssistantReplyLog } = require('../../core/conversationLog');
const {
  clearPendingPermissions,
  getPendingPermission,
  pendingPermissionIds,
  removePendingPermission,
  setPendingPermission,
} = require('../../core/permissionState');

const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:3080';

function execute(input, ws, session, config) {
  const textForCheck = stringifyInput(input);
  if (isDangerousCommand(textForCheck) && session.autoApprove !== true) {
    session.pendingDanger = { input };
    send(ws, 'danger_warning', {
      text: `检测到可能的危险操作，请确认是否继续：\n\n"${textForCheck.slice(0, 200)}${textForCheck.length > 200 ? '...' : ''}"`,
    });
    return;
  }

  if (session.isTurnActive) {
    if (session.messageQueue.length >= config.maxMessageQueue) {
      sendError(ws, '消息队列已满，请稍后再试。');
      return;
    }
    session.messageQueue.push({ input, ws });
    sendSystem(ws, `DeepSeek 正在处理上一条消息，已加入队列（${session.messageQueue.length}）。`);
    return;
  }

  void runTurn(input, ws, session, config);
}

async function runTurn(input, ws, session, config) {
  session.isTurnActive = true;
  session.currentInputForNoOutput = input;
  session._lastWs = ws;
  session._lastConfig = config;
  session.deepseekTurn = null;
  session.deepseekSawTextDelta = false;
  session.deepseekFallbackMessageEmitted = false;
  session.deepseekTurnUsage = null;
  startAssistantReplyLog(session, config, { agentType: 'deepseek' });
  resetAssistantText(session);

  try {
    const agentConfig = resolveAgentConfig(config);
    const sessionId = await ensureHarnessSession(session, ws, agentConfig);
    await ensureEventStream(session, agentConfig, config);
    const result = await callRpc(agentConfig, 'session.prompt', {
      sessionId,
      mode: 'queue',
      content: buildPromptContent(input),
      clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    if (result.command?.kind === 'success') {
      if (typeof result.command.text === 'string' && result.command.text) appendAssistantText(result.command.text, ws, session);
      completeTurn(ws, session, config, { kind: 'completed' });
    }
  } catch (err) {
    if (!isAbortError(err) && session.isTurnActive) {
      const message = `DeepSeek Harness 错误: ${err.message}`;
      sendError(ws, message);
      sendTurnEnd(ws, session, 'error', { error: message });
      finishTurn(ws, session, config);
    }
  }
}

function resolveAgentConfig(config = {}) {
  const agentConfig = config.agents?.deepseek || {};
  return {
    ...agentConfig,
    gatewayUrl: normalizeGatewayUrl(agentConfig.gatewayUrl || DEFAULT_GATEWAY_URL),
  };
}

function normalizeGatewayUrl(value) {
  return String(value || DEFAULT_GATEWAY_URL).trim().replace(/\/+$/, '');
}

async function ensureHarnessSession(session, ws, agentConfig) {
  if (session.deepseekAttachedSessionId !== session.agentSessionId || !session.agentSessionId) {
    const workspaceId = await resolveWorkspaceId(agentConfig, session.workspace);
    const workspaceTarget = workspaceId ? { workspaceId } : { cwd: session.workspace };
    const payload = session.agentSessionId
      ? { sessionId: session.agentSessionId, ...workspaceTarget }
      : workspaceTarget;
    if (!session.agentSessionId && agentConfig.agentPreset) payload.agentPreset = agentConfig.agentPreset;
    const created = await callRpc(agentConfig, 'session.create', payload);
    if (!created?.sessionId) throw new Error('session.create 未返回 sessionId');
    persistAgentSessionId(session, created.sessionId);
    session.deepseekAttachedSessionId = created.sessionId;
  }
  sendAgentSession(ws, session, { provider: 'deepseek-harness' });
  return session.agentSessionId;
}

async function ensureEventStream(session, agentConfig, config) {
  if (session.deepseekEventController && !session.deepseekEventController.signal.aborted) {
    return session.deepseekEventReady;
  }

  const controller = new AbortController();
  session.deepseekEventController = controller;
  const socket = new WebSocket(eventStreamUrl(agentConfig.gatewayUrl), {
    headers: buildHeaders(agentConfig),
  });
  session.deepseekEventSocket = socket;

  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  session.deepseekEventReady = ready;
  session.deepseekEventTask = consumeEventSocket(socket, session, config, controller, {
    resolveReady,
    rejectReady,
  })
    .catch(err => {
      if (isAbortError(err) || controller.signal.aborted) return;
      config.logger?.warn?.('deepseek event stream failed', { sessionId: session.id, error: err.message });
      if (session.isTurnActive) {
        const ws = session._lastWs;
        sendError(ws, `DeepSeek Harness 事件流中断: ${err.message}`);
        sendTurnEnd(ws, session, 'error', { error: err.message });
        finishTurn(ws, session, config);
      }
    })
    .finally(() => {
      if (session.deepseekEventController === controller) {
        session.deepseekEventController = null;
        session.deepseekEventSocket = null;
        session.deepseekEventReady = null;
        session.deepseekEventTask = null;
      }
    });

  return ready;
}

function eventStreamUrl(gatewayUrl) {
  const url = new URL('/api/events.mux', normalizeGatewayUrl(gatewayUrl));
  if (url.protocol === 'http:') url.protocol = 'ws:';
  else if (url.protocol === 'https:') url.protocol = 'wss:';
  else throw new Error(`DeepSeek Harness gateway URL protocol is not supported: ${url.protocol}`);
  return url.toString();
}

function consumeEventSocket(socket, session, config, controller, ready) {
  return new Promise((resolve, reject) => {
    let opened = false;
    let settled = false;

    const cleanup = () => {
      controller.signal.removeEventListener('abort', onAbort);
      socket.removeListener('open', onOpen);
      socket.removeListener('message', onMessage);
      socket.removeListener('close', onClose);
      socket.removeListener('error', onError);
    };
    const settle = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (!opened && error) ready.rejectReady(error);
      if (error) reject(error);
      else resolve();
    };
    const onOpen = () => {
      opened = true;
      ready.resolveReady();
    };
    const onMessage = (data, isBinary) => {
      if (isBinary) {
        config.logger?.warn?.('deepseek dropped binary event frame', { sessionId: session.id });
        return;
      }
      try {
        handleMuxEnvelope(JSON.parse(String(data)), session, config);
      } catch (err) {
        config.logger?.warn?.('deepseek dropped malformed event frame', {
          sessionId: session.id,
          error: err.message,
        });
      }
    };
    const onClose = (code, reason) => {
      if (controller.signal.aborted) {
        settle();
        return;
      }
      const suffix = reason?.length ? `: ${String(reason)}` : '';
      settle(new Error(`DeepSeek Harness event WebSocket closed (${code})${suffix}`));
    };
    const onError = (error) => {
      const normalized = error instanceof Error ? error : new Error(String(error));
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) socket.terminate();
      if (controller.signal.aborted) settle();
      else settle(normalized);
    };
    const onAbort = () => {
      if (socket.readyState === WebSocket.CONNECTING) socket.terminate();
      else if (socket.readyState === WebSocket.OPEN) socket.close();
      else settle();
    };

    socket.once('open', onOpen);
    socket.on('message', onMessage);
    socket.once('close', onClose);
    socket.once('error', onError);
    controller.signal.addEventListener('abort', onAbort, { once: true });
    if (controller.signal.aborted) onAbort();
  });
}

function handleMuxEnvelope(envelope, session, config) {
  if (envelope?.type !== 'server-request') return;
  const frame = envelope.payload;
  if (!frame || (frame.sessionId && frame.sessionId !== session.agentSessionId)) return;

  if (frame.type === 'session/event') {
    handleSessionEvent(frame.event, session._lastWs, session, config);
    return;
  }
  if (frame.type === 'approval/requested') {
    handleApprovalRequest(envelope.rpcId, frame, session._lastWs, session, config);
    return;
  }
  if (frame.type === 'question/requested') {
    handleQuestionRequest(envelope.rpcId, frame, session._lastWs, session, config);
    return;
  }
  if (frame.type === 'stream/error' && session.isTurnActive) {
    const message = frame.error?.message || 'DeepSeek Harness stream error';
    sendError(session._lastWs, message);
  }
}

function handleSessionEvent(event, ws, session, config) {
  const data = event?.data || {};
  switch (event?.type) {
    case 'turn/start':
      session.deepseekTurn = data.turn;
      return;
    case 'assistant/chunk':
      handleAssistantChunk(data.chunk, ws, session);
      return;
    case 'assistant/message':
      if (!session.deepseekSawTextDelta && !session.deepseekFallbackMessageEmitted) {
        const text = assistantMessageText(data.message);
        if (text) {
          appendAssistantText(text, ws, session);
          session.deepseekFallbackMessageEmitted = true;
        }
      }
      if (data.usage) session.deepseekTurnUsage = data.usage;
      return;
    case 'tool/call':
      flushTextStream(ws, session.streamState);
      send(ws, 'tool_call', {
        id: String(data.callId || ''),
        name: data.name || 'DeepSeek Tool',
        input: data.arguments || '',
      });
      return;
    case 'tool/result':
      flushTextStream(ws, session.streamState);
      send(ws, 'tool_result', {
        id: String(data.callId || ''),
        toolUseId: String(data.callId || ''),
        output: toolResultText(data.message),
        isError: Boolean(data.error),
      });
      return;
    case 'turn/end':
      if (session.deepseekTurn != null && data.turn !== session.deepseekTurn) return;
      completeTurn(ws, session, config, data.reason || { kind: 'completed' });
      return;
    default:
      return;
  }
}

function handleAssistantChunk(chunk, ws, session) {
  if (!chunk) return;
  if (chunk.type === 'text-delta' && chunk.text) {
    session.deepseekSawTextDelta = true;
    appendAssistantText(chunk.text, ws, session);
  } else if (chunk.type === 'reasoning-delta' && chunk.text) {
    send(ws, 'thinking', { text: chunk.text, mode: 'summary' });
  } else if (chunk.type === 'usage' && chunk.usage) {
    session.deepseekTurnUsage = chunk.usage;
  }
}

function completeTurn(ws, session, config, reason) {
  if (!session.isTurnActive) return;
  flushTextStream(ws, session.streamState);
  if (session.streamState?.assistantStarted) send(ws, 'assistant_end', {});
  else sendSystem(ws, 'DeepSeek 本次执行没有输出。');
  updateSessionStats(session, session.deepseekTurnUsage);
  const mapped = mapTurnEndReason(reason);
  sendTurnEnd(ws, session, mapped.reason, mapped.payload);
  finishTurn(ws, session, config);
}

function mapTurnEndReason(reason = {}) {
  if (reason.kind === 'completed' || reason.kind === 'max-tokens') return { reason: 'completed', payload: {} };
  if (reason.kind === 'aborted' || reason.kind === 'interrupted') return { reason: 'cancelled', payload: {} };
  if (reason.kind === 'error') {
    const error = reason.error?.message || reason.error || 'DeepSeek Harness 执行失败';
    return { reason: 'error', payload: { error: String(error) } };
  }
  return { reason: reason.kind || 'error', payload: {} };
}

function finishTurn(ws, session, config, { drain = true } = {}) {
  session.isTurnActive = false;
  session.currentInputForNoOutput = null;
  session.deepseekTurn = null;
  session.deepseekTurnUsage = null;
  clearPendingPermissions(session, 'deepseek');
  flushTextStream(ws, session.streamState);
  resetAssistantText(session);
  if (drain) drainQueue(ws, session, config);
}

function appendAssistantText(text, ws, session) {
  if (!text) return;
  ensureStreamState(session);
  appendTextStream(text, ws, session.streamState, { phase: 'progress', ephemeral: true });
  captureAssistantReplyText(session, text);
}

function ensureStreamState(session) {
  if (!session.streamState) session.streamState = createTextStreamBuffer();
  session.streamState.onStart = targetWs => {
    send(targetWs, 'thinking_clear');
    send(targetWs, 'assistant_start', {});
  };
}

function resetAssistantText(session) {
  ensureStreamState(session);
  resetTextStream(session.streamState);
}

function updateSessionStats(session, usage = {}) {
  session.messageCount = (session.messageCount || 0) + 1;
  if (!session.usage) session.usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
  session.usage.inputTokens += usage.inputTokens || usage.input_tokens || usage.input || 0;
  session.usage.outputTokens += usage.outputTokens || usage.output_tokens || usage.output || 0;
  session.usage.cacheReadTokens += usage.cacheReadTokens || usage.cache_read_input_tokens || 0;
  session.usage.cacheCreationTokens += usage.cacheCreationTokens || usage.cache_creation_input_tokens || 0;
  updateAgentSessionHistory(session);
}

function handleApprovalRequest(rpcId, frame, ws, session, config) {
  const requestId = String(rpcId || frame.approvalId);
  if (getPendingPermission(session, requestId, 'deepseek')) return;
  setPendingPermission(session, {
    provider: 'deepseek',
    kind: 'approval',
    requestId,
    rpcId,
    approvalId: frame.approvalId,
    sessionId: frame.sessionId,
    toolName: frame.toolName || 'DeepSeek Tool',
    input: frame.reason || frame.callId || '',
  });
  if (session.autoApprove === true) {
    void resolvePendingPermission(true, ws, session, config, requestId, { silent: true });
    return;
  }
  send(ws, 'permission_request', { requestId, toolName: frame.toolName || 'DeepSeek Tool', input: frame.reason || '' });
}

function handleQuestionRequest(rpcId, frame, ws, session, config) {
  const requestId = String(rpcId);
  if (getPendingPermission(session, requestId, 'deepseek')) return;
  const input = (frame.questions || []).map(item => item.question || item.id).filter(Boolean).join('\n');
  setPendingPermission(session, {
    provider: 'deepseek', kind: 'question', requestId, rpcId, sessionId: frame.sessionId,
    questions: frame.questions || [], toolName: 'AskUserQuestion', input,
  });
  if (session.autoApprove === true) {
    void resolvePendingPermission(true, ws, session, config, requestId, { silent: true });
    return;
  }
  send(ws, 'permission_request', { requestId, toolName: 'AskUserQuestion', input });
}

async function resolvePendingPermission(approved, ws, session, config, requestId, options = {}) {
  const pending = getPendingPermission(session, requestId, 'deepseek');
  if (!pending) {
    config.logger?.warn?.('deepseek permission response without pending request', {
      sessionId: session.id,
      requestId: requestId || '',
      pendingRequestIds: pendingPermissionIds(session, 'deepseek'),
    });
    return false;
  }
  removePendingPermission(session, pending.requestId);
  const value = pending.kind === 'question'
    ? {
        sessionId: pending.sessionId,
        answer: {
          answers: pending.questions.map(question => ({
            id: question.id,
            selected: approved && question.options?.[0]?.label ? [question.options[0].label] : [],
          })),
        },
      }
    : {
        sessionId: pending.sessionId,
        approvalId: pending.approvalId,
        outcome: approved ? 'allowed-once' : 'rejected',
      };
  try {
    await respond(resolveAgentConfig(config), pending.rpcId, value);
    if (!options.silent) sendSystem(ws, approved ? '已批准 DeepSeek 操作。' : '已拒绝 DeepSeek 操作。');
  } catch (err) {
    sendError(ws, `DeepSeek 审批响应失败: ${err.message}`);
  }
  return true;
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

function stop(session, options = {}) {
  const agentConfig = resolveAgentConfig(session._lastConfig || {});
  if (session.agentSessionId && session.isTurnActive) {
    void callRpc(agentConfig, 'session.cancel', { sessionId: session.agentSessionId }).catch(() => {});
  }
  if (session.deepseekEventController) session.deepseekEventController.abort();
  session.deepseekEventController = null;
  session.deepseekEventSocket = null;
  session.deepseekEventReady = null;
  session.deepseekEventTask = null;
  session.deepseekAttachedSessionId = null;
  stopSessionProcess(session, options);
}

async function warmup(ws, session, config) {
  session._lastWs = ws;
  session._lastConfig = config;
  const agentConfig = resolveAgentConfig(config);
  const sessionId = await ensureHarnessSession(session, ws, agentConfig);
  await ensureEventStream(session, agentConfig, config);
  return { supported: true, process: 'deepseek harness', gatewayUrl: agentConfig.gatewayUrl, sessionId };
}

async function loadModels(session, config) {
  const agentConfig = resolveAgentConfig(config);
  const sessionId = await ensureHarnessSession(session, session._lastWs, agentConfig);
  return callRpc(agentConfig, 'session.models', { sessionId });
}

async function listProjects(_session, config) {
  const result = await callRpc(resolveAgentConfig(config), 'workspace.list', {});
  return result.items || [];
}

async function listProjectSessions(_session, config, options = {}) {
  const agentConfig = resolveAgentConfig(config);
  const projectPath = String(options.workspace || options.projectPath || '').trim();
  if (!projectPath) return [];
  const [workspaceResult, sessionResult] = await Promise.all([
    callRpc(agentConfig, 'workspace.list', {}),
    callRpc(agentConfig, 'session.list', {}),
  ]);
  const workspaces = Array.isArray(workspaceResult.items) ? workspaceResult.items : [];
  const projectKey = workspacePathKey(projectPath);
  const workspace = workspaces.find(item => options.projectId && item.workspaceId === options.projectId) ||
    workspaces.find(item => workspacePathKey(item.path) === projectKey);
  const workspaceSessionIds = new Set(Array.isArray(workspace?.sessionIds) ? workspace.sessionIds : []);
  const archivedSessionIds = new Set(
    Array.isArray(workspaceResult.archivedSessionIds) ? workspaceResult.archivedSessionIds : [],
  );
  const rows = Array.isArray(sessionResult.items) ? sessionResult.items : [];
  const sessions = rows
    .filter(item => item && typeof item.sessionId === 'string' && item.sessionId.trim())
    .filter(item => item.blank !== true && item.origin !== 'subagent')
    .filter(item => !archivedSessionIds.has(item.sessionId))
    .filter(item => workspaceSessionIds.has(item.sessionId) || workspacePathKey(item.cwd) === projectKey)
    .map(item => {
      const title = stringValue(item.projections?.values?.title) || item.sessionId;
      return {
        id: item.sessionId,
        title,
        firstMessage: title,
        updatedAt: Number.isFinite(Number(item.updatedAt)) ? Number(item.updatedAt) : 0,
        workspace: projectPath,
        workspaceId: workspace?.workspaceId || '',
        running: item.running === true,
        source: 'deepseek-harness',
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  const limit = Number(options.limit);
  return Number.isInteger(limit) && limit > 0 ? sessions.slice(0, limit) : sessions;
}

async function findProjectSession(session, config, options = {}) {
  const targetId = String(options.sessionId || '').trim();
  if (!targetId) return null;
  const sessions = await listProjectSessions(session, config, { ...options, limit: 0 });
  return sessions.find(item => item.id === targetId) || null;
}

async function readSessionHistory(_session, config, options = {}) {
  const sessionId = stringValue(options.sessionId);
  const limit = Number(options.limit);
  if (!sessionId) throw new Error('DeepSeek Harness session ID is required');
  if (!Number.isInteger(limit) || limit < 1) throw new Error('DeepSeek Harness history limit is invalid');

  const agentConfig = resolveAgentConfig(config);
  const cursor = decodeHistoryCursor(options.beforeCursor, sessionId);
  let beforeSeq = cursor?.beforeSeq;
  let entries = [];
  let hasMore = false;
  const maxMessages = Math.min(200, Math.max(20, limit * 4));

  for (let page = 0; page < 6; page++) {
    const result = await callRpc(agentConfig, 'session.history', {
      sessionId,
      ...(beforeSeq === undefined ? {} : { beforeSeq }),
      maxMessages,
    });
    const pageEntries = Array.isArray(result.events) ? result.events : [];
    entries = [...pageEntries, ...entries];
    hasMore = result.hasMore === true;

    const rounds = historyEntriesToRounds(entries, {
      includeThinking: options.includeThinking === true,
    });
    if (rounds.length >= limit || !hasMore || pageEntries.length === 0) break;

    const firstSeq = historyEntrySeq(pageEntries[0]);
    if (!Number.isInteger(firstSeq) || firstSeq < 0 || firstSeq === beforeSeq) break;
    beforeSeq = firstSeq;
  }

  const allRounds = historyEntriesToRounds(entries, {
    includeThinking: options.includeThinking === true,
  });
  const rounds = allRounds.slice(-limit);
  const moreRounds = hasMore || allRounds.length > limit;
  const boundarySeq = rounds[0]?.sourceSeq;
  return {
    rounds,
    pageInfo: {
      hasMore: moreRounds,
      nextCursor: moreRounds && Number.isInteger(boundarySeq)
        ? encodeHistoryCursor(sessionId, boundarySeq)
        : null,
      snapshotId: sessionId,
    },
    syncMeta: {
      strategy: 'deepseek_harness_rpc',
      pageMode: cursor ? 'older' : 'latest',
      eventCount: entries.length,
    },
  };
}

function historyEntriesToRounds(entries, options = {}) {
  const rounds = [];
  let current = null;

  for (const entry of entries) {
    const event = entry?.event;
    if (!event || event.surfaceOp !== 'append') continue;

    if (event.type === 'user/message' && event.data?.source?.kind === 'user') {
      if (current) rounds.push(current);
      const sourceSeq = historyEntrySeq(entry);
      current = {
        ordinal: sourceSeq + 1,
        sourceSeq,
        user: messageContentText(event.data?.content),
        userTimestamp: event.time || null,
        assistant: '',
        assistantTimestamp: null,
      };
      if (options.includeThinking === true) current.thinkingItems = [];
      continue;
    }

    if (event.type !== 'assistant/message' || !current) continue;
    const message = event.data?.message;
    if (message?.source?.kind !== 'model') continue;
    const text = messageContentText(message.content);
    if (text) current.assistant = [current.assistant, text].filter(Boolean).join('\n\n');
    current.assistantTimestamp = event.time || current.assistantTimestamp;
    if (options.includeThinking === true) {
      for (const block of Array.isArray(message.content) ? message.content : []) {
        if (block?.type === 'reasoning' && typeof block.text === 'string' && block.text.trim()) {
          current.thinkingItems.push({
            text: block.text.trim(),
            mode: 'summary',
            timestamp: event.time || null,
          });
        }
      }
    }
  }

  if (current) rounds.push(current);
  return rounds.filter(round => round.user || round.assistant);
}

function messageContentText(content) {
  if (!Array.isArray(content)) return '';
  return content.map(block => {
    if (typeof block === 'string') return block;
    if (block?.type === 'text' && typeof block.text === 'string') return block.text;
    if (block?.type === 'image') {
      const name = stringValue(block.attachment?.name || block.name);
      return name ? `[Image: ${name}]` : '[Image]';
    }
    return '';
  }).filter(Boolean).join('\n').trim();
}

function historyEntrySeq(entry) {
  const seq = Number(entry?.event?.seq);
  return Number.isInteger(seq) && seq >= 0 ? seq : -1;
}

function encodeHistoryCursor(sessionId, beforeSeq) {
  return `dsh1.${Buffer.from(JSON.stringify({ sessionId, beforeSeq }), 'utf8').toString('base64url')}`;
}

function decodeHistoryCursor(value, sessionId) {
  const cursor = stringValue(value);
  if (!cursor) return null;
  try {
    if (!cursor.startsWith('dsh1.')) throw new Error('unsupported cursor');
    const parsed = JSON.parse(Buffer.from(cursor.slice(5), 'base64url').toString('utf8'));
    if (parsed.sessionId !== sessionId || !Number.isInteger(parsed.beforeSeq) || parsed.beforeSeq < 0) {
      throw new Error('cursor identity mismatch');
    }
    return parsed;
  } catch {
    throw new Error('DeepSeek Harness history cursor is invalid');
  }
}

async function resolveWorkspaceId(agentConfig, workspace) {
  const targetKey = workspacePathKey(workspace);
  if (!targetKey) return '';
  const result = await callRpc(agentConfig, 'workspace.list', {});
  const matched = (result.items || []).find(item => workspacePathKey(item.path) === targetKey);
  return stringValue(matched?.workspaceId);
}

function workspacePathKey(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const resolved = path.resolve(text);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function applySettings(ws, session, config, options = {}) {
  session._lastWs = ws;
  session._lastConfig = config;
  if (session.isTurnActive) {
    if (session.messageQueue.length >= config.maxMessageQueue) {
      sendError(ws, '消息队列已满，请稍后再试。');
      sendTurnEnd(ws, session, 'error', { error: 'message_queue_full' });
      return true;
    }
    session.messageQueue.push({ ws, settingsOptions: options });
    sendSystem(ws, `DeepSeek 正在处理上一条消息，设置已加入队列（${session.messageQueue.length}）。`);
    return true;
  }
  try {
    const models = await loadModels(session, config);
    const current = models.current || {};
    const selected = await callRpc(resolveAgentConfig(config), 'session.selectModel', {
      sessionId: session.agentSessionId,
      provider: options.provider || providerForModel(models, options.modelId) || current.provider,
      model: options.modelId || current.model,
      ...(options.reasoningEffort ? { reasoningEffort: options.reasoningEffort } : {}),
    });
    sendSystem(ws, `DeepSeek 模型已切换为 ${selected.selected?.provider || current.provider}/${selected.selected?.model || current.model}。`);
    sendTurnEnd(ws, session);
  } catch (err) {
    sendError(ws, `DeepSeek 设置更新失败: ${err.message}`);
    sendTurnEnd(ws, session, 'error', { error: err.message });
  }
  return true;
}

async function model(ws, session, config, options = {}) {
  if (options.command === 'set') return applySettings(ws, session, config, { modelId: options.model });
  try {
    const catalog = await loadModels(session, config);
    const lines = [`当前模型: ${catalog.current?.provider || ''}/${catalog.current?.model || ''}`];
    for (const group of catalog.groups || []) {
      lines.push(`${group.name || group.id}: ${(group.models || []).map(item => item.id).join(', ') || '(无)'}`);
    }
    sendSystem(ws, lines.join('\n'));
    sendTurnEnd(ws, session);
  } catch (err) {
    sendError(ws, `无法读取 DeepSeek 模型: ${err.message}`);
    sendTurnEnd(ws, session, 'error', { error: err.message });
  }
  return true;
}

async function reasoning(ws, session, config, options = {}) {
  if (options.command === 'set') return applySettings(ws, session, config, { reasoningEffort: options.effort });
  try {
    const catalog = await loadModels(session, config);
    const current = catalog.current || {};
    const group = (catalog.groups || []).find(item => item.id === current.provider);
    const selectedModel = (group?.models || []).find(item => item.id === current.model);
    const efforts = (selectedModel?.reasoning?.efforts || []).map(item => item.id);
    sendSystem(ws, `当前推理强度: ${current.reasoningEffort || selectedModel?.reasoning?.defaultEffort || '(默认)'}\n可选: ${efforts.join(', ') || '(当前模型未提供可选项)'}`);
    sendTurnEnd(ws, session);
  } catch (err) {
    sendError(ws, `无法读取 DeepSeek 推理设置: ${err.message}`);
    sendTurnEnd(ws, session, 'error', { error: err.message });
  }
  return true;
}

function providerForModel(catalog, modelId) {
  if (!modelId) return '';
  return (catalog.groups || []).find(group => (group.models || []).some(model => model.id === modelId))?.id || '';
}

function buildPromptContent(input) {
  if (!Array.isArray(input)) return [{ type: 'text', text: String(input || '') }];
  const content = [];
  for (const block of input) {
    if (typeof block === 'string') content.push({ type: 'text', text: block });
    else if (block?.type === 'text') content.push({ type: 'text', text: block.text || '' });
    else if (block?.type === 'image' && block.source?.data) {
      content.push({ type: 'image', mediaType: block.source.media_type || 'image/png', data: block.source.data, ...(block.name ? { name: block.name } : {}) });
    } else if (block?.type !== 'meta') {
      content.push({ type: 'text', text: block?.path ? `附件路径：${block.path}` : stringifyValue(block) });
    }
  }
  return content.length ? content : [{ type: 'text', text: '' }];
}

function stringifyInput(input) {
  return buildPromptContent(input).map(part => part.type === 'text' ? part.text : '[图片附件]').join('\n');
}

function assistantMessageText(message = {}) {
  return (message.content || []).filter(block => block?.type === 'text').map(block => block.text || '').join('');
}

function toolResultText(message = {}) {
  const content = message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(block => {
      if (typeof block === 'string') return block;
      if (typeof block?.text === 'string') return block.text;
      if (typeof block?.content === 'string') return block.content;
      if (Array.isArray(block?.content)) return block.content.map(item => item?.text || item?.content || stringifyValue(item)).join('\n');
      return stringifyValue(block);
    }).filter(Boolean).join('\n');
  }
  return stringifyValue(message);
}

function stringifyValue(value) {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value || ''); }
}

function drainQueue(ws, session, config) {
  const next = session.messageQueue.shift();
  if (!next) return;
  const nextWs = next?.ws || ws;
  if (next?.settingsOptions) {
    setImmediate(() => void applySettings(nextWs, session, config, next.settingsOptions));
    return;
  }
  const input = next && Object.prototype.hasOwnProperty.call(next, 'input') ? next.input : next;
  setImmediate(() => execute(input, nextWs, session, config));
}

async function callRpc(agentConfig, method, payload, signal) {
  const rpcId = crypto.randomUUID();
  const response = await fetch(`${agentConfig.gatewayUrl}/api/${method}`, {
    method: 'POST',
    headers: buildHeaders(agentConfig, { 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify({ type: 'client-request', rpcId, method, payload }),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error(await responseErrorText(response));
  const envelope = await response.json();
  if (envelope.rpcId !== rpcId) throw new Error(`${method} rpcId 不匹配`);
  if (!envelope.result?.ok) throw new Error(envelope.result?.error?.message || `${method} 调用失败`);
  return envelope.result.value;
}

async function respond(agentConfig, rpcId, value) {
  const response = await fetch(`${agentConfig.gatewayUrl}/api/respond`, {
    method: 'POST',
    headers: buildHeaders(agentConfig, { 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify({ type: 'client-response', rpcId, result: { ok: true, value } }),
  });
  if (!response.ok) throw new Error(await responseErrorText(response));
  const receipt = await response.json();
  if (!receipt.accepted) throw new Error(receipt.reason || '响应未被 Harness 接受');
  return receipt;
}

function buildHeaders(agentConfig, extra = {}) {
  return { ...(agentConfig.apiKey ? { Authorization: `Bearer ${agentConfig.apiKey}` } : {}), ...extra };
}

async function responseErrorText(response) {
  const text = await response.text().catch(() => '');
  if (!text) return `${response.status} ${response.statusText}`;
  try { return JSON.parse(text).error?.message || text; } catch { return text; }
}

function isAbortError(err) {
  return err?.name === 'AbortError';
}

module.exports = {
  applySettings,
  execute,
  findProjectSession,
  listProjects,
  listProjectSessions,
  readSessionHistory,
  model,
  reasoning,
  resolvePendingDanger,
  resolvePendingPermission,
  stop,
  warmup,
  _internal: {
    assistantMessageText,
    buildPromptContent,
    callRpc,
    handleMuxEnvelope,
    handleSessionEvent,
    historyEntriesToRounds,
    eventStreamUrl,
    loadModels,
    listProjects,
    mapTurnEndReason,
    normalizeGatewayUrl,
    resolveWorkspaceId,
    workspacePathKey,
    toolResultText,
  },
};
