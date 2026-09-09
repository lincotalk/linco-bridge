'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { parseRecentHistoryRounds } = require('../../src/command/history/readers');

function completed(type, text, index, phase) {
  return {
    type: 'event_msg',
    metadata: 'x'.repeat(40000),
    timestamp: new Date(1788900000000 + index * 1000).toISOString(),
    payload: {
      type: 'item_completed',
      turn_id: `turn-${Math.floor(index / 3)}`,
      item: { type, id: `item-${index}`, content: [{ type: 'text', text }], phase },
    },
  };
}

for (const descending of [false, true]) {
  test(`item_completed history supports ${descending ? 'descending' : 'ascending'} pagination`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-item-history-'));
    const file = path.join(dir, 'history.jsonl');
    const records = [];
    for (let i = 0; i < 5; i++) {
      records.push(completed('UserMessage', `question ${i}`, i * 3));
      records.push(completed('AgentMessage', `progress ${i}`, i * 3 + 1, 'commentary'));
      records.push(completed('AgentMessage', `answer ${i}`, i * 3 + 2, 'final_answer'));
    }
    if (descending) records.reverse();
    fs.writeFileSync(file, records.map(record => JSON.stringify(record)).join('\n') + '\n');
    try {
      const options = { agentType: 'codex', sessionId: 'session-1', limit: 3, includeThinking: true };
      const latest = parseRecentHistoryRounds(file, options);
      assert.deepEqual(latest.rounds.map(round => round.user), ['question 2', 'question 3', 'question 4']);
      assert.deepEqual(latest.rounds.map(round => round.assistant), ['answer 2', 'answer 3', 'answer 4']);
      assert.equal(latest.rounds[0].thinkingItems[0].text, 'progress 2');
      assert.equal(latest.pageInfo.hasMore, true);
      const older = parseRecentHistoryRounds(file, { ...options, beforeCursor: latest.pageInfo.nextCursor });
      assert.deepEqual(older.rounds.map(round => round.user), ['question 0', 'question 1']);
      assert.equal(older.pageInfo.hasMore, false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('mixed legacy and completed events ignore mirrored response items and context', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-mixed-history-'));
  const file = path.join(dir, 'history.jsonl');
  const records = [
    { type: 'response_item', payload: { type: 'message', role: 'user', content: 'hidden context' } },
    { type: 'event_msg', payload: { type: 'user_message', message: 'repeat question' } },
    { type: 'event_msg', payload: { type: 'agent_message', phase: 'final_answer', message: 'old answer' } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: 'repeat question' } },
    completed('UserMessage', 'repeat question', 3),
    completed('AgentMessage', 'new answer', 5, 'final_answer'),
    { type: 'response_item', payload: { type: 'message', role: 'assistant', phase: 'final_answer', content: 'new answer' } },
  ];
  fs.writeFileSync(file, records.map(record => JSON.stringify(record)).join('\n') + '\n');
  try {
    const result = parseRecentHistoryRounds(file, { agentType: 'codex', sessionId: 'mixed', limit: 3 });
    assert.deepEqual(result.rounds.map(round => [round.user, round.assistant]), [
      ['repeat question', 'old answer'],
      ['repeat question', 'new answer'],
    ]);
    assert.equal(result.rounds[1].thinkingItems, undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
