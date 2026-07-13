const assert = require('assert');
const { handleSlashCommand, _internal } = require('../../src/command');

function createWs() {
  return {
    sent: [],
    send(payload) {
      this.sent.push(JSON.parse(payload));
    },
  };
}

const config = {
  channels: {
    linco: {
      agents: {
        claude: {
          accounts: {
            claude_1: { appId: 'claude-app', appSecret: 'claude-secret' },
            shared: { appId: 'shared-claude-app', appSecret: 'shared-claude-secret' },
          },
        },
        codex: {
          accounts: {
            codex_1: { appId: 'codex-app', appSecret: 'codex-secret' },
            shared: { appId: 'shared-codex-app', appSecret: 'shared-codex-secret' },
          },
        },
      },
    },
  },
};

{
  const ws = createWs();
  const session = { id: 'remote-session-1', linco: { streamId: 'linco-cmd-test-1' } };
  assert.strictEqual(handleSlashCommand('/accounts --channel linco', ws, session, config), true);

  const result = ws.sent.find(item => item.type === 'slash_command_result' && item.command === 'accounts');
  assert(result, 'expected accounts slash_command_result');
  assert.strictEqual(result.version, 1);
  assert.strictEqual(result.streamId, 'linco-cmd-test-1');
  assert.strictEqual(result.sessionKey, 'remote-session-1');
  assert.deepStrictEqual(result.data, {
    channel: 'linco',
    accountIds: ['claude_1', 'codex_1', 'shared'],
  });
  assert.strictEqual(JSON.stringify(result).includes('secret'), false);
  assert.strictEqual(JSON.stringify(result).includes('appId'), false);
  assert.strictEqual(ws.sent.at(-1).type, 'turn_end');
}

{
  const ws = createWs();
  assert.strictEqual(handleSlashCommand('/accounts', ws, {}, config), true);
  const result = ws.sent.find(item => item.type === 'slash_command_result' && item.command === 'accounts');
  assert(result, 'expected accounts slash_command_result for usage error');
  assert.match(result.data.error, /--channel <channel>/);
  assert.deepStrictEqual(result.data.accountIds, []);
  assert.strictEqual(ws.sent.at(-1).type, 'turn_end');
}

{
  const ws = createWs();
  assert.strictEqual(handleSlashCommand('/accounts --channel missing', ws, {}, config), true);
  const result = ws.sent.find(item => item.type === 'slash_command_result' && item.command === 'accounts');
  assert(result, 'expected accounts slash_command_result for unknown channel');
  assert.strictEqual(result.data.channel, 'missing');
  assert.deepStrictEqual(result.data.accountIds, []);
  assert.match(result.data.error, /Unknown channel: missing/);
  assert.strictEqual(ws.sent.at(-1).type, 'turn_end');
}

assert.deepStrictEqual(_internal.parseAccountsArgs('--channel=linco'), {
  ok: true,
  channel: 'linco',
});

console.log('accounts command ok');
