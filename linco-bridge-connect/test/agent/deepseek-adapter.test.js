const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { WebSocketServer } = require('ws');

const deepseek = require('../../src/agent/deepseek');
const { handleSlashCommand } = require('../../src/command');
const { createSession } = require('../../src/core/session');

test('DeepSeek adapter maps Harness HTTP origins to WebSocket event URLs', () => {
  assert.equal(
    deepseek._internal.eventStreamUrl('http://127.0.0.1:3080/base/'),
    'ws://127.0.0.1:3080/api/events.mux',
  );
  assert.equal(
    deepseek._internal.eventStreamUrl('https://harness.example'),
    'wss://harness.example/api/events.mux',
  );
  assert.throws(
    () => deepseek._internal.eventStreamUrl('ftp://harness.example'),
    /protocol is not supported/,
  );
});

test('DeepSeek adapter creates a Harness session and maps streamed events', async t => {
  const harness = await createMockHarness();
  t.after(() => harness.close());
  const fixture = createFixture(harness.url);
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));

  deepseek.execute('hello', fixture.ws, fixture.session, fixture.config);
  await waitFor(() => fixture.frames.some(frame => frame.type === 'turn_end'));

  assert.equal(harness.calls.filter(call => call.method === 'session.create').length, 1);
  assert.equal(harness.calls.filter(call => call.method === 'session.prompt').length, 1);
  assert.equal(fixture.session.agentSessionId, 'dsh-session-1');
  assert.deepEqual(
    fixture.frames.filter(frame => ['thinking', 'tool_call', 'tool_result'].includes(frame.type)).map(frame => frame.type),
    ['thinking', 'tool_call', 'tool_result'],
  );
  assert.equal(
    fixture.frames.filter(frame => frame.type === 'assistant_chunk').map(frame => frame.text).join(''),
    'Hello from DeepSeek',
  );
  assert.equal(fixture.frames.filter(frame => frame.type === 'assistant_start').length, 1);
  assert.equal(fixture.frames.filter(frame => frame.type === 'assistant_end').length, 1);
  assert.equal(fixture.frames.filter(frame => frame.type === 'turn_end').length, 1);
  assert.equal(fixture.session.usage.inputTokens, 7);
  assert.equal(fixture.session.usage.outputTokens, 4);
});

test('DeepSeek adapter resumes a persisted Harness session and cancels an active turn', async t => {
  const harness = await createMockHarness({ autoComplete: false });
  t.after(() => harness.close());
  const fixture = createFixture(harness.url);
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  fixture.session.agentSessionId = 'persisted-session';

  deepseek.execute('continue', fixture.ws, fixture.session, fixture.config);
  await waitFor(() => harness.calls.some(call => call.method === 'session.prompt'));
  deepseek.stop(fixture.session, { clearAgentSession: false });
  await waitFor(() => harness.calls.some(call => call.method === 'session.cancel'));

  assert.equal(harness.calls.filter(call => call.method === 'session.create').length, 1);
  assert.deepEqual(harness.calls.find(call => call.method === 'session.create').payload, {
    sessionId: 'persisted-session',
    cwd: fixture.root,
  });
  assert.equal(harness.calls.find(call => call.method === 'session.prompt').payload.sessionId, 'persisted-session');
  assert.equal(fixture.session.agentSessionId, 'persisted-session');
  assert.equal(fixture.session.isTurnActive, false);
});

test('DeepSeek project sessions merge workspace ownership and cwd matches, then bind a selected session', async t => {
  const options = {};
  const harness = await createMockHarness(options);
  t.after(() => harness.close());
  const fixture = createFixture(harness.url);
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  options.workspaceResult = {
    items: [{
      workspaceId: 'workspace-1',
      path: fixture.root,
      title: 'fixture',
      sessionIds: ['owned-session', 'blank-session', 'archived-session'],
    }],
    archivedSessionIds: ['archived-session'],
  };
  options.sessionResult = {
    items: [
      sessionRow('cwd-session', fixture.root, 300, 'Cwd session'),
      sessionRow('owned-session', path.join(fixture.root, 'legacy-path'), 200, 'Owned session'),
      sessionRow('archived-session', fixture.root, 500, 'Archived session'),
      sessionRow('blank-session', fixture.root, 400, '', { blank: true }),
      sessionRow('subagent-session', fixture.root, 350, 'Subagent', { origin: 'subagent' }),
      sessionRow('other-session', path.dirname(fixture.root), 600, 'Other session'),
    ],
  };

  fixture.ws.linco = { streamId: 'sessions-stream' };
  assert.equal(
    handleSlashCommand(`/sessions --project "${fixture.root}" 10`, fixture.ws, fixture.session, fixture.config),
    true,
  );
  await waitFor(() => fixture.frames.some(frame => frame.type === 'turn_end'));
  const payload = fixture.frames.find(frame => frame.type === 'slash_command_result');
  assert.deepEqual(payload.data.items.map(item => item.id), ['cwd-session', 'owned-session']);
  assert.deepEqual(payload.data.items.map(item => item.title), ['Cwd session', 'Owned session']);
  assert.deepEqual(payload.data.items.map(item => item.resumeCommand), [null, null]);

  fixture.frames.length = 0;
  fixture.ws.linco = { streamId: 'bind-stream' };
  assert.equal(
    handleSlashCommand(`/bind --project "${fixture.root}" owned-session`, fixture.ws, fixture.session, fixture.config),
    true,
  );
  await waitFor(() => fixture.frames.some(frame => frame.type === 'turn_end'));
  assert.equal(fixture.session.agentSessionId, 'owned-session');
  assert.equal(fixture.session.workspace, fixture.root);
  assert.match(fixture.frames.find(frame => frame.type === 'system')?.text || '', /DeepSeek Harness/);
});

