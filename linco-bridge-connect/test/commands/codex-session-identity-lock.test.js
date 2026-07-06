const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sessionIdentityLocked,
} = require('../../src/commands/agentSelection');

test('Codex app server without an agent session id does not lock identity changes', () => {
  const appServer = { pid: 1234 };

  assert.equal(
    sessionIdentityLocked({
      agentType: 'codex',
      agentSessionId: '',
      codexAppServer: appServer,
      agentProcess: appServer,
    }),
    false,
  );
});

test('Codex identity changes stay locked while a turn or thread is active', () => {
  assert.equal(
    sessionIdentityLocked({
      agentType: 'codex',
      agentSessionId: 'thread-1',
    }),
    true,
  );
  assert.equal(
    sessionIdentityLocked({
      agentType: 'codex',
      isTurnActive: true,
      codexAppServer: { pid: 1234 },
    }),
    true,
  );
});
