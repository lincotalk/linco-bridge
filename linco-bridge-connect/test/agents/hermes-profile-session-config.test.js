const assert = require('assert');
const { _internal } = require('../../src/agents/hermes');

{
  const config = {
    agents: {
      hermes: {
        profile: 'default',
        gatewayUrl: 'http://127.0.0.1:8642',
      },
    },
  };

  const agentConfig = _internal.resolveHermesAgentConfig({ hermesProfile: 'work' }, config);
  assert.strictEqual(agentConfig.profile, 'work');
  assert.strictEqual(agentConfig.gatewayUrl, 'http://127.0.0.1:8642');
  assert.strictEqual(config.agents.hermes.profile, 'default');
}

{
  const base = { profile: 'default' };
  const config = { agents: { hermes: base } };
  const session = {};
  const agentConfig = _internal.resolveHermesAgentConfig(session, config);
  assert.notStrictEqual(agentConfig, base);
  assert.strictEqual(agentConfig.profile, 'default');
  assert.strictEqual(session.hermesProfile, 'default');
}

{
  const session = {};
  const first = _internal.resolveHermesAgentConfig(session, { agents: { hermes: { profile: 'default' } } });
  const second = _internal.resolveHermesAgentConfig(session, { agents: { hermes: { profile: 'work' } } });
  assert.strictEqual(first.profile, 'default');
  assert.strictEqual(second.profile, 'default');
  assert.strictEqual(session.hermesProfile, 'default');
}

{
  const agentConfig = _internal.resolveHermesAgentConfig({ hermesProfile: '  qa  ' }, { agents: { hermes: {} } });
  assert.strictEqual(agentConfig.profile, 'qa');
}

console.log('hermes profile session config ok');
