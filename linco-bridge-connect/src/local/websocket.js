const { WebSocketServer } = require('ws');
const { executeAgentQuery, resolvePendingDanger, resolvePendingPermission, stopAgentProcess } = require('../runtime/agentRunner');
const { handleLegacyImageMessage, handleMessageWithAttachments } = require('../attachments/attachmentHandler');
const { isLocalRequestAuthorized } = require('./auth');
const { send, sendError, sendSystem, sendTurnEnd } = require('../core/protocol');
const { cleanupSession, createSession, saveSessionMetadata } = require('../core/session');
const { handleSlashCommand, isBridgeControlCommand } = require('../commands');
const { isLincoMessage, toInternal, createLincoAdapter } = require('../channels/bridge/protocolAdapter');
const { _internal: imConnectorInternals } = require('../channels/bridge/connector');
const { buildPresenceEvent } = require('../channels/bridge/presence');
const { logUserInput } = require('../core/conversationLog');

function attachWebSocketServer(server, config) {
  const log = config.logger;
  const activeSessions = config.activeSessions || new Map();
  config.activeSessions = activeSessions;
  const wss = new WebSocketServer({ server, maxPayload: config.maxWsPayloadBytes });

  wss.on('connection', (ws, request) => {
    const url = new URL(request?.url || '/', 'http://localhost');
    if (!isLocalRequestAuthorized(request, config, url)) {
      log?.warn('websocket authorization failed', { path: url.pathname });
      ws.close(1008, 'Unauthorized local test access');
      return;
    }

    let session;
    try {
      session = createSession(config, { externalSessionId: parseExternalSessionId(request), agentType: parseAgentType(request, config) });
    } catch (err) {
      log?.error('session initialization failed', { error: err.message });
      sendError(ws, `❌ 会话初始化失败: ${err.message}`);
      ws.close(1008, 'Invalid session_id');
      return;
    }

    if (!registerActiveSession(activeSessions, session)) {
      log?.warn('duplicate websocket session rejected', { sessionId: session.id });
      cleanupSession(session);
      sendError(ws, '❌ 该 session_id 已有活动连接');
      ws.close(1008, 'Session already active');
      return;
    }

    // Detect Linco mode from URL parameter
    const lincoMode = url.searchParams.get('linco') !== null;
    let effectiveWs = ws;
    if (lincoMode) {
      session.linco = {
        accountId: 'local-mock',
        agentId: 'main',
        chatType: 'direct',
        streamId: `linco-stream-${Date.now()}`,
        fullText: '',
      };
      effectiveWs = createLincoAdapter(ws, session, config);
      session._lincoAdapterActive = true;
      config.logger?.info('linco protocol activated on connect', { sessionId: session.id });
      sendLocalPresence(ws, session, config, 'online');
    }

    session.ws = effectiveWs;

    log?.info('websocket session opened', { sessionId: session.id, workspace: session.workspace });
    sendSessionInfo(effectiveWs, session, config);
    sendSystem(effectiveWs, `👋 已连接到 Linco Agent\n📂 工作目录: ${session.workspace}\n📋 输入 /help 查看可用命令`);

    ws.on('message', (data) => {
      handleMessage(data, ws, session, config);
    });

    ws.on('close', (code, reason) => {
      log?.info('websocket session closed', {
        sessionId: session.id,
        code,
        reason: reason?.toString(),
      });
      if (activeSessions.get(session.activeKey) === session) {
        activeSessions.delete(session.activeKey);
      }
      if (session._lincoAdapterActive) {
        sendLocalPresence(ws, session, config, 'offline', 'local_websocket_closed');
      }
      cleanupSession(session);
    });

    ws.on('error', (err) => {
      log?.error('websocket error', { sessionId: session.id, error: err.message });
    });
  });

  return wss;
}

function parseExternalSessionId(request) {
  const rawUrl = request?.url || '/';
  const url = new URL(rawUrl, 'http://localhost');
  if (!url.searchParams.has('session_id') && !url.searchParams.has('sessionId')) return undefined;

  const sessionId = url.searchParams.get('session_id') ?? url.searchParams.get('sessionId');
  if (!String(sessionId || '').trim()) {
    throw new Error('session_id 不能为空');
  }
  return sessionId;
}

function parseAgentType(request, config) {
  const rawUrl = request?.url || '/';
  const url = new URL(rawUrl, 'http://localhost');
  const requested = String(url.searchParams.get('agentType') || '').trim().toLowerCase();
  if (requested && config.agents?.[requested]) return requested;
  return config.defaultLocalAgent || 'claude';
}

function registerActiveSession(activeSessions, session) {
  if (activeSessions.has(session.activeKey)) return false;
  activeSessions.set(session.activeKey, session);
  return true;
}

