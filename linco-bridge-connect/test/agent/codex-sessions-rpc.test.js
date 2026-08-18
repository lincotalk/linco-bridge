'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildHistoryPageInfo,
  buildThreadListParams,
  decodeHistoryCursor,
  encodeHistoryCursor,
  encodeThreadReadCursor,
  mapThreadListItem,
  mapTurnsToRounds,
  paginateRounds,
} = require('../../src/agent/codex/sessions');

test('mapThreadListItem prefers name then preview', () => {
  assert.deepEqual(
    mapThreadListItem({
      id: 'thr_1',
      name: 'Named',
      preview: 'Preview',
      recencyAt: 1700000000,
      status: { type: 'active' },
      cwd: 'D:/demo',
    }, 'D:/fallback'),
    {
      id: 'thr_1',
      title: 'Named',
      firstMessage: 'Preview',
      updatedAt: 1700000000000,
      workspace: 'D:/demo',
      running: true,
      source: 'codex-app-server',
    },
  );
});

test('mapTurnsToRounds maps user/agent items and optional thinking', () => {
  const rounds = mapTurnsToRounds([
    {
      id: 'turn_1',
      items: [
        { type: 'userMessage', text: 'hello', timestamp: 100 },
        { type: 'reasoning', text: 'think', timestamp: 110 },
        { type: 'agentMessage', phase: 'final_answer', text: 'world', timestamp: 120 },
      ],
    },
    {
      id: 'turn_2',
      items: [
        { type: 'user_message', message: 'again' },
        { type: 'agentMessage', phase: 'progress', text: 'draft' },
        { type: 'agentMessage', phase: 'final_answer', text: 'done' },
      ],
    },
  ], { includeThinking: true });

  assert.equal(rounds.length, 2);
  assert.equal(rounds[0].user, 'hello');
  assert.equal(rounds[0].assistant, 'world');
  assert.equal(rounds[0].thinkingItems.length, 1);
  assert.equal(rounds[1].user, 'again');
  assert.equal(rounds[1].assistant, 'done');
  assert.equal(rounds[1].thinkingItems.some(item => item.mode === 'progress' && item.text === 'draft'), true);
});

test('mapTurnsToRounds reuses local parsers for files-mentioned filter and assistant file links', () => {
  const tempDir = require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'linco-rpc-history-'));
  const imagePath = require('node:path').join(tempDir, 'shot.png');
  require('node:fs').writeFileSync(imagePath, Buffer.from('img'));
  const userMessage = [
    '# Files mentioned by the user:',
    '',
    `## shot.png: ${imagePath}`,
    '',
    '## My request for Codex:',
    '请继续处理这些素材',
  ].join('\n');
  const assistantMessage = `完成了，见 [shot.png](${imagePath})`;

  try {
    const rounds = mapTurnsToRounds([
      {
        id: 'turn_files',
        items: [
          { type: 'userMessage', text: userMessage },
          { type: 'agentMessage', phase: 'final_answer', text: assistantMessage },
        ],
      },
    ]);
    assert.equal(rounds.length, 1);
    assert.equal(rounds[0].user, '请继续处理这些素材');
    assert.doesNotMatch(rounds[0].user, /Files mentioned by the user/u);
    assert.equal(rounds[0].userFiles.length, 1);
    assert.equal(rounds[0].userFiles[0].name, 'shot.png');
    assert.equal(rounds[0].assistantFiles.length, 1);
    assert.equal(rounds[0].assistantFiles[0].path, imagePath);
  } finally {
    require('node:fs').rmSync(tempDir, { recursive: true, force: true });
  }
});

test('buildThreadListParams includes app-server sources and cwd filters', () => {
  const params = buildThreadListParams('D:/project/demo', { limit: 10 });
  assert.equal(params.limit, 10);
  assert.equal(params.sortKey, 'recency_at');
  assert.equal(params.useStateDbOnly, true);
  assert.deepEqual(params.sourceKinds, ['cli', 'vscode', 'appServer', 'exec']);
  assert.ok(params.cwd);
});

test('history cursor is gateway-safe base64url without dots', () => {
  const encoded = encodeHistoryCursor('thr_1', 'opaque-next');
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.doesNotMatch(encoded, /\./);
  assert.deepEqual(decodeHistoryCursor(encoded, 'thr_1'), {
    kind: 'rpc',
    sessionId: 'thr_1',
    cursor: 'opaque-next',
  });
  assert.throws(() => decodeHistoryCursor(encoded, 'thr_2'), /invalid|mismatch/i);
  assert.throws(() => decodeHistoryCursor('not-a-cursor', 'thr_1'), /invalid/i);
});

test('buildHistoryPageInfo never returns hasMore without a cursor', () => {
  assert.deepEqual(
    buildHistoryPageInfo({ hasMore: true, nextCursor: null, snapshotId: 'thr_1' }),
    { hasMore: false, nextCursor: null, snapshotId: 'thr_1' },
  );
  const cursor = encodeHistoryCursor('thr_1', 'next');
  assert.deepEqual(
    buildHistoryPageInfo({ hasMore: true, nextCursor: cursor, snapshotId: 'thr_1' }),
    { hasMore: true, nextCursor: cursor, snapshotId: 'thr_1' },
  );
});

test('paginateRounds builds a valid older-page cursor from thread/read turns', () => {
  const allRounds = [
    { turnId: 't1', user: 'a', assistant: '1' },
    { turnId: 't2', user: 'b', assistant: '2' },
    { turnId: 't3', user: 'c', assistant: '3' },
  ];
  const latest = paginateRounds(allRounds, { sessionId: 'thr_1', limit: 2 });
  assert.deepEqual(latest.rounds.map(item => item.turnId), ['t2', 't3']);
  assert.equal(latest.pageInfo.hasMore, true);
  assert.match(latest.pageInfo.nextCursor, /^[A-Za-z0-9_-]+$/);

  const older = paginateRounds(allRounds, {
    sessionId: 'thr_1',
    limit: 2,
    decoded: decodeHistoryCursor(latest.pageInfo.nextCursor, 'thr_1'),
  });
  assert.deepEqual(older.rounds.map(item => item.turnId), ['t1']);
  assert.equal(older.pageInfo.hasMore, false);
  assert.equal(older.pageInfo.nextCursor, null);
  assert.equal(decodeHistoryCursor(encodeThreadReadCursor('thr_1', 't2'), 'thr_1').kind, 'read');
});
