const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const os = require('os');
const path = require('path');

function loadCodexInternals() {
  const filename = path.resolve(__dirname, '../../src/agent/codex/index.js');
  const source = fs.readFileSync(filename, 'utf8');
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(`${source}\nmodule.exports._test = { handleAppServerMessage, buildCodexInput, buildCodexDeliveryInput, stringifyInput, summarizeCodexItemForLog, resolveCodexSpawnTarget, buildCodexThreadSandbox, buildCodexThreadStartParams, buildCodexThreadResumeParams, buildExecArgs, buildCodexAppServerEnv };\n`, filename);
  return mod.exports._test;
}

function createSession() {
  const sent = [];
  const ws = {
    send(raw) {
      sent.push(JSON.parse(raw));
    },
  };
  const session = {
    id: 'session-1',
    isTurnActive: true,
    currentInputForNoOutput: 'hello',
    messageQueue: [],
    sawPartialAssistantText: false,
    codexAssistantEnded: false,
    codexEmittedAgentMessageIds: new Set(),
    _lastWs: ws,
    _lastConfig: {},
    _log: { info() {} },
  };
  return { session, sent };
}

function createRemoteSession() {
  const result = createSession();
  result.session.linco = {
    messageId: 'm-1',
    streamId: 'stream-1',
  };
  result.session._lastWs.linco = result.session.linco;
  result.session.agentSessionId = 'thread-1';
  return result;
}

function withCapturedTimers(fn) {
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
    fn(timers);
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  }
}

const { handleAppServerMessage, buildCodexInput, buildCodexDeliveryInput, stringifyInput, summarizeCodexItemForLog, resolveCodexSpawnTarget, buildCodexThreadSandbox, buildCodexThreadStartParams, buildCodexThreadResumeParams, buildExecArgs, buildCodexAppServerEnv } = loadCodexInternals();

{
  const input = [
    { type: 'text', text: 'hello from IM' },
    {
      type: 'meta',
      agentId: 'remote-agent',
      _lincoMeta: {
        accountId: 'default',
        messageId: 'm-1',
        agentId: 'remote-agent',
      },
    },
  ];

  assert.deepStrictEqual(buildCodexInput(input, process.cwd()), [
    { type: 'text', text: 'hello from IM' },
  ]);
  assert.strictEqual(stringifyInput(input), 'hello from IM');
}

{
  const previous = process.env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE;
  delete process.env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE;
  try {
    assert.strictEqual(buildCodexAppServerEnv().CODEX_INTERNAL_ORIGINATOR_OVERRIDE, 'Codex Desktop');
  } finally {
    if (previous == null) delete process.env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE;
    else process.env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE = previous;
  }
}

{
  const session = {
    workspace: 'C:\\work',
    runtimeDir: 'C:\\runtime',
    attachmentsDir: 'C:\\runtime\\attachments',
  };
  const imageInput = buildCodexDeliveryInput('生成一张小蜜蜂的图片发给我', session);
  assert.match(imageInput, /built-in image generation tool/);
  assert.match(imageInput, /If you can only deliver the image as a saved file/);
  assert.doesNotMatch(imageInput, /The user is asking to send or deliver a file\/image/);
  assert.doesNotMatch(imageInput, /\/get/);

  const codeInput = buildCodexDeliveryInput('帮我改代码，让页面可以生成图片', session);
  assert.doesNotMatch(codeInput, /built-in image generation tool/);
  assert.doesNotMatch(codeInput, /The user is asking to send or deliver a file\/image/);
  assert.match(codeInput, /You are running inside Linco Connect/);

  const appServerCodeInput = buildCodexDeliveryInput('implement an image generator', session, {
    includeBridgeContextHint: false,
  });
  assert.doesNotMatch(appServerCodeInput, /You are running inside Linco Connect/);

  const fileInput = buildCodexDeliveryInput('生成一个 report.md 文件发给我', session);
  assert.match(fileInput, /The user is asking to send or deliver a file\/image/);
  assert.match(fileInput, /You are running inside Linco Connect/);
  assert.match(fileInput, /\[filename\.ext\]\(absolute-local-path\)/);
  assert.doesNotMatch(fileInput, /\/get/);
}

