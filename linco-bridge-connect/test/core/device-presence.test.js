const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { getDeviceIdentity } = require('../../src/core/deviceIdentity');
const { _internal: imInternal } = require('../../src/core/channelConnector');
const { buildPresenceEvent } = require('../../src/core/channelPresence');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-device-'));
const config = {
  lincoHome: home,
  im: {
    account: 'main',
    agentId: 'agent-1',
    channel: 'linco',
  },
};

const first = getDeviceIdentity(config);
const second = getDeviceIdentity(config);

assert(first.id.startsWith('linco-'));
assert.strictEqual(second.id, first.id);
assert.strictEqual(first.name, os.hostname());
assert.strictEqual(first.platform, process.platform);
assert.strictEqual(first.arch, process.arch);
assert(fs.existsSync(path.join(home, 'device.json')));

const online = buildPresenceEvent(config, { agentType: 'codex', status: 'online' });
assert.strictEqual(online.type, 'presence_event');
assert.strictEqual(online.from, 'codex');
assert.strictEqual(online.accountId, 'main');
assert.strictEqual(online.agentId, 'agent-1');
assert.strictEqual(online.channel, 'linco');
assert.deepStrictEqual(online.device, first);
assert.strictEqual(online.client.name, 'linco-connect');
assert(online.client.version);
assert.strictEqual(online.client.installType, 'source');
assert.strictEqual(online.client.selfUpdateSupported, false);

const offline = buildPresenceEvent(config, { agentType: 'codex', status: 'offline', reason: 'shutdown' });
assert.deepStrictEqual(offline.device, { id: first.id });
assert.strictEqual(offline.reason, 'shutdown');

const ping = imInternal.buildHeartbeatMessage(config, { agentType: 'codex', type: 'ping' });
assert.strictEqual(ping.type, 'ping');
assert.strictEqual(ping.from, 'codex');
assert.strictEqual(ping.to, 'robot');
assert.strictEqual(ping.source, 'ws');
assert.strictEqual(ping.accountId, 'main');
assert.strictEqual(ping.agentId, 'agent-1');
assert.strictEqual(ping.channel, 'linco');
assert.deepStrictEqual(ping.device, first);
assert.strictEqual(ping.client.name, 'linco-connect');
assert(ping.client.version);
assert.strictEqual(ping.client.installType, 'source');
assert.strictEqual(ping.client.selfUpdateSupported, false);

const pong = imInternal.buildHeartbeatMessage(config, { agentType: 'codex', type: 'pong' });
assert.strictEqual(pong.type, 'pong');
assert.deepStrictEqual(pong.device, first);

console.log('device presence ok');
