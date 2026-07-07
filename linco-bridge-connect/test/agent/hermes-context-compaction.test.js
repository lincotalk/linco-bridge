const assert = require('assert');
const hermes = require('../../src/agent/hermes');

function wsRecorder() {
  const sent = [];
  return {
    sent,
    linco: { messageId: 'm-1', streamId: 'stream-1' },
    send(raw) {
      sent.push(JSON.parse(raw));
    },
  };
}

function session(extra = {}) {
  return {
    id: 'session-1',
    agentSessionId: 'hermes-session-1',
    hermesRunId: 'run-1',
    pendingHermesReasoning: '',
    messageQueue: [],
    _lastConfig: { agents: { hermes: { compactionTimeoutMs: 300000 } } },
    ...extra,
  };
}

function withCapturedTimers(fn) {
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const timers = [];
  global.setTimeout = (callback, delay) => {
    const timer = { callback, delay, cleared: false, unref() {} };
    timers.push(timer);
    return timer;
  };
  global.clearTimeout = (timer) => {
    if (timer) timer.cleared = true;
  };
  try {
    fn(timers);
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  }
}

withCapturedTimers((timers) => {
  const originalNow = Date.now;
  let now = 1780400000000;
  Date.now = () => now;
  try {
    const ws = wsRecorder();
    const s = session();
    hermes._internal.handleHermesEvent({
      event: 'context_compaction.started',
      run_id: 'run-1',
      session_id: 'hermes-session-1',
      compaction_id: 'hm-cmp-1',
      trigger: 'auto',
    }, ws, s, s._lastConfig);

    assert.strictEqual(ws.sent.length, 1);
    assert.strictEqual(ws.sent[0].type, 'context_compaction');
    assert.strictEqual(ws.sent[0].phase, 'started');
    assert.strictEqual(ws.sent[0].agentType, 'hermes');
    assert.strictEqual(ws.sent[0].compactionId, 'hm-cmp-1');
    assert.strictEqual(ws.sent[0].agentSessionId, 'hermes-session-1');
    assert.strictEqual(ws.sent[0].requestId, 'm-1');
    assert.strictEqual(ws.sent[0].streamId, 'stream-1');
    assert.strictEqual(timers.some(timer => timer.delay === 90000), true);
    assert.strictEqual(timers.some(timer => timer.delay === 300000), true);

    now = 1780400060612;
    hermes._internal.handleHermesEvent({
      event: 'context_compaction.completed',
      run_id: 'run-1',
      session_id: 'hermes-session-1',
      compaction_id: 'hm-cmp-1',
    }, ws, s, s._lastConfig);

    assert.strictEqual(ws.sent.length, 2);
    assert.strictEqual(ws.sent[1].phase, 'completed');
    assert.strictEqual(ws.sent[1].durationMs, 60612);
    assert.strictEqual(s.hermesCompaction, null);
  } finally {
    Date.now = originalNow;
  }
});

withCapturedTimers((timers) => {
  const originalNow = Date.now;
  let now = 1780400000000;
  Date.now = () => now;
  try {
    const ws = wsRecorder();
    const s = session();
    hermes._internal.handleHermesEvent({
      event: 'context_compaction',
      phase: 'started',
      run_id: 'run-1',
      compaction_id: 'hm-cmp-timeout',
    }, ws, s, s._lastConfig);

    const staleTimer = timers.find(timer => timer.delay === 90000);
    const timeoutTimer = timers.find(timer => timer.delay === 300000);
    assert(staleTimer);
    assert(timeoutTimer);

    now = 1780400090000;
    staleTimer.callback();
    assert.strictEqual(ws.sent[1].phase, 'stale');
    assert.strictEqual(ws.sent[1].durationMs, 90000);

    now = 1780400300000;
    timeoutTimer.callback();
    assert.strictEqual(ws.sent[2].phase, 'failed');
    assert.strictEqual(ws.sent[2].durationMs, 300000);
    assert.strictEqual(ws.sent[2].error.code, 'timeout');
    assert.strictEqual(s.hermesCompaction, null);
  } finally {
    Date.now = originalNow;
  }
});

{
  const ws = wsRecorder();
  const s = session({ isTurnActive: true });
  const config = { maxMessageQueue: 10, agents: { hermes: { compactionTimeoutMs: 300000 } } };

  assert.strictEqual(hermes._internal.compactHermesContext(ws, s, config, { trigger: 'manual', nativeCommand: '/compress' }), true);
  assert.strictEqual(s.messageQueue.length, 1);
  assert.strictEqual(s.messageQueue[0].compact, true);
  assert.strictEqual(s.messageQueue[0].nativeCommand, '/compress');
  assert.strictEqual(ws.sent[0].type, 'system');
}

{
  const ws = wsRecorder();
  const s = session({ hermesCompaction: { id: 'hm-cmp-active', startedAt: Date.now(), completed: false } });
  hermes._internal.handleHermesEvent({ event: 'reasoning.available', text: 'large compaction reasoning' }, ws, s, s._lastConfig);
  hermes._internal.handleHermesEvent({ event: 'tool.started', run_id: 'run-1', tool: 'read_file', preview: 'package.json' }, ws, s, s._lastConfig);

  assert.strictEqual(ws.sent.some(item => item.type === 'thinking'), false);
  assert.strictEqual(ws.sent.some(item => item.type === 'tool_call'), true);
}

console.log('hermes context compaction ok');
