const assert = require('assert');

const {
  getChannelAdapter,
  getChannelAgentWsUrl,
  getChannelPreset,
  registerChannelAdapter,
} = require('../../src/core/channelRegistry');

{
  const linco = getChannelAdapter('linco');
  const demo = getChannelAdapter('linco-demo');

  assert.ok(linco);
  assert.ok(demo);
  assert.notStrictEqual(linco, demo);
  assert.strictEqual(linco.name, 'linco');
  assert.strictEqual(demo.name, 'linco-demo');
  assert.strictEqual(typeof linco.mapLocalEventToLinco, 'function');
  assert.strictEqual(typeof demo.mapLocalEventToLinco, 'function');
}

{
  const lincoPreset = getChannelPreset('linco');
  const demoPreset = getChannelPreset('linco-demo');

  assert.ok(lincoPreset.defaultWsUrl.startsWith('wss://app.lincotalk.com/'));
  assert.ok(demoPreset.defaultWsUrl.startsWith('ws://127.0.0.1:3300/'));
  assert.notStrictEqual(
    getChannelAgentWsUrl('linco', 'codex'),
    getChannelAgentWsUrl('linco-demo', 'codex'),
  );
}

{
  const adapter = registerChannelAdapter({
    name: 'custom-test',
    preset: {
      defaultWsUrl: 'wss://example.test/ws',
      agentWsUrls: {
        claude: 'wss://example.test/ws/claude',
      },
    },
  });

  assert.strictEqual(getChannelAdapter('custom-test'), adapter);
  assert.strictEqual(getChannelAgentWsUrl('custom-test', 'claude'), 'wss://example.test/ws/claude');
  assert.strictEqual(getChannelAgentWsUrl('custom-test', 'codex'), 'wss://example.test/ws');
}

console.log('channel adapter registry ok');
