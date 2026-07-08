const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildHistoryPayload } = require('../../src/command/history/payloads');
const { extractClaudeContentFiles, extractCodexMentionedUserFiles, parseCodexHistoryRounds } = require('../../src/command/history/readers');

test('buildHistoryPayload includes user and assistant files', () => {
  const payload = buildHistoryPayload('claude', 'sess-1', 10, [{
    user: 'see image',
    userFiles: [{ name: 'photo.png', mimeType: 'image/png', base64: 'abc' }],
    assistant: 'done',
    assistantFiles: [{ name: 'out.png', mimeType: 'image/png', base64: 'def' }],
  }]);

  assert.equal(payload.rounds[0].user.files[0].name, 'photo.png');
  assert.equal(payload.rounds[0].assistant.files[0].base64, 'def');
});

test('extractClaudeContentFiles reads image blocks', () => {
  const files = extractClaudeContentFiles([
    { type: 'text', text: 'hello' },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
  ]);

  assert.equal(files.length, 1);
  assert.equal(files[0].mimeType, 'image/png');
  assert.equal(files[0].base64, 'abc');
});

test('extractCodexMentionedUserFiles reads clipboard image paths when file exists', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-history-'));
  const imagePath = path.join(tempDir, 'demo.png');
  fs.writeFileSync(imagePath, Buffer.from('fake-image'));

  const files = extractCodexMentionedUserFiles([
    '# Files mentioned by the user:',
    '',
    `## demo.png: ${imagePath}`,
    '',
    '## My request for Codex:',
    'question',
  ].join('\n'));

  assert.equal(files.length, 1);
  assert.equal(files[0].name, 'demo.png');
  assert.equal(files[0].mimeType, 'image/png');
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('parseCodexHistoryRounds strips Linco Connect system note even when attached to user text', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-codex-history-'));
  const transcriptPath = path.join(tempDir, 'history.jsonl');
  const userMessage = [
    '今天广州天气System note: You are running inside Linco Connect, a bridge that connects you to Linco IM.',
    'Your normal text responses are automatically delivered to the user. Reply normally, and do not use a separate send mechanism for ordinary text replies.',
  ].join('\n');
  const records = [
    {
      type: 'event_msg',
      payload: {
        type: 'user_message',
        message: userMessage,
      },
    },
    {
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        phase: 'final_answer',
        message: '广州今天晴。',
      },
    },
  ];
  fs.writeFileSync(transcriptPath, records.map((record) => JSON.stringify(record)).join('\n'));

  const rounds = parseCodexHistoryRounds(transcriptPath);

  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].user, '今天广州天气');
  assert.equal(rounds[0].assistant, '广州今天晴。');
  fs.rmSync(tempDir, { recursive: true, force: true });
});
