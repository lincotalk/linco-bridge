'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  classifyCodexAppServerProcess,
  isCodexAppServerCommandLine,
  isDesktopCodexAppServerCommandLine,
  reclaimOrphanCodexWriters,
  resolveThreadWriterLockPath,
  tryRemoveThreadWriterLock,
} = require('../../src/agent/codex/threadWriterLock');

test('isCodexAppServerCommandLine recognizes desktop and cli app-server commands', () => {
  assert.equal(
    isCodexAppServerCommandLine(
      String.raw`C:\Users\x\AppData\Local\OpenAI\Codex\bin\codex.exe app-server --listen stdio://`,
    ),
    true,
  );
  assert.equal(isCodexAppServerCommandLine('codex app-server'), true);
  assert.equal(isCodexAppServerCommandLine('node server.js'), false);
  assert.equal(isCodexAppServerCommandLine('codex exec'), false);
});

test('desktop classifier never treats OpenAI Codex install path as orphan', () => {
  const desktopCmd = String.raw`C:\Users\x\AppData\Local\OpenAI\Codex\bin\d0097be4\codex.exe -c features.code_mode_host=true app-server`;
  assert.equal(isDesktopCodexAppServerCommandLine(desktopCmd), true);
  assert.equal(classifyCodexAppServerProcess({ commandLine: desktopCmd }), 'desktop');

  const orphanCmd = String.raw`C:\Users\x\AppData\Roaming\npm\codex.cmd app-server --listen stdio://`;
  assert.equal(isDesktopCodexAppServerCommandLine(orphanCmd), false);
  assert.equal(classifyCodexAppServerProcess({ commandLine: orphanCmd }), 'orphan');
});

test('resolveThreadWriterLockPath points under ~/.codex/thread-writer-locks', () => {
  const lockPath = resolveThreadWriterLockPath('thread-123', 'D:\\home\\user');
  assert.equal(
    lockPath,
    path.join('D:\\home\\user', '.codex', 'thread-writer-locks', 'thread-123.lock'),
  );
});

test('reclaimOrphanCodexWriters is skipped under node --test and can remove stale lock files', () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-codex-lock-'));
  const lockDir = path.join(homeDir, '.codex', 'thread-writer-locks');
  fs.mkdirSync(lockDir, { recursive: true });
  const threadId = 'stale-thread';
  const lockPath = path.join(lockDir, `${threadId}.lock`);
  fs.writeFileSync(lockPath, '');

  const result = reclaimOrphanCodexWriters({ threadId, homeDir });
  assert.equal(result.skipped, 'node_test');
  assert.equal(fs.existsSync(lockPath), true);

  assert.equal(tryRemoveThreadWriterLock(threadId, homeDir), true);
  assert.equal(fs.existsSync(lockPath), false);

  fs.rmSync(homeDir, { recursive: true, force: true });
});
