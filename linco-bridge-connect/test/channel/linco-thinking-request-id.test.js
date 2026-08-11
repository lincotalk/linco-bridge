const test = require('node:test');
const assert = require('node:assert/strict');
const { mapLocalEventToLinco } = require('../../src/channel/linco/protocol');

test('thinking frames keep the turn request messageId for IM binding', () => {
  const session = { id: 'agent:codex:linco:direct:conv_1' };
  const linco = {
    messageId: 'req_123',
    streamId: 'ddchat-stream-req_123',
    thinkingText: '',
  };

  const payload = mapLocalEventToLinco(
    { type: 'thinking', text: '正在整理盘前行情', mode: 'progress' },
    session,
    { im: { account: 'codex_5', agentId: 'codex', channel: 'linco' } },
    linco,
  );

  assert.equal(payload.type, 'thinking');
  assert.equal(payload.messageId, 'req_123');
  assert.equal(payload.requestId, 'req_123');
  assert.equal(payload.streamId, 'ddchat-stream-req_123');
  assert.equal(payload.fullText, '正在整理盘前行情');
  assert.equal(payload.mode, 'progress');
});