{
  assert.deepStrictEqual(summarizeCodexItemForLog({
    type: 'userMessage',
    id: 'u-1',
    content: [{ type: 'input_text', text: '你好' }],
  }), {
    type: 'userMessage',
    id: 'u-1',
    content: '你好',
  });
}

{
  const sandbox = buildCodexThreadSandbox({
    workspace: process.cwd(),
    _lastConfig: {},
  });
  assert.strictEqual(sandbox.config.sandbox_workspace_write.network_access, true);
}

{
  const sandbox = buildCodexThreadSandbox({
    workspace: process.cwd(),
    _lastConfig: {
      agents: {
        codex: {
          networkAccess: false,
        },
      },
    },
  });
  assert.strictEqual(sandbox.config.sandbox_workspace_write.network_access, false);
}

{
  const session = {
    workspace: process.cwd(),
    approveMode: 'yolo',
    _lastConfig: {},
  };
  const sandbox = buildCodexThreadSandbox(session);
  assert.strictEqual(sandbox.sandbox, 'danger-full-access');
  assert.strictEqual(sandbox.config.sandbox_mode, 'danger-full-access');
  const params = buildCodexThreadStartParams(session, {});
  assert.strictEqual(params.approvalPolicy, 'never');

  const developerParams = buildCodexThreadStartParams(session, {}, 'Bridge developer instructions.');
  assert.strictEqual(developerParams.developerInstructions, 'Bridge developer instructions.');

  session.agentSessionId = 'thread-1';
  const resumeParams = buildCodexThreadResumeParams(session, 'Bridge developer instructions.');
  assert.strictEqual(resumeParams.threadId, 'thread-1');
  assert.strictEqual(resumeParams.developerInstructions, 'Bridge developer instructions.');
}

{
  assert(!buildExecArgs({ workspace: process.cwd(), autoApprove: true, approveMode: 'auto' }, {}).includes('--dangerously-bypass-approvals-and-sandbox'));
  assert(buildExecArgs({ workspace: process.cwd(), approveMode: 'yolo' }, {}).includes('--dangerously-bypass-approvals-and-sandbox'));
}

withCapturedTimers((timers) => {
  const { session } = createSession();
  handleAppServerMessage({
    method: 'item/completed',
    params: {
      item: {
        type: 'userMessage',
        id: 'user-1',
        content: [{ type: 'input_text', text: 'write a long essay' }],
      },
    },
  }, session);

  assert.strictEqual(timers.length, 0);
  assert.strictEqual(session.turnCompletedTimerId, undefined);
});

withCapturedTimers((timers) => {
  const { session, sent } = createSession();
  handleAppServerMessage({
    method: 'item/completed',
    params: {
      item: {
        type: 'agentMessage',
        id: 'agent-1',
        text: 'final answer with enough text to flush immediately',
        phase: 'final_answer',
      },
    },
  }, session);

  const fallbackTimers = timers.filter(timer => timer.delay === 1000);
  assert.strictEqual(fallbackTimers.length, 1);
  assert.strictEqual(session.turnCompletedTimerId, fallbackTimers[0]);
  assert(sent.some(message => message.type === 'assistant_chunk' && message.text === 'final answer with enough text to flush immediately'));
});

withCapturedTimers((timers) => {
  const { session, sent } = createSession();
  handleAppServerMessage({
    method: 'item/completed',
    params: {
      item: {
        type: 'reasoning',
        id: 'reasoning-1',
        summary: 'Checked the files and found the matching adapter.',
      },
    },
  }, session);

  assert.strictEqual(timers.length, 0);
  assert.deepStrictEqual(sent, [
    {
      type: 'thinking',
      text: 'Checked the files and found the matching adapter.',
      mode: 'summary',
    },
  ]);
});