function sendSessionInfo(ws, session, config) {
  send(ws, 'session_info', {
    sessionId: session.id,
    sessionIdSource: session.idSource,
    storageId: session.storageId,
    agentType: session.agentType,
    agentSessionId: session.agentSessionId,
    workspace: session.workspace,
    runtime: {
      dir: session.runtimeDir,
      attachmentsDir: session.attachmentsDir,
    },
    upload: {
      maxCount: config.maxAttachmentCount,
      maxFileBytes: config.maxAttachmentBytes,
      maxTotalBytes: config.maxTotalAttachmentBytes,
      blockedExtensions: config.allowUnsafeAttachments ? [] : config.unsafeAttachmentExtensions,
    },
    capabilities: {
      incomingAttachments: true,
      multimodalImages: ['claude', 'hermes', 'openclaw'].includes(session.agentType),
    },
  });
}

function handleMessage(data, ws, session, config) {
  let msg;
  try {
    msg = JSON.parse(data.toString());
  } catch (err) {
    config.logger?.warn('invalid websocket message json', { sessionId: session.id, error: err.message });
    sendError(ws, '❌ 消息格式错误');
    return;
  }

  // --- Linco protocol handling ---
  if (isLincoMessage(msg)) {
    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', from: 'linco', ts: Date.now() }));
      return;
    }
    if (msg.type === 'pong') return;

    if (msg.type === 'inbound_message') {
      handleLincoInboundMessage(msg, ws, session, config);
      return;
    }

    // danger_confirm / permission_response in Linco format
    if (msg.type === 'danger_confirm') {
      config.logger?.info('danger confirmation received (linco)', { sessionKey: msg.sessionKey, approved: !!msg.approved });
      if (!resolvePendingDanger(!!msg.approved, session.ws, session, config)) {
        sendError(session.ws, '❌ 没有待确认的危险操作');
      }
      return;
    }
    if (msg.type === 'permission_response') {
      config.logger?.info('permission response received (linco)', { sessionKey: msg.sessionKey, approved: !!msg.approved });
      if (!resolvePendingPermission(!!msg.approved, session.ws, session, config, msg.requestId)) {
        sendError(session.ws, '❌ 没有待确认的工具权限请求');
      }
      return;
    }
    if (msg.type === 'stop_turn') {
      stopCurrentTurn(ws, session, config, 'user_cancelled');
      return;
    }
    return;
  }

  // --- Internal protocol handling ---
  if (msg.type === 'danger_confirm') {
    config.logger?.info('danger confirmation received', { sessionId: session.id, approved: !!msg.approved });
    if (!resolvePendingDanger(!!msg.approved, ws, session, config)) {
      sendError(ws, '❌ 没有待确认的危险操作');
    }
    return;
  }

  if (msg.type === 'permission_response') {
    config.logger?.info('permission response received', { sessionId: session.id, approved: !!msg.approved });
    if (!resolvePendingPermission(!!msg.approved, ws, session, config, msg.requestId)) {
      sendError(ws, '❌ 没有待确认的工具权限请求');
    }
    return;
  }

  if (msg.type === 'stop_turn') {
    stopCurrentTurn(ws, session, config, 'user_cancelled');
    return;
  }

  if (msg.type === 'message') {
    const rawText = String(msg.text || '').trim();
    const attachments = Array.isArray(msg.attachments) ? msg.attachments.length : 0;
    config.logger?.info('user message received', {
      sessionId: session.id,
      type: msg.type,
      chars: rawText.length,
      attachments,
    });
    logUserInput(config, session, {
      source: 'websocket',
      text: rawText,
      attachments,
    });
    if ((rawText.startsWith('/') || isBridgeControlCommand(rawText)) && (!Array.isArray(msg.attachments) || msg.attachments.length === 0)) {
      if (handleSlashCommand(rawText, ws, session, config)) return;
    }

    send(ws, 'turn_start', {});
    handleMessageWithAttachments(msg, ws, session, config, executeAgentQuery);
    return;
  }

  if (msg.type === 'image') {
    config.logger?.info('legacy image message received', { sessionId: session.id });
    send(ws, 'turn_start', {});
    handleLegacyImageMessage(msg, ws, session, config, executeAgentQuery);
    return;
  }

  if (!msg.type && typeof msg.text === 'string') {
    const rawText = msg.text.trim();
    config.logger?.info('legacy text message received', { sessionId: session.id, chars: rawText.length });
    logUserInput(config, session, {
      source: 'legacy-websocket',
      text: rawText,
      attachments: 0,
    });

    if ((rawText.startsWith('/') || isBridgeControlCommand(rawText)) && handleSlashCommand(rawText, ws, session, config)) {
      return;
    }

    send(ws, 'turn_start', {});
    executeAgentQuery(rawText, ws, session, config);
    return;
  }

  config.logger?.warn('unknown websocket message type', { sessionId: session.id, type: msg.type || '(empty)' });
  sendError(ws, `❌ 未知消息类型: ${msg.type || '(空)'}`);
}

