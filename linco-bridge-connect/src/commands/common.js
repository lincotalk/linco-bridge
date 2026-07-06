const { sendSystem, sendTurnEnd } = require('../core/protocol');

function agentRunner() {
  return require('../runtime/agentRunner');
}

function completeLocalCommand(ws, session) {
  sendTurnEnd(ws, session);
  return true;
}

function completeMaybeAsyncLocalCommand(result, ws, session) {
  if (result && typeof result.then === 'function') {
    result.finally(() => completeLocalCommand(ws, session));
    return;
  }
  completeLocalCommand(ws, session);
}

function sendSlashCommandResult(ws, command, data = {}) {
  ws.send(JSON.stringify({
    type: 'slash_command_result',
    command,
    version: 1,
    data,
  }));
}

function usesProviderManagedWorkspace(session) {
  const agentType = session.agentType || 'claude';
  return agentType === 'hermes' || agentType === 'openclaw';
}

function sendProviderWorkspaceNotice(ws, session) {
  const agentType = session.agentType || 'claude';
  if (agentType === 'openclaw') {
    sendSystem(ws, 'OpenClaw 模式下工作空间由 OpenClaw Agent 自身管理；请使用 /agent 选择 Agent。');
    return;
  }
  if (agentType === 'hermes') {
    sendSystem(ws, 'Hermes 模式下工作空间由 Hermes Profile/Gateway 自身管理；请使用 /profile 选择 Profile。');
    return;
  }
  sendSystem(ws, '当前模式支持 /pwd 和 /project 管理项目目录。');
}

module.exports = {
  agentRunner,
  completeLocalCommand,
  completeMaybeAsyncLocalCommand,
  sendSlashCommandResult,
  usesProviderManagedWorkspace,
  sendProviderWorkspaceNotice,
};
