const claude = require('../agent/claude');
const codex = require('../agent/codex');
const deepseek = require('../agent/deepseek');
const hermes = require('../agent/hermes');
const openclaw = require('../agent/openclaw');

const providers = {
  claude,
  codex,
  deepseek,
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

function listAgentProjects(session, config) {
  return providerFor(session).listProjects?.(session, config) || Promise.resolve([]);
}

function listAgentProjectSessions(session, config, options = {}) {
  return providerFor(session).listProjectSessions?.(session, config, options) || Promise.resolve([]);
}

function findAgentProjectSession(session, config, options = {}) {
  return providerFor(session).findProjectSession?.(session, config, options) || Promise.resolve(null);
}

function readAgentSessionHistory(session, config, options = {}) {
  return providerFor(session).readSessionHistory?.(session, config, options) || Promise.resolve({ rounds: [] });
}

module.exports = {
  applyAgentSettings,
  compactAgentContext,
  executeAgentQuery,
  findAgentProjectSession,
  listAgentProjectSessions,
  listAgentProjects,
  readAgentSessionHistory,
  resolvePendingDanger,
  resolvePendingPermission,
  switchAgentReasoning,
  switchAgentModel,
  stopAgentProcess,
  warmupAgentProcess,
};
