const LINCO_INBOUND_TYPES = new Set([
  'ping',
  'pong',
  'inbound_message',
  'danger_confirm',
  'permission_response',
  'stop_turn',
]);

function isLincoMessage(msg) {
  return msg && typeof msg === 'object' && LINCO_INBOUND_TYPES.has(msg.type);
}

function pruneUndefined(value) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, item]) => item !== undefined),
  );
}

function buildStreamId(msg = {}, options = {}) {
  const prefix = options.prefix || 'linco-stream';
  const messageId = String(msg.messageId || '').trim();
  if (messageId) return `${prefix}-${messageId}`;
  const now = typeof options.now === 'function' ? options.now() : Date.now();
  return `${prefix}-${now}`;
}

function lincoMetaDefaults(config = {}, meta = {}) {
  return {
    accountId: meta.accountId || config.im?.account || 'main',
    agentId: meta.agentId || config.im?.agentId || 'main',
    chatType: meta.chatType || 'direct',
    targetType: meta.targetType || meta.chatType || 'direct',
    targetId: meta.targetId || meta.userId,
    userId: meta.userId || meta.targetId,
    messageId: meta.messageId,
    streamId: meta.streamId,
    channel: meta.channel || config.im?.channel || 'linco',
  };
}

function buildHeartbeatMessage(config = {}, options = {}) {
  const meta = lincoMetaDefaults(config, options.meta || {});
  const now = typeof options.now === 'function' ? options.now() : Date.now();
  return pruneUndefined({
    type: options.type || 'ping',
    from: options.agentType || 'agent',
    to: options.to || 'robot',
    source: options.source || 'ws',
    ts: options.ts || now,
    accountId: meta.accountId,
    agentId: meta.agentId,
    channel: meta.channel,
    device: options.device,
    client: options.client,
  });
}

module.exports = {
  LINCO_INBOUND_TYPES,
  isLincoMessage,
  pruneUndefined,
  buildStreamId,
  lincoMetaDefaults,
  buildHeartbeatMessage,
};