withCapturedTimers((timers) => {
  const { session, sent } = createSession();
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-image-workspace-'));
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-image-source-'));
  const sourcePath = path.join(sourceDir, 'generated deer.png');
  const imageBase64 = Buffer.from('fake image').toString('base64');
  fs.writeFileSync(sourcePath, Buffer.from('fake image'));
  session.workspace = workspace;
  handleAppServerMessage({
    method: 'item/completed',
    params: {
      item: {
        type: 'imageGeneration',
        id: 'image-1',
        status: 'completed',
        result: imageBase64,
        savedPath: sourcePath,
      },
    },
  }, session);

  assert.strictEqual(timers.length, 0);
  const imageMessage = sent.find(message => message.type === 'outbound_message');
  assert(imageMessage);
  assert.strictEqual(imageMessage.mediaName, 'generated deer.png');
  assert.strictEqual(imageMessage.mediaType, 'image/png');
  assert.strictEqual(imageMessage.mediaBase64, imageBase64);
  assert.strictEqual(imageMessage.size, Buffer.from('fake image').length);
  assert.strictEqual(imageMessage.text, '图片已生成');
  assert.strictEqual(imageMessage.references, undefined);
  assert.strictEqual(fs.readFileSync(path.join(workspace, 'generated deer.png'), 'utf8'), 'fake image');
});

withCapturedTimers((timers) => {
  const { session, sent } = createRemoteSession();
  handleAppServerMessage({
    method: 'item/completed',
    params: {
      item: {
        type: 'reasoning',
        id: 'reasoning-remote-1',
        summary: 'Checked the files and found the matching adapter.',
      },
    },
  }, session);

  assert.strictEqual(timers.length, 0);
  assert.deepStrictEqual(sent, [
    {
      type: 'thinking',
      text: 'Checked the files and found the matching adapter.',
      mode: 'summary',
    },
  ]);
});

withCapturedTimers((timers) => {
  const { session, sent } = createSession();
  handleAppServerMessage({
    method: 'item/completed',
    params: {
      item: {
        type: 'agentMessage',
        id: 'agent-progress-1',
        text: 'I will search for a suitable kitten image first.',
        phase: 'planning',
      },
    },
  }, session);

  assert.strictEqual(timers.length, 0);
  assert.deepStrictEqual(sent, [
    {
      type: 'assistant_start',
    },
    {
      type: 'assistant_chunk',
      text: 'I will search for a suitable kitten image first.',
    },
    {
      type: 'thinking',
      text: 'I will search for a suitable kitten image first.',
      mode: 'progress',
    },
  ]);
});

withCapturedTimers((timers) => {
  const { session, sent } = createRemoteSession();
  handleAppServerMessage({
    method: 'item/completed',
    params: {
      item: {
        type: 'agentMessage',
        id: 'agent-progress-remote-1',
        text: 'I will search for a suitable kitten image first.',
        phase: 'planning',
      },
    },
  }, session);

  assert.strictEqual(timers.length, 0);
  assert.deepStrictEqual(sent, [
    {
      type: 'assistant_start',
    },
    {
      type: 'assistant_chunk',
      text: 'I will search for a suitable kitten image first.',
    },
    {
      type: 'thinking',
      text: 'I will search for a suitable kitten image first.',
      mode: 'progress',
    },
  ]);
});

withCapturedTimers((timers) => {
  const { session, sent } = createRemoteSession();
  session.codexCompaction = {
    id: 'cmp-active',
    startedAt: Date.now(),
    completed: false,
  };
  handleAppServerMessage({
    method: 'item/completed',
    params: {
      item: {
        type: 'reasoning',
        id: 'reasoning-during-compact',
        summary: 'Large reasoning emitted during compaction.',
      },
    },
  }, session);
  handleAppServerMessage({
    method: 'item/completed',
    params: {
      item: {
        type: 'agentMessage',
        id: 'agent-progress-during-compact',
        text: 'Large progress emitted during compaction.',
        phase: 'planning',
      },
    },
  }, session);

  assert.strictEqual(timers.length, 0);
  assert.deepStrictEqual(sent, []);
});

