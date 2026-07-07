const DEFAULT_CLAUDE_EFFORT = 'high';

const CLAUDE_MODEL_OPTIONS = [
  { name: 'sonnet', desc: 'Claude Sonnet (balanced)' },
  { name: 'opus', desc: 'Claude Opus (most capable)' },
  { name: 'opus[1m]', desc: 'Claude Opus (1M context)' },
  { name: 'haiku', desc: 'Claude Haiku (fastest)' },
];

const CLAUDE_EFFORT_OPTIONS = [
  { name: 'low', desc: 'Lowest reasoning effort' },
  { name: 'medium', desc: 'Balanced reasoning effort' },
  { name: 'high', desc: 'High reasoning effort' },
  { name: 'xhigh', desc: 'Extra-high reasoning effort' },
  { name: 'max', desc: 'Maximum reasoning effort' },
];

function currentClaudeModel(session, config) {
  return String(session?.claudeModelOverride || config?.agents?.claude?.model || '').trim();
}

function configuredClaudeEffort(config) {
  return String(config?.agents?.claude?.effort || '').trim();
}

function currentClaudeEffort(session, config) {
  return String(session?.claudeEffortOverride || configuredClaudeEffort(config)).trim();
}

function availableClaudeModels() {
  return CLAUDE_MODEL_OPTIONS.slice();
}

function availableClaudeEfforts() {
  return CLAUDE_EFFORT_OPTIONS.slice();
}

function resolveClaudeModelInput(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const models = availableClaudeModels();
  const index = Number.parseInt(raw, 10);
  if (String(index) === raw && index >= 1 && index <= models.length) return models[index - 1].name;
  const option = models.find(model => model.name.toLowerCase() === raw.toLowerCase());
  return option?.name || raw;
}

function resolveClaudeEffortInput(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return '';
  const normalized = raw.replace(/[\s_]+/g, '-');
  const effortName = normalized === 'extra-high' || normalized === 'extra' || normalized === 'x-high'
    ? 'xhigh'
    : normalized;
  const efforts = availableClaudeEfforts();
  const index = Number.parseInt(effortName, 10);
  if (String(index) === effortName && index >= 1 && index <= efforts.length) return efforts[index - 1].name;
  const option = efforts.find(effort => effort.name === effortName);
  return option?.name || effortName;
}

function isSupportedClaudeEffort(effort) {
  return availableClaudeEfforts().some(item => item.name === effort);
}

module.exports = {
  DEFAULT_CLAUDE_EFFORT,
  availableClaudeEfforts,
  availableClaudeModels,
  configuredClaudeEffort,
  currentClaudeEffort,
  currentClaudeModel,
  isSupportedClaudeEffort,
  resolveClaudeEffortInput,
  resolveClaudeModelInput,
};
