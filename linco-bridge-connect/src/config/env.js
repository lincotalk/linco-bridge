const os = require('os');
const path = require('path');
const { findGitBash, resolveCommand } = require('./commandResolution');
const { getConfigFile, readUserConfig } = require('./io');
const {
  DEFAULT_IM_IDLE_SESSION_MS,
  DEFAULT_UNSAFE_ATTACHMENT_EXTENSIONS,
  TIMEOUT,
} = require('./defaults');
const {
  getChannelAgentWsUrl,
  getChannelAgentWsUrls,
} = require('../core/channelRegistry');

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function listFromEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  return value
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
    .map(item => item.startsWith('.') ? item : `.${item}`);
}

function parseToken(value) {
  if (!value) return { appId: '', appSecret: '' };
  const separator = value.indexOf(':');
  if (separator < 0) return { appId: value.trim(), appSecret: '' };
  return {
    appId: value.slice(0, separator).trim(),
    appSecret: value.slice(separator + 1).trim(),
  };
}

function selectedChannelConfig(userConfig) {
  const channel = process.env.LINCO_CHANNEL || userConfig.defaultChannel || 'linco';
  const channelConfig = userConfig.channels?.[channel];
  const agentType = process.env.LINCO_AGENT || userConfig.defaultAgent || inferDefaultAgent(channelConfig) || 'claude';
  const agentConfig = channelConfig?.agents?.[agentType];
  const account = process.env.LINCO_ACCOUNT || agentConfig?.defaultAccount || 'default';
  const accountConfig = agentConfig?.accounts?.[account];

  return {
    channel,
    agentType,
    account,
    ...(accountConfig || {}),
  };
}

function inferDefaultAgent(channelConfig) {
  const agents = channelConfig?.agents || {};
  const configuredAgents = Object.entries(agents)
    .filter(([, agent]) => Object.keys(agent?.accounts || {}).length > 0)
    .map(([agentType]) => agentType);
  if (configuredAgents.length === 1) return configuredAgents[0];

  const enabledAgents = Object.entries(agents)
    .filter(([, agent]) => Object.values(agent?.accounts || {}).some(account => account?.enabled === true))
    .map(([agentType]) => agentType);
  return enabledAgents.length === 1 ? enabledAgents[0] : null;
}

function stringFromEnv(name, fallback = '') {
  return process.env[name] || fallback || '';
}

