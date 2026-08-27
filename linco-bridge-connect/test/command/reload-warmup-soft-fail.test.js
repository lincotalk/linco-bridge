'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isSoftWarmupFailure,
  warmupAfterReload,
} = require('../../src/command/lifecycle');

test('isSoftWarmupFailure recognizes codex active writer errors', () => {
  assert.equal(
    isSoftWarmupFailure({
      code: 'CODEX_THREAD_ACTIVE_WRITER',
      message: '新版 Codex 已调整旧会话的跨端写入机制',
    }),
    true,
  );
  assert.equal(
    isSoftWarmupFailure(new Error('thread abc already has an active writer')),
    true,
  );
  assert.equal(
    isSoftWarmupFailure(new Error('当前会话写入权仍被占用（可能是 Codex 桌面端）')),
    true,
  );
  assert.equal(isSoftWarmupFailure(new Error('network timeout')), false);
});

test('warmupAfterReload does not sendError on active writer; uses system notice', async () => {
  const frames = [];
  const ws = {
    send(raw) {
      frames.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
    },
  };
  const session = {
    agentType: 'codex',
    agentSessionId: 'thread-soft-fail',
    workspace: 'D:\\project\\demo',
  };

  const agentRunnerPath = require.resolve('../../src/runtime/agentRunner');
  const original = require.cache[agentRunnerPath];
  let stopCalls = 0;
  let warmupCalls = 0;
  require.cache[agentRunnerPath] = {
    id: agentRunnerPath,
    filename: agentRunnerPath,
    loaded: true,
    exports: {
      stopAgentProcess() {
        stopCalls += 1;
      },
      async warmupAgentProcess() {
        warmupCalls += 1;
        const err = new Error('thread thread-soft-fail already has an active writer');
        err.code = 'CODEX_THREAD_ACTIVE_WRITER';
        throw err;
      },
    },
  };

  try {
    // Re-require lifecycle against the mocked agentRunner.
    delete require.cache[require.resolve('../../src/command/lifecycle')];
    delete require.cache[require.resolve('../../src/command/common')];
    const lifecycle = require('../../src/command/lifecycle');

    await lifecycle.warmupAfterReload(ws, session, {}, 'codex');

    assert.equal(warmupCalls, 3);
    assert.ok(stopCalls >= 3);
    assert.equal(frames.some(frame => frame.type === 'error'), false);
    const systemText = frames
      .filter(frame => frame.type === 'system' || frame.type === 'outbound_message')
      .map(frame => String(frame.text || frame.message || ''))
      .join('\n');
    assert.match(systemText, /预启动暂未完成|写入权忙|发送消息时会再次尝试/);
  } finally {
    if (original) require.cache[agentRunnerPath] = original;
    else delete require.cache[agentRunnerPath];
    delete require.cache[require.resolve('../../src/command/lifecycle')];
    delete require.cache[require.resolve('../../src/command/common')];
  }
});