withCapturedTimers((timers) => {
  const originalNow = Date.now;
  let now = 1780400868266;
  Date.now = () => now;
  try {
    const { session, sent } = createRemoteSession();
    session._lastConfig = {
      agents: {
        codex: {
          compactionTimeoutMs: 300000,
        },
      },
    };
    handleAppServerMessage({
      method: 'item/started',
      params: {
        item: {
          type: 'contextCompaction',
          id: 'cmp-1',
        },
      },
    }, session);

    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].type, 'context_compaction');
    assert.strictEqual(sent[0].phase, 'started');
    assert.strictEqual(sent[0].compactionId, 'cmp-1');
    assert.strictEqual(sent[0].agentSessionId, 'thread-1');
    assert.strictEqual(sent[0].requestId, 'm-1');
    assert.strictEqual(sent[0].streamId, 'stream-1');
    assert.strictEqual(sent[0].text, '正在整理上下文...');
    assert.strictEqual(timers.some(timer => timer.delay === 90000), true);
    assert.strictEqual(timers.some(timer => timer.delay === 300000), true);

    now = 1780400928878;
    handleAppServerMessage({
      method: 'item/completed',
      params: {
        item: {
          type: 'contextCompaction',
          id: 'cmp-1',
        },
      },
    }, session);

    assert.strictEqual(sent.length, 2);
    assert.strictEqual(sent[1].phase, 'completed');
    assert.strictEqual(sent[1].durationMs, 60612);
    assert.strictEqual(sent[1].text, '上下文整理完成，继续处理当前问题。');
    assert.strictEqual(session.codexCompaction, null);
  } finally {
    Date.now = originalNow;
  }
});

withCapturedTimers((timers) => {
  const originalNow = Date.now;
  let now = 1780400868266;
  Date.now = () => now;
  try {
    const { session, sent } = createRemoteSession();
    session._lastConfig = {
      agents: {
        codex: {
          compactionTimeoutMs: 300000,
        },
      },
    };
    handleAppServerMessage({
      method: 'item/started',
      params: {
        item: {
          type: 'contextCompaction',
          id: 'cmp-timeout',
        },
      },
    }, session);

    const staleTimer = timers.find(timer => timer.delay === 90000);
    const timeoutTimer = timers.find(timer => timer.delay === 300000);
    assert(staleTimer);
    assert(timeoutTimer);

    now = 1780400958266;
    staleTimer.callback();
    assert.strictEqual(sent[1].phase, 'stale');
    assert.strictEqual(sent[1].durationMs, 90000);

    now = 1780401168266;
    timeoutTimer.callback();
    assert.strictEqual(sent[2].phase, 'failed');
    assert.strictEqual(sent[2].durationMs, 300000);
    assert.strictEqual(sent[2].error.code, 'timeout');
    assert.strictEqual(session.codexCompaction, null);
  } finally {
    Date.now = originalNow;
  }
});

