const { stopAgentProcess } = require('../runtime/agentRunner');
const { sendSystem, sendTurnEnd } = require('../core/protocol');

function stopCurrentTurn(rawWs, session, config, reason = 'cancelled') {
  const targetWs = session.ws || rawWs;
  if (!session.isTurnActive) {
    sendSystem(targetWs, 'No active task to stop.');
    sendTurnEnd(targetWs, session, 'idle');
    return false;
  }
  config.logger?.info('stop requested', { sessionId: session.id, agentType: session.agentType, reason });
  stopAgentProcess(session, { clearAgentSession: false });
  sendSystem(targetWs, 'Task stop requested.');
  sendTurnEnd(targetWs, session, reason);
  return true;
}

module.exports = {
  stopCurrentTurn,
};
