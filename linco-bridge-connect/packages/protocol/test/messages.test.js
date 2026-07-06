const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildHeartbeatMessage,
  buildStreamId,
  isLincoMessage,
  lincoMetaDefaults,
  pruneUndefined,
} = require('../src');

test('recognizes bridge inbound message types', () => {
  assert.equal(isLincoMessage({ type: 'inbound_message' }), true);
  assert.equal(isLincoMessage({ type: 'permission_response' }), true);
  assert.equal(isLincoMessage({ type: 'outbound_message' }), false);
  assert.equal(isLincoMessage(null), null);
});

test('builds stream ids from message ids when present', () => {
  assert.equal(buildStreamId({ messageId: 'm-1' }), 'linco-stream-m-1');
  assert.equal(buildStreamId({}, { now: () => 123 }), 'linco-stream-123');
});

test('fills metadata defaults from config and meta', () => {
  assert.deepEqual(lincoMetaDefaults({
    im: { account: 'acct', agentId: 'bot', channel: 'linco-demo' },
  }, {
    userId: 'u-1',
    messageId: 'm-1',
  }), {
    accountId: 'acct',
    agentId: 'bot',
    chatType: 'direct',
    targetType: 'direct',
    targetId: 'u-1',
    userId: 'u-1',
    messageId: 'm-1',
    streamId: undefined,
    channel: 'linco-demo',
  });
});

test('builds heartbeat messages with caller-provided device and client info', () => {
  assert.deepEqual(buildHeartbeatMessage({
    im: { account: 'acct', agentId: 'bot', channel: 'linco' },
  }, {
    type: 'pong',
    agentType: 'codex',
    device: { id: 'device-1' },
    client: { name: 'linco-connect' },
    now: () => 456,
  }), {
    type: 'pong',
    from: 'codex',
    to: 'robot',
    source: 'ws',
    ts: 456,
    accountId: 'acct',
    agentId: 'bot',
    channel: 'linco',
    device: { id: 'device-1' },
    client: { name: 'linco-connect' },
  });
});

test('prunes undefined fields only', () => {
  assert.deepEqual(pruneUndefined({ a: 1, b: undefined, c: null, d: false }), {
    a: 1,
    c: null,
    d: false,
  });
});
