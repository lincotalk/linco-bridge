const { getClientInfo, getDeviceIdentity } = require('./deviceIdentity');
const { lincoMetaDefaults, pruneUndefined } = require('../channel/linco/protocol');

function buildPresenceEvent(config, options = {}) {
  const status = options.status || 'online';
  const meta = lincoMetaDefaults(config, options.meta || {});
  const device = getDeviceIdentity(config);
  return pruneUndefined({
    type: 'presence_event',
    from: options.agentType || 'agent',
    to: 'robot',
    source: 'ws',
    ts: Date.now(),
    accountId: meta.accountId,
    agentId: meta.agentId,
    channel: meta.channel,
    status,
    reason: options.reason,
    device: status === 'offline' ? { id: device.id } : device,
    client: getClientInfo(),
  });
}

module.exports = {
  buildPresenceEvent,
};
