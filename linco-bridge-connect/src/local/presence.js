const { buildPresenceEvent } = require('../channels/bridge/presence');

function sendLocalPresence(rawWs, session, config, status, reason) {
  try {
    rawWs.send(JSON.stringify(buildPresenceEvent(config, {
      agentType: session.agentType,
      status,
      reason,
      meta: session.linco,
    })));
  } catch {}
}

module.exports = {
  sendLocalPresence,
};
