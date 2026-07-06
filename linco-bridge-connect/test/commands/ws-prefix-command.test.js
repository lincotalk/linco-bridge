const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadConfig } = require('../../src/config');

const rootDir = path.resolve(__dirname, '..', '..');
const cli = path.join(rootDir, 'bin', 'linco-connect.js');

function withTempHome(config, fn) {
  const originalHome = process.env.LINCO_HOME;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-ws-prefix-'));
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
          defaultAccount: 'default',
          accounts: {
            default: { appId: 'claude-app', appSecret: 'claude-secret', enabled: true },
            backup: { appId: 'claude-backup', appSecret: 'backup-secret', enabled: false },
          },
        },
        codex: {
          defaultAccount: 'default',
          accounts: {
            default: {
              appId: 'codex-app',
              appSecret: 'codex-secret',
              enabled: true,
              wsUrl: 'wss://old.example.test/socket/ai/codex',
            },
          },
        },
        hermes: {
          profile: 'default',
        },
      },
    },
  },
}, (tempDir) => {
  const result = runCli(['ws-prefix', 'gateway.example.com'], tempDir);
  assert.strictEqual(result.status, 0, result.stderr);

  const config = readConfig(tempDir);
  assert.strictEqual(config.channels.linco.agents.claude.accounts.default.wsUrl, 'wss://gateway.example.com/socket/ai/claude');
  assert.strictEqual(config.channels.linco.agents.claude.accounts.backup.wsUrl, 'wss://gateway.example.com/socket/ai/claude');
  assert.strictEqual(config.channels.linco.agents.codex.accounts.default.wsUrl, 'wss://gateway.example.com/socket/ai/codex');
  assert.strictEqual(config.channels.linco.agents.hermes.accounts, undefined);
});

withTempHome({
  defaultChannel: 'linco',
  defaultAgent: 'claude',
  channels: {
    linco: {
      agents: {
        claude: {
          defaultAccount: 'default',
          accounts: {
            default: {
              appId: 'claude-app',
              appSecret: 'claude-secret',
              enabled: true,
              wsUrl: 'wss://gateway.example.com/socket/ai/claude',
            },
          },
        },
        codex: {
          defaultAccount: 'default',
          accounts: {
            default: {
              appId: 'codex-app',
              appSecret: 'codex-secret',
              enabled: true,
              wsUrl: 'wss://gateway.example.com/socket/ai/codex',
            },
          },
        },
      },
    },
  },
}, (tempDir) => {
  const result = runCli(['ws-prefix', '--clear'], tempDir);
  assert.strictEqual(result.status, 0, result.stderr);

  const config = readConfig(tempDir);
  assert.strictEqual(config.channels.linco.agents.claude.accounts.default.wsUrl, undefined);
  assert.strictEqual(config.channels.linco.agents.codex.accounts.default.wsUrl, undefined);

  const loaded = loadConfig(rootDir);
  assert.strictEqual(loaded.agents.claude.wsUrl, 'wss://app.lincotalk.com/socket/ai/claude');
  assert.strictEqual(loaded.agents.codex.wsUrl, 'wss://app.lincotalk.com/socket/ai/codex');
});

withTempHome({
  defaultChannel: 'linco',
  channels: {
    linco: {
      agents: {
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
  const result = runCli(['ws-prefix', 'https://stage.gateway.example.com/socket/ai'], tempDir);
  assert.strictEqual(result.status, 0, result.stderr);

  const config = readConfig(tempDir);
  assert.strictEqual(config.channels.linco.agents.codex.accounts.default.wsUrl, 'wss://stage.gateway.example.com/socket/ai/codex');
});

console.log('ws-prefix command ok');
