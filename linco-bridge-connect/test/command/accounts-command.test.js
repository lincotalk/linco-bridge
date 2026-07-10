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
  assert.strictEqual(handleSlashCommand('/accounts --channel linco', ws, {}, config), true);

  const result = ws.sent.find(item => item.type === 'slash_command_result' && item.command === 'accounts');
  assert(result, 'expected accounts slash_command_result');
  assert.strictEqual(result.version, 1);
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
  assert.strictEqual(ws.sent.some(item => item.type === 'slash_command_result'), false);
  assert.strictEqual(ws.sent[0].type, 'error');
  assert.match(ws.sent[0].text, /--channel <channel>/);
  assert.strictEqual(ws.sent.at(-1).type, 'turn_end');
}

{
  const ws = createWs();
  assert.strictEqual(handleSlashCommand('/accounts --channel missing', ws, {}, config), true);
  assert.strictEqual(ws.sent.some(item => item.type === 'slash_command_result'), false);
  assert.strictEqual(ws.sent[0].type, 'error');
  assert.match(ws.sent[0].text, /Unknown channel: missing/);
  assert.strictEqual(ws.sent.at(-1).type, 'turn_end');
}

assert.deepStrictEqual(_internal.parseAccountsArgs('--channel=linco'), {
  ok: true,
  channel: 'linco',
});

console.log('accounts command ok');
