const CODEX_HOST_DIRECTIVE_NAMES = [
  'git-stage',
  'git-commit',
  'git-push',
  'git-create-branch',
  'git-create-pr',
  'code-comment',
];

const CODEX_HOST_DIRECTIVE_LINE = new RegExp(
  `^[ \\t]{0,3}::(?:${CODEX_HOST_DIRECTIVE_NAMES.join('|')})\\{.*\\}[ \\t]*$`,
);

function createCodexHostDirectiveStreamState() {
  return { pending: '', pendingSeparator: '', inFence: false };
}

function filterCodexHostDirectiveChunk(state, value) {
  const streamState = state || createCodexHostDirectiveStreamState();
  const combined = `${streamState.pending || ''}${String(value || '')}`;
  streamState.pending = '';
  if (!combined) return '';

  const parts = combined.split(/(\r\n|\n|\r)/);
  let output = '';
  let index = 0;
  while (index + 1 < parts.length) {
    const line = parts[index];
    const newline = parts[index + 1];
    if (streamState.inFence || !isCodexHostDirectiveLine(line)) {
      output += `${streamState.pendingSeparator || ''}${line}${newline}`;
      streamState.pendingSeparator = '';
    } else {
      streamState.pendingSeparator = '';
    }
    if (isMarkdownFenceLine(line)) {
      streamState.inFence = !streamState.inFence;
    }
    index += 2;
  }

  const tail = parts[index] || '';
  if (!streamState.inFence && isPotentialCodexHostDirectiveLine(tail)) {
    const separatorMatch = output.match(/(?:\r\n|\n|\r)[ \t]*(?:(?:\r\n|\n|\r)[ \t]*)*$/);
    if (separatorMatch) {
      streamState.pendingSeparator = separatorMatch[0];
      output = output.substring(0, output.length - separatorMatch[0].length);
    }
    streamState.pending = tail;
  } else {
    output += `${streamState.pendingSeparator || ''}${tail}`;
    streamState.pendingSeparator = '';
  }
  return output;
}

function flushCodexHostDirectiveStream(state) {
  if (!state?.pending) return '';
  const pending = state.pending;
  state.pending = '';
  if (!state.inFence && isCodexHostDirectiveLine(pending)) {
    state.pendingSeparator = '';
    return '';
  }
  const output = `${state.pendingSeparator || ''}${pending}`;
  state.pendingSeparator = '';
  return output;
}

function resetCodexHostDirectiveStream(state) {
  if (!state) return;
  state.pending = '';
  state.pendingSeparator = '';
  state.inFence = false;
}

function sanitizeCodexHostDirectives(value) {
  const state = createCodexHostDirectiveStreamState();
  return `${filterCodexHostDirectiveChunk(state, value)}${flushCodexHostDirectiveStream(state)}`.trim();
}

function isCodexHostDirectiveLine(line) {
  return CODEX_HOST_DIRECTIVE_LINE.test(String(line || ''));
}

function isPotentialCodexHostDirectiveLine(line) {
  const value = String(line || '');
  const match = value.match(/^[ \t]{0,3}(.*)$/);
  if (!match) return false;
  const candidate = match[1];
  if (!candidate.startsWith(':')) return false;
  if (candidate === ':') return true;
  if (!candidate.startsWith('::')) return false;

  const body = candidate.substring(2);
  const braceIndex = body.indexOf('{');
  const name = braceIndex >= 0 ? body.substring(0, braceIndex) : body;
  if (!CODEX_HOST_DIRECTIVE_NAMES.some(item => item.startsWith(name))) {
    return false;
  }
  if (braceIndex < 0) return true;
  return CODEX_HOST_DIRECTIVE_NAMES.includes(name);
}

function isMarkdownFenceLine(line) {
  return /^[ \t]{0,3}(```+|~~~+)/.test(String(line || ''));
}

module.exports = {
  createCodexHostDirectiveStreamState,
  filterCodexHostDirectiveChunk,
  flushCodexHostDirectiveStream,
  isCodexHostDirectiveLine,
  resetCodexHostDirectiveStream,
  sanitizeCodexHostDirectives,
};
