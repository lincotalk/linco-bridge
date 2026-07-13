const assert = require('assert');
const { _internal } = require('../../../src/core/channelConnector');
const { handleRemoteBridgeSlashCommand } = require('../../../src/command');

function createConnector() {
  const sent = [];
  return {
    sent,
    config: {
      im: {
        account: 'codex_a962e6c4',
        agentId: 'main',
        channel: 'linco-demo',
      },
      channels: {
        'linco-demo': {
          agents: {
            codex: {
              accounts: {
                codex_a962e6c4: { appId: 'app', appSecret: 'secret' },
              },
            },
          },
        },
      },
    },
    adapter: require('../../../src/channel/linco'),
    sendLincoMessage(payload) {
      sent.push(payload);
    },
  };
}

{
  const connector = createConnector();
  const session = {
    id: 'landing-codex',
    linco: { streamId: 'linco-cmd-remote-1' },
  };
  const ws = _internal.createRemoteAdapter(connector, session, session.linco);
  assert.strictEqual(
    handleRemoteBridgeSlashCommand('/accounts --channel linco-demo', ws, session, connector.config),
    true,
  );

  const result = connector.sent.find(item => item.type === 'slash_command_result' && item.command === 'accounts');
  assert(result, 'expected remote accounts slash_command_result');
  assert.strictEqual(result.streamId, 'linco-cmd-remote-1');
  assert.strictEqual(result.sessionKey, 'landing-codex');
  assert.deepStrictEqual(result.data, {
    channel: 'linco-demo',
    accountIds: ['codex_a962e6c4'],
  });
  assert.strictEqual(connector.sent.some(item => item.type === 'agentMessage' || item.type === 'stream_chunk'), false);
  assert.strictEqual(connector.sent.at(-1).type, 'turn_end');
}

console.log('accounts remote command ok');