{
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  const tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'linco-codex path-'));
  const nodeDir = path.join(tempDir, 'Program Files', 'nodejs');
  const packageBinDir = path.join(nodeDir, 'node_modules', '@openai', 'codex', 'bin');
  const codexCmd = path.join(nodeDir, 'codex.cmd');
  const codexJs = path.join(packageBinDir, 'codex.js');
  fs.mkdirSync(packageBinDir, { recursive: true });
  fs.writeFileSync(codexCmd, '@ECHO off\r\n"%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n');
  fs.writeFileSync(codexJs, 'console.log("codex");\n');

  try {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const target = resolveCodexSpawnTarget(codexCmd);
    assert.strictEqual(target.command, process.execPath);
    assert.deepStrictEqual(target.argsPrefix, [codexJs]);
    assert.strictEqual(target.shell, false);
  } finally {
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

{
  const { session, sent } = createSession();
  session.codexUseProgressiveAnswer = true;
  handleAppServerMessage({
    method: 'item/agentMessage/delta',
    params: {
      item: {
        type: 'agentMessage',
        id: 'agent-step-1',
      },
      delta: 'I will inspect the file first.',
    },
  }, session);
  handleAppServerMessage({
    method: 'item/started',
    params: {
      item: {
        type: 'commandExecution',
        id: 'call_1',
        command: 'sed -n 1,20p file',
      },
    },
  }, session);
  handleAppServerMessage({
    method: 'item/agentMessage/delta',
    params: {
      item: {
        type: 'agentMessage',
        id: 'agent-step-2',
      },
      delta: 'I found the target and will search references.',
    },
  }, session);
  handleAppServerMessage({
    method: 'item/started',
    params: {
      item: {
        type: 'webSearch',
        id: 'call_2',
        query: 'target reference',
      },
    },
  }, session);
  handleAppServerMessage({
    method: 'item/agentMessage/delta',
    params: {
      item: {
        type: 'agentMessage',
        id: 'agent-final',
      },
      delta: 'Final answer.',
    },
  }, session);
  handleAppServerMessage({
    method: 'turn/completed',
    params: {},
  }, session);

  assert.deepStrictEqual(sent.map(message => message.type), [
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
  assert.strictEqual(sent[1].text, 'I will inspect the file first.');
  assert.strictEqual(sent[2].text, 'I will inspect the file first.');
  assert.strictEqual(sent[4].text, '\n\nI found the target and will search references.');
  assert.strictEqual(sent[5].text, 'I found the target and will search references.');
  assert.strictEqual(sent[7].text, '\n\nFinal answer.');
}

{
  const { session, sent } = createRemoteSession();
  session.codexUseProgressiveAnswer = true;
  handleAppServerMessage({
    method: 'item/agentMessage/delta',
    params: {
      item: {
        type: 'agentMessage',
        id: 'agent-step-remote-1',
        phase: 'commentary',
      },
      delta: 'I will inspect the file first.',
    },
  }, session);
  handleAppServerMessage({
    method: 'item/started',
    params: {
      item: {
        type: 'commandExecution',
        id: 'call_1',
        command: 'sed -n 1,20p file',
      },
    },
  }, session);
  handleAppServerMessage({
    method: 'item/completed',
    params: {
      item: {
        type: 'agentMessage',
        id: 'agent-final-remote',
        text: 'Final answer with enough text to flush immediately after progress is suppressed.',
        phase: 'final_answer',
      },
    },
  }, session);

  assert.deepStrictEqual(sent.map(message => message.type), [
    'assistant_start',
    'assistant_chunk',
    'thinking',
    'tool_call',
    'assistant_chunk',
  ]);
  assert.strictEqual(sent[1].text, 'I will inspect the file first.');
  assert.strictEqual(sent[2].text, 'I will inspect the file first.');
  assert(sent[4].text.endsWith('Final answer with enough text to flush immediately after progress is suppressed.'));
}

{
  const { session, sent } = createRemoteSession();
  handleAppServerMessage({
    method: 'item/agentMessage/delta',
    params: {
      item: {
        type: 'agentMessage',
        id: 'agent-step-remote-without-phase',
      },
      delta: 'I will inspect the file first.',
    },
  }, session);
  handleAppServerMessage({
    method: 'item/completed',
    params: {
      item: {
        type: 'agentMessage',
        id: 'agent-final-remote-without-phase',
        text: 'Final answer with enough text to flush immediately after no-phase progress is suppressed.',
        phase: 'final_answer',
      },
    },
  }, session);

  assert.deepStrictEqual(sent.map(message => message.type), [
    'assistant_start',
    'assistant_chunk',
    'thinking',
    'assistant_chunk',
  ]);
  assert.strictEqual(sent[1].text, 'I will inspect the file first.');
  assert.strictEqual(sent[2].text, 'I will inspect the file first.');
  assert(sent[3].text.endsWith('Final answer with enough text to flush immediately after no-phase progress is suppressed.'));
}

{
  const { session, sent } = createSession();
  const commandItem = {
    type: 'commandExecution',
    id: 'call_1',
    command: '/bin/zsh -lc "sed -n 1,20p file"',
    output: 'printed lines',
  };

  handleAppServerMessage({
    method: 'item/completed',
    params: { item: commandItem },
  }, session);
  handleAppServerMessage({
    method: 'item/started',
    params: { item: commandItem },
  }, session);

  assert.deepStrictEqual(sent, [
    {
      type: 'tool_call',
      id: 'call_1',
      name: 'exec',
      input: '/bin/zsh -lc "sed -n 1,20p file"',
    },
    {
      type: 'tool_result',
      id: 'call_1',
      output: 'printed lines',
    },
  ]);
}

{
  const { session, sent } = createSession();
  handleAppServerMessage({
    method: 'tool/completed',
    params: {
      id: 'call_pwd',
      stdout: '/Users/admin/Desktop/work/git/ai-project/aichat\n',
    },
  }, session);

  assert.deepStrictEqual(sent, [
    {
      type: 'tool_call',
      id: 'call_pwd',
      name: 'tool',
      input: '',
    },
    {
      type: 'tool_result',
      id: 'call_pwd',
      output: '/Users/admin/Desktop/work/git/ai-project/aichat\n',
    },
  ]);
}

console.log('codex turn completion fallback ok');
