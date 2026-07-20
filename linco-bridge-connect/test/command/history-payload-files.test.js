const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildHistoryPayload } = require('../../src/command/history/payloads');
const { parseHistoryArgs } = require('../../src/command/history/args');
const {
  extractClaudeContentFiles,
  extractCodexMentionedUserFiles,
  parseClaudeHistoryRounds,
  parseCodexHistoryRounds,
  parseRecentHistoryRounds,
} = require('../../src/command/history/readers');

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

test('history thinking flag is opt-in', () => {
  assert.deepEqual(parseHistoryArgs('10'), {
    ok: true,
    limit: 10,
    includeThinking: false,
  });
  assert.deepEqual(parseHistoryArgs('--thinking 10'), {
    ok: true,
    limit: 10,
    includeThinking: true,
  });
  assert.deepEqual(parseHistoryArgs('--with-thinking'), {
    ok: true,
    limit: 10,
    includeThinking: true,
  });
});

test('buildHistoryPayload only includes thinking when parser provides items', () => {
  const plain = buildHistoryPayload('codex', 'sess-1', 10, [{
    user: 'question',
    assistant: 'answer',
  }]);
  assert.equal(Object.prototype.hasOwnProperty.call(plain.rounds[0], 'thinking'), false);

  const withThinking = buildHistoryPayload('codex', 'sess-1', 10, [{
    user: 'question',
    assistant: 'answer',
    thinkingItems: [
      { mode: 'progress', text: 'checking files', timestamp: '2026-06-11T02:00:01.000Z' },
      { mode: 'summary', text: 'reasoning summary', timestamp: '2026-06-11T02:00:02.000Z' },
    ],
  }]);
  assert.equal(withThinking.rounds[0].thinking.text, 'checking files\n\nreasoning summary');
  assert.equal(withThinking.rounds[0].thinking.items[0].mode, 'progress');
});

test('buildHistoryPayload keeps stable identities across rolling windows', () => {
  const allRounds = Array.from({ length: 12 }, (_, index) => ({
    ordinal: index + 1,
    user: index >= 10 ? '继续' : `question ${index + 1}`,
    userTimestamp: new Date(Date.UTC(2026, 6, 13, 0, index)).toISOString(),
    assistant: index === 11 ? '完成' : '',
    assistantTimestamp:
      index === 11
        ? new Date(Date.UTC(2026, 6, 13, 0, index, 30)).toISOString()
        : null,
  }));

  const first = buildHistoryPayload(
    'codex',
    'desktop-session-1',
    10,
    allRounds.slice(0, 10),
  );
  const second = buildHistoryPayload(
    'codex',
    'desktop-session-1',
    10,
    allRounds.slice(2, 12),
  );

  assert.equal(second.version, 2);
  const firstByOrdinal = new Map(
    first.rounds.map((round) => [round.ordinal, round]),
  );
  for (const round of second.rounds.filter((item) => item.ordinal <= 10)) {
    assert.equal(round.roundId, firstByOrdinal.get(round.ordinal).roundId);
    assert.equal(
      round.user.messageId,
      firstByOrdinal.get(round.ordinal).user.messageId,
    );
  }
  assert.notEqual(second.rounds[8].roundId, second.rounds[9].roundId);
  assert.notEqual(
    second.rounds[8].user.messageId,
    second.rounds[9].user.messageId,
  );
  assert.match(second.rounds[9].assistant.messageId, /:assistant$/);
});

test('stable history identity does not depend on rolling-window ordinal when timestamp exists', () => {
  const base = {
    user: 'same prompt',
    userTimestamp: '2026-07-20T01:02:03.000Z',
    assistant: 'same answer',
  };
  const first = buildHistoryPayload('codex', 'desktop-session', 5, [
    { ...base, ordinal: 19 },
  ]);
  const second = buildHistoryPayload('codex', 'desktop-session', 5, [
    { ...base, ordinal: 1 },
  ]);

  assert.equal(first.rounds[0].roundId, second.rounds[0].roundId);
  assert.equal(
    first.rounds[0].user.messageId,
    second.rounds[0].user.messageId,
  );
});

