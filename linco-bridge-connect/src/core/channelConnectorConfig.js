const { getClientInfo, getDeviceIdentity } = require('./deviceIdentity');
const lincoAdapter = require('../channel/linco');
const { connectorKey } = require('../package/protocol');

function buildHeartbeatMessage(config, options = {}) {
  return lincoAdapter.buildHeartbeat(config, {
    ...options,
    device: getDeviceIdentity(config),
    client: getClientInfo(),
  });
}

function remoteConnectorSpecs(config) {
  const configured = Array.isArray(config.im?.connectors) ? config.im.connectors : [];
  if (configured.length > 0) {
    return configured
      .filter(item => item && config.agents?.[item.agentType]?.enabled && hasWsUrl(item.wsUrl))
      .map(item => ({
        agentType: item.agentType,
        agentConfig: config.agents[item.agentType],
        im: item,
      }));
  }

  return Object.entries(config.agents || { claude: { enabled: true } })
    .filter(([, agent]) => agent?.enabled)
    .map(([agentType, agent]) => {
      const im = {
        channel: config.im?.channel,
        account: config.im?.account,
        agentId: config.im?.agentId,
        appId: agent.appId || config.im?.appId,
        appSecret: agent.appSecret || config.im?.appSecret,
        wsUrl: agent.wsUrl || config.im?.wsUrl,
        allowInsecureWs: config.im?.allowInsecureWs,
      };
      return {
        agentType,
        agentConfig: agent,
        im,
      };
    })
    .filter(spec => hasWsUrl(spec.im.wsUrl));
}

function hasWsUrl(value) {
  return String(value || '').trim() !== '';
}

function imLogPrefix(agentType, imConfig = {}) {
  const channel = String(imConfig.channel || 'linco').trim() || 'linco';
  const normalizedAgentType = String(agentType || 'agent').trim() || 'agent';
  const account = String(imConfig.account || 'default').trim() || 'default';
  return `[IM:${channel}/${normalizedAgentType}/${account}]`;
}

function connectorSignature(config, agentType, agentConfig = {}, imConfig = {}) {
  return JSON.stringify({
    key: connectorKey(agentType, imConfig),
    agentType,
    imEnabled: config.im?.enabled === true,
    wsUrl: imConfig.wsUrl || agentConfig.wsUrl || config.im?.wsUrl || '',
    appId: imConfig.appId || agentConfig.appId || config.im?.appId || '',
    appSecret: imConfig.appSecret || agentConfig.appSecret || config.im?.appSecret || '',
    allowInsecureWs: (imConfig.allowInsecureWs ?? config.im?.allowInsecureWs) === true,
    connectTimeoutMs: config.im?.connectTimeoutMs,
    heartbeatMs: config.im?.heartbeatMs,
    reconnectMinMs: config.im?.reconnectMinMs,
    reconnectMaxMs: config.im?.reconnectMaxMs,
    maxPayloadBytes: config.maxWsPayloadBytes,
    account: imConfig.account || config.im?.account || '',
    channel: imConfig.channel || config.im?.channel || '',
    agentId: imConfig.agentId || config.im?.agentId || '',
  });
}

module.exports = {
  buildHeartbeatMessage,
  connectorSignature,
  hasWsUrl,
  imLogPrefix,
  remoteConnectorSpecs,
};
