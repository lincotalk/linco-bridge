const { readUserConfig } = require('../config');

function resolveOpenClawAgentIdFromMessage(msg, session, agentConfig, config) {
  if (session.openclawAgentId) return String(session.openclawAgentId).trim() || 'main';
  return String(
    msg.openclawAgentId ||
    accountSelectorFromMessage(msg, session, config, 'openclaw', 'openclawAgentId') ||
    agentConfig.openclawAgentId ||
    config.agents?.openclaw?.openclawAgentId ||
    'main'
  ).trim() || 'main';
}

function resolveHermesProfileFromMessage(msg, session, agentConfig, config) {
  if (session.hermesProfile) return String(session.hermesProfile).trim() || 'default';
  return String(
    msg.hermesProfile ||
    msg.profile ||
    accountSelectorFromMessage(msg, session, config, 'hermes', 'profile') ||
    agentConfig.profile ||
    config.agents?.hermes?.profile ||
    'default'
  ).trim() || 'default';
}

function accountSelectorFromMessage(msg, session, config, agentType, key) {
  const account = String(msg?.accountId || session?.linco?.accountId || config?.im?.account || 'default').trim() || 'default';
  const channel = String(msg?.channel || session?.linco?.channel || config?.im?.channel || 'linco').trim() || 'linco';
  const channelConfig = readChannelAgentConfig(config, channel, agentType);
  return channelConfig?.accounts?.[account]?.[key] || '';
}

function readChannelAgentConfig(config, channel, agentType) {
  const fromRuntime = config?.channels?.[channel]?.agents?.[agentType];
  if (fromRuntime) return fromRuntime;
  if (!config?.configFile) return null;
  try {
    return readUserConfig(config.configFile).channels?.[channel]?.agents?.[agentType] || null;
  } catch {
    return null;
  }
}

module.exports = {
  accountSelectorFromMessage,
  readChannelAgentConfig,
  resolveHermesProfileFromMessage,
  resolveOpenClawAgentIdFromMessage,
};
