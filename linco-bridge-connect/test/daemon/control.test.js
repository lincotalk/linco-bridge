const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  controlSocketPath,
  sendControlCommand,
  startControlServer,
  stopControlServer,
} = require('../../src/daemon/control');

const rootDir = path.resolve(__dirname, '..', '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-control-server-'));
const configFile = path.join(tempDir, 'config.json');

(async () => {
  const originalHome = process.env.LINCO_HOME;
  try {
    process.env.LINCO_HOME = tempDir;
    fs.writeFileSync(configFile, `${JSON.stringify({
      defaultChannel: 'linco',
      channels: {
        linco: {
          agents: {
            claude: {
              defaultAccount: 'default',
              accounts: {
                default: { appId: 'app', appSecret: 'secret', enabled: false },
              },
            },
          },
        },
      },
    }, null, 2)}\n`);

    const config = {
      lincoHome: tempDir,
      configFile,
      logger: { info() {}, warn() {} },
      im: { enabled: false },
      agents: {},
      _imConnectors: [],
    };

    const server = startControlServer(rootDir, config);
    assert.ok(server);
    await onceListening(server);

    const result = await sendControlCommand(config, 'reload');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.configFile, configFile);
    assert.deepStrictEqual(result.agents, []);
    assert.strictEqual(config.im.enabled, false);
    assert.strictEqual(config.agents.claude.enabled, false);
    assert.strictEqual(controlSocketPath(config), config._controlSocketPath);
    stopControlServer(config);
  } finally {
    if (originalHome == null) delete process.env.LINCO_HOME;
    else process.env.LINCO_HOME = originalHome;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log('control server ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

function onceListening(server) {
  if (server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
}
