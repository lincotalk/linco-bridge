const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const claude = require('../../src/agent/claude');
const {
  repairClaudeTranscriptFile,
  resolveClaudeTranscriptPath,
} = require('../../src/runtime/claudeTranscript');
const hermes = require('../../src/agent/hermes');
const openclaw = require('../../src/agent/openclaw');
const { createTextStreamBuffer } = require('../../src/core/streamBuffer');

function wsRecorder() {
  const sent = [];
  return {
    sent,
    send(raw) {
      sent.push(JSON.parse(raw));
    },
  };
}

function baseSession(extra = {}) {
  return {
    id: 'session-1',
    messageQueue: [],
    currentInputForNoOutput: 'inspect the file',
    streamState: createTextStreamBuffer({ onStart: ws => ws.send(JSON.stringify({ type: 'assistant_start' })) }),
    _log: { info() {}, warn() {} },
    ...extra,
  };
}

{
  const ws = wsRecorder();
  const session = baseSession();
  const config = { logger: { info() {} } };

  claude._internal.handleStreamEvent({
    event: {
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'I will inspect the target file first.' },
    },
  }, ws, session);

  claude._internal.handleAssistantMessage({
    message: {
      content: [
        { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: 'src/app.js' } },
      ],
    },
  }, ws, session, config);

  claude._internal.handleStreamEvent({
    event: {
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'I found a reference and will search related files.' },
    },
  }, ws, session);
  claude._internal.handleAssistantMessage({
    message: {
      content: [
        { type: 'tool_use', id: 'tool-2', name: 'Grep', input: { pattern: 'needle' } },
      ],
    },
  }, ws, session, config);
  claude._internal.handleStreamEvent({
    event: {
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'Final answer after reading.' },
    },
  }, ws, session);
  claude.flushAssistantText(ws, session);

  assert.deepStrictEqual(ws.sent.map(item => item.type), [
    'assistant_start',
    'assistant_chunk',
    'thinking',
    'tool_call',
    'assistant_chunk',
    'thinking',
    'tool_call',
    'assistant_chunk',
  ]);
  assert.strictEqual(ws.sent[1].text, 'I will inspect the target file first.');
  assert.strictEqual(ws.sent[2].text, 'I will inspect the target file first.');
  assert.strictEqual(ws.sent[4].text, '\n\nI found a reference and will search related files.');
  assert.strictEqual(ws.sent[5].text, 'I found a reference and will search related files.');
  assert.strictEqual(ws.sent[7].text, '\n\nFinal answer after reading.');
}

function withMetadataSession(extra = {}) {
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-claude-test-'));
  return {
    runtimeDir,
    storageId: 'test-storage',
    workspace: runtimeDir,
    agentSessionHistory: [],
    ...extra,
  };
}

{
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-claude-transcript-'));
  const file = path.join(tempDir, 'session.jsonl');
  fs.writeFileSync(file, [
    JSON.stringify({ type: 'assistant', entrypoint: 'sdk-cli', message: { role: 'assistant', content: [{ type: 'text', text: 'hello' }] } }),
    JSON.stringify({ type: 'user', entrypoint: 'sdk-cli', message: { role: 'user', content: [{ type: 'text', text: 'first prompt' }] } }),
    JSON.stringify({ type: 'user', entrypoint: 'sdk-cli', message: { role: 'user', content: [{ type: 'text', text: 'second prompt' }] } }),
    '',
  ].join('\n'));

  const result = repairClaudeTranscriptFile(file);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.repaired, true);
  assert.strictEqual(result.line, 2);

  const records = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).map(line => JSON.parse(line));
  assert.strictEqual(records[0].entrypoint, 'sdk-cli');
  assert.strictEqual(records[1].entrypoint, 'cli');
  assert.strictEqual(records[2].entrypoint, 'sdk-cli');
}

{
  const payload = claude._internal.buildClaudeSlashPayload('/compact');
  assert.deepStrictEqual(payload, {
    type: 'user',
    message: {
      role: 'user',
      content: '/compact',
    },
  });
}

