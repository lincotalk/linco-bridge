const lincoAdapter = require('../channel/linco');

const {
  buildStreamId,
  normalizeLincoFiles,
  pruneUndefined,
} = lincoAdapter;

function lincoSessionKey(msg) {
  return String(msg.sessionKey || '').trim();
}

function lincoMetaFromMessage(msg) {
  const userId = stringOrUndefined(msg.userId || msg.targetId);
  return pruneUndefined({
    accountId: stringOrUndefined(msg.accountId),
    agentId: stringOrUndefined(msg.agentId),
    chatType: stringOrUndefined(msg.chatType || msg.targetType),
    targetType: stringOrUndefined(msg.targetType || msg.chatType),
    targetId: stringOrUndefined(msg.targetId || msg.userId),
    userId,
    messageId: stringOrUndefined(msg.messageId),
    streamId: stringOrUndefined(msg.streamId) || buildStreamId(msg),
    sessionKey: lincoSessionKey(msg),
    channel: stringOrUndefined(msg.channel),
  });
}

function remoteInboundMetaForLog(msg) {
  const files = normalizeLincoFiles(msg);
  return pruneUndefined({
    type: stringOrUndefined(msg.type),
    messageId: stringOrUndefined(msg.messageId),
    streamId: stringOrUndefined(msg.streamId) || buildStreamId(msg),
    sessionKey: lincoSessionKey(msg) || undefined,
    accountId: stringOrUndefined(msg.accountId),
    agentId: stringOrUndefined(msg.agentId),
    to: stringOrUndefined(msg.to),
    from: stringOrUndefined(msg.from),
    channel: stringOrUndefined(msg.channel),
    chatType: stringOrUndefined(msg.chatType || msg.targetType),
    userId: stringOrUndefined(msg.userId || msg.targetId),
    textLength: String(msg.text || '').length,
    attachmentCount: files.length,
  });
}

function remoteTurnEndMetaForLog(message) {
  return pruneUndefined({
    type: stringOrUndefined(message.type),
    requestId: stringOrUndefined(message.requestId || message.request_id),
    messageId: stringOrUndefined(message.messageId),
    streamId: stringOrUndefined(message.streamId || message.stream_id),
    sessionKey: stringOrUndefined(message.sessionKey || message.session_key),
    accountId: stringOrUndefined(message.accountId),
    agentId: stringOrUndefined(message.agentId),
    channel: stringOrUndefined(message.channel),
    reason: stringOrUndefined(message.reason),
  });
}

function connectorLincoMeta(connector, meta = {}) {
  return {
    ...meta,
    accountId: meta.accountId || connector.imConfig.account,
    agentId: meta.agentId || connector.imConfig.agentId,
    channel: meta.channel || connector.imConfig.channel,
  };
}

function lincoMetaForConnector(connector, msg) {
  return connectorLincoMeta(connector, lincoMetaFromMessage(msg));
}

function stringOrUndefined(value) {
  const text = String(value || '').trim();
  return text || undefined;
}

module.exports = {
  connectorLincoMeta,
  lincoMetaForConnector,
  lincoMetaFromMessage,
  lincoSessionKey,
  remoteInboundMetaForLog,
  remoteTurnEndMetaForLog,
  stringOrUndefined,
};
