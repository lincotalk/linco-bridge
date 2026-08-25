'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

function loadCodexInternals() {
  const filename = path.resolve(__dirname, '../../src/agent/codex/index.js');
  const source = fs.readFileSync(filename, 'utf8');
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(`${source}\nmodule.exports._test = { ensureThread, handleAppServerMessage };\n`, filename);
  return mod.exports._test;
}

function createHarness() {
  const writes = [];
  const frames = [];
  const warnings = [];
  const child = {
    stdin: {
      destroyed: false,
      write(value) {
        writes.push(JSON.parse(value));
      },
    },
  };
  const ws = {
    linco: { messageId: 'resume-message', streamId: 'resume-stream' },
    send(value) {
      frames.push(JSON.parse(value));
    },
  };
  const session = {
    id: 'linco-session',
    agentType: 'codex',
    agentSessionId: 'fork-child-thread',
    workspace: process.cwd(),
    codexAppServer: child,
    codexPendingRequests: new Map(),
    codexRpcId: 0,
    codexDeveloperInstructionsResolved: true,
    codexDeveloperInstructionsMode: 'input',
    codexDeveloperInstructionsApplied: false,
    codexInheritedDeveloperInstructions: '',
    messageQueue: [],
    agentSessionHistory: [],
    linco: ws.linco,
    _lastWs: ws,
    _lastConfig: { agents: { codex: { mode: 'app-server' } } },
    _log: {
      info() {},
      error() {},
      warn(message, payload) {
        warnings.push({ message, payload });
      },
    },
  };
  return { child, frames, session, warnings, writes, ws };
}

async function waitForRequest(writes, method, occurrence = 1) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const matches = writes.filter(message => message.method === method);
    if (matches.length >= occurrence) return matches[occurrence - 1];
    await new Promise(resolve => setImmediate(resolve));
  }
  throw new Error(`Timed out waiting for ${method} request #${occurrence}`);
}

function resolveRpc(handleAppServerMessage, session, request, result) {
  handleAppServerMessage({ id: request.id, result }, session);
}

function rejectRpc(handleAppServerMessage, session, request, message) {
  handleAppServerMessage({
    id: request.id,
    error: { code: -32000, message },
  }, session);
}

test('resuming a copied Codex session keeps the selected child thread id', async () => {
  const { ensureThread, handleAppServerMessage } = loadCodexInternals();
  const { session, writes } = createHarness();

  const pending = ensureThread(session);
  const request = await waitForRequest(writes, 'thread/resume');
  assert.equal(request.params.threadId, 'fork-child-thread');
  resolveRpc(handleAppServerMessage, session, request, {
    thread: { id: 'fork-child-thread', forkedFromId: 'fork-parent-thread' },
  });

  assert.equal(await pending, 'fork-child-thread');
  assert.equal(session.agentSessionId, 'fork-child-thread');
  assert.equal(writes.some(message => message.method === 'thread/start'), false);
});

test('a failed copied-session resume preserves the selected id and never starts a new thread', async () => {
  const { ensureThread, handleAppServerMessage } = loadCodexInternals();
  const { session, writes } = createHarness();

  const pending = ensureThread(session);
  const request = await waitForRequest(writes, 'thread/resume');
  rejectRpc(handleAppServerMessage, session, request, 'thread not found');

  await assert.rejects(pending, error => {
    assert.equal(error.code, 'CODEX_THREAD_RESUME_FAILED');
    assert.match(error.message, /已保留原会话且未创建新会话/);
    return true;
  });
  assert.equal(session.agentSessionId, 'fork-child-thread');
  assert.equal(writes.filter(message => message.method === 'thread/resume').length, 1);
  assert.equal(writes.some(message => message.method === 'thread/start'), false);
});

test('an active desktop writer fails once with a precise error and preserves the selected id', async () => {
  const { ensureThread, handleAppServerMessage } = loadCodexInternals();
  const { session, writes } = createHarness();
  session.codexDeveloperInstructionsMode = 'developer';
  session.agentSessionHistory = [{
    id: 'fork-child-thread',
    isActive: true,
    forkedFromId: 'fork-parent-thread',
  }];

  const pending = ensureThread(session);
  const request = await waitForRequest(writes, 'thread/resume');
  rejectRpc(
    handleAppServerMessage,
    session,
    request,
    'thread fork-child-thread already has an active writer',
  );

  await assert.rejects(pending, error => {
    assert.equal(error.code, 'CODEX_THREAD_ACTIVE_WRITER');
    assert.match(error.message, /Codex 旧版“复制会话”功能/);
    assert.match(error.message, /Linco App 暂时无法继续在原会话中聊天/);
    assert.doesNotMatch(error.message, /active writer|app-server/i);
    return true;
  });
  assert.equal(session.agentSessionId, 'fork-child-thread');
  assert.equal(writes.filter(message => message.method === 'thread/resume').length, 1);
  assert.equal(writes.some(message => message.method === 'thread/start'), false);
});

