const assert = require('node:assert/strict');
const test = require('node:test');
const { WebSocketServer } = require('ws');
const { BridgeConnectorClient } = require('../../../src/package/connector');

test('builds authenticated websocket urls and redacts appSecret params', () => {
  const client = new BridgeConnectorClient({
    wsUrl: 'wss://example.test/socket?appSecret=old&x=1',
    appId: 'app',
    appSecret: 'secret',
  });

  assert.equal(client.buildUrl(), 'wss://example.test/socket?x=1&token=app%3Asecret');
});

test('rejects insecure urls unless explicitly allowed', () => {
  const client = new BridgeConnectorClient({
    wsUrl: 'ws://example.test/socket',
    appId: 'app',
    appSecret: 'secret',
  });

  assert.throws(() => client.buildUrl(), /requires wss/);
});

test('connects, flushes queued messages, receives messages, and sends heartbeat', async () => {
  const received = [];
  const server = new WebSocketServer({ port: 0 });
  const address = await onceListening(server);

  let serverSocket;
  server.on('connection', (socket) => {
    serverSocket = socket;
    socket.on('message', (raw) => received.push(JSON.parse(raw.toString())));
  });

  const client = new BridgeConnectorClient({
    wsUrl: `ws://127.0.0.1:${address.port}/socket`,
    appId: 'app',
    appSecret: 'secret',
    allowInsecureWs: true,
    maxPayloadBytes: 1024,
    connectTimeoutMs: 1000,
    heartbeatMs: 20,
    reconnectMinMs: 1000,
    reconnectMaxMs: 1000,
    maxPendingEvents: 5,
    buildHeartbeat: () => ({ type: 'ping', ts: 1 }),
  });

  const messages = [];
  client.on('message', (data) => messages.push(JSON.parse(data.toString())));
  client.send({ type: 'outbound_message', text: 'queued' });
  client.start();
  await once(client, 'open');
  await waitFor(() => received.some((item) => item.type === 'outbound_message'));
  await waitFor(() => received.some((item) => item.type === 'ping'));

  serverSocket.send(JSON.stringify({ type: 'pong' }));
  await waitFor(() => messages.some((item) => item.type === 'pong'));

  client.stop();
  await closeServer(server);
});

function onceListening(server) {
  return new Promise((resolve) => {
    server.once('listening', () => resolve(server.address()));
  });
}

function once(emitter, event) {
  return new Promise((resolve) => emitter.once(event, resolve));
}

function waitFor(predicate, timeoutMs = 1000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error('timed out waiting for condition'));
      setTimeout(tick, 10);
    };
    tick();
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}
