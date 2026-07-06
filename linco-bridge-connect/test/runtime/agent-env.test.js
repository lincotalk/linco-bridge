const assert = require('assert');
const {
  buildClaudeEnv,
  buildCodexEnv,
  _internal,
} = require('../../src/runtime/agentEnv');

function reader(values) {
  return (name, target) => values[`${target}:${name}`] || '';
}

{
  const env = buildClaudeEnv({
    ANTHROPIC_AUTH_TOKEN: 'from-process',
    CLAUDECODE: 'nested',
  }, {
    readSystemEnv: reader({
      'User:ANTHROPIC_AUTH_TOKEN': 'from-user',
      'User:ANTHROPIC_BASE_URL': 'https://user.example',
      'Machine:ANTHROPIC_MODEL': 'sonnet',
    }),
  });

  assert.strictEqual(env.ANTHROPIC_AUTH_TOKEN, 'from-process');
  assert.strictEqual(env.ANTHROPIC_BASE_URL, 'https://user.example');
  assert.strictEqual(env.ANTHROPIC_MODEL, 'sonnet');
  assert.strictEqual(env.CLAUDECODE, undefined);
}

{
  const env = buildCodexEnv({}, {
    readSystemEnv: reader({
      'Machine:OPENAI_API_KEY': 'sk-machine',
      'User:OPENAI_BASE_URL': 'https://user-openai.example',
      'User:ANTHROPIC_AUTH_TOKEN': 'should-not-cross-agent',
    }),
  });

  assert.strictEqual(env.OPENAI_API_KEY, 'sk-machine');
  assert.strictEqual(env.OPENAI_BASE_URL, 'https://user-openai.example');
  assert.strictEqual(env.ANTHROPIC_AUTH_TOKEN, undefined);
}

{
  const quoted = _internal.quotePowerShellString("A'B");
  assert.strictEqual(quoted, "'A''B'");
}

{
  const command = _internal.buildWindowsEnvMapCommand(['OPENAI_API_KEY', "A'B"], 'User');
  assert(command.includes("'OPENAI_API_KEY'"));
  assert(command.includes("'A''B'"));
  assert(command.includes("'User'"));
  assert(command.includes('ConvertTo-Json'));
}

console.log('agent env ok');
