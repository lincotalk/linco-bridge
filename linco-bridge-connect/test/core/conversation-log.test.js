const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sendTurnEnd } = require('../../src/core/protocol');
const { createLogger } = require('../../src/core/logger');
const {
  captureAssistantReplyText,
  logUserInput,
  startAssistantReplyLog,
  textPreview,
} = require('../../src/core/conversationLog');

function createCaptureLogger() {
  const entries = [];
  return {
    entries,
    info(msg, fields) {
      entries.push({ level: 'info', msg, fields });
    },
  };
}

function todayStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

{
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-conversation-log-'));
  const logger = createLogger({ logsDir: tempDir });
  const originalLog = console.log;

  try {
    console.log = () => {};
    logger.info('conversation user input', { direction: 'input', preview: 'hello' });
  } finally {
    console.log = originalLog;
  }

  const logFile = path.join(tempDir, `linco-${todayStamp()}.log`);
  assert(fs.existsSync(logFile));
  const lines = fs.readFileSync(logFile, 'utf8').trim().split(/\r?\n/);
  assert.strictEqual(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.strictEqual(entry.msg, 'conversation user input');
  assert.strictEqual(entry.direction, 'input');
  assert.strictEqual(entry.preview, 'hello');
}

{
  const result = textPreview('hello\n  world '.repeat(10));

  assert.strictEqual(result.preview.length, 80);
  assert.strictEqual(result.truncated, true);
  assert(!result.preview.includes('\n'));
}

{
  const logger = createCaptureLogger();
  const session = { id: 'session-1', agentType: 'claude' };

  logUserInput({ logger }, session, {
    source: 'websocket',
    text: '请帮我分析一下这个问题，并给出三个可执行步骤'.repeat(5),
    attachments: 2,
  });

  assert.strictEqual(logger.entries.length, 1);
  assert.strictEqual(logger.entries[0].msg, 'conversation user input');
  assert.strictEqual(logger.entries[0].fields.direction, 'input');
  assert.strictEqual(logger.entries[0].fields.sessionId, 'session-1');
  assert.strictEqual(logger.entries[0].fields.agentType, 'claude');
  assert.strictEqual(logger.entries[0].fields.source, 'websocket');
  assert.strictEqual(logger.entries[0].fields.attachments, 2);
  assert(logger.entries[0].fields.preview.length <= 80);
  assert.strictEqual(logger.entries[0].fields.truncated, true);
}

{
  const logger = createCaptureLogger();
  const sent = [];
  const ws = {
    send(raw) {
      sent.push(JSON.parse(raw));
    },
  };
  const session = {
    id: 'session-1',
    agentType: 'codex',
  };

  startAssistantReplyLog(session, { logger }, { agentType: 'codex' });
  captureAssistantReplyText(session, '这是第一段回复。');
  captureAssistantReplyText(session, '这是第二段回复，用来模拟流式输出，并且超过预览长度。'.repeat(5));

  assert.strictEqual(sendTurnEnd(ws, session, 'completed', { requestId: 'm-1', streamId: 's-1' }), true);

  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].type, 'turn_end');
  assert.strictEqual(logger.entries.length, 1);
  assert.strictEqual(logger.entries[0].msg, 'conversation assistant reply');
  assert.strictEqual(logger.entries[0].fields.direction, 'output');
  assert.strictEqual(logger.entries[0].fields.sessionId, 'session-1');
  assert.strictEqual(logger.entries[0].fields.agentType, 'codex');
  assert.strictEqual(logger.entries[0].fields.reason, 'completed');
  assert.strictEqual(logger.entries[0].fields.requestId, 'm-1');
  assert.strictEqual(logger.entries[0].fields.streamId, 's-1');
  assert(logger.entries[0].fields.chars > 80);
  assert(logger.entries[0].fields.preview.length <= 80);
  assert.strictEqual(logger.entries[0].fields.truncated, true);
}
