const protocol = require('./protocol');
const defaults = require('./defaults');
const { buildHeartbeatMessage } = require('../../package/protocol');
const { BridgeConnectorClient } = require('../../package/connector');

function getSessionKey(msg) {
  return String(msg?.sessionKey || '').trim();
}

function getInboundText(msg) {
  return String(msg?.text || '').trim();
}

function isPing(msg) {
  return msg?.type === 'ping';
}

function isPong(msg) {
  return msg?.type === 'pong';
}

function isChatMessage(msg) {
  return msg?.type === 'inbound_message';
}

function isDangerConfirm(msg) {
  return msg?.type === 'danger_confirm';
}

function shouldRouteToAgent(msg, agentType) {
  const to = String(msg?.to || agentType);
  return ['agent', 'claude', agentType].includes(to);
}

function inboundForAgent(msg) {
  return {
    text: getInboundText(msg),
    attachments: protocol.lincoFilesToAttachments(protocol.normalizeLincoFiles(msg)),
    openclawAgentId: msg.openclawAgentId,
    agentId: msg.agentId,
    _lincoMeta: {
      accountId: msg.accountId,
      messageId: msg.messageId,
      agentId: msg.agentId,
      openclawAgentId: msg.openclawAgentId,
    },
  };
}

function buildHeartbeat(config, options = {}) {
  return buildHeartbeatMessage(config, options);
}

module.exports = {
  name: 'linco',
  defaults,
  Client: BridgeConnectorClient,
  ...protocol,
  buildHeartbeat,
  getInboundText,
  getSessionKey,
  inboundForAgent,
  isChatMessage,
  isDangerConfirm,
  isPing,
  isPong,
  isRemoteMessage: protocol.isLincoMessage,
  shouldRouteToAgent,
};
