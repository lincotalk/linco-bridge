const assert = require('assert');
const { applyRuntimeConfig } = require('../../src/app/configRuntime');

const logger = { info() {}, warn() {} };
const activeSessions = new Map([['claude:s1', { id: 's1' }]]);
const connectors = [{ agentType: 'claude' }];
const watcher = { close() {} };

const config = {
  logLevel: 'info',
  port: 3000,
  stale: true,
  logger,
  activeSessions,
  _imConnectors: connectors,
  _configWatcher: watcher,
};

applyRuntimeConfig(config, {
  logLevel: 'debug',
  host: '127.0.0.1',
  port: 4000,
  im: { enabled: true, account: 'main' },
});

assert.strictEqual(config.logLevel, 'debug');
assert.strictEqual(config.host, '127.0.0.1');
assert.strictEqual(config.port, 4000);
assert.strictEqual(config.stale, undefined);
assert.strictEqual(config.logger, logger);
assert.strictEqual(config.activeSessions, activeSessions);
assert.strictEqual(config._imConnectors, connectors);
assert.strictEqual(config._configWatcher, watcher);
assert.deepStrictEqual(config.im, { enabled: true, account: 'main' });

console.log('config runtime reload ok');
