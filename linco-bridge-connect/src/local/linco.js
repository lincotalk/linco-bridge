const { executeAgentQuery } = require('../runtime/agentRunner');
const { handleMessageWithAttachments } = require('../attachment/attachmentHandler');
const { send } = require('../core/protocol');
const { saveSessionMetadata } = require('../core/session');
const { handleSlashCommand, isBridgeControlCommand } = require('../command');
const { toInternal, createLincoAdapter } = require('../channel/linco/protocol');
const { _internal: imConnectorInternals } = require('../core/channelConnector');
const { logUserInput } = require('../core/conversationLog');
const { sendLocalPresence } = require('./presence');

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

module.exports = {
  freezeLocalLincoSelector,
  handleLincoInboundMessage,
  updateLincoTurnMeta,
};