test('DeepSeek session creation attaches to the registered Harness workspace', async t => {
  const options = {};
  const harness = await createMockHarness(options);
  t.after(() => harness.close());
  const fixture = createFixture(harness.url);
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  options.workspaceResult = {
    items: [{ workspaceId: 'workspace-1', path: fixture.root, sessionIds: [] }],
    archivedSessionIds: [],
  };

  await deepseek.warmup(fixture.ws, fixture.session, fixture.config);
  const create = harness.calls.find(call => call.method === 'session.create');
  assert.deepEqual(create.payload, { workspaceId: 'workspace-1', agentPreset: 'standard' });
  deepseek.stop(fixture.session, { clearAgentSession: false });
});

test('DeepSeek history reload maps Harness events into visible conversation rounds', async t => {
  const options = {};
  const harness = await createMockHarness(options);
  t.after(() => harness.close());
  const fixture = createFixture(harness.url);
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  options.workspaceResult = {
    items: [{ workspaceId: 'workspace-1', path: fixture.root, sessionIds: ['history-session'] }],
    archivedSessionIds: [],
  };
  options.sessionResult = {
    items: [sessionRow('history-session', fixture.root, 300, 'History session')],
  };
  options.historyResult = {
    events: [
      historyEntry('user/message', 1, 1000, {
        role: 'user',
        content: [{ type: 'text', text: 'First question' }],
        source: { kind: 'user' },
      }),
      historyEntry('user/message', 2, 1001, {
        role: 'user',
        content: [{ type: 'text', text: 'hidden plugin context' }],
        source: { kind: 'plugin', plugin: 'fixture' },
      }),
      historyEntry('assistant/message', 3, 1002, {
        message: {
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'Reasoning summary' },
            { type: 'text', text: 'First answer' },
          ],
          source: { kind: 'model', provider: 'fixture', model: 'fixture' },
        },
      }),
      historyEntry('user/message', 4, 2000, {
        role: 'user',
        content: [{ type: 'text', text: 'Second question' }],
        source: { kind: 'user' },
      }),
      historyEntry('assistant/message', 5, 2001, {
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Second answer' }],
          source: { kind: 'model', provider: 'fixture', model: 'fixture' },
        },
      }),
    ],
    hasMore: false,
  };

  fixture.ws.linco = { streamId: 'history-reload-stream' };
  assert.equal(
    handleSlashCommand(
      `/history-reload --project "${fixture.root}" --session history-session --thinking 5`,
      fixture.ws,
      fixture.session,
      fixture.config,
    ),
    true,
  );
  await waitFor(() => fixture.frames.some(frame => frame.type === 'turn_end'));
  const payload = fixture.frames.find(frame => frame.type === 'slash_command_result');
  assert.equal(payload.command, 'history');
  assert.equal(payload.data.replaceConversation, true);
  assert.deepEqual(payload.data.rounds.map(round => round.user.text), ['First question', 'Second question']);
  assert.deepEqual(payload.data.rounds.map(round => round.assistant.text), ['First answer', 'Second answer']);
  assert.equal(payload.data.rounds[0].thinking.text, 'Reasoning summary');
  assert.equal(harness.calls.filter(call => call.method === 'session.history').length, 1);
  assert.equal(harness.calls.filter(call => call.method === 'session.create').length, 0);
});

