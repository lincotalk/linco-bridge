const claude = require('../agent/claude');
const codex = require('../agent/codex');
const hermes = require('../agent/hermes');
const openclaw = require('../agent/openclaw');

const providers = {
  claude,
  codex,
  hermes,
  openclaw,
};

function providerFor(session) {
  const agentType = session.agentType || 'claude';
  const provider = providers[agentType];
  if (!provider) throw new Error(`不支持的 Agent: ${agentType}`);
  return provider;
}

function executeAgentQuery(input, ws, session, config) {
  return providerFor(session).execute(input, ws, session, config);
}

function resolvePendingDanger(confirmed, ws, session, config) {
  return providerFor(session).resolvePendingDanger?.(confirmed, ws, session, config) || false;
}

function resolvePendingPermission(allowed, ws, session, config, requestId) {
  return providerFor(session).resolvePendingPermission?.(allowed, ws, session, config, requestId) || false;
}

function stopAgentProcess(session, options = {}) {
  return providerFor(session).stop?.(session, options);
}

function warmupAgentProcess(ws, session, config) {
  return providerFor(session).warmup?.(ws, session, config) || Promise.resolve({ supported: false });
}

function compactAgentContext(ws, session, config, options = {}) {
  return providerFor(session).compact?.(ws, session, config, options) || false;
}

function switchAgentModel(ws, session, config, options = {}) {
  return providerFor(session).model?.(ws, session, config, options) || false;
}

function switchAgentReasoning(ws, session, config, options = {}) {
  return providerFor(session).reasoning?.(ws, session, config, options) || false;
}

function applyAgentSettings(ws, session, config, options = {}) {
  return providerFor(session).applySettings?.(ws, session, config, options) || false;
}

module.exports = {
  applyAgentSettings,
  compactAgentContext,
  executeAgentQuery,
  resolvePendingDanger,
  resolvePendingPermission,
  switchAgentReasoning,
  switchAgentModel,
  stopAgentProcess,
  warmupAgentProcess,
};
