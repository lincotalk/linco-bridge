const assert = require('assert');
const Module = require('module');
const path = require('path');

function loadOpenClawAgentWithGateway(fakeGateway) {
  const filename = path.resolve(__dirname, '../../src/agent/openclaw/index.js');
  delete require.cache[filename];

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (parent?.filename === filename && request === '../../gateway/openclawGateway') {
      return fakeGateway;
    }
    return originalLoad.apply(this, arguments);
  };

  try {
    return require(filename);
  } finally {
    Module._load = originalLoad;
  }
}

function createCaptureWs() {
  const sent = [];
  return {
    sent,
    send(raw) {
      sent.push(JSON.parse(raw));
    },
  };
}

class FailingGatewayClient {
  constructor() {
    this.connected = true;
  }

  async connect() {}

  requireMethods() {}

  onEvent() {
    return () => {};
  }

  onClose() {
    return () => {};
  }

  request(method) {
    if (method === 'sessions.create') {
      return Promise.reject(new Error('label already in use: 你好'));
    }
    return Promise.resolve({});
  }

  close() {
    this.connected = false;
  }
}

async function waitForAsyncTurn() {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
}

(async () => {
  const { execute } = loadOpenClawAgentWithGateway({
    DEFAULT_GATEWAY_URL: 'ws://127.0.0.1:18789',
    REQUIRED_METHODS: ['sessions.create', 'chat.send', 'chat.abort', 'sessions.messages.subscribe'],
    OpenClawGatewayClient: FailingGatewayClient,
    ensureOpenClawGateway: async () => 'ws://127.0.0.1:18789',
    normalizeGatewayUrl: value => value,
  });

  const ws = createCaptureWs();
  const session = {
    id: 'session-1',
    storageId: 'sid_session_1',
    linco: {
      messageId: 'm-1',
      streamId: 'linco-stream-m-1',
    },
    isTurnActive: false,
    messageQueue: [],
    pendingPermissions: new Map(),
    agentSessionHistory: [],
  };

  execute('你好', ws, session, {
    maxMessageQueue: 10,
    agents: { openclaw: {} },
    logger: { info() {}, warn() {} },
  });
  await waitForAsyncTurn();

  assert.strictEqual(session.isTurnActive, false);
  assert(ws.sent.some(msg => msg.type === 'error' && msg.text.includes('label already in use: 你好')));
  assert(ws.sent.some(msg => (
    msg.type === 'turn_end' &&
    msg.reason === 'error' &&
    msg.requestId === 'm-1' &&
    msg.streamId === 'linco-stream-m-1' &&
    msg.sessionKey === 'session-1' &&
    msg.error.includes('label already in use: 你好')
  )));

  console.log('openclaw startup error turn_end ok');
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
