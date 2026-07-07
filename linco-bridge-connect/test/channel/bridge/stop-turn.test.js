const assert = require('node:assert/strict');
const test = require('node:test');
const { ImConnector } = require('../../../src/core/channelConnector');

test('production Linco connector stops the active session on stop_turn', () => {
  const sent = [];
  const ended = [];
  const session = {
    id: 'agent:codex:linco:direct:conv_1',
    activeKey: 'codex:session:conv_1',
    agentType: 'codex',
    linco: {
      messageId: 'req_1',
      streamId: 'ddchat-stream-req_1',
    },
    ws: {
      send(raw) {
        sent.push(JSON.parse(raw));
      },
    },
    agentProcess: {
      killed: false,
      exitCode: null,
      stdin: {
        destroyed: false,
        end() {
          ended.push('stdin');
        },
      },
    },
  };
  const connector = Object.create(ImConnector.prototype);
  connector.adapter = require('../../../src/channel/linco');
  connector.sessions = new Map([[session.id, session]]);
  connector.config = {};
  connector.agentType = 'codex';

  connector.handleMessage({
    type: 'stop_turn',
    sessionKey: session.id,
    messageId: 'cancel_req_1',
    streamId: 'ddchat-stream-cancel_req_1',
  });

  assert.equal(session.agentProcess, null);
  assert.deepEqual(ended, ['stdin']);
  assert.equal(sent.some((msg) => msg.type === 'turn_end'), true);
  assert.equal(sent.find((msg) => msg.type === 'turn_end').reason, 'cancelled');
});
