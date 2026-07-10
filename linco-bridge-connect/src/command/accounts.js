const { sendError } = require('../core/protocol');
const { splitCommandArgs } = require('./args');
const { sendSlashCommandResult } = require('./common');

const USAGE = 'Usage: /accounts --channel <channel>';

function handleAccounts(rawArg, ws, session, config = {}) {
  const parsed = parseAccountsArgs(rawArg);
  if (!parsed.ok) {
    sendError(ws, parsed.message);
    return;
  }

  const channelConfig = config?.channels?.[parsed.channel];
  if (!channelConfig) {
    sendError(ws, `Unknown channel: ${parsed.channel}`);
    return;
  }

  sendSlashCommandResult(ws, 'accounts', {
    channel: parsed.channel,
    accountIds: listChannelAccountIds(channelConfig),
  });
}

function parseAccountsArgs(rawArg) {
  const parsed = splitCommandArgs(rawArg);
  if (!parsed.ok) return parsed;

  let channel = null;

  for (let i = 0; i < parsed.args.length; i++) {
    const arg = parsed.args[i];
    if (arg === '--channel') {
      const next = parsed.args[++i];
      if (!next) return { ok: false, message: USAGE };
      channel = next;
      continue;
    }
    if (arg.startsWith('--channel=')) {
      channel = arg.slice('--channel='.length);
      if (!channel) return { ok: false, message: USAGE };
      continue;
    }
    return { ok: false, message: USAGE };
  }

  channel = String(channel || '').trim();
  if (!channel) return { ok: false, message: USAGE };
  return { ok: true, channel };
}

function listChannelAccountIds(channelConfig = {}) {
  const ids = new Set();
  const agents = channelConfig.agents || {};

  for (const agentConfig of Object.values(agents)) {
    const accounts = agentConfig?.accounts || {};
    for (const accountId of Object.keys(accounts)) {
      ids.add(accountId);
    }
  }

  return [...ids].sort();
}

module.exports = {
  handleAccounts,
  parseAccountsArgs,
  listChannelAccountIds,
};
