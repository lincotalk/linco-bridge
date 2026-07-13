const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

function loadHandleAppServerMessage() {
  const filename = path.resolve(__dirname, '../../src/agent/codex/index.js');
  const source = fs.readFileSync(filename, 'utf8');
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(
    `${source}\nmodule.exports._hostDirectiveTest = { handleAppServerMessage };\n`,
    filename,
  );
  return mod.exports._hostDirectiveTest.handleAppServerMessage;
}

function createRemoteSession() {
  const sent = [];
  const linco = { messageId: 'm-1', streamId: 'stream-1' };
  const ws = {
    linco,
    send(raw) {
      sent.push(JSON.parse(raw));
    },
  };
  return {
    sent,
    session: {
      id: 'session-1',
      isTurnActive: true,
      currentInputForNoOutput: 'hello',
      messageQueue: [],
      sawPartialAssistantText: false,
      codexAssistantEnded: false,
      codexEmittedAgentMessageIds: new Set(),
      linco,
      agentSessionId: 'thread-1',
      _lastWs: ws,
      _lastConfig: {},
      _log: { info() {} },
    },
  };
}

function withCapturedTimers(callback) {
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  global.setTimeout = () => ({ captured: true });
  global.clearTimeout = () => {};
  try {
    callback();
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  }
}

function assistantText(sent) {
  return sent
    .filter((message) => message.type === 'assistant_chunk')
    .map((message) => message.text)
    .join('');
}

const handleAppServerMessage = loadHandleAppServerMessage();

test('Codex completed final answer omits host directives', () => {
  withCapturedTimers(() => {
    const { session, sent } = createRemoteSession();
    handleAppServerMessage(
      {
        method: 'item/completed',
        params: {
          item: {
            type: 'agentMessage',
            id: 'agent-complete',
            text:
              '已合并到本地 master。\n\n'
              + '::git-create-branch{cwd="/workspace" branch="master"}',
            phase: 'final_answer',
          },
        },
      },
      session,
    );
    handleAppServerMessage({ method: 'turn/completed', params: {} }, session);

    assert.equal(assistantText(sent), '已合并到本地 master。');
  });
});

test('Codex split final answer never emits a partial host directive', () => {
  withCapturedTimers(() => {
    const { session, sent } = createRemoteSession();
    for (const delta of [
      '提交并推送完成。\n\n::git-pu',
      'sh{cwd="/workspace" branch="master"}',
    ]) {
      handleAppServerMessage(
        {
          method: 'item/agentMessage/delta',
          params: {
            item: {
              type: 'agentMessage',
              id: 'agent-split',
              phase: 'final_answer',
            },
            delta,
            phase: 'final_answer',
          },
        },
        session,
      );
    }
    handleAppServerMessage({ method: 'turn/completed', params: {} }, session);

    assert.equal(assistantText(sent), '提交并推送完成。');
  });
});
