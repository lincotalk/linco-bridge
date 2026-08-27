'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  STOP_DESKTOP_CONFIRM_MESSAGE,
  buildStopDesktopResultMessage,
  isDesktopCodexUiProcess,
  parseStopDesktopArg,
  stopDesktopCodex,
} = require('../../src/agent/codex/stopDesktop');

test('parseStopDesktopArg requires explicit confirm', () => {
  assert.deepEqual(parseStopDesktopArg(''), { kind: 'none' });
  assert.deepEqual(parseStopDesktopArg('desktop'), { kind: 'prompt' });
  assert.deepEqual(parseStopDesktopArg('desktop confirm'), { kind: 'confirm' });
  assert.deepEqual(parseStopDesktopArg('desktop Confirm'), { kind: 'confirm' });
  assert.deepEqual(parseStopDesktopArg('desktop now'), { kind: 'usage' });
});

test('confirm message warns that other running desktop tasks will stop', () => {
  assert.match(STOP_DESKTOP_CONFIRM_MESSAGE, /其他任务也会停止/);
  assert.match(STOP_DESKTOP_CONFIRM_MESSAGE, /\/stop desktop confirm/);
});

test('isDesktopCodexUiProcess recognizes ChatGPT desktop app', () => {
  assert.equal(
    isDesktopCodexUiProcess({
      name: 'ChatGPT.exe',
      commandLine: String.raw`C:\Program Files\WindowsApps\OpenAI.Codex_1.0.0\app\ChatGPT.exe`,
    }),
    true,
  );
  assert.equal(
    isDesktopCodexUiProcess({
      name: 'node.exe',
      commandLine: 'node server.js',
    }),
    false,
  );
});

test('stopDesktopCodex is skipped under node --test', () => {
  const result = stopDesktopCodex({ threadId: 'thread-1' });
  assert.equal(result.skipped, 'node_test');
  assert.deepEqual(result.killed, []);
  assert.match(buildStopDesktopResultMessage(result), /测试环境/);
});

test('buildStopDesktopResultMessage reports killed process count', () => {
  assert.match(
    buildStopDesktopResultMessage({ killed: [1, 2], skipped: null }),
    /结束 2 个进程/,
  );
  assert.match(
    buildStopDesktopResultMessage({ killed: [], skipped: null }),
    /未检测到/,
  );
});
