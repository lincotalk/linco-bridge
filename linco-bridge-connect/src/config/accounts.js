function removeConfiguredAccount(current, options = {}) {
  const account = String(options.account || 'default').trim() || 'default';
  const channelName = String(options.channel || current.defaultChannel || 'linco').trim() || 'linco';
  const channel = current.channels?.[channelName];
  const agents = channel?.agents || {};
  const agentType = resolveAccountAgentForRemoval(agents, account, options.agent, current.defaultAgent);

  if (!agentType || !agents[agentType]?.accounts?.[account]) {
    throw new Error(`未找到账号: ${channelName}/${agentType || options.agent || current.defaultAgent || 'unknown'}/${account}`);
  }

  const nextAgents = { ...agents };
  const nextAgent = {
    ...nextAgents[agentType],
    accounts: {
      ...(nextAgents[agentType].accounts || {}),
    },
  };

  delete nextAgent.accounts[account];
  const remainingAccounts = Object.keys(nextAgent.accounts);
  if (remainingAccounts.length > 0) {
    if (nextAgent.defaultAccount === account || !nextAgent.accounts[nextAgent.defaultAccount]) {
      nextAgent.defaultAccount = pickDefaultAccount(nextAgent.accounts);
    }
    nextAgents[agentType] = nextAgent;
  } else {
    delete nextAgent.accounts;
    delete nextAgent.defaultAccount;
    if (hasChannelAgentSettings(nextAgent)) {
      nextAgents[agentType] = nextAgent;
    } else {
      delete nextAgents[agentType];
    }
  }

  const nextChannel = {
    ...channel,
    agents: nextAgents,
  };
  if (Object.keys(nextAgents).length === 0) delete nextChannel.agents;

  const next = {
    ...current,
    channels: {
      ...(current.channels || {}),
      [channelName]: nextChannel,
    },
  };

  if (next.defaultChannel === channelName && next.defaultAgent === agentType && !agentHasAccounts(nextAgents[agentType])) {
    const fallbackAgent = firstAgentWithAccounts(nextAgents);
    if (fallbackAgent) next.defaultAgent = fallbackAgent;
    else delete next.defaultAgent;
  }

  return {
    config: next,
    channelName,
    agentType,
    account,
    defaultAgent: next.defaultAgent || null,
    agentDefaultAccount: nextAgents[agentType]?.defaultAccount || null,
  };
}

function resolveAccountAgentForRemoval(agents, account, requestedAgent, defaultAgent) {
  if (requestedAgent) return String(requestedAgent).trim().toLowerCase();
  if (defaultAgent && agents[defaultAgent]?.accounts?.[account]) return defaultAgent;

  const matches = Object.entries(agents)
    .filter(([, agent]) => agent?.accounts?.[account])
    .map(([agentType]) => agentType);

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(`账号 ${account} 存在于多个 Agent: ${matches.join(', ')}。请使用 --agent 指定要删除的 Agent。`);
  }
  return defaultAgent || null;
}

function pickDefaultAccount(accounts = {}) {
  const enabled = Object.entries(accounts).find(([, account]) => account?.enabled === true);
  return enabled?.[0] || Object.keys(accounts)[0];
}

function firstAgentWithAccounts(agents = {}) {
  return Object.entries(agents).find(([, agent]) => agentHasAccounts(agent))?.[0] || null;
}

function agentHasAccounts(agent) {
  return Object.keys(agent?.accounts || {}).length > 0;
}

function hasChannelAgentSettings(agent) {
  return Object.keys(agent || {}).some(key => key !== 'accounts' && key !== 'defaultAccount');
}

module.exports = {
  removeConfiguredAccount,
};