{
  const ws = wsRecorder();
  const session = baseSession(withMetadataSession({
    id: 'session-compact',
    isTurnActive: true,
    agentSessionId: 'claude-session-1',
    claudeCompaction: {
      id: 'claude-compact-test',
      trigger: 'manual',
      startedAt: Date.now() - 20,
      staleTimerId: null,
      timeoutTimerId: null,
      staleNotified: false,
      completed: false,
      resultPreview: '',
    },
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
  }));
  const config = { logger: { info() {}, warn() {} } };

  claude._internal.handleClaudeMessage({
    type: 'stream_event',
    event: {
      type: 'content_block_delta',
      delta: { type: 'thinking_delta', thinking: 'internal reasoning' },
    },
    session_id: 'claude-session-1',
  }, ws, session, config);
  claude._internal.handleClaudeMessage({
    type: 'assistant',
    message: { content: [{ type: 'text', text: 'Not enough messages to compact.' }] },
    session_id: 'claude-session-1',
  }, ws, session, config);
  claude._internal.handleClaudeMessage({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: 'Not enough messages to compact.',
    session_id: 'claude-session-1',
    usage: { input_tokens: 10, output_tokens: 2 },
  }, ws, session, config);

  assert.deepStrictEqual(ws.sent.map(item => item.type), ['context_compaction', 'turn_end']);
  assert.strictEqual(ws.sent[0].phase, 'completed');
  assert.strictEqual(ws.sent[0].agentType, 'claude');
  assert.strictEqual(ws.sent[0].compactionId, 'claude-compact-test');
  assert.strictEqual(ws.sent[0].result.nativeCommand, '/compact');
  assert.strictEqual(ws.sent[0].result.agentResult, 'Not enough messages to compact.');
  assert.strictEqual(session.claudeCompaction, null);
  assert.strictEqual(session.isTurnActive, false);
  assert.strictEqual(session.usage.inputTokens, 10);
  assert.strictEqual(session.usage.outputTokens, 2);
}

{
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-claude-repair-home-'));
  const workspace = path.join(homeDir, 'project');
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-claude-repair-runtime-'));
  fs.mkdirSync(workspace, { recursive: true });
  const sessionId = 'claude-first-turn-session';
  const transcript = resolveClaudeTranscriptPath(workspace, sessionId, homeDir);
  fs.mkdirSync(path.dirname(transcript), { recursive: true });
  fs.writeFileSync(transcript, [
    JSON.stringify({ type: 'user', entrypoint: 'sdk-cli', message: { role: 'user', content: [{ type: 'text', text: 'first prompt' }] } }),
    '',
  ].join('\n'));

  const ws = wsRecorder();
  const session = baseSession({
    id: 'session-repair-after-result',
    storageId: 'sid_repair_after_result',
    runtimeDir,
    workspace,
    agentType: 'claude',
    agentSessionId: sessionId,
    claudeResumeEntrypointFixPending: true,
    messageCount: 0,
    agentSessionHistory: [{ id: sessionId, isActive: true, usage: {}, messageCount: 0 }],
  });
  const config = { logger: { info() {}, warn() {} }, agents: { claude: {} }, homeDir };

  claude._internal.handleClaudeMessage({
    type: 'result',
    subtype: 'success',
    is_error: false,
    session_id: sessionId,
  }, ws, session, config);

  const firstRecord = JSON.parse(fs.readFileSync(transcript, 'utf8').trim());
  assert.strictEqual(firstRecord.entrypoint, 'cli');
  assert.strictEqual(session.claudeResumeEntrypointFixPending, false);
  assert.strictEqual(session.claudeResumeEntrypointFixedSessionId, sessionId);
  const metadata = JSON.parse(fs.readFileSync(path.join(runtimeDir, 'session.json'), 'utf8'));
  assert.strictEqual(metadata.claudeResumeEntrypointFixPending, false);
  assert.strictEqual(metadata.claudeResumeEntrypointFixedSessionId, sessionId);
}

