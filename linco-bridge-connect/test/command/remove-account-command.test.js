const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..', '..');
const cli = path.join(rootDir, 'bin', 'linco-connect.js');

function withTempHome(config, fn) {
  const originalHome = process.env.LINCO_HOME;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-remove-account-'));
  try {
    process.env.LINCO_HOME = tempDir;
    fs.writeFileSync(path.join(tempDir, 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
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

withTempHome({
  defaultChannel: 'linco',
  defaultAgent: 'claude',
  channels: {
    linco: {
      agents: {
        claude: {
          defaultAccount: 'main',
          accounts: {
            main: { appId: 'app-main', appSecret: 'secret-main', enabled: true },
            backup: { appId: 'app-backup', appSecret: 'secret-backup', enabled: true },
          },
        },
      },
    },
  },
}, (tempDir) => {
  const result = runCli(['remove-account', '--agent', 'claude', '--account', 'main'], tempDir);
  assert.strictEqual(result.status, 0, result.stderr);

  const config = readConfig(tempDir);
  const claude = config.channels.linco.agents.claude;
  assert.strictEqual(claude.accounts.main, undefined);
  assert.strictEqual(claude.accounts.backup.appId, 'app-backup');
  assert.strictEqual(claude.defaultAccount, 'backup');
  assert.strictEqual(config.defaultAgent, 'claude');
});

withTempHome({
  defaultChannel: 'linco',
  defaultAgent: 'claude',
  channels: {
    linco: {
      agents: {
        claude: {
          defaultAccount: 'main',
          accounts: {
            main: { appId: 'app-main', appSecret: 'secret-main', enabled: true },
          },
        },
        codex: {
          defaultAccount: 'default',
          accounts: {
            default: { appId: 'codex-app', appSecret: 'codex-secret', enabled: true },
          },
        },
      },
    },
  },
}, (tempDir) => {
  const result = runCli(['delete-account', '--agent', 'claude', '--account', 'main'], tempDir);
  assert.strictEqual(result.status, 0, result.stderr);

  const config = readConfig(tempDir);
  assert.strictEqual(config.channels.linco.agents.claude, undefined);
  assert.strictEqual(config.channels.linco.agents.codex.accounts.default.appId, 'codex-app');
  assert.strictEqual(config.defaultAgent, 'codex');
});

withTempHome({
  defaultChannel: 'linco',
  channels: {
    linco: {
      agents: {
        claude: {
          defaultAccount: 'shared',
          accounts: {
            shared: { appId: 'claude-app', appSecret: 'claude-secret', enabled: true },
          },
        },
        codex: {
          defaultAccount: 'shared',
          accounts: {
            shared: { appId: 'codex-app', appSecret: 'codex-secret', enabled: true },
          },
        },
      },
    },
  },
}, (tempDir) => {
  const result = runCli(['remove-account', '--account', 'shared'], tempDir);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /多个 Agent|multiple Agent/i);
});

console.log('remove account command ok');
