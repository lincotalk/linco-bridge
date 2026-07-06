const assert = require('assert');
const { stopServer } = require('../../src/app/serverApp');

function createChild() {
  let ended = false;
  return {
    killed: false,
    exitCode: 0,
    stdin: {
      destroyed: false,
      end() {
        ended = true;
      },
    },
    get stdinEnded() {
      return ended;
    },
  };
}

(async () => {
  let connectorStopped = false;
  let serverClosed = false;
  const agentProcess = createChild();
  const codexAppServer = createChild();
  const session = {
    id: 'session-1',
    agentType: 'codex',
    agentProcess,
    claudeProcess: null,
    codexAppServer,
    messageQueue: [],
    pendingPermissions: new Map(),
    streamState: {},
  };
  const config = {
    lincoHome: 'test-home',
    _imConnectors: [{
      stop() {
        connectorStopped = true;
      },
    }],
    activeSessions: new Map([['codex:session-1', session]]),
    logger: { info() {}, warn() {} },
  };
  const server = {
    close(callback) {
      serverClosed = true;
      callback();
    },
  };

  await stopServer(config, server, { serverCloseMs: 1, childGraceMs: 1 });

  assert.strictEqual(connectorStopped, true);
  assert.strictEqual(serverClosed, true);
  assert.strictEqual(config.activeSessions.size, 0);
  assert.strictEqual(session.agentProcess, null);
  assert.strictEqual(session.codexAppServer, null);
  assert.strictEqual(agentProcess.stdinEnded, true);
  assert.strictEqual(codexAppServer.stdinEnded, true);

  console.log('shutdown cleanup ok');
})();
