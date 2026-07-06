const { unquoteProjectPath } = require('./args');

function currentModel(session, config = {}) {
  const agentType = session?.agentType || 'claude';
  if (agentType === 'codex' && session?.codexModelOverride) return String(session.codexModelOverride).trim();
  if (agentType === 'claude' && session?.claudeModelOverride) return String(session.claudeModelOverride).trim();
  if (agentType === 'openclaw' && session?.openclawModelOverride) return String(session.openclawModelOverride).trim();
  if (agentType === 'hermes' && session?.hermesModelOverride) return String(session.hermesModelOverride).trim();
  return String(config?.agents?.[agentType]?.model || '').trim();
}

function parseModelArgs(rawArg) {
  const trimmed = String(rawArg || '').trim();
  if (!trimmed) return { mode: 'list' };
  if (trimmed === 'status') return { mode: 'show' };
  if (trimmed === '--list' || trimmed === 'list') return { mode: 'list' };
  if (trimmed === '--clear' || trimmed === 'clear') return { mode: 'clear' };
  const switchMatch = trimmed.match(/^switch(?:\s+(.+))?$/s);
  if (switchMatch) return { mode: 'set', model: unquoteProjectPath(switchMatch[1] || '') };
  const selectMatch = trimmed.match(/^--select(?:\s+(.+))?$/s);
  if (selectMatch) return { mode: 'set', model: unquoteProjectPath(selectMatch[1] || '') };
  return { mode: 'set', model: unquoteProjectPath(trimmed) };
}

function validateModelName(model) {
  if (!model) return { ok: false, message: 'Please specify a model, for example /model sonnet or /model gpt-5-codex.' };
  if (/[\x00-\x1F\x7F]/.test(model)) return { ok: false, message: 'Model name cannot contain control characters.' };
  if (model.length > 120) return { ok: false, message: 'Model name is too long.' };
  return { ok: true };
}

module.exports = {
  currentModel,
  parseModelArgs,
  validateModelName,
};
