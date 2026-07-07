const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..', '..');
const cli = path.join(rootDir, 'bin', 'linco-connect.js');

function withTempHome(fn) {
  const originalHome = process.env.LINCO_HOME;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-init-command-'));
  try {
    fn(tempDir);
  } finally {
    if (originalHome == null) delete process.env.LINCO_HOME;
    else process.env.LINCO_HOME = originalHome;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function runCli(args, tempDir) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: rootDir,
    env: {
      ...process.env,
      LINCO_HOME: tempDir,
    },
    encoding: 'utf8',
  });
}

function readConfig(tempDir) {
  return JSON.parse(fs.readFileSync(path.join(tempDir, 'config.json'), 'utf8'));
}

withTempHome((tempDir) => {
  const result = runCli(['init', '--token', 'app:secret'], tempDir);
  assert.strictEqual(result.status, 0, result.stderr);

  const config = readConfig(tempDir);
  assert.strictEqual(config.defaultChannel, 'linco');
  assert.strictEqual(config.defaultAgent, 'claude');
  assert.deepStrictEqual(config.activeChannels, ['linco']);
  assert.strictEqual(config.channels.linco.agents.claude.defaultAccount, 'default');
  assert.deepStrictEqual(config.channels.linco.agents.claude.accounts.default, {
    appId: 'app',
    appSecret: 'secret',
    enabled: true,
  });
});

withTempHome((tempDir) => {
  const result = runCli([
    'init',
    '--token',
    'demo-app:demo-secret',
    '--channel',
    'linco-demo',
    '--ws-url',
    'ws://127.0.0.1:8787/socket/ai/claude',
    '--allow-insecure-ws',
  ], tempDir);
  assert.strictEqual(result.status, 0, result.stderr);

  const config = readConfig(tempDir);
  assert.strictEqual(config.defaultChannel, 'linco-demo');
  assert.strictEqual(config.defaultAgent, 'claude');
  assert.deepStrictEqual(config.activeChannels, ['linco-demo']);
  assert.strictEqual(config.channels.linco, undefined);
  assert.deepStrictEqual(config.channels['linco-demo'].agents.claude.accounts.default, {
    appId: 'demo-app',
    appSecret: 'demo-secret',
    enabled: true,
    wsUrl: 'ws://127.0.0.1:8787/socket/ai/claude',
    allowInsecureWs: true,
  });
});

withTempHome((tempDir) => {
  const first = runCli(['init', '--token', 'app:secret', '--channel', 'linco'], tempDir);
  assert.strictEqual(first.status, 0, first.stderr);

  const second = runCli([
    'init',
    '--token',
    'demo-app:demo-secret',
    '--channel',
    'linco-demo',
    '--ws-url',
    'ws://127.0.0.1:8787/socket/ai/claude',
    '--allow-insecure-ws',
  ], tempDir);
  assert.strictEqual(second.status, 0, second.stderr);

  const config = readConfig(tempDir);
  assert.strictEqual(config.defaultChannel, 'linco-demo');
  assert.deepStrictEqual(config.activeChannels, ['linco', 'linco-demo']);
  assert.deepStrictEqual(config.channels.linco.agents.claude.accounts.default, {
    appId: 'app',
    appSecret: 'secret',
    enabled: true,
  });
  assert.deepStrictEqual(config.channels['linco-demo'].agents.claude.accounts.default, {
    appId: 'demo-app',
    appSecret: 'demo-secret',
    enabled: true,
    wsUrl: 'ws://127.0.0.1:8787/socket/ai/claude',
    allowInsecureWs: true,
  });
});

withTempHome((tempDir) => {
  const first = runCli([
    'init',
    '--token',
    'app:secret',
    '--channel',
    'company-im',
    '--account',
    'main',
  ], tempDir);
  assert.strictEqual(first.status, 0, first.stderr);

  const second = runCli([
    'init',
    '--token',
    'other:secret',
    '--channel',
    'company-im',
    '--account',
    'main',
  ], tempDir);
  assert.notStrictEqual(second.status, 0);
});

console.log('init command ok');
