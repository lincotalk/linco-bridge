const { WebSocketServer } = require('ws');
const { createLincoAdapter } = require('../channels/bridge/protocolAdapter');
const { sendError, sendSystem } = require('../core/protocol');
const { cleanupSession, createSession } = require('../core/session');
const { isLocalRequestAuthorized } = require('./auth');
const { freezeLocalLincoSelector } = require('./linco');
const { handleMessage } = require('./messages');
const { sendLocalPresence } = require('./presence');
const {
  parseAgentType,
  parseExternalSessionId,
  registerActiveSession,
  sendSessionInfo,
} = require('./session');

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

module.exports = {
  attachWebSocketServer,
  _internal: {
    freezeLocalLincoSelector,
  },
};
