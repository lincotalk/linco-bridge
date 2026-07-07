const { readUserConfig, removeConfiguredAccount, saveUserConfig } = require('../config');
const { sendError, sendSystem } = require('../core/protocol');
const { saveSessionMetadata } = require('../core/session');
const { splitCommandArgs } = require('./args');

function handleRemoveAccount(rawArg, ws, session, config = {}) {
  try {
    const parsed = parseRemoveAccountArgs(rawArg, session, config);
    if (!parsed.ok) {
      sendError(ws, parsed.message);
      return;
    }

    const configFile = config?.configFile;
    if (!configFile) {
      sendError(ws, 'Runtime config has no configFile; cannot remove account.');
      return;
    }

    const current = readUserConfig(configFile);
    const result = removeConfiguredAccount(current, parsed);
    saveUserConfig(result.config, configFile);
    applyRemovedAccountRuntimeConfig(config, result);

    const lines = [`已删除账号: ${result.channelName}/${result.agentType}/${result.account}`];
    if (result.agentDefaultAccount) lines.push(`当前 ${result.agentType} 默认账号: ${result.agentDefaultAccount}`);
    if (result.defaultAgent) lines.push(`当前默认 Agent: ${result.defaultAgent}`);
    lines.push(`配置文件: ${configFile}`);
    sendSystem(ws, lines.join('\n'));
  } catch (err) {
    sendError(ws, `删除账号失败: ${err.message}`);
  }
}

function parseRemoveAccountArgs(rawArg, session = {}, config = {}) {
  const parsed = splitCommandArgs(rawArg);
  if (!parsed.ok) return parsed;

  const args = {
    account: session?.linco?.accountId || config?.im?.account || 'default',
    agent: session?.agentType || config?.defaultLocalAgent || null,
    channel: session?.linco?.channel || config?.im?.channel || null,
  };

  for (let i = 0; i < parsed.args.length; i++) {
    const arg = parsed.args[i];
    if (arg === '--account') {
      const next = parsed.args[++i];
      if (!next) return { ok: false, message: '用法：/remove-account [--agent <agent>] [--account <账号>] [--channel <channel>]' };
      args.account = next;
      continue;
    }
    if (arg.startsWith('--account=')) {
      args.account = arg.slice('--account='.length);
      if (!args.account) return { ok: false, message: '用法：/remove-account [--agent <agent>] [--account <账号>] [--channel <channel>]' };
      continue;
    }
    if (arg === '--agent') {
      const next = parsed.args[++i];
      if (!next) return { ok: false, message: '用法：/remove-account [--agent <agent>] [--account <账号>] [--channel <channel>]' };
      args.agent = next.toLowerCase();
      continue;
    }
    if (arg.startsWith('--agent=')) {
      args.agent = arg.slice('--agent='.length).toLowerCase();
      if (!args.agent) return { ok: false, message: '用法：/remove-account [--agent <agent>] [--account <账号>] [--channel <channel>]' };
      continue;
    }
    if (arg === '--channel') {
      const next = parsed.args[++i];
      if (!next) return { ok: false, message: '用法：/remove-account [--agent <agent>] [--account <账号>] [--channel <channel>]' };
      args.channel = next;
      continue;
    }
    if (arg.startsWith('--channel=')) {
      args.channel = arg.slice('--channel='.length);
      if (!args.channel) return { ok: false, message: '用法：/remove-account [--agent <agent>] [--account <账号>] [--channel <channel>]' };
      continue;
    }
    if (!arg.startsWith('--') && !args.accountExplicit) {
      args.account = arg;
      args.accountExplicit = true;
      continue;
    }
    return { ok: false, message: '用法：/remove-account [--agent <agent>] [--account <账号>] [--channel <channel>]' };
  }

  delete args.accountExplicit;
  args.account = String(args.account || 'default').trim() || 'default';
  args.agent = args.agent ? String(args.agent).trim().toLowerCase() : null;
  args.channel = args.channel ? String(args.channel).trim() : null;
  return { ok: true, ...args };
}

function applyRemovedAccountRuntimeConfig(config, result) {
  if (!config || !result) return;
  if (result.defaultAgent) config.defaultLocalAgent = result.defaultAgent;
  if (config.im?.channel === result.channelName && config.im?.account === result.account && config.defaultLocalAgent === result.agentType) {
    const nextAccount = result.agentDefaultAccount;
    if (nextAccount) config.im.account = nextAccount;
  }
}

module.exports = {
  handleRemoveAccount,
  parseRemoveAccountArgs,
};
