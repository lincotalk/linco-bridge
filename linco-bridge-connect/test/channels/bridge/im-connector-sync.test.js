const assert = require('assert');
const { ImConnector, syncImConnectors, _internal } = require('../../../src/channels/bridge/connector');

const originalConnect = ImConnector.prototype.connect;
const originalStop = ImConnector.prototype.stop;
const started = [];
const stopped = [];

ImConnector.prototype.connect = function connectStub() {
  started.push(this.key);
};
ImConnector.prototype.stop = function stopStub(reason) {
  stopped.push([this.key, reason]);
  this.stopped = true;
};

try {
  const config = createConfig(
    {
      claude: { enabled: true, wsUrl: 'wss://example.test/claude' },
      codex: { enabled: true, wsUrl: 'wss://example.test/codex' },
    },
    [
      { channel: 'linco', account: 'main', agentType: 'claude', appId: 'claude-main', appSecret: 'main-secret', wsUrl: 'wss://example.test/claude' },
      { channel: 'linco', account: 'backup', agentType: 'claude', appId: 'claude-backup', appSecret: 'backup-secret', wsUrl: 'wss://example.test/claude' },
      { channel: 'linco', account: 'main', agentType: 'codex', appId: 'codex-app', appSecret: 'codex-secret', wsUrl: 'wss://example.test/codex' },
    ]
  );

  const claudeMain = new ImConnector(config, 'claude', config.agents.claude, config.im.connectors[0]);
  const claudeBackup = new ImConnector(config, 'claude', config.agents.claude, config.im.connectors[1]);
  const codex = new ImConnector(config, 'codex', config.agents.codex, config.im.connectors[2]);
  assert.strictEqual(claudeMain.logPrefix, '[IM:linco/claude/main]');
  assert.strictEqual(claudeBackup.logPrefix, '[IM:linco/claude/backup]');
  assert.strictEqual(codex.logPrefix, '[IM:linco/codex/main]');
  assert.strictEqual(_internal.imLogPrefix('codex', { channel: 'custom-im', account: 'codex_1' }), '[IM:custom-im/codex/codex_1]');
  assert.strictEqual(_internal.imLogPrefix('codex', { channel: '  ', account: '  ' }), '[IM:linco/codex/default]');
  config._imConnectors = [claudeMain, claudeBackup, codex];

  config.agents = {
    claude: { enabled: true, wsUrl: 'wss://example.test/claude' },
    hermes: { enabled: true, wsUrl: 'wss://example.test/hermes' },
  };
  config.im.connectors = [
    { channel: 'linco', account: 'main', agentType: 'claude', appId: 'claude-main', appSecret: 'main-secret', wsUrl: 'wss://example.test/claude' },
    { channel: 'linco', account: 'backup', agentType: 'claude', appId: 'claude-backup', appSecret: 'next-secret', wsUrl: 'wss://example.test/claude' },
    { channel: 'linco', account: 'main', agentType: 'hermes', appId: 'hermes-app', appSecret: 'hermes-secret', wsUrl: 'wss://example.test/hermes' },
  ];

  const next = syncImConnectors(config);

  assert.deepStrictEqual(next.map(connector => connector.key), ['claude:linco:main', 'claude:linco:backup', 'hermes:linco:main']);
  assert.strictEqual(next[0], claudeMain);
  assert.notStrictEqual(next[1], claudeBackup);
  assert.strictEqual(next[2].agentType, 'hermes');
  assert.deepStrictEqual(started, ['claude:linco:backup', 'hermes:linco:main']);
  assert.deepStrictEqual(stopped, [['claude:linco:backup', 'config_reload'], ['codex:linco:main', 'config_reload']]);
  assert.strictEqual(config._imConnectors, next);
  assert.strictEqual(
    next[0].configSignature,
    _internal.connectorSignature(config, 'claude', config.agents.claude, config.im.connectors[0])
  );

  const invalidConfig = createConfig(
    { claude: { enabled: true, wsUrl: '' } },
    [
      { channel: 'custom-im', account: 'default', agentType: 'claude', appId: 'app', appSecret: 'secret', wsUrl: '' },
    ]
  );
  assert.deepStrictEqual(_internal.remoteConnectorSpecs(invalidConfig), []);
} finally {
  ImConnector.prototype.connect = originalConnect;
  ImConnector.prototype.stop = originalStop;
}

function createConfig(agents, connectors) {
  return {
    im: {
      enabled: true,
      appId: '',
      appSecret: '',
      wsUrl: '',
      allowInsecureWs: false,
      connectTimeoutMs: 15000,
      heartbeatMs: 30000,
      reconnectMinMs: 1000,
      reconnectMaxMs: 30000,
      account: 'default',
      channel: 'linco',
      agentId: 'main',
      connectors,
    },
    maxWsPayloadBytes: 1024,
    agents,
  };
}

console.log('im connector sync ok');
