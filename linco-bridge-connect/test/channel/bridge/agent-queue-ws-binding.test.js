const assert = require('assert');

const claude = require('../../../src/agent/claude');
const codex = require('../../../src/agent/codex');
const hermes = require('../../../src/agent/hermes');
const openclaw = require('../../../src/agent/openclaw');

function wsRecorder(messageId) {
  const sent = [];
  return {
    sent,
    linco: {
      messageId,
      streamId: `stream-${messageId}`,
    },
    send(raw) {
      sent.push(JSON.parse(raw));
    },
  };
}

function activeSession() {
  return {
    id: 'remote-session-1',
    isTurnActive: true,
    messageQueue: [],
    autoApprove: true,
    _log: { info() {}, warn() {}, error() {} },
  };
}

const config = {
  maxMessageQueue: 10,
  logger: { info() {}, warn() {}, error() {} },
  agents: {
    codex: {},
    hermes: {},
    openclaw: {},
  },
};

for (const [name, agent] of [
  ['claude', claude],
  ['codex', codex],
  ['hermes', hermes],
  ['openclaw', openclaw],
]) {
  const session = activeSession();
  const ws = wsRecorder(`${name}-m-1`);
  agent.execute(`queued ${name}`, ws, session, config);

  assert.strictEqual(session.messageQueue.length, 1, `${name} should queue one item`);
  assert.strictEqual(session.messageQueue[0].input, `queued ${name}`, `${name} should preserve input`);
  assert.strictEqual(session.messageQueue[0].ws, ws, `${name} should preserve ws binding`);
}

console.log('agent queue ws binding ok');
