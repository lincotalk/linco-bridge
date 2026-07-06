const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DEFAULT_IM_IDLE_SESSION_MS, loadConfig } = require('../../src/config');

function withTempLincoHome(config, envValue, fn, idleEnvValue = null) {
  const originalHome = process.env.LINCO_HOME;
  const originalEnv = process.env.LINCO_CODEX_NETWORK_ACCESS;
  const originalIdleEnv = process.env.LINCO_IM_IDLE_SESSION_MS;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-codex-network-'));
  try {
    process.env.LINCO_HOME = tempDir;
    if (envValue == null) {
      delete process.env.LINCO_CODEX_NETWORK_ACCESS;
    } else {
      process.env.LINCO_CODEX_NETWORK_ACCESS = envValue;
    }
    if (idleEnvValue == null) {
      delete process.env.LINCO_IM_IDLE_SESSION_MS;
    } else {
      process.env.LINCO_IM_IDLE_SESSION_MS = idleEnvValue;
    }
    if (config) {
      fs.writeFileSync(path.join(tempDir, 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
    }
    fn(loadConfig(path.resolve(__dirname, '..', '..')));
  } finally {
    if (originalHome == null) delete process.env.LINCO_HOME;
    else process.env.LINCO_HOME = originalHome;
    if (originalEnv == null) delete process.env.LINCO_CODEX_NETWORK_ACCESS;
    else process.env.LINCO_CODEX_NETWORK_ACCESS = originalEnv;
    if (originalIdleEnv == null) delete process.env.LINCO_IM_IDLE_SESSION_MS;
    else process.env.LINCO_IM_IDLE_SESSION_MS = originalIdleEnv;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

withTempLincoHome({}, null, (config) => {
  assert.strictEqual(config.agents.codex.networkAccess, true);
  assert.strictEqual(config.im.idleSessionMs, DEFAULT_IM_IDLE_SESSION_MS);
});

withTempLincoHome({
  agents: {
    codex: {
      networkAccess: false,
    },
  },
}, null, (config) => {
  assert.strictEqual(config.agents.codex.networkAccess, false);
});

withTempLincoHome({
  agents: {
    codex: {
      networkAccess: true,
    },
  },
}, '0', (config) => {
  assert.strictEqual(config.agents.codex.networkAccess, false);
});

withTempLincoHome({}, null, (config) => {
  assert.strictEqual(config.im.idleSessionMs, 12345);
}, '12345');