{
  const ws = wsRecorder();
  const session = baseSession(withMetadataSession({
    id: 'session-compact-failed',
    isTurnActive: true,
    claudeCompaction: {
      id: 'claude-compact-failed',
      trigger: 'manual',
      startedAt: Date.now() - 20,
      staleTimerId: null,
      timeoutTimerId: null,
      completed: false,
      resultPreview: '',
    },
    messageQueue: [],
  }));
  const config = { logger: { warn() {}, info() {} } };

  claude._internal.failActiveClaudeCompaction(ws, session, config, 'timeout', 'Claude context compaction timed out.');

  assert.deepStrictEqual(ws.sent.map(item => item.type), ['context_compaction', 'turn_end']);
  assert.strictEqual(ws.sent[0].phase, 'failed');
  assert.strictEqual(ws.sent[0].error.code, 'timeout');
  assert.strictEqual(ws.sent[1].reason, 'error');
  assert.strictEqual(session.claudeCompaction, null);
  assert.strictEqual(session.isTurnActive, false);
}

{
  const ws = wsRecorder();
  const session = baseSession();
  const config = {};

  hermes._internal.handleHermesEvent({ event: 'message.delta', delta: 'I will run a search first.' }, ws, session, config);
  hermes._internal.handleHermesEvent({ event: 'tool.started', run_id: 'run-1', tool: 'grep', preview: 'needle' }, ws, session, config);
  hermes._internal.handleHermesEvent({ event: 'message.delta', delta: 'I found a URL and will fetch it.' }, ws, session, config);
  hermes._internal.handleHermesEvent({ event: 'tool.started', run_id: 'run-1', tool: 'fetch', preview: 'https://example.test' }, ws, session, config);
  hermes._internal.handleHermesEvent({ event: 'message.delta', delta: 'Final Hermes answer.' }, ws, session, config);
  hermes._internal.handleHermesEvent({ event: 'run.completed', output: 'Final Hermes answer.', usage: {} }, ws, session, config);

  assert.deepStrictEqual(ws.sent.map(item => item.type), [
    'thinking_clear',
    'assistant_start',
    'assistant_chunk',
    'thinking',
    'tool_call',
    'assistant_chunk',
    'thinking',
    'tool_call',
    'assistant_chunk',
    'assistant_end',
    'turn_end',
  ]);
  assert.strictEqual(ws.sent[2].text, 'I will run a search first.');
  assert.strictEqual(ws.sent[3].text, 'I will run a search first.');
  assert.strictEqual(ws.sent[5].text, '\n\nI found a URL and will fetch it.');
  assert.strictEqual(ws.sent[6].text, 'I found a URL and will fetch it.');
  assert.strictEqual(ws.sent[8].text, '\n\nFinal Hermes answer.');
  assert.deepStrictEqual(
    ws.sent.filter(item => item.type === 'assistant_chunk').map(item => item.text),
    ['I will run a search first.', '\n\nI found a URL and will fetch it.', '\n\nFinal Hermes answer.'],
  );
}

{
  const ws = wsRecorder();
  const session = baseSession();
  const config = {};

  hermes._internal.handleHermesEvent({ event: 'run.completed', output: 'Fallback Hermes answer.', usage: {} }, ws, session, config);

  assert.deepStrictEqual(ws.sent.slice(0, 3).map(item => item.type), ['thinking_clear', 'assistant_start', 'assistant_chunk']);
  assert.deepStrictEqual(
    ws.sent.filter(item => item.type === 'assistant_chunk').map(item => item.text),
    ['Fallback Hermes answer.'],
  );
}

{
  const ws = wsRecorder();
  const session = baseSession();
  const config = {};

  hermes._internal.handleHermesEvent({ event: 'reasoning.available', text: 'Hermes is preparing a concise reply.' }, ws, session, config);
  hermes._internal.handleHermesEvent({ event: 'message.delta', delta: '你好！' }, ws, session, config);
  hermes._internal.handleHermesEvent({ event: 'run.completed', output: '你好！', usage: {} }, ws, session, config);

  assert.deepStrictEqual(ws.sent.map(item => item.type), [
    'thinking_clear',
    'assistant_start',
    'assistant_chunk',
    'assistant_end',
    'turn_end',
  ]);
}

