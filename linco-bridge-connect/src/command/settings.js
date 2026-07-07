const { unquoteProjectPath } = require('./args');
const { normalizeReasoningEffortInput } = require('./reasoning');

const GET_MODELS_AND_REASONS_COMMAND = 'getModelsAndReasons';

function isGetModelsAndReasonsCommand(text) {
  return String(text || '').trim().toLowerCase() === GET_MODELS_AND_REASONS_COMMAND.toLowerCase();
}

function parseSettingsArgs(rawArg) {
  const trimmed = String(rawArg || '').trim();
  if (!trimmed) return { mode: 'list' };
  if (!/^apply\b/i.test(trimmed)) return { mode: 'list' };

  const rest = trimmed.replace(/^apply\b/i, '').trim();
  let reasoningEffort = '';
  let modelId = '';

  const flagPattern = /--(reasoning|effort|model)\s+("(?:\\.|[^"])*"|[^\s-][^\s]*)/gi;
  let match;
  while ((match = flagPattern.exec(rest)) !== null) {
    const key = String(match[1] || '').toLowerCase();
    const value = unquoteProjectPath(match[2] || '').trim();
    if (!value) continue;
    if (key === 'model') modelId = value;
    if (key === 'reasoning' || key === 'effort') {
      reasoningEffort = normalizeReasoningEffortInput(value);
    }
  }

  return {
    mode: 'apply',
    reasoningEffort,
    modelId,
  };
}

function validateSettingsApplyArgs(args) {
  const reasoningEffort = String(args?.reasoningEffort || '').trim();
  const modelId = String(args?.modelId || '').trim();
  if (!reasoningEffort && !modelId) {
    return {
      ok: false,
      message: 'Please specify at least one of --reasoning or --model, for example /settings apply --reasoning high --model gpt-5.5.',
    };
  }
  if (reasoningEffort && (/[\x00-\x1F\x7F]/.test(reasoningEffort) || reasoningEffort.length > 40)) {
    return { ok: false, message: 'Reasoning effort is invalid.' };
  }
  if (modelId && (/[\x00-\x1F\x7F]/.test(modelId) || modelId.length > 120)) {
    return { ok: false, message: 'Model name is invalid.' };
  }
  return { ok: true };
}

module.exports = {
  GET_MODELS_AND_REASONS_COMMAND,
  isGetModelsAndReasonsCommand,
  parseSettingsArgs,
  validateSettingsApplyArgs,
};
