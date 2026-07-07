const fs = require('fs');
const {
  getConfigFile,
  loadConfig,
  parseToken,
  readUserConfig,
  resolveCommand,
  saveUserConfig,
} = require('../config');
const { ensureLocalToken } = require('../local/auth');
const { commandExists } = require('./utils');

function initCommand(options, context = {}) {
  const rootDir = context.rootDir;
  const tokenValue = options.token || process.env.LINCO_TOKEN || '';
  const token = parseToken(tokenValue);
  const appId = options['app-id'] || token.appId;
  const appSecret = options['app-secret'] || token.appSecret;

  if (!appId || !appSecret) {
    throw new Error('请提供 --token "appId:appSecret"，或同时提供 --app-id 与 --app-secret。');
  }

  const account = options.account || 'default';
  const agentType = options.agent ? options.agent.trim().toLowerCase() : null;
  const channel = options.channel ? String(options.channel).trim() : 'linco';
  const wsUrl = options['ws-url'] ? String(options['ws-url']).trim() : '';
  if (!channel) throw new Error('参数 --channel 不能为空');
  const configFile = getConfigFile();
  const current = readUserConfig(configFile);

  if (fs.existsSync(configFile) && !options.force) {
    const existingAccount = current.channels?.[channel]?.agents?.[agentType || 'claude']?.accounts?.[account];
    if (existingAccount?.appId || existingAccount?.appSecret || existingAccount?.token) {
      throw new Error(`配置已存在，如需覆盖请添加 --force。配置文件: ${configFile}`);
    }
  }

  if (agentType) {
    // Hermes is an HTTP gateway service, not a CLI binary
    if (agentType !== 'hermes') {
      const agentBin = resolveCommand(agentType);
      if (!agentBin || !commandExists(agentType)) {
        throw new Error(`未检测到 ${agentType} CLI，请先安装 ${agentType} 再初始化。`);
      }
    }
  }

  const next = mergeInitConfig(current, {
    appId,
    appSecret,
    account,
    agentType,
    channel,
    wsUrl,
    allowInsecureWs: options['allow-insecure-ws'] === true,
  });
  saveUserConfig(next, configFile);

  const config = loadConfig(rootDir);
  ensureLocalToken(config);

  console.log('✅ Linco Connect 初始化完成');
  console.log(`   配置文件: ${config.configFile}`);
  console.log(`   账号: ${account}`);
  if (agentType) {
    console.log(`   Agent 类型: ${agentType}`);
  }
  console.log('   下一步: linco-connect doctor && linco-connect start');
}

function mergeInitConfig(current, values) {
  const accountEntry = {
    appId: values.appId,
    appSecret: values.appSecret,
    enabled: true,
  };
  if (values.wsUrl) accountEntry.wsUrl = values.wsUrl;
  if (values.allowInsecureWs) accountEntry.allowInsecureWs = true;
  if (values.agentType === 'openclaw') accountEntry.openclawAgentId = 'main';
  const agentType = values.agentType || 'claude';
  const channel = values.channel || 'linco';
  const currentChannel = current.channels?.[channel] || {};
  const currentAgent = currentChannel.agents?.[agentType] || {};
  const currentAccounts = currentAgent.accounts || {};

  return {
    ...current,
    defaultChannel: channel,
    defaultAgent: agentType,
    activeChannels: mergeActiveChannels(current, channel),
    channels: {
      ...(current.channels || {}),
      [channel]: {
        ...currentChannel,
        agents: {
          ...(currentChannel.agents || {}),
          [agentType]: {
            ...currentAgent,
            defaultAccount: values.account,
            accounts: {
              ...currentAccounts,
              [values.account]: {
                ...(currentAccounts[values.account] || {}),
                ...accountEntry,
              },
            },
          },
        },
      },
    },
    localWeb: {
      ...(current.localWeb || {}),
    },
  };
}

function mergeActiveChannels(current, channel) {
  const existing = Array.isArray(current.activeChannels)
    ? current.activeChannels
    : String(current.activeChannels || '').split(',');
  const seeded = existing
    .map(item => String(item || '').trim())
    .filter(Boolean);

  if (seeded.length === 0 && current.defaultChannel) {
    seeded.push(String(current.defaultChannel).trim());
  }
  seeded.push(channel);

  return Array.from(new Set(seeded.filter(Boolean)));
}

module.exports = {
  initCommand,
  mergeInitConfig,
  mergeActiveChannels,
};
