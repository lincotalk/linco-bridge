const test = require('node:test');
const assert = require('node:assert/strict');

const { handleSlashCommand } = require('../../src/command/index');
const {
  GET_MODELS_AND_REASONS_COMMAND,
  parseSettingsArgs,
} = require('../../src/command/settings');

function makeWs() {
  const sent = [];
  return {
    sent,
    readyState: 1,
    send(payload) {
      sent.push(JSON.parse(payload));
    },
  };
}

test('parseSettingsArgs parses composite apply command', () => {
  assert.deepEqual(
    parseSettingsArgs('apply --reasoning high --model gpt-5.5'),
    {
      mode: 'apply',
      reasoningEffort: 'high',
      modelId: 'gpt-5.5',
    },
  );
});

test('claude /settings apply updates model and effort with one restart', () => {
  const ws = makeWs();
  const session = {
    id: 'session-settings-apply',
    storageId: 'sid_settings_apply',
    workspace: process.cwd(),
    runtimeDir: process.cwd(),
    agentType: 'claude',
    messageQueue: [],
    agentSessionHistory: [],
    claudeProcess: {
      stdin: null,
      killed: false,
      exitCode: null,
      kill() {
        this.killed = true;
      },
    },
  };

  assert.strictEqual(
    handleSlashCommand(
      '/settings apply --reasoning high --model opus',
      ws,
      session,
      { agents: { claude: { model: 'sonnet', effort: 'medium' } } },
    ),
    true,
  );

  assert.strictEqual(session.claudeEffortOverride, 'high');
  assert.strictEqual(session.claudeModelOverride, 'opus');
  assert.strictEqual(session.claudeProcess, null);

  const result = ws.sent.find(item => item.type === 'slash_command_result');
  assert.equal(result?.command, GET_MODELS_AND_REASONS_COMMAND);
  assert.equal(result?.data?.reasoning?.current, 'high');
  assert.equal(result?.data?.model?.current, 'opus');
});
