const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadConfig } = require('../../src/config');

function withTempConfig(config, fn) {
  const originalHome = process.env.LINCO_HOME;
  const originalBin = process.env.CLAUDE_BIN;
  const originalInstructions = process.env.LINCO_CLAUDE_INSTRUCTIONS;
  const originalAddRuntimeDir = process.env.LINCO_CLAUDE_ADD_RUNTIME_DIR;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linco-claude-config-'));
  try {
    process.env.LINCO_HOME = tempDir;
    delete process.env.CLAUDE_BIN;
    delete process.env.LINCO_CLAUDE_INSTRUCTIONS;
    delete process.env.LINCO_CLAUDE_ADD_RUNTIME_DIR;
    fs.writeFileSync(path.join(tempDir, 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
    fn(loadConfig(path.resolve(__dirname, '..', '..')));
  } finally {
    if (originalHome == null) delete process.env.LINCO_HOME;
    else process.env.LINCO_HOME = originalHome;
    if (originalBin == null) delete process.env.CLAUDE_BIN;
    else process.env.CLAUDE_BIN = originalBin;
    if (originalInstructions == null) delete process.env.LINCO_CLAUDE_INSTRUCTIONS;
    else process.env.LINCO_CLAUDE_INSTRUCTIONS = originalInstructions;
    if (originalAddRuntimeDir == null) delete process.env.LINCO_CLAUDE_ADD_RUNTIME_DIR;
    else process.env.LINCO_CLAUDE_ADD_RUNTIME_DIR = originalAddRuntimeDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

withTempConfig({
  defaultChannel: 'linco',
  systemPrompt: 'legacy prompt should not be used',
  claudeBin: 'legacy-claude-bin',
  claudeAddRuntimeDir: false,
  channels: {
    linco: {
      agents: {
        claude: {
          defaultAccount: 'default',
          accounts: {
            default: {
              enabled: true,
              appId: 'app',
              appSecret: 'secret',
              bin: 'channel-claude',
              instructions: 'channel instructions',
              addRuntimeDir: true,
            },
          },
        },
      },
    },
  },
  agents: {
    claude: {
      bin: 'agent-claude',
      instructions: 'agent instructions',
      addRuntimeDir: false,
    },
  },
}, (config) => {
  assert.strictEqual(config.agents.claude.enabled, true);
  assert.strictEqual(config.agents.claude.bin, 'channel-claude');
  assert.strictEqual(config.agents.claude.instructions, 'agent instructions');
  assert.strictEqual(config.agents.claude.addRuntimeDir, false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(config, 'claudeBin'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(config, 'systemPrompt'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(config, 'claudeAddRuntimeDir'), false);
});
