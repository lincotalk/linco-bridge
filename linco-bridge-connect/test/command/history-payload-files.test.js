const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildHistoryPayload } = require('../../src/command/history/payloads');
const { extractClaudeContentFiles, extractCodexMentionedUserFiles } = require('../../src/command/history/readers');

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
