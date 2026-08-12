const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const test = require('node:test');

function loadCodexModule() {
  const filename = path.resolve(__dirname, '../../src/agent/codex/index.js');
  delete require.cache[filename];
  return require(filename);
}

function loadHandleAppServerMessage() {
  const filename = path.resolve(__dirname, '../../src/agent/codex/index.js');
  const source = fs.readFileSync(filename, 'utf8');
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(
    `${source}\nmodule.exports._test = { handleAppServerMessage };\n`,
    filename,
  );
  return mod.exports._test.handleAppServerMessage;
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

function createRemoteTurnSession() {
  const ws = createWs();
  ws.linco = {
    messageId: 'req_stream_retry',
    streamId: 'ddchat-stream-req_stream_retry',
  };
  const session = {
    id: 'session-stream-retry',
    isTurnActive: true,
    currentInputForNoOutput: '当前项目是什么功能的',
    messageQueue: [],
    sawPartialAssistantText: false,
    codexAssistantEnded: false,
    codexSawFinalAssistantText: false,
    codexUseProgressiveAnswer: true,
    codexAgentMessageEmissionPhases: new Map(),
    codexEmittedAgentMessageIds: new Set(),
    linco: ws.linco,
    agentSessionId: 'thread-stream-retry',
    _lastWs: ws,
    _lastConfig: {},
    _log: {
      info() {},
      warn() {},
    },
  };
  return { session, ws };
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

test('stream disconnect willRetry 时不提前 turn_end，后续 final_answer 仍可送达', () => {
  const handleAppServerMessage = loadHandleAppServerMessage();
  const { session, ws } = createRemoteTurnSession();
  const commentary = '我先查看项目说明、多页面入口和核心脚本目录，再基于代码概括它实际包含的功能。';
  const finalAnswer = '当前项目是一个面向微信端的 Vue 3 多页面 H5 项目。';

  handleAppServerMessage({
    method: 'item/agentMessage/delta',
    params: {
      item: {
        type: 'agentMessage',
        id: 'msg_commentary',
        phase: 'commentary',
      },
      delta: commentary,
    },
  }, session);

  handleAppServerMessage({
    method: 'error',
    params: {
      error: {
        message: 'Reconnecting... 1/5',
        codexErrorInfo: {
          responseStreamDisconnected: {
            httpStatusCode: null,
          },
        },
        additionalDetails: 'stream disconnected before completion: Concurrency limit exceeded for user, please retry later',
      },
      willRetry: true,
      threadId: '019f9208-d41c-7a61-b006-67e59c82ef04',
      turnId: '019ff3c3-8d28-7c70-bf66-bced5156a954',
    },
  }, session);

  assert.strictEqual(session.isTurnActive, true);
  assert.strictEqual(session.codexAssistantEnded, false);
  assert.ok(!ws.frames.some((frame) => frame.type === 'turn_end'));
  assert.ok(!ws.frames.some((frame) => frame.type === 'error'));

  handleAppServerMessage({
    method: 'item/completed',
    params: {
      item: {
        type: 'agentMessage',
        id: 'msg_final',
        text: finalAnswer,
        phase: 'final_answer',
      },
    },
  }, session);
  handleAppServerMessage({ method: 'turn/completed', params: {} }, session);

  assert.strictEqual(session.isTurnActive, false);
  const chunks = ws.frames.filter((frame) => frame.type === 'assistant_chunk').map((frame) => frame.text).join('');
  assert.match(chunks, /Vue 3 多页面 H5/);
  const turnEnd = ws.frames.find((frame) => frame.type === 'turn_end');
  assert.ok(turnEnd);
  assert.strictEqual(turnEnd.reason, 'completed');
  assert.ok(!turnEnd.partialRecovered);
});

test('非 willRetry 的 app-server error 仍按失败收口', () => {
  const handleAppServerMessage = loadHandleAppServerMessage();
  const { session, ws } = createRemoteTurnSession();

  handleAppServerMessage({
    method: 'item/agentMessage/delta',
    params: {
      item: {
        type: 'agentMessage',
        id: 'msg_commentary_fatal',
        phase: 'commentary',
      },
      delta: '我先查看项目说明。',
    },
  }, session);

  handleAppServerMessage({
    method: 'error',
    params: {
      message: 'Codex provider unavailable',
    },
  }, session);

  assert.strictEqual(session.isTurnActive, false);
  const turnEnd = ws.frames.find((frame) => frame.type === 'turn_end');
  assert.ok(turnEnd);
  assert.strictEqual(turnEnd.reason, 'completed');
  assert.strictEqual(turnEnd.partialRecovered, true);
});
