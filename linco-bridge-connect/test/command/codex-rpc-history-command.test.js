'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const codex = require('../../src/agent/codex');
const { handleSlashCommand } = require('../../src/command');

function createCaptureWs() {
  const sent = [];
  return {
    sent,
    send(raw) {
      sent.push(JSON.parse(raw));
    },
  };
}

async function waitForFrame(ws, predicate, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const frame = ws.sent.find(predicate);
    if (frame) return frame;
    await new Promise(resolve => setImmediate(resolve));
  }
  throw new Error(`Timed out waiting for frame. Received: ${JSON.stringify(ws.sent)}`);
}

function createFakeAppServer(tempDir) {
  const scriptPath = path.join(tempDir, 'fake-codex-app-server.js');
  const shimPath = path.join(tempDir, 'fake-codex.cmd');
  fs.writeFileSync(scriptPath, [
    "'use strict';",
    "const readline = require('node:readline');",
    "const input = readline.createInterface({ input: process.stdin });",
    'function reply(id, result) {',
    "  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\\n');",
    '}',
    "input.on('line', line => {",
    '  const message = JSON.parse(line);',
    '  if (message.id === undefined) return;',
    "  if (message.method === 'initialize') {",
    "    reply(message.id, { serverInfo: { name: 'fake-codex', version: '1' } });",
    '    return;',
    '  }',
    "  if (message.method === 'thread/list') {",
    '    const cwd = Array.isArray(message.params.cwd) ? message.params.cwd[0] : message.params.cwd;',
    "    reply(message.id, { data: [{ id: 'rpc-thread-1', name: 'RPC thread', preview: 'RPC first prompt', cwd, recencyAt: 1786000000, status: { type: 'idle' } }], nextCursor: null });",
    '    return;',
    '  }',
    "  if (message.method === 'thread/turns/list') {",
    "    reply(message.id, { data: [{ id: 'rpc-turn-1', items: [{ id: 'user-1', type: 'userMessage', text: 'RPC user' }, { id: 'assistant-1', type: 'agentMessage', phase: 'final_answer', text: 'RPC assistant' }] }], nextCursor: null });",
    '    return;',
    '  }',
    "  if (message.method === 'thread/read') {",
    "    reply(message.id, { thread: { id: message.params.threadId, name: 'RPC thread', cwd: process.cwd(), turns: [] } });",
    '    return;',
    '  }',
    "  reply(message.id, {});",
    '});',
  ].join('\n'));
  fs.writeFileSync(shimPath, '@echo off\r\nnode "%~dp0\\fake-codex-app-server.js" %*\r\n');
  return shimPath;
}

function assertResultBeforeSingleTurnEnd(ws, command) {
  const resultIndex = ws.sent.findIndex(frame => frame.type === 'slash_command_result' && frame.command === command);
  const turnEndIndexes = ws.sent
    .map((frame, index) => frame.type === 'turn_end' ? index : -1)
    .filter(index => index >= 0);
  assert.ok(resultIndex >= 0, `missing ${command} result`);
  assert.deepEqual(turnEndIndexes.length, 1);
  assert.ok(resultIndex < turnEndIndexes[0], `${command} result must precede turn_end`);
}

test('Codex RPC sessions bind and history commands complete in protocol order', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-codex-rpc-command-'));
  const project = path.join(tempDir, 'project');
  fs.mkdirSync(project, { recursive: true });
  const config = {
    homeDir: tempDir,
    agents: { codex: { mode: 'app-server', bin: createFakeAppServer(tempDir) } },
  };
  const session = {
    id: 'rpc-command-session',
    workspace: project,
    agentType: 'codex',
    messageQueue: [],
    agentSessionHistory: [],
    linco: { messageId: 'rpc-sessions', streamId: 'rpc-sessions-stream' },
  };

  try {
    const sessionsWs = createCaptureWs();
    assert.equal(handleSlashCommand('/sessions', sessionsWs, session, config), true);
    await waitForFrame(sessionsWs, frame => frame.type === 'turn_end');
    assertResultBeforeSingleTurnEnd(sessionsWs, 'sessions');
    assert.equal(sessionsWs.sent[0].data.items[0].id, 'rpc-thread-1');

    session.linco = { messageId: 'rpc-bind', streamId: 'rpc-bind-stream' };
    const bindWs = createCaptureWs();
    assert.equal(handleSlashCommand('/bind rpc-thread-1', bindWs, session, config), true);
    await waitForFrame(bindWs, frame => frame.type === 'turn_end');
    assert.equal(session.agentSessionId, 'rpc-thread-1');
    assert.equal(bindWs.sent.filter(frame => frame.type === 'turn_end').length, 1);

    session.linco = { messageId: 'rpc-history', streamId: 'rpc-history-stream' };
    const historyWs = createCaptureWs();
    assert.equal(handleSlashCommand('/history 3', historyWs, session, config), true);
    await waitForFrame(historyWs, frame => frame.type === 'turn_end');
    assertResultBeforeSingleTurnEnd(historyWs, 'history');
    const historyResult = historyWs.sent.find(frame => frame.type === 'slash_command_result');
    assert.equal(historyResult.data.rounds[0].user.text, 'RPC user');
    assert.equal(historyResult.data.rounds[0].assistant.text, 'RPC assistant');
    assert.equal(historyResult.data.syncMeta.strategy, 'codex_app_server_turns_list');
  } finally {
    const child = session.codexAppServer;
    codex.stop(session, { clearAgentSession: false });
    if (child && child.exitCode === null) {
      await once(child, 'close');
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
