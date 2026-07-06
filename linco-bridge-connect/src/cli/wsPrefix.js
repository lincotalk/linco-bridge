const {
  getConfigFile,
  readUserConfig,
  saveUserConfig,
} = require('../config');

function wsPrefixCommand(options) {
  const configFile = getConfigFile();
  const current = readUserConfig(configFile);
  const channelName = String(options.channel || current.defaultChannel || 'linco').trim() || 'linco';
  const channel = current.channels?.[channelName];
  const agents = channel?.agents || {};
  const prefix = options._[0];

  if (options._.length > 1) {
    throw new Error('Usage: linco-connect ws-prefix <domain-or-url> or linco-connect ws-prefix --clear');
  }
  if (!options.clear && !prefix) {
    throw new Error('Usage: linco-connect ws-prefix <domain-or-url>');
  }
  if (options.clear && prefix) {
    throw new Error('Usage: linco-connect ws-prefix --clear');
  }

  const entries = collectConfiguredAccounts(agents, options.agent);
  if (entries.length === 0) {
    throw new Error(`No configured accounts found in channel: ${channelName}`);
  }

  const nextAgents = { ...agents };
  const changed = [];
  for (const entry of entries) {
    const nextAgent = {
      ...nextAgents[entry.agentType],
      accounts: {
        ...(nextAgents[entry.agentType].accounts || {}),
      },
    };
    const nextAccount = {
      ...(nextAgent.accounts[entry.account] || {}),
    };

    if (options.clear) {
      if (!Object.prototype.hasOwnProperty.call(nextAccount, 'wsUrl')) continue;
      delete nextAccount.wsUrl;
      changed.push({ ...entry });
    } else {
      const wsUrl = buildAgentWsUrl(prefix, entry.agentType);
      if (nextAccount.wsUrl === wsUrl) continue;
      nextAccount.wsUrl = wsUrl;
      changed.push({ ...entry, wsUrl });
    }

    nextAgent.accounts[entry.account] = nextAccount;
    nextAgents[entry.agentType] = nextAgent;
  }

  if (changed.length === 0) {
    console.log(options.clear ? 'No wsUrl overrides to clear.' : 'wsUrl overrides are already up to date.');
    return;
  }

  const next = {
    ...current,
    channels: {
      ...(current.channels || {}),
      [channelName]: {
        ...(channel || {}),
        agents: nextAgents,
      },
    },
  };

  saveUserConfig(next, configFile);

  if (options.clear) {
    console.log('Cleared wsUrl overrides:');
    for (const item of changed) {
      console.log(`- ${channelName}/${item.agentType}/${item.account}`);
    }
    console.log('Accounts without wsUrl use the default production endpoint.');
  } else {
    console.log('Updated wsUrl overrides:');
    for (const item of changed) {
      console.log(`- ${channelName}/${item.agentType}/${item.account}: ${item.wsUrl}`);
    }
  }
  console.log(`Config file: ${configFile}`);
}

function collectConfiguredAccounts(agents = {}, requestedAgent) {
  const normalizedAgent = requestedAgent ? String(requestedAgent).trim().toLowerCase() : null;
  return Object.entries(agents)
    .filter(([agentType]) => !normalizedAgent || agentType === normalizedAgent)
    .flatMap(([agentType, agent]) => Object.keys(agent?.accounts || {}).map(account => ({
      agentType,
      account,
    })));
}

function buildAgentWsUrl(prefix, agentType) {
  const base = normalizeWsPrefix(prefix);
  return `${base}/${encodeURIComponent(agentType)}`;
}

function normalizeWsPrefix(prefix) {
  const raw = String(prefix || '').trim();
  if (!raw) throw new Error('ws-prefix cannot be empty.');

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `wss://${raw}`;
  let url;
  try {
    url = new URL(withProtocol);
  } catch (err) {
    throw new Error(`Invalid ws-prefix: ${err.message}`);
  }

  if (!['wss:', 'ws:', 'https:', 'http:'].includes(url.protocol)) {
    throw new Error('ws-prefix protocol must be wss, ws, https, or http.');
  }

  if (url.protocol === 'https:') url.protocol = 'wss:';
  if (url.protocol === 'http:') url.protocol = 'ws:';

  url.search = '';
  url.hash = '';
  const pathname = url.pathname.replace(/\/+$/, '');
  url.pathname = pathname && pathname !== '/' ? pathname : '/socket/ai';

  return url.toString().replace(/\/+$/, '');
}

module.exports = {
  wsPrefixCommand,
  collectConfiguredAccounts,
  buildAgentWsUrl,
  normalizeWsPrefix,
};