test('a transient resume failure retries the same copied-session id without creating a thread', async () => {
  const { ensureThread, handleAppServerMessage } = loadCodexInternals();
  const { session, warnings, writes } = createHarness();

  const pending = ensureThread(session);
  const firstRequest = await waitForRequest(writes, 'thread/resume');
  rejectRpc(handleAppServerMessage, session, firstRequest, 'Codex RPC timeout: thread/resume');

  const secondRequest = await waitForRequest(writes, 'thread/resume', 2);
  assert.equal(secondRequest.params.threadId, 'fork-child-thread');
  resolveRpc(handleAppServerMessage, session, secondRequest, {
    thread: { id: 'fork-child-thread' },
  });

  assert.equal(await pending, 'fork-child-thread');
  assert.equal(session.agentSessionId, 'fork-child-thread');
  assert.equal(writes.some(message => message.method === 'thread/start'), false);
  assert.equal(warnings.some(entry => entry.message.includes('retrying same thread')), true);
});

test('an unexpected thread-started notification cannot replace the selected copied-session id', async () => {
  const { ensureThread, handleAppServerMessage } = loadCodexInternals();
  const { session, warnings, writes } = createHarness();

  const pending = ensureThread(session);
  const request = await waitForRequest(writes, 'thread/resume');
  handleAppServerMessage({
    method: 'thread/started',
    params: { thread: { id: 'unexpected-new-thread' } },
  }, session);

  assert.equal(session.agentSessionId, 'fork-child-thread');
  assert.equal(warnings.some(entry => entry.message.includes('unexpected thread id')), true);
  resolveRpc(handleAppServerMessage, session, request, {
    thread: { id: 'fork-child-thread' },
  });
  assert.equal(await pending, 'fork-child-thread');
});

test('an unexpected resume response id fails safely without replacing the selected copied-session id', async () => {
  const { ensureThread, handleAppServerMessage } = loadCodexInternals();
  const { session, writes } = createHarness();

  const pending = ensureThread(session);
  const request = await waitForRequest(writes, 'thread/resume');
  resolveRpc(handleAppServerMessage, session, request, {
    thread: { id: 'unexpected-new-thread' },
  });

  await assert.rejects(pending, error => {
    assert.equal(error.code, 'CODEX_THREAD_RESUME_FAILED');
    assert.equal(error.cause?.code, 'CODEX_THREAD_ID_MISMATCH');
    return true;
  });
  assert.equal(session.agentSessionId, 'fork-child-thread');
  assert.equal(writes.some(message => message.method === 'thread/start'), false);
});

test('concurrent callers share one copied-session resume request', async () => {
  const { ensureThread, handleAppServerMessage } = loadCodexInternals();
  const { session, writes } = createHarness();

  const first = ensureThread(session);
  const second = ensureThread(session);
  const request = await waitForRequest(writes, 'thread/resume');
  resolveRpc(handleAppServerMessage, session, request, {
    thread: { id: 'fork-child-thread' },
  });

  assert.deepEqual(await Promise.all([first, second]), ['fork-child-thread', 'fork-child-thread']);
  assert.equal(writes.filter(message => message.method === 'thread/resume').length, 1);
});

test('failCodexTurn emits structured CODEX_THREAD_ACTIVE_WRITER code on error and turn_end', () => {
  const { failCodexTurn } = require('../../src/agent/codex')._internal;
  const frames = [];
  const ws = {
    send(value) {
      frames.push(JSON.parse(value));
    },
  };
  const session = {
    id: 'linco-session',
    agentType: 'codex',
    agentSessionId: 'fork-child-thread',
    isTurnActive: true,
    sawPartialAssistantText: false,
    messageQueue: [],
    linco: { messageId: 'msg-1', streamId: 'stream-1' },
  };
  const message = '该会话是通过 Codex 旧版“复制会话”功能创建的。';

  failCodexTurn(ws, session, { agents: { codex: { mode: 'app-server' } } }, message, {
    code: 'CODEX_THREAD_ACTIVE_WRITER',
    error_code: 'CODEX_THREAD_ACTIVE_WRITER',
  });

  const errorFrame = frames.find((frame) => frame.type === 'error');
  const turnEnd = frames.find((frame) => frame.type === 'turn_end');
  assert.equal(errorFrame?.text, message);
  assert.equal(errorFrame?.code, 'CODEX_THREAD_ACTIVE_WRITER');
  assert.equal(errorFrame?.error_code, 'CODEX_THREAD_ACTIVE_WRITER');
  assert.equal(errorFrame?.agentSessionId, 'fork-child-thread');
  assert.equal(turnEnd?.reason, 'error');
  assert.equal(turnEnd?.code, 'CODEX_THREAD_ACTIVE_WRITER');
  assert.equal(turnEnd?.error_code, 'CODEX_THREAD_ACTIVE_WRITER');
  assert.equal(turnEnd?.error, message);
});
