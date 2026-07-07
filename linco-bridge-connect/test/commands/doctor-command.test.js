const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { OFFICIAL_LINCO_DEMO_AGENT_WS_URLS } = require('../../src/channels/presets/lincoDemo');

const rootDir = path.resolve(__dirname, '..', '..');
const cli = path.join(rootDir, 'bin', 'linco-connect.js');
const lincoDemoCodexWsUrl = OFFICIAL_LINCO_DEMO_AGENT_WS_URLS.codex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-doctor-command-'));

try {
  fs.writeFileSync(path.join(tempDir, 'config.json'), `${JSON.stringify({
    defaultChannel: 'linco',
    activeChannels: ['linco', 'linco-demo', 'custom-im', 'missing-channel'],
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
      'linco-demo': {
        agents: {
          codex: {
            defaultAccount: 'default',
            accounts: {
              default: { appId: 'demo-app', appSecret: 'demo-secret', enabled: true },
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
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [cli, 'doctor'], {
    cwd: rootDir,
    env: {
      ...process.env,
      LINCO_HOME: tempDir,
    },
    encoding: 'utf8',
  });
  const output = `${result.stdout}\n${result.stderr}`;

  assert.match(output, /Active channels: linco, linco-demo, custom-im, missing-channel/);
  assert.match(output, /Channel linco: preset=linco/);
  assert.match(output, /Channel linco\/claude\/default: wss:\/\/app\.lincotalk\.com\/socket\/ai\/claude/);
  assert.match(output, /Channel linco-demo: preset=linco-demo/);
  assert.match(output, new RegExp(`Channel linco-demo/codex/default: ${lincoDemoCodexWsUrl}`));
  assert.match(output, /Channel custom-im: preset=none/);
  assert.match(output, /Channel custom-im\/claude\/default: missing wsUrl/);
  assert.match(output, /Channel missing-channel: missing from config\.channels/);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log('doctor command ok');