{
  const ws = wsRecorder();
  const session = baseSession();
  const config = {};

  hermes._internal.handleHermesEvent({ event: 'reasoning.available', text: 'Hermes will inspect a file.' }, ws, session, config);
  hermes._internal.handleHermesEvent({ event: 'tool.started', run_id: 'run-1', tool: 'read_file', preview: 'package.json' }, ws, session, config);
  hermes._internal.handleHermesEvent({ event: 'tool.completed', run_id: 'run-1', tool: 'read_file', duration: 1.25 }, ws, session, config);
  hermes._internal.handleHermesEvent({ event: 'message.delta', delta: 'Final Hermes tool answer.' }, ws, session, config);
  hermes._internal.handleHermesEvent({ event: 'run.completed', output: 'Final Hermes tool answer.', usage: {} }, ws, session, config);

  assert.deepStrictEqual(ws.sent.slice(0, 3).map(item => item.type), ['thinking', 'tool_call', 'tool_result']);
  assert.strictEqual(ws.sent[0].text, 'Hermes will inspect a file.');
  assert.deepStrictEqual(
    ws.sent.filter(item => item.type === 'assistant_chunk').map(item => item.text),
    ['Final Hermes tool answer.'],
  );
}

{
  const ws = wsRecorder();
  const session = baseSession();
  const config = {};

  hermes._internal.handleHermesEvent({
    event: 'tool.completed',
    run_id: 'run-1',
    tool: 'pwd',
    stdout: '/Users/admin/Desktop/work/git/ai-project/aichat\n',
    duration: 0.8,
  }, ws, session, config);

  assert.deepStrictEqual(ws.sent, [
    {
      type: 'tool_result',
      toolUseId: 'run-1:pwd',
      output: '/Users/admin/Desktop/work/git/ai-project/aichat\n',
      isError: false,
    },
  ]);
}

{
  const ws = wsRecorder();
  const session = baseSession({
    agentSessionId: 'openclaw-session-1',
    openclawRunId: 'run-1',
    openclawLastText: '',
    isTurnActive: true,
    messageQueue: [],
  });
  const config = {};

  openclaw._internal.handleOpenClawEvent('chat', {
    state: 'delta',
    runId: 'run-1',
    sessionKey: 'openclaw-session-1',
    deltaText: 'I will call the plugin first.',
  }, {}, ws, session, config);
  openclaw._internal.handleOpenClawEvent('plugin.started', {
    state: 'started',
    runId: 'run-1',
    id: 'plugin-1',
    plugin: 'files.read',
    input: { path: 'src/app.js' },
  }, {}, ws, session, config);
  openclaw._internal.handleOpenClawEvent('chat', {
    state: 'delta',
    runId: 'run-1',
    sessionKey: 'openclaw-session-1',
    deltaText: 'I found another file and will inspect it.',
  }, {}, ws, session, config);
  openclaw._internal.handleOpenClawEvent('plugin.started', {
    state: 'started',
    runId: 'run-1',
    id: 'plugin-2',
    plugin: 'files.read',
    input: { path: 'src/other.js' },
  }, {}, ws, session, config);
  openclaw._internal.handleOpenClawEvent('chat', {
    state: 'delta',
    runId: 'run-1',
    sessionKey: 'openclaw-session-1',
    deltaText: 'Final OpenClaw answer.',
  }, {}, ws, session, config);
  openclaw._internal.handleOpenClawEvent('chat', {
    state: 'final',
    runId: 'run-1',
    sessionKey: 'openclaw-session-1',
    message: { text: 'I will call the plugin first.I found another file and will inspect it.Final OpenClaw answer.' },
    usage: {},
  }, {}, ws, session, config);

  assert.deepStrictEqual(ws.sent.map(item => item.type), [
    'assistant_start',
    'assistant_chunk',
    'thinking',
    'tool_call',
    'assistant_chunk',
    'thinking',
    'tool_call',
    'assistant_chunk',
    'assistant_end',
    'turn_end',
  ]);
  assert.strictEqual(ws.sent[1].text, 'I will call the plugin first.');
  assert.strictEqual(ws.sent[2].text, 'I will call the plugin first.');
  assert.strictEqual(ws.sent[4].text, '\n\nI found another file and will inspect it.');
  assert.strictEqual(ws.sent[5].text, 'I found another file and will inspect it.');
  assert.strictEqual(ws.sent[7].text, '\n\nFinal OpenClaw answer.');
}