function booleanFromEnv(name, fallback = false) {
  const value = process.env[name];
  if (value == null || value === '') return !!fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function selectedImEnabled(userConfig, imConfig) {
  return booleanFromEnv('LINCO_IM_ENABLED', imConfig.enabled === true || userConfig.im?.enabled === true);
}

function localImEnabled(userConfig) {
  return booleanFromEnv('LINCO_LOCAL_IM_ENABLED', userConfig.localWeb?.imEnabled === true);
}

function localWebEnabled(userConfig) {
  // 本地测试页跟随本地模拟IM的开关，--local-im 时一并启用
  return booleanFromEnv('LINCO_LOCAL_WEB_ENABLED', userConfig.localWeb?.enabled === true || localImEnabled(userConfig));
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function selectedChannelName(userConfig) {
  return process.env.LINCO_CHANNEL || userConfig.defaultChannel || 'linco';
}

function configuredActiveChannels(userConfig) {
  if (process.env.LINCO_CHANNEL) return [String(process.env.LINCO_CHANNEL).trim()].filter(Boolean);

  const activeChannels = userConfig.activeChannels;
  const channels = Array.isArray(activeChannels)
    ? activeChannels
    : String(activeChannels || '').split(',');
  const normalized = channels
    .map(channel => String(channel || '').trim())
    .filter(Boolean);

  return normalized.length > 0 ? Array.from(new Set(normalized)) : [selectedChannelName(userConfig)];
}

function agentConfigFromChannels(userConfig, agentType) {
  const channels = userConfig.channels || {};
  for (const channelKey of Object.keys(channels)) {
    const agents = channels[channelKey]?.agents || {};
    if (agents[agentType]) return agents[agentType];
  }
  return null;
}

function agentConfig(userConfig, imConfig, agentType, defaults = {}) {
  const configured = userConfig.agents?.[agentType] || {};
  const hasAgentEnabled = hasOwn(configured, 'enabled');
  const channelAgentConfig = agentConfigFromChannels(userConfig, agentType);
  const channelAccount = channelAgentConfig
    ? channelAgentConfig.accounts?.[channelAgentConfig.defaultAccount || 'default']
    : null;
  const channelAccountEnabled = channelAgentConfig && Object.values(channelAgentConfig.accounts || {}).some(
    account => account.enabled === true
  );
  const enabledFallback = hasAgentEnabled ? configured.enabled === true : channelAccountEnabled;
  const enabled = booleanFromEnv(`LINCO_${agentType.toUpperCase()}_ENABLED`, enabledFallback);
  const binEnv = `LINCO_${agentType.toUpperCase()}_BIN`;
  const wsEnv = `LINCO_${agentType.toUpperCase()}_WS_URL`;
  const gatewayEnv = `LINCO_${agentType.toUpperCase()}_GATEWAY_URL`;
  const apiKeyEnv = `LINCO_${agentType.toUpperCase()}_API_KEY`;
  const instructionsEnv = `LINCO_${agentType.toUpperCase()}_INSTRUCTIONS`;
  const agentIdEnv = `LINCO_${agentType.toUpperCase()}_AGENT_ID`;
  const appIdEnv = `LINCO_${agentType.toUpperCase()}_APP_ID`;
  const appSecretEnv = `LINCO_${agentType.toUpperCase()}_APP_SECRET`;
  const hermesBin = agentType === 'hermes'
    ? resolveCommand(stringFromEnv('LINCO_HERMES_BIN', process.env.HERMES_BIN || configured.hermesBin || configured.bin || defaults.hermesBin || defaults.bin || 'hermes'))
    : undefined;

  return {
    type: agentType,
    enabled,
    bin: resolveCommand(stringFromEnv(binEnv, channelAccount?.bin || configured.bin || defaults.bin)),
    wsUrl: stringFromEnv(wsEnv, channelAccount?.wsUrl || configured.wsUrl || defaults.wsUrl),
    mode: stringFromEnv(`LINCO_${agentType.toUpperCase()}_MODE`, configured.mode || defaults.mode),
    model: stringFromEnv(`LINCO_${agentType.toUpperCase()}_MODEL`, configured.model || defaults.model),
    gatewayUrl: stringFromEnv(gatewayEnv, channelAccount?.gatewayUrl || channelAccount?.baseUrl || configured.gatewayUrl || configured.baseUrl || defaults.gatewayUrl),
    apiKey: stringFromEnv(apiKeyEnv, channelAccount?.apiKey || configured.apiKey || defaults.apiKey),
    instructions: stringFromEnv(instructionsEnv, configured.instructions || defaults.instructions),
    ...(agentType === 'hermes' ? {
      autoStartGateway: booleanFromEnv('LINCO_HERMES_AUTO_START_GATEWAY', configured.autoStartGateway ?? defaults.autoStartGateway ?? true),
      profileScopedGateway: booleanFromEnv('LINCO_HERMES_PROFILE_SCOPED_GATEWAY', configured.profileScopedGateway ?? defaults.profileScopedGateway ?? true),
      hermesBin,
      profile: stringFromEnv('LINCO_HERMES_PROFILE', channelAccount?.profile || configured.profile || defaults.profile || 'default'),
      hermesHome: stringFromEnv('LINCO_HERMES_HOME', process.env.HERMES_HOME || configured.hermesHome || defaults.hermesHome),
      gatewayStartTimeoutMs: numberFromEnv('LINCO_HERMES_GATEWAY_START_TIMEOUT_MS', configured.gatewayStartTimeoutMs || defaults.gatewayStartTimeoutMs || 15000),
      compactionTimeoutMs: numberFromEnv('LINCO_HERMES_COMPACTION_TIMEOUT_MS', channelAccount?.compactionTimeoutMs || configured.compactionTimeoutMs || defaults.compactionTimeoutMs || 300000),
    } : {}),
    ...(agentType === 'openclaw' ? {
      autoStartGateway: booleanFromEnv('LINCO_OPENCLAW_AUTO_START_GATEWAY', configured.autoStartGateway ?? channelAccount?.autoStartGateway ?? defaults.autoStartGateway ?? true),
      gatewayStartTimeoutMs: numberFromEnv('LINCO_OPENCLAW_GATEWAY_START_TIMEOUT_MS', configured.gatewayStartTimeoutMs || channelAccount?.gatewayStartTimeoutMs || defaults.gatewayStartTimeoutMs || 30000),
      turnTimeoutMs: numberFromEnv('LINCO_OPENCLAW_TURN_TIMEOUT_MS', configured.turnTimeoutMs || channelAccount?.turnTimeoutMs || defaults.turnTimeoutMs || TIMEOUT),
      compactionTimeoutMs: numberFromEnv('LINCO_OPENCLAW_COMPACTION_TIMEOUT_MS', channelAccount?.compactionTimeoutMs || configured.compactionTimeoutMs || defaults.compactionTimeoutMs || 300000),
      openclawAgentId: stringFromEnv(agentIdEnv, channelAccount?.openclawAgentId || configured.openclawAgentId || defaults.openclawAgentId || 'main'),
    } : {}),
    ...(agentType === 'codex' ? {
      networkAccess: booleanFromEnv('LINCO_CODEX_NETWORK_ACCESS', channelAccount?.networkAccess ?? configured.networkAccess ?? defaults.networkAccess ?? true),
      compactionTimeoutMs: numberFromEnv('LINCO_CODEX_COMPACTION_TIMEOUT_MS', channelAccount?.compactionTimeoutMs || configured.compactionTimeoutMs || defaults.compactionTimeoutMs || 300000),
    } : {}),
    ...(agentType === 'claude' ? {
      addRuntimeDir: booleanFromEnv('LINCO_CLAUDE_ADD_RUNTIME_DIR', configured.addRuntimeDir ?? channelAccount?.addRuntimeDir ?? defaults.addRuntimeDir ?? true),
      compactionTimeoutMs: numberFromEnv('LINCO_CLAUDE_COMPACTION_TIMEOUT_MS', channelAccount?.compactionTimeoutMs || configured.compactionTimeoutMs || defaults.compactionTimeoutMs || 300000),
    } : {}),
    appId: stringFromEnv(appIdEnv, channelAccount?.appId || configured.appId),
    appSecret: stringFromEnv(appSecretEnv, channelAccount?.appSecret || configured.appSecret),
  };
}

function defaultAccountFromChannel(userConfig, channel, agentType) {
  const agent = userConfig.channels?.[channel]?.agents?.[agentType];
  if (!agent) return {};
  const accountKey = agent.defaultAccount || 'default';
  return agent.accounts?.[accountKey] || {};
}

function explicitAgentWsUrl(userConfig, agentType) {
  const upperAgentType = agentType.toUpperCase();
  const agentWsEnv = process.env[`LINCO_${upperAgentType}_WS_URL`];
  if (agentWsEnv) return agentWsEnv;
  if (agentType === 'claude' && process.env.LINCO_WS_URL) return process.env.LINCO_WS_URL;
  return userConfig.agents?.[agentType]?.wsUrl || '';
}

function channelConnectorWsUrl(userConfig, channel, agentType, accountConfig = {}) {
  return accountConfig.wsUrl
    || explicitAgentWsUrl(userConfig, agentType)
    || getChannelAgentWsUrl(channel, agentType);
}

function hasWsUrl(value) {
  return String(value || '').trim() !== '';
}

function remoteImConnectorsFromChannels(userConfig, agents = {}, imConfig = {}) {
  const channels = configuredActiveChannels(userConfig);
  const selectedChannel = selectedChannelName(userConfig);
  const selectedAgent = process.env.LINCO_AGENT ? String(process.env.LINCO_AGENT).trim().toLowerCase() : '';
  const selectedAccount = process.env.LINCO_ACCOUNT ? String(process.env.LINCO_ACCOUNT).trim() : '';
  const tokenConfig = parseToken(process.env.LINCO_TOKEN || imConfig.token);
  const overrideAppId = process.env.LINCO_APP_ID || tokenConfig.appId;
  const overrideAppSecret = process.env.LINCO_APP_SECRET || tokenConfig.appSecret;
  const result = [];

  for (const channel of channels) {
    const channelAgents = userConfig.channels?.[channel]?.agents || {};
    for (const [agentType, channelAgentConfig] of Object.entries(channelAgents)) {
      if (selectedAgent && agentType !== selectedAgent) continue;
      const runtimeAgent = agents[agentType];
      if (!runtimeAgent?.enabled) continue;

      for (const [accountName, accountConfig] of Object.entries(channelAgentConfig?.accounts || {})) {
        if (selectedAccount && accountName !== selectedAccount) continue;
        if (accountConfig?.enabled !== true) continue;

        const appId = selectedAccount ? (overrideAppId || accountConfig.appId || runtimeAgent.appId) : (accountConfig.appId || runtimeAgent.appId);
        const appSecret = selectedAccount ? (overrideAppSecret || accountConfig.appSecret || runtimeAgent.appSecret) : (accountConfig.appSecret || runtimeAgent.appSecret);
        const wsUrl = channelConnectorWsUrl(userConfig, channel, agentType, accountConfig);
        if (!hasWsUrl(wsUrl)) continue;

        result.push({
          channel,
          account: accountName,
          agentType,
          agentId: stringFromEnv('LINCO_AGENT_ID', accountConfig.agentId || imConfig.agentId || userConfig.im?.agentId || 'main'),
          appId,
          appSecret,
          wsUrl,
          allowInsecureWs: accountConfig.allowInsecureWs === true || imConfig.allowInsecureWs === true || userConfig.im?.allowInsecureWs === true,
        });
      }
    }
  }

  if (result.length > 0) return result;

  const selectedRuntimeAgent = agents[imConfig.agentType];
  const fallbackWsUrl = imConfig.wsUrl || explicitAgentWsUrl(userConfig, imConfig.agentType) || getChannelAgentWsUrl(selectedChannel, imConfig.agentType);
  if (selectedRuntimeAgent?.enabled && hasWsUrl(fallbackWsUrl) && (overrideAppId || imConfig.appId || selectedRuntimeAgent.appId)) {
    result.push({
      channel: selectedChannel,
      account: imConfig.account || 'default',
      agentType: imConfig.agentType,
      agentId: stringFromEnv('LINCO_AGENT_ID', imConfig.agentId || userConfig.im?.agentId || 'main'),
      appId: overrideAppId || imConfig.appId || selectedRuntimeAgent.appId,
      appSecret: overrideAppSecret || imConfig.appSecret || selectedRuntimeAgent.appSecret,
      wsUrl: fallbackWsUrl,
      allowInsecureWs: imConfig.allowInsecureWs === true || userConfig.im?.allowInsecureWs === true,
    });
  }

  return result;
}

function loadConfig(rootDir) {
  const configFile = getConfigFile();
  const userConfig = readUserConfig(configFile);
  const imConfig = selectedChannelConfig(userConfig);
  const gitBashPath = findGitBash(userConfig);
  const gitBashEnv = gitBashPath ? gitBashPath.replace(/\\/g, '/') : null;
  const tokenConfig = parseToken(process.env.LINCO_TOKEN || imConfig.token);
  const lincoHome = stringFromEnv('LINCO_HOME', userConfig.lincoHome || path.join(os.homedir(), '.linco'));
  const sessionsDir = stringFromEnv('LINCO_SESSIONS_DIR', userConfig.sessionsDir || path.join(lincoHome, 'sessions'));
  const accountAgentType = imConfig.agentType;
  const selectedChannelWsUrls = getChannelAgentWsUrls(imConfig.channel);
  const codexAccountConfig = defaultAccountFromChannel(userConfig, imConfig.channel, 'codex');
  const hermesAccountConfig = defaultAccountFromChannel(userConfig, imConfig.channel, 'hermes');
  const openclawAccountConfig = defaultAccountFromChannel(userConfig, imConfig.channel, 'openclaw');
  const agents = {
    claude: agentConfig(userConfig, imConfig, 'claude', {
      bin: stringFromEnv('CLAUDE_BIN', 'claude'),
      wsUrl: stringFromEnv('LINCO_WS_URL', imConfig.wsUrl || selectedChannelWsUrls.claude),
      instructions: '',
      addRuntimeDir: true,
    }),
    codex: agentConfig(userConfig, imConfig, 'codex', {
      bin: stringFromEnv('CODEX_BIN', userConfig.codexBin || codexAccountConfig.bin || 'codex'),
      wsUrl: codexAccountConfig.wsUrl || selectedChannelWsUrls.codex,
    }),
    hermes: agentConfig(userConfig, imConfig, 'hermes', {
      wsUrl: hermesAccountConfig.wsUrl || selectedChannelWsUrls.hermes,
      gatewayUrl: 'http://127.0.0.1:8642',
      autoStartGateway: true,
      hermesBin: 'hermes',
      profile: 'default',
    }),
    openclaw: agentConfig(userConfig, imConfig, 'openclaw', {
      bin: stringFromEnv('OPENCLAW_BIN', userConfig.openclawBin || openclawAccountConfig.bin || 'openclaw'),
      wsUrl: openclawAccountConfig.wsUrl || selectedChannelWsUrls.openclaw,
      gatewayUrl: 'ws://127.0.0.1:18789',
      autoStartGateway: true,
      gatewayStartTimeoutMs: 30000,
      openclawAgentId: 'main',
    }),
  };
  const accountAgent = agents[accountAgentType];
  const enabledAgentEntries = Object.entries(agents).filter(([, agent]) => agent.enabled);
  const firstEnabledAgent = enabledAgentEntries[0]?.[1] || null;
  const selectedImAgent = accountAgent?.enabled ? accountAgent : firstEnabledAgent || accountAgent;
  const imConnectors = remoteImConnectorsFromChannels(userConfig, agents, imConfig);
  const imEnabled = selectedImEnabled(userConfig, imConfig) || imConnectors.length > 0 || enabledAgentEntries.length > 0;

  return {
    logLevel: stringFromEnv('LOG_LEVEL', userConfig.logLevel || 'info'),
    port: stringFromEnv('PORT', userConfig.port || 30381),
    host: stringFromEnv('HOST', userConfig.host || '127.0.0.1'),
    lincoHome,
    sessionsDir,
    publicDir: path.join(rootDir, 'public'),
    timeout: TIMEOUT,
    gitBashPath,
    gitBashEnv,
    agents,
    defaultLocalAgent: stringFromEnv('LINCO_LOCAL_AGENT', userConfig.defaultLocalAgent || accountAgentType),
    maxWsPayloadBytes: numberFromEnv('MAX_WS_PAYLOAD_BYTES', userConfig.maxWsPayloadBytes || 350 * 1024 * 1024),
    maxAttachmentBytes: numberFromEnv('MAX_ATTACHMENT_BYTES', userConfig.maxAttachmentBytes || 50 * 1024 * 1024),
    maxTotalAttachmentBytes: numberFromEnv('MAX_TOTAL_ATTACHMENT_BYTES', userConfig.maxTotalAttachmentBytes || 250 * 1024 * 1024),
    maxAttachmentCount: numberFromEnv('MAX_ATTACHMENT_COUNT', userConfig.maxAttachmentCount || 50),
    maxMessageQueue: numberFromEnv('MAX_MESSAGE_QUEUE', userConfig.maxMessageQueue || 10),
    attachmentsDirName: stringFromEnv('ATTACHMENTS_DIR_NAME', userConfig.attachmentsDirName || 'attachments'),
    maxOutgoingAttachmentBytes: numberFromEnv('MAX_OUTGOING_ATTACHMENT_BYTES', userConfig.maxOutgoingAttachmentBytes || 50 * 1024 * 1024),
    allowHiddenGetFiles: process.env.ALLOW_HIDDEN_GET_FILES === '1' || userConfig.allowHiddenGetFiles === true,
    allowUnsafeAttachments: process.env.ALLOW_UNSAFE_ATTACHMENTS === '1' || userConfig.allowUnsafeAttachments === true,
    unsafeAttachmentExtensions: listFromEnv('UNSAFE_ATTACHMENT_EXTENSIONS', userConfig.unsafeAttachmentExtensions || DEFAULT_UNSAFE_ATTACHMENT_EXTENSIONS),
    gracefulShutdownMs: numberFromEnv('CLAUDE_GRACEFUL_SHUTDOWN_MS', userConfig.gracefulShutdownMs || 3000),
    configFile,
    channels: userConfig.channels || {},
    activeChannels: configuredActiveChannels(userConfig),
    localWeb: {
      ...(userConfig.localWeb || {}),
      enabled: localWebEnabled(userConfig),
      imEnabled: localImEnabled(userConfig),
    },
    logsDir: path.join(lincoHome, 'logs'),
    im: {
      enabled: imEnabled,
      channel: imConfig.channel,
      activeChannels: configuredActiveChannels(userConfig),
      account: imConfig.account,
      agentId: stringFromEnv('LINCO_AGENT_ID', imConfig.agentId || userConfig.im?.agentId || 'main'),
      appId: stringFromEnv('LINCO_APP_ID', tokenConfig.appId || imConfig.appId || selectedImAgent?.appId),
      appSecret: stringFromEnv('LINCO_APP_SECRET', tokenConfig.appSecret || imConfig.appSecret || selectedImAgent?.appSecret),
      wsUrl: selectedImAgent ? selectedImAgent.wsUrl : agents.claude.wsUrl,
      reconnectMinMs: numberFromEnv('LINCO_IM_RECONNECT_MIN_MS', imConfig.reconnectMinMs || userConfig.im?.reconnectMinMs || 1000),
      reconnectMaxMs: numberFromEnv('LINCO_IM_RECONNECT_MAX_MS', imConfig.reconnectMaxMs || userConfig.im?.reconnectMaxMs || 30000),
      heartbeatMs: numberFromEnv('LINCO_IM_HEARTBEAT_MS', imConfig.heartbeatMs || userConfig.im?.heartbeatMs || 30000),
      connectTimeoutMs: numberFromEnv('LINCO_IM_CONNECT_TIMEOUT_MS', imConfig.connectTimeoutMs || userConfig.im?.connectTimeoutMs || 15000),
      idleSessionMs: numberFromEnv('LINCO_IM_IDLE_SESSION_MS', imConfig.idleSessionMs || userConfig.im?.idleSessionMs || DEFAULT_IM_IDLE_SESSION_MS),
      maxPendingEvents: numberFromEnv('LINCO_IM_MAX_PENDING_EVENTS', imConfig.maxPendingEvents || userConfig.im?.maxPendingEvents || 500),
      allowInsecureWs: booleanFromEnv('LINCO_IM_ALLOW_INSECURE_WS', imConfig.allowInsecureWs === true || userConfig.im?.allowInsecureWs === true),
      connectors: imConnectors,
    },
  };
}

module.exports = {
  loadConfig,
  parseToken,
};
