function normalizeChannelName(value, fallback = 'linco') {
  return String(value || fallback).trim() || fallback;
}

function normalizeAccountName(value, fallback = 'default') {
  return String(value || fallback).trim() || fallback;
}

function normalizeAgentType(value, fallback = 'agent') {
  return String(value || fallback).trim() || fallback;
}

function connectorKey(agentType, channelConfig = {}) {
  const channel = normalizeChannelName(channelConfig.channel);
  const account = normalizeAccountName(channelConfig.account);
  return `${agentType}:${channel}:${account}`;
}

function remoteSessionScope(channelConfig = {}) {
  const channel = normalizeChannelName(channelConfig.channel);
  const account = normalizeAccountName(channelConfig.account);
  return `${channel}:${account}`;
}

module.exports = {
  normalizeChannelName,
  normalizeAccountName,
  normalizeAgentType,
  connectorKey,
  remoteSessionScope,
};
