const assert = require('assert');
const path = require('path');
const test = require('node:test');

function loadCodexModule() {
  const filename = path.resolve(__dirname, '../../src/agent/codex/index.js');
  delete require.cache[filename];
  return require(filename);
}

function createWs() {
  const frames = [];
  return {
    frames,
    send(raw) {
      frames.push(JSON.parse(raw));
    },
  };
}

test('failCodexTurn 有部分回复时不先发 error，并以 completed 收口', () => {
  const { failCodexTurn } = loadCodexModule()._internal;
  const ws = createWs();
  const session = {
    id: 'session-partial',
    isTurnActive: true,
    sawPartialAssistantText: true,
    codexAssistantEnded: false,
    codexStreamState: null,
    lastTurnEndKey: null,
    _assistantReplyLog: {
      agentType: 'codex',
      chars: 12,
      rawPreview: '部分回复内容',
    },
    _conversationLogger: {
      info() {},
      warn() {},
    },
  };

  failCodexTurn(ws, session, null, 'Codex app-server 崩溃');

  assert.strictEqual(session.isTurnActive, false);
  assert.ok(!ws.frames.some((frame) => frame.type === 'error'));
  assert.ok(ws.frames.some((frame) => frame.type === 'assistant_end'));
  const turnEnd = ws.frames.find((frame) => frame.type === 'turn_end');
  assert.ok(turnEnd);
  assert.strictEqual(turnEnd.reason, 'completed');
  assert.strictEqual(turnEnd.partialRecovered, true);
  assert.match(String(turnEnd.error || ''), /崩溃/);
});

test('failCodexTurn 无部分回复时仍发送 error 并以 error 收口', () => {
  const { failCodexTurn } = loadCodexModule()._internal;
  const ws = createWs();
  const session = {
    id: 'session-empty',
    isTurnActive: true,
    sawPartialAssistantText: false,
    codexAssistantEnded: false,
    lastTurnEndKey: null,
  };

  failCodexTurn(ws, session, null, 'Codex RPC 超时: config/read');

  assert.strictEqual(session.isTurnActive, false);
  assert.ok(ws.frames.some((frame) => frame.type === 'error'));
  const turnEnd = ws.frames.find((frame) => frame.type === 'turn_end');
  assert.ok(turnEnd);
  assert.strictEqual(turnEnd.reason, 'error');
});