{
  const ws = wsRecorder();
  const session = baseSession({
    agentSessionId: 'openclaw-session-2',
    openclawRunId: 'run-2',
    openclawLastText: '',
    isTurnActive: true,
    messageQueue: [],
  });
  const config = {};

  openclaw._internal.handleOpenClawEvent('chat', {
    state: 'delta',
    runId: 'run-2',
    sessionKey: 'openclaw-session-2',
    deltaText: 'I will run a command first.',
  }, {}, ws, session, config);
  openclaw._internal.handleOpenClawEvent('exec.started', {
    state: 'started',
    runId: 'run-2',
    commandId: 'cmd-1',
    command: 'npm test',
  }, {}, ws, session, config);
  openclaw._internal.handleOpenClawEvent('exec.completed', {
    state: 'completed',
    runId: 'run-2',
    commandId: 'cmd-1',
    command: 'npm test',
    output: 'ok',
  }, {}, ws, session, config);
  openclaw._internal.handleOpenClawEvent('chat', {
    state: 'delta',
    runId: 'run-2',
    sessionKey: 'openclaw-session-2',
    deltaText: 'Final command answer.',
  }, {}, ws, session, config);
  openclaw._internal.handleOpenClawEvent('chat', {
    state: 'final',
    runId: 'run-2',
    sessionKey: 'openclaw-session-2',
    message: { text: 'I will run a command first.Final command answer.' },
    usage: {},
  }, {}, ws, session, config);

  assert.deepStrictEqual(ws.sent.slice(0, 5).map(item => item.type), ['assistant_start', 'assistant_chunk', 'thinking', 'tool_call', 'tool_result']);
  assert.strictEqual(ws.sent[1].text, 'I will run a command first.');
  assert.strictEqual(ws.sent[2].mode, 'progress');
  assert.strictEqual(ws.sent[2].text, 'I will run a command first.');
  assert.strictEqual(ws.sent[3].id, 'cmd-1');
  assert.strictEqual(ws.sent[3].name, 'npm test');
  assert.strictEqual(ws.sent[4].toolUseId, 'cmd-1');
  assert(ws.sent.some(item => item.type === 'assistant_chunk' && item.text === '\n\nFinal command answer.'));
}

{
  const ws = wsRecorder();
  const session = baseSession({
    agentSessionId: 'openclaw-session-3',
    openclawRunId: 'run-3',
    openclawLastText: '',
    isTurnActive: true,
    messageQueue: [],
  });
  const config = {};

  openclaw._internal.handleOpenClawEvent('chat', {
    state: 'delta',
    runId: 'run-3',
    sessionKey: 'openclaw-session-3',
    deltaText: 'I will inspect the file.',
  }, {}, ws, session, config);
  openclaw._internal.handleOpenClawEvent('agent', {
    stream: 'lifecycle',
    runId: 'run-3',
    sessionKey: 'openclaw-session-3',
    data: { phase: 'started' },
  }, {}, ws, session, config);
  openclaw._internal.handleOpenClawEvent('agent', {
    stream: 'item',
    runId: 'run-3',
    sessionKey: 'openclaw-session-3',
    data: { phase: 'start', itemId: 'item-1' },
  }, {}, ws, session, config);
  openclaw._internal.handleOpenClawEvent('agent', {
    stream: 'tool',
    runId: 'run-3',
    sessionKey: 'openclaw-session-3',
    data: {
      phase: 'start',
      name: 'read',
      toolCallId: 'tool-1',
      args: { path: 'package.json' },
    },
  }, {}, ws, session, config);
  openclaw._internal.handleOpenClawEvent('agent', {
    stream: 'tool',
    runId: 'run-3',
    sessionKey: 'openclaw-session-3',
    data: {
      phase: 'result',
      name: 'read',
      toolCallId: 'tool-1',
      result: '{ "name": "linco-connect" }',
      isError: false,
    },
  }, {}, ws, session, config);

  assert.deepStrictEqual(ws.sent.map(item => item.type), ['assistant_start', 'assistant_chunk', 'thinking', 'tool_call', 'tool_result']);
  assert.strictEqual(ws.sent[1].text, 'I will inspect the file.');
  assert.strictEqual(ws.sent[2].text, 'I will inspect the file.');
  assert.strictEqual(ws.sent[3].id, 'tool-1');
  assert.strictEqual(ws.sent[3].name, 'read');
  assert.strictEqual(ws.sent[4].toolUseId, 'tool-1');
  assert.strictEqual(ws.sent[4].name, 'read');
}

console.log('progressive action panel ok');