test('parseRecentHistoryRounds scans only the suffix and preserves chronological order', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-recent-history-'));
  const transcriptPath = path.join(tempDir, 'history.jsonl');
  const records = [];
  for (let index = 1; index <= 8; index++) {
    records.push({
      type: 'event_msg',
      timestamp: `2026-07-20T00:0${index}:00.000Z`,
      payload: { type: 'user_message', message: `question ${index}` },
    });
    records.push({
      type: 'response_item',
      timestamp: `2026-07-20T00:0${index}:01.000Z`,
      payload: { type: 'context_snapshot', text: 'x'.repeat(420000) },
    });
    records.push({
      type: 'event_msg',
      timestamp: `2026-07-20T00:0${index}:02.000Z`,
      payload: {
        type: 'agent_message',
        phase: 'final_answer',
        message: `answer ${index}`,
      },
    });
  }
  fs.writeFileSync(
    transcriptPath,
    `${records.map((record) => JSON.stringify(record)).join('\n')}\n{incomplete`,
  );

  const result = await parseRecentHistoryRounds(transcriptPath, {
    agentType: 'codex',
    limit: 2,
    includeThinking: true,
  });

  assert.deepEqual(result.rounds.map((round) => round.user), [
    'question 7',
    'question 8',
  ]);
  assert.deepEqual(result.rounds.map((round) => round.assistant), [
    'answer 7',
    'answer 8',
  ]);
  assert.equal(result.syncMeta.strategy, 'reverse_tail');
  assert.equal(result.syncMeta.storageOrder, 'ascending');
  assert.ok(result.syncMeta.scannedBytes < result.syncMeta.sourceBytes);
  assert.equal(result.syncMeta.returnedRounds, 2);

  const cached = await parseRecentHistoryRounds(transcriptPath, {
    agentType: 'codex',
    limit: 2,
    includeThinking: true,
  });
  assert.equal(cached.syncMeta.strategy, 'memory_cache');
  assert.equal(cached.syncMeta.cacheHit, true);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('parseRecentHistoryRounds detects descending storage and normalizes output order', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-desc-history-'));
  const transcriptPath = path.join(tempDir, 'history.jsonl');
  const chronological = [];
  for (let index = 1; index <= 5; index++) {
    chronological.push({
      type: 'event_msg',
      timestamp: `2026-07-20T00:0${index}:00.000Z`,
      payload: { type: 'user_message', message: `question ${index}` },
    });
    chronological.push({
      type: 'response_item',
      timestamp: `2026-07-20T00:0${index}:01.000Z`,
      payload: { type: 'context_snapshot', text: 'x'.repeat(300000) },
    });
    chronological.push({
      type: 'event_msg',
      timestamp: `2026-07-20T00:0${index}:02.000Z`,
      payload: {
        type: 'agent_message',
        phase: 'final_answer',
        message: `answer ${index}`,
      },
    });
  }
  fs.writeFileSync(
    transcriptPath,
    chronological.reverse().map((record) => JSON.stringify(record)).join('\n'),
  );

  const result = await parseRecentHistoryRounds(transcriptPath, {
    agentType: 'codex',
    limit: 2,
  });

  assert.equal(result.syncMeta.storageOrder, 'descending');
  assert.equal(result.syncMeta.strategy, 'forward_head');
  assert.deepEqual(result.rounds.map((round) => round.user), [
    'question 4',
    'question 5',
  ]);
  assert.deepEqual(result.rounds.map((round) => round.assistant), [
    'answer 4',
    'answer 5',
  ]);
  fs.rmSync(tempDir, { recursive: true, force: true });
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

test('parseClaudeHistoryRounds includes thinking only when requested', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-claude-history-thinking-'));
  const transcriptPath = path.join(tempDir, 'history.jsonl');
  const records = [
    { type: 'user', timestamp: '2026-06-11T01:00:00.000Z', message: { role: 'user', content: [{ type: 'text', text: 'inspect this' }] } },
    { type: 'assistant', timestamp: '2026-06-11T01:00:01.000Z', message: { role: 'assistant', content: [{ type: 'thinking', thinking: 'I should inspect the file.' }] } },
    { type: 'assistant', timestamp: '2026-06-11T01:00:02.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'Looking at package.json.' }] } },
    { type: 'assistant', timestamp: '2026-06-11T01:00:03.000Z', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Read', input: { file: 'package.json' } }] } },
    { type: 'user', timestamp: '2026-06-11T01:00:04.000Z', message: { role: 'user', content: [{ type: 'tool_result', content: 'tool output hidden' }] }, toolUseResult: true },
    { type: 'assistant', timestamp: '2026-06-11T01:00:05.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'Final answer.' }] } },
  ];
  fs.writeFileSync(transcriptPath, records.map((record) => JSON.stringify(record)).join('\n'));

  const plain = parseClaudeHistoryRounds(transcriptPath);
  assert.equal(Object.prototype.hasOwnProperty.call(plain[0], 'thinkingItems'), false);
  assert.equal(plain[0].assistant, 'Final answer.');

  const withThinking = parseClaudeHistoryRounds(transcriptPath, { includeThinking: true });
  assert.deepEqual(withThinking[0].thinkingItems.map(item => item.text), [
    'I should inspect the file.',
    'Looking at package.json.',
  ]);
  assert.equal(withThinking[0].assistant, 'Final answer.');
  fs.rmSync(tempDir, { recursive: true, force: true });
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
        phase: 'commentary',
        message: '这条过程消息必须继续过滤。',
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

test('parseCodexHistoryRounds includes thinking only when requested', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-codex-history-thinking-'));
  const transcriptPath = path.join(tempDir, 'history.jsonl');
  const records = [
    {
      type: 'event_msg',
      timestamp: '2026-06-11T02:00:00.000Z',
      payload: { type: 'user_message', message: 'fix the bug' },
    },
    {
      type: 'event_msg',
      timestamp: '2026-06-11T02:00:01.000Z',
      payload: { type: 'agent_message', phase: 'commentary', message: 'Inspecting the failing test.' },
    },
    {
      type: 'event_msg',
      timestamp: '2026-06-11T02:00:02.000Z',
      payload: { type: 'reasoning', summary: 'The failure points to argument parsing.' },
    },
    {
      type: 'event_msg',
      timestamp: '2026-06-11T02:00:03.000Z',
      payload: { type: 'tool_result', output: 'hidden tool output' },
    },
    {
      type: 'event_msg',
      timestamp: '2026-06-11T02:00:04.000Z',
      payload: { type: 'agent_message', phase: 'final_answer', message: 'Fixed.' },
    },
  ];
  fs.writeFileSync(transcriptPath, records.map((record) => JSON.stringify(record)).join('\n'));

  const plain = parseCodexHistoryRounds(transcriptPath);
  assert.equal(Object.prototype.hasOwnProperty.call(plain[0], 'thinkingItems'), false);
  assert.equal(plain[0].assistant, 'Fixed.');

  const withThinking = parseCodexHistoryRounds(transcriptPath, { includeThinking: true });
  assert.deepEqual(withThinking[0].thinkingItems.map(item => item.text), [
    'Inspecting the failing test.',
    'The failure points to argument parsing.',
  ]);
  assert.equal(withThinking[0].assistant, 'Fixed.');
  fs.rmSync(tempDir, { recursive: true, force: true });
});
