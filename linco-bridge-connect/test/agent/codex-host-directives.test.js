const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createCodexHostDirectiveStreamState,
  filterCodexHostDirectiveChunk,
  flushCodexHostDirectiveStream,
  sanitizeCodexHostDirectives,
} = require('../../src/agent/codex/hostDirectives');

test('removes standalone Codex host directives from final text', () => {
  const input = [
    '提交完成。',
    '',
    '::git-stage{cwd="/workspace"}',
    '::git-commit{cwd="/workspace"}',
    '::git-push{cwd="/workspace" branch="master"}',
  ].join('\n');

  assert.equal(sanitizeCodexHostDirectives(input), '提交完成。');
});

test('removes a host directive split across stream chunks without leaking separators', () => {
  const state = createCodexHostDirectiveStreamState();
  const output = [
    filterCodexHostDirectiveChunk(state, '提交并推送完成。\n\n::git-pu'),
    filterCodexHostDirectiveChunk(state, 'sh{cwd="/workspace" branch="master"}'),
    flushCodexHostDirectiveStream(state),
  ].join('');

  assert.equal(output, '提交并推送完成。');
});

test('preserves directive examples inside Markdown fences', () => {
  const input = [
    '示例：',
    '```text',
    '::git-push{cwd="/workspace" branch="master"}',
    '```',
  ].join('\n');

  assert.equal(sanitizeCodexHostDirectives(input), input);
});

test('preserves inline directive-like prose', () => {
  const input = '日志中出现 ::git-push{cwd="/workspace"} 时不要误删。';
  assert.equal(sanitizeCodexHostDirectives(input), input);
});
