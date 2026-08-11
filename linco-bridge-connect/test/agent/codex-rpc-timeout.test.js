const assert = require('assert');
const path = require('path');
const test = require('node:test');

function loadCodexModule() {
  const filename = path.resolve(__dirname, '../../src/agent/codex/index.js');
  delete require.cache[filename];
  return require(filename);
}

function createRpcSession() {
  const writes = [];
  const session = {
    codexPendingRequests: new Map(),
    codexAppServer: {
      stdin: {
        destroyed: false,
        write(chunk) {
          writes.push(chunk);
        },
      },
    },
  };
  return { session, writes };
}

test('Codex RPC 无响应时会超时而不是永久挂起', async () => {
  const previous = process.env.LINCO_CODEX_RPC_TIMEOUT_MS;
  process.env.LINCO_CODEX_RPC_TIMEOUT_MS = '25';
  const codex = loadCodexModule();
  const { rpcRequest } = codex._internal;
  const { session, writes } = createRpcSession();

  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const timers = [];
  global.setTimeout = (callback, delay) => {
    const timer = { callback, delay, cleared: false };
    timers.push(timer);
    return timer;
  };
  global.clearTimeout = (timer) => {
    if (timer) timer.cleared = true;
  };

  try {
    const pending = rpcRequest(session, 7, 'config/read', { cwd: '/tmp' });
    assert.strictEqual(writes.length, 1);
    assert.match(writes[0], /"method":"config\/read"/);
    assert.strictEqual(session.codexPendingRequests.has(7), true);
    assert.strictEqual(timers.length, 1);
    assert.strictEqual(timers[0].delay, 25);

    timers[0].callback();

    await assert.rejects(pending, /Codex RPC 超时: config\/read/);
    assert.strictEqual(session.codexPendingRequests.has(7), false);
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
    if (previous == null) delete process.env.LINCO_CODEX_RPC_TIMEOUT_MS;
    else process.env.LINCO_CODEX_RPC_TIMEOUT_MS = previous;
  }
});

test('Codex RPC 在 stdin 不可用时立即失败', async () => {
  const codex = loadCodexModule();
  const { rpcRequest, sendJsonRpc } = codex._internal;

  assert.throws(
    () => sendJsonRpc({ stdin: { destroyed: true } }, { jsonrpc: '2.0', id: 1, method: 'ping' }),
    /stdin unavailable/,
  );

  const session = {
    codexPendingRequests: new Map(),
    codexAppServer: { stdin: { destroyed: true, write() {} } },
  };
  await assert.rejects(rpcRequest(session, 9, 'thread/start', {}), /stdin unavailable/);
  assert.strictEqual(session.codexPendingRequests.has(9), false);
});
