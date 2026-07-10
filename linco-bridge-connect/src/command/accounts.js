const { remoteConnectorSpecs } = require('../core/channelConnectorConfig');
const { completeLocalCommand, sendSlashCommandResult } = require('./common');

const ACCOUNTS_COMMAND = 'accounts';

function isAccountsCommand(text) {
  return String(text || '').trim().toLowerCase() === ACCOUNTS_COMMAND.toLowerCase();
}

function resolveAccountId(spec) {
  const account = String(spec.im?.account || '').trim();
  if (account && account !== 'default') {
    return account;
  }
  const agentType = String(spec.agentType || '').trim();
  if (!agentType) return '';
  return agentType === 'openclaw' ? 'openclaw_1' : `${agentType}_1`;
}

function buildAccountsPayload(config) {
  const specs = remoteConnectorSpecs(config);
  const channel = String(config.defaultChannel || specs[0]?.im?.channel || 'linco').trim() || 'linco';
  const accountIds = specs
    .map(resolveAccountId)
    .filter(Boolean);

  return {
    channel,
    accountIds,
  };
}

function handleAccounts(ws, session, config) {
  sendSlashCommandResult(ws, ACCOUNTS_COMMAND, buildAccountsPayload(config, session));
  return completeLocalCommand(ws, session);
}

module.exports = {
  ACCOUNTS_COMMAND,
  buildAccountsPayload,
  handleAccounts,
  isAccountsCommand,
};
