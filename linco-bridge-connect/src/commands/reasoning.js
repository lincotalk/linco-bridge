const { unquoteProjectPath } = require('./args');

function parseReasoningArgs(rawArg) {
  const trimmed = String(rawArg || '').trim();
  if (!trimmed) return { mode: 'list' };
  if (trimmed === 'status') return { mode: 'show' };
  if (trimmed === '--list' || trimmed === 'list') return { mode: 'list' };
  if (trimmed === '--clear' || trimmed === 'clear') return { mode: 'clear' };
  const switchMatch = trimmed.match(/^switch(?:\s+(.+))?$/s);
  if (switchMatch) return { mode: 'set', effort: normalizeReasoningEffortInput(unquoteProjectPath(switchMatch[1] || '')) };
  const selectMatch = trimmed.match(/^--select(?:\s+(.+))?$/s);
  if (selectMatch) return { mode: 'set', effort: normalizeReasoningEffortInput(unquoteProjectPath(selectMatch[1] || '')) };
  return { mode: 'set', effort: normalizeReasoningEffortInput(unquoteProjectPath(trimmed)) };
}

function normalizeReasoningEffortInput(input) {
  const raw = String(input || '').trim().toLowerCase();
  const normalized = raw.replace(/[\s_]+/g, '-');
  if (normalized === 'extra-high' || normalized === 'extra' || normalized === 'x-high' || normalized === 'xhigh') return 'xhigh';
  return normalized;
}

function validateReasoningEffort(effort) {
  if (!effort) return { ok: false, message: 'Please specify a reasoning effort, for example /reasoning high.' };
  if (/[\x00-\x1F\x7F]/.test(effort)) return { ok: false, message: 'Reasoning effort cannot contain control characters.' };
  if (effort.length > 40) return { ok: false, message: 'Reasoning effort is too long.' };
  return { ok: true };
}

module.exports = {
  normalizeReasoningEffortInput,
  parseReasoningArgs,
  validateReasoningEffort,
};
