const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadConfig } = require('../../src/config');

function withTempConfig(config, fn, env = {}) {
  const envNames = ['LINCO_HOME', 'LINCO_AGENT', 'LINCO_CHANNEL', 'LINCO_ACCOUNT', 'LINCO_APP_ID', 'LINCO_APP_SECRET', 'LINCO_TOKEN'];
  const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-init-default-agent-'));
  try {
    process.env.LINCO_HOME = tempDir;
    for (const name of envNames) {
      if (name !== 'LINCO_HOME') delete process.env[name];
    }
    for (const [name, value] of Object.entries(env)) {
      if (value == null) delete process.env[name];
      else process.env[name] = value;
    }
    fs.writeFileSync(path.join(tempDir, 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
    fn(loadConfig(path.resolve(__dirname, '..', '..')));
  } finally {
    for (const [name, value] of Object.entries(originalEnv)) {
      if (value == null) delete process.env[name];
      else process.env[name] = value;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

withTempConfig({
  defaultChannel: 'linco',
  channels: {
    linco: {
      agents: {
        codex: {
          defaultAccount: 'default',
          accounts: {
            default: {
              appId: 'app',
              appSecret: 'secret',
              enabled: true,
            },
          },
        },
      },
    },
  },
}, (config) => {
  assert.strictEqual(config.im.enabled, true);
  assert.strictEqual(config.im.appId, 'app');
  assert.strictEqual(config.im.appSecret, 'secret');
  assert.strictEqual(config.im.wsUrl, 'wss://app.lincotalk.com/socket/ai/codex');
  assert.strictEqual(config.defaultLocalAgent, 'codex');
  assert.deepStrictEqual(config.im.connectors.map(item => ({
    agentType: item.agentType,
    account: item.account,
    appId: item.appId,
    wsUrl: item.wsUrl,
  })), [{
    agentType: 'codex',
    account: 'default',
    appId: 'app',
    wsUrl: 'wss://app.lincotalk.com/socket/ai/codex',
  }]);
});

withTempConfig({
  defaultChannel: 'linco',
  defaultAgent: 'claude',
  channels: {
    linco: {
      agents: {
        codex: {
          defaultAccount: 'default',
          accounts: {
            default: {
              appId: 'codex-app',
              appSecret: 'codex-secret',
              enabled: true,
            },
          },
        },
      },
    },
  },
}, (config) => {
  assert.strictEqual(config.defaultLocalAgent, 'claude');
  assert.strictEqual(config.im.enabled, true);
  assert.strictEqual(config.im.appId, 'codex-app');
  assert.strictEqual(config.im.appSecret, 'codex-secret');
  assert.strictEqual(config.im.wsUrl, 'wss://app.lincotalk.com/socket/ai/codex');
});

withTempConfig({
  defaultChannel: 'linco',
  defaultAgent: 'hermes',
  channels: {
    linco: {
      agents: {
        hermes: {
          defaultAccount: 'default',
          accounts: {
            default: {
              appId: 'hermes-app',
              appSecret: 'hermes-secret',
              enabled: true,
              profile: 'work',
            },
          },
        },
      },
    },
  },
}, (config) => {
  assert.strictEqual(config.agents.hermes.profile, 'work');
  assert.strictEqual(config.defaultLocalAgent, 'hermes');
});

withTempConfig({
  defaultChannel: 'linco',
  channels: {
    linco: {
      agents: {
        claude: {
          defaultAccount: 'main',
          accounts: {
            main: { appId: 'main-app', appSecret: 'main-secret', enabled: true },
            backup: { appId: 'backup-app', appSecret: 'backup-secret', enabled: true },
            disabled: { appId: 'disabled-app', appSecret: 'disabled-secret', enabled: false },
          },
        },
      },
    },
  },
}, (config) => {
  assert.deepStrictEqual(config.im.connectors.map(item => ({
    agentType: item.agentType,
    account: item.account,
    appId: item.appId,
  })), [
    { agentType: 'claude', account: 'main', appId: 'main-app' },
    { agentType: 'claude', account: 'backup', appId: 'backup-app' },
  ]);
});

withTempConfig({
  defaultChannel: 'linco',
  activeChannels: ['linco', 'linco-demo'],
  channels: {
    linco: {
      agents: {
        claude: {
          defaultAccount: 'main',
          accounts: {
            main: { appId: 'linco-app', appSecret: 'linco-secret', enabled: true },
          },
        },
      },
    },
    'linco-demo': {
      agents: {
        codex: {
          defaultAccount: 'default',
          accounts: {
            default: {
              appId: 'demo-app',
              appSecret: 'demo-secret',
              enabled: true,
            },
          },
        },
      },
    },
  },
}, (config) => {
  assert.deepStrictEqual(config.activeChannels, ['linco', 'linco-demo']);
  assert.deepStrictEqual(config.im.activeChannels, ['linco', 'linco-demo']);
  assert.deepStrictEqual(config.im.connectors.map(item => ({
    channel: item.channel,
    agentType: item.agentType,
    account: item.account,
    appId: item.appId,
    wsUrl: item.wsUrl,
  })), [
    {
      channel: 'linco',
      agentType: 'claude',
      account: 'main',
      appId: 'linco-app',
      wsUrl: 'wss://app.lincotalk.com/socket/ai/claude',
    },
    {
      channel: 'linco-demo',
      agentType: 'codex',
      account: 'default',
      appId: 'demo-app',
      wsUrl: 'wss://demo.lincotalk.com/socket/ai/codex',
    },
  ]);
});

withTempConfig({
  defaultChannel: 'linco',
  activeChannels: ['linco', 'linco-demo'],
  channels: {
    linco: {
      agents: {
        claude: {
          defaultAccount: 'main',
          accounts: {
            main: { appId: 'linco-app', appSecret: 'linco-secret', enabled: true },
          },
        },
      },
    },
    'linco-demo': {
      agents: {
        claude: {
          defaultAccount: 'default',
          accounts: {
            default: {
              appId: 'demo-app',
              appSecret: 'demo-secret',
              enabled: true,
            },
          },
        },
      },
    },
  },
}, (config) => {
  assert.deepStrictEqual(config.im.activeChannels, ['linco-demo']);
  assert.deepStrictEqual(config.im.connectors.map(item => ({
    channel: item.channel,
    account: item.account,
    appId: item.appId,
    wsUrl: item.wsUrl,
  })), [{
    channel: 'linco-demo',
    account: 'default',
    appId: 'demo-app',
    wsUrl: 'wss://demo.lincotalk.com/socket/ai/claude',
  }]);
}, { LINCO_CHANNEL: 'linco-demo' });

withTempConfig({
  defaultChannel: 'linco',
  activeChannels: ['linco', 'custom-im'],
  channels: {
    linco: {
      agents: {
        claude: {
          defaultAccount: 'default',
          accounts: {
            default: { appId: 'linco-app', appSecret: 'linco-secret', enabled: true },
          },
        },
      },
    },
    'custom-im': {
      agents: {
        claude: {
          defaultAccount: 'default',
          accounts: {
            default: { appId: 'custom-app', appSecret: 'custom-secret', enabled: true },
          },
        },
      },
    },
  },
}, (config) => {
  assert.deepStrictEqual(config.im.connectors.map(item => ({
    channel: item.channel,
    appId: item.appId,
    wsUrl: item.wsUrl,
  })), [{
    channel: 'linco',
    appId: 'linco-app',
    wsUrl: 'wss://app.lincotalk.com/socket/ai/claude',
  }]);
});

console.log('init default agent config ok');
