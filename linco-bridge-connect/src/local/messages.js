const { executeAgentQuery, resolvePendingDanger, resolvePendingPermission } = require('../runtime/agentRunner');
const { handleLegacyImageMessage, handleMessageWithAttachments } = require('../attachments/attachmentHandler');
const { send, sendError } = require('../core/protocol');
const { handleSlashCommand, isBridgeControlCommand } = require('../commands');
const { isLincoMessage } = require('../channels/bridge/protocolAdapter');
const { logUserInput } = require('../core/conversationLog');
const { handleLincoInboundMessage } = require('./linco');
const { stopCurrentTurn } = require('./turn');

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

module.exports = {
  handleMessage,
};
