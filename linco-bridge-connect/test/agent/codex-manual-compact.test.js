const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');

function loadCodexInternals() {
  const filename = path.resolve(__dirname, '../../src/agent/codex/index.js');
  const source = fs.readFileSync(filename, 'utf8');
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(`${source}\nmodule.exports._test = { compactCodexContext, handleAppServerMessage };\n`, filename);
  return mod.exports._test;
}

function createRemoteSession() {
  const sent = [];
  const ws = {
    linco: {
      messageId: 'm-compact-codex',
      streamId: 'stream-compact-codex',
    },
    send(raw) {
      sent.push(JSON.parse(raw));
    },
  };
  const session = {
    id: 'session-compact-codex',
    workspace: process.cwd(),
    attachmentsDir: process.cwd(),
    isTurnActive: false,
    currentInputForNoOutput: null,
    messageQueue: [],
    sawPartialAssistantText: false,
    codexAssistantEnded: false,
    codexEmittedAgentMessageIds: new Set(),
    codexPendingRequests: new Map(),
    codexRpcId: 0,
    agentSessionId: 'thread-1',
    linco: ws.linco,
    _lastWs: ws,
    _lastConfig: {},
    _log: { info() {}, warn() {}, error() {} },
  };
  return { session, sent, ws };
}

function withCapturedTimers(fn) {
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const timers = [];
  global.setTimeout = (callback, delay) => {
    const timer = {
      callback,
      delay,
      cleared: false,
      unref() {},
    };
    timers.push(timer);
    return timer;
  };
  global.clearTimeout = (timer) => {
    if (timer) timer.cleared = true;
  };
  return Promise.resolve()
    .then(() => fn(timers))
    .finally(() => {
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
    });
}

function flushImmediate() {
  return new Promise(resolve => setImmediate(resolve));
}

(async () => {
  const { compactCodexContext, handleAppServerMessage } = loadCodexInternals();
  await withCapturedTimers(async (timers) => {
    const originalNow = Date.now;
    let now = 1780400868266;
    Date.now = () => now;
    try {
      const { session, sent, ws } = createRemoteSession();
      const writes = [];
      session.codexAppServer = {
        stdin: {
          destroyed: false,
          write(value) {
            writes.push(JSON.parse(value));
          },
        },
      };
      const config = {
        maxMessageQueue: 10,
        agents: {
          codex: {
            mode: 'app-server',
            compactionTimeoutMs: 300000,
          },
        },
        logger: { info() {}, warn() {}, error() {} },
      };

      assert.strictEqual(compactCodexContext(ws, session, config, { trigger: 'manual' }), true);
      await flushImmediate();
      assert.strictEqual(writes[0].method, 'thread/resume');
      assert.strictEqual(writes[0].params.threadId, 'thread-1');

      handleAppServerMessage({ id: writes[0].id, result: {} }, session);
      await flushImmediate();
      assert.strictEqual(writes[1].method, 'thread/compact/start');
      assert.deepStrictEqual(writes[1].params, { threadId: 'thread-1' });
      handleAppServerMessage({ id: writes[1].id, result: {} }, session);

      handleAppServerMessage({
        method: 'item/started',
        params: { item: { type: 'contextCompaction', id: 'cmp-manual' } },
      }, session);

      const startedEvent = sent.find(item => item.type === 'context_compaction' && item.phase === 'started');
      assert(startedEvent);
      assert.strictEqual(startedEvent.trigger, 'manual');
      assert.strictEqual(session.codexCompaction.manualTurn, true);
      assert.strictEqual(timers.some(timer => timer.delay === 300000), true);

      now = 1780400869266;
      handleAppServerMessage({
        method: 'item/completed',
        params: { item: { type: 'contextCompaction', id: 'cmp-manual' } },
      }, session);

      const completedEvent = sent.find(item => item.type === 'context_compaction' && item.phase === 'completed');
      assert(completedEvent);
      assert.strictEqual(completedEvent.trigger, 'manual');
      const turnEnd = sent.find(item => item.type === 'turn_end');
      assert(turnEnd);
      assert.strictEqual(turnEnd.reason, 'completed');
      assert.strictEqual(session.isTurnActive, false);
      assert.strictEqual(session.pendingCodexManualCompaction, null);
    } finally {
      Date.now = originalNow;
    }
  });
})().catch(err => {
  console.error(err);
  process.exit(1);
});
