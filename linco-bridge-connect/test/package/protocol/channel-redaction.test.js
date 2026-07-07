const assert = require('node:assert/strict');
const test = require('node:test');
const {
  connectorKey,
  remoteSessionScope,
  safeUrlForLog,
} = require('../../../src/package/protocol');

test('builds stable connector keys and session scopes', () => {
  assert.equal(connectorKey('claude', { channel: 'linco-demo', account: 'main' }), 'claude:linco-demo:main');
  assert.equal(connectorKey('  ', { channel: '  ', account: '  ' }), '  :linco:default');
  assert.equal(remoteSessionScope({ channel: 'company-im', account: 'ops' }), 'company-im:ops');
});

test('redacts tokens from websocket urls for logs', () => {
  assert.equal(
    safeUrlForLog('wss://example.test/socket?token=app%3Asecret&appSecret=secret&x=1'),
    'wss://example.test/socket?x=1',
  );
  assert.equal(safeUrlForLog('not a url'), '(invalid url)');
});