function createFixture(gatewayUrl) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-deepseek-test-'));
  const config = {
    lincoHome: root,
    attachmentsDirName: 'attachments',
    maxMessageQueue: 10,
    agents: { deepseek: { gatewayUrl, agentPreset: 'standard' } },
    logger: { info() {}, warn() {}, error() {} },
  };
  const session = createSession(config, { externalSessionId: 'bridge-session', agentType: 'deepseek' });
  session.workspace = root;
  const frames = [];
  const ws = { send(value) { frames.push(JSON.parse(value)); } };
  return { root, config, session, frames, ws };
}

async function createMockHarness(options = {}) {
  const clients = new Set();
  const calls = [];
  const server = http.createServer(async (req, res) => {
    const body = await readJson(req);
    const method = body.method || req.url.replace('/api/', '');
    calls.push({ method, payload: body.payload });
    if (method === 'workspace.list') {
      return sendRpc(res, body.rpcId, options.workspaceResult || { items: [], archivedSessionIds: [] });
    }
    if (method === 'session.list') {
      return sendRpc(res, body.rpcId, options.sessionResult || { items: [] });
    }
    if (method === 'session.history') {
      return sendRpc(res, body.rpcId, options.historyResult || { events: [], hasMore: false });
    }
    if (method === 'session.create') {
      return sendRpc(res, body.rpcId, {
        sessionId: body.payload.sessionId || 'dsh-session-1',
        agentPreset: 'standard',
      });
    }
    if (method === 'session.prompt') {
      sendRpc(res, body.rpcId, { accepted: true });
      if (options.autoComplete !== false) setImmediate(() => emitTurn(clients, body.payload.sessionId));
      return;
    }
    if (method === 'session.cancel') return sendRpc(res, body.rpcId, { accepted: true });
    sendRpc(res, body.rpcId, {});
  });
  const downlinks = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/api/events.mux') {
      socket.destroy();
      return;
    }
    downlinks.handleUpgrade(req, socket, head, client => downlinks.emit('connection', client, req));
  });
  downlinks.on('connection', client => {
    clients.add(client);
    client.once('close', () => clients.delete(client));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    calls,
    url: `http://127.0.0.1:${address.port}`,
    close() {
      for (const client of clients) client.terminate();
      return Promise.all([
        new Promise(resolve => downlinks.close(resolve)),
        new Promise(resolve => server.close(resolve)),
      ]);
    },
  };
}

function sessionRow(sessionId, cwd, updatedAt, title, extra = {}) {
  return {
    sessionId,
    cwd,
    updatedAt,
    running: false,
    blank: false,
    ...extra,
    ...(title ? { projections: { asOfSeq: 1, values: { title } } } : {}),
  };
}

function historyEntry(type, seq, time, data, surfaceOp = 'append') {
  return { event: { type, seq, time, data, surfaceOp } };
}

function emitTurn(clients, sessionId) {
  const events = [
    { type: 'turn/start', seq: 1, time: 1, data: { turn: 1 } },
    { type: 'assistant/chunk', seq: 2, time: 2, data: { turn: 1, step: 1, chunk: { type: 'reasoning-delta', index: 0, text: 'Thinking' } } },
    { type: 'assistant/chunk', seq: 3, time: 3, data: { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: 'Hello from ' } } },
    { type: 'assistant/chunk', seq: 4, time: 4, data: { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: 'DeepSeek' } } },
    { type: 'tool/call', seq: 5, time: 5, data: { turn: 1, step: 1, callId: 'call-1', name: 'read_file', arguments: '{"path":"README.md"}' } },
    { type: 'tool/result', seq: 6, time: 6, data: { turn: 1, step: 1, callId: 'call-1', message: { content: [{ type: 'text', text: 'ok' }] } } },
    { type: 'assistant/message', seq: 7, time: 7, data: { turn: 1, step: 1, message: { content: [{ type: 'text', text: 'Hello from DeepSeek' }] }, usage: { inputTokens: 7, outputTokens: 4 } } },
    { type: 'turn/end', seq: 8, time: 8, data: { turn: 1, reason: { kind: 'completed' } } },
  ];
  for (const event of events) {
    const envelope = {
      type: 'server-request',
      rpcId: `event-${event.seq}`,
      method: 'session/event',
      payload: { type: 'session/event', sessionId, event },
    };
    for (const client of clients) client.send(JSON.stringify(envelope));
  }
}

function sendRpc(res, rpcId, value) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ type: 'server-response', rpcId, result: { ok: true, value } }));
}

async function readJson(req) {
  let text = '';
  for await (const chunk of req) text += chunk;
  return text ? JSON.parse(text) : {};
}

async function waitFor(predicate, timeoutMs = 3000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('timed out waiting for condition');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
