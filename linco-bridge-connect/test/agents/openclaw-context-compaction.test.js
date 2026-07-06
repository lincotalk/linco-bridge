const assert = require('assert');
const openclaw = require('../../src/agents/openclaw');

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
    agentSessionId: 'openclaw-session-1',
    openclawRunId: 'run-1',
    openclawLastText: '',
    messageQueue: [],
    _lastConfig: { agents: { openclaw: { compactionTimeoutMs: 300000 } } },
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
    openclaw._internal.handleOpenClawEvent('context_compaction.started', {
      runId: 'run-1',
      sessionKey: 'openclaw-session-1',
      compactionId: 'oc-cmp-1',
      trigger: 'auto',
    }, {}, ws, s, s._lastConfig);

    assert.strictEqual(ws.sent.length, 1);
    assert.strictEqual(ws.sent[0].type, 'context_compaction');
    assert.strictEqual(ws.sent[0].phase, 'started');
    assert.strictEqual(ws.sent[0].agentType, 'openclaw');
    assert.strictEqual(ws.sent[0].compactionId, 'oc-cmp-1');
    assert.strictEqual(ws.sent[0].agentSessionId, 'openclaw-session-1');
    assert.strictEqual(ws.sent[0].requestId, 'm-1');
    assert.strictEqual(ws.sent[0].streamId, 'stream-1');
    assert.strictEqual(timers.some(timer => timer.delay === 90000), true);
    assert.strictEqual(timers.some(timer => timer.delay === 300000), true);

    now = 1780400060612;
    openclaw._internal.handleOpenClawEvent('context_compaction.completed', {
      runId: 'run-1',
      sessionKey: 'openclaw-session-1',
      compactionId: 'oc-cmp-1',
    }, {}, ws, s, s._lastConfig);

    assert.strictEqual(ws.sent.length, 2);
    assert.strictEqual(ws.sent[1].phase, 'completed');
    assert.strictEqual(ws.sent[1].durationMs, 60612);
    assert.strictEqual(s.openclawCompaction, null);
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
    openclaw._internal.handleOpenClawEvent('agent', {
      stream: 'context_compaction',
      runId: 'run-1',
      sessionKey: 'openclaw-session-1',
      data: { phase: 'started', id: 'oc-cmp-timeout' },
    }, {}, ws, s, s._lastConfig);

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
    assert.strictEqual(s.openclawCompaction, null);
  } finally {
    Date.now = originalNow;
  }
});

{
  const ws = wsRecorder();
  const s = session({ isTurnActive: true });
  const config = { maxMessageQueue: 10, agents: { openclaw: { compactionTimeoutMs: 300000 } } };

  assert.strictEqual(openclaw._internal.compactOpenClawContext(ws, s, config, { trigger: 'manual', nativeCommand: '/compact' }), true);
  assert.strictEqual(s.messageQueue.length, 1);
  assert.strictEqual(s.messageQueue[0].compact, true);
  assert.strictEqual(s.messageQueue[0].nativeCommand, '/compact');
  assert.strictEqual(ws.sent[0].type, 'system');
}

{
  const ws = wsRecorder();
  const s = session({ openclawCompaction: { id: 'oc-cmp-active', startedAt: Date.now(), completed: false } });
  openclaw._internal.handleOpenClawEvent('chat', {
    state: 'delta',
    runId: 'run-1',
    sessionKey: 'openclaw-session-1',
    reasoningDelta: 'large compaction reasoning',
  }, {}, ws, s, s._lastConfig);

  assert.deepStrictEqual(ws.sent, []);
}

console.log('openclaw context compaction ok');