function handleLincoInboundMessage(msg, rawWs, session, config) {
  // Activate Linco adapter on first inbound message (if not already activated via URL param)
  if (!session._lincoAdapterActive) {
    // Update session ID from Linco sessionKey if available
    if (msg.sessionKey) {
      session.id = msg.sessionKey;
      session.activeKey = `${session.agentType}:${msg.sessionKey}`;
      if (config.activeSessions) {
        config.activeSessions.set(session.activeKey, session);
      }
    }

    // Initialize linco metadata
    session.linco = {
      accountId: msg.accountId || 'local-mock',
      agentId: msg.agentId || 'main',
      openclawAgentId: msg.openclawAgentId,
      chatType: msg.chatType || 'direct',
      userId: msg.userId,
      messageId: msg.messageId,
      streamId: msg.streamId || `linco-stream-${msg.messageId || Date.now()}`,
      fullText: '',
    };

    // Wrap ws with Linco adapter for outbound conversion
    const adapterWs = createLincoAdapter(rawWs, session, config);
    session.ws = adapterWs;

    session._lincoAdapterActive = true;
    config.logger?.info('linco protocol activated', { sessionId: session.id });
    sendLocalPresence(rawWs, session, config, 'online');
  } else {
    updateLincoTurnMeta(session, msg);
  }

  // Convert to internal format and route
  const internal = toInternal(msg);
  freezeLocalLincoSelector(msg, session, config);
  const rawText = internal.text || '';
  const attachments = internal.attachments || [];

  config.logger?.info('linco inbound message', {
    sessionId: session.id,
    chars: rawText.length,
    attachments: attachments.length,
  });
  logUserInput(config, session, {
    source: 'linco',
    text: rawText,
    attachments: attachments.length,
  });

  if ((rawText.startsWith('/') || isBridgeControlCommand(rawText)) && attachments.length === 0) {
    if (handleSlashCommand(rawText, session.ws, session, config)) return;
  }

  send(session.ws, 'turn_start', {});
  handleMessageWithAttachments(internal, session.ws, session, config, executeAgentQuery);
}

function freezeLocalLincoSelector(msg, session, config) {
  const agentType = session.agentType || 'claude';
  if (agentType === 'openclaw' && !session.openclawAgentId) {
    session.openclawAgentId = String(
      msg.openclawAgentId ||
      imConnectorInternals.accountSelectorFromMessage(msg, session, config, 'openclaw', 'openclawAgentId') ||
      config.agents?.openclaw?.openclawAgentId ||
      'main'
    ).trim() || 'main';
    if (session.runtimeDir) saveSessionMetadata(session);
  }
  if (agentType === 'hermes' && !session.hermesProfile) {
    session.hermesProfile = String(
      msg.hermesProfile ||
      msg.profile ||
      imConnectorInternals.accountSelectorFromMessage(msg, session, config, 'hermes', 'profile') ||
      config.agents?.hermes?.profile ||
      'default'
    ).trim() || 'default';
    if (session.runtimeDir) saveSessionMetadata(session);
  }
}

function updateLincoTurnMeta(session, msg) {
  if (!session.linco) return;
  session.linco.accountId = msg.accountId || session.linco.accountId || 'local-mock';
  session.linco.agentId = msg.agentId || session.linco.agentId || 'main';
  session.linco.openclawAgentId = msg.openclawAgentId || session.linco.openclawAgentId;
  session.linco.chatType = msg.chatType || session.linco.chatType || 'direct';
  session.linco.userId = msg.userId || session.linco.userId;
  session.linco.messageId = msg.messageId || session.linco.messageId;
  session.linco.streamId = msg.streamId || (msg.messageId ? `linco-stream-${msg.messageId}` : session.linco.streamId);
}

function stopCurrentTurn(rawWs, session, config, reason = 'cancelled') {
  const targetWs = session.ws || rawWs;
  if (!session.isTurnActive) {
    sendSystem(targetWs, 'No active task to stop.');
    sendTurnEnd(targetWs, session, 'idle');
    return false;
  }
  config.logger?.info('stop requested', { sessionId: session.id, agentType: session.agentType, reason });
  stopAgentProcess(session, { clearAgentSession: false });
  sendSystem(targetWs, 'Task stop requested.');
  sendTurnEnd(targetWs, session, reason);
  return true;
}

function sendLocalPresence(rawWs, session, config, status, reason) {
  try {
    rawWs.send(JSON.stringify(buildPresenceEvent(config, {
      agentType: session.agentType,
      status,
      reason,
      meta: session.linco,
    })));
  } catch {}
}

module.exports = {
  attachWebSocketServer,
  _internal: {
    freezeLocalLincoSelector,
  },
};
