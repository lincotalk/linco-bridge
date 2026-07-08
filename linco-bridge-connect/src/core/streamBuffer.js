const { send } = require('./protocol');

const STREAM_FLUSH_INTERVAL = 100;
const STREAM_FLUSH_TEXT_THRESHOLD = 24;

function createTextStreamBuffer({ onStart } = {}) {
  return {
    assistantStarted: false,
    pendingText: '',
    pendingMeta: null,
    flushTimer: null,
    lastFlushAt: 0,
    onStart,
  };
}

function appendTextStream(text, ws, state, meta = {}) {
  if (!state) return;

  if (!state.assistantStarted) {
    state.onStart?.(ws);
    state.assistantStarted = true;
  }

  if (state.pendingText && !sameStreamMeta(state.pendingMeta, meta)) {
    flushTextStream(ws, state);
  }

  state.pendingMeta = streamMeta(meta);
  state.pendingText += text;

  if (state.pendingText.length >= STREAM_FLUSH_TEXT_THRESHOLD) {
    flushTextStream(ws, state);
    return;
  }

  if (!state.flushTimer) {
    state.flushTimer = setTimeout(() => {
      state.flushTimer = null;
      flushTextStream(ws, state);
    }, STREAM_FLUSH_INTERVAL);
  }
}

function flushTextStream(ws, state) {
  if (!state) return;

  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
    state.flushTimer = null;
  }

  if (!state.pendingText) return;
  if (ws) send(ws, 'assistant_chunk', { text: state.pendingText, ...streamMeta(state.pendingMeta) });
  state.pendingText = '';
  state.pendingMeta = null;
  state.lastFlushAt = Date.now();
}

function resetTextStream(state) {
  if (!state) return;

  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
  }

  state.assistantStarted = false;
  state.pendingText = '';
  state.pendingMeta = null;
  state.flushTimer = null;
  state.lastFlushAt = 0;
}

function streamMeta(meta = {}) {
  meta = meta || {};
  const payload = {};
  if (meta.phase === 'progress') payload.phase = meta.phase;
  if (meta.ephemeral === true) payload.ephemeral = meta.ephemeral;
  if (meta.replacePrevious === true) payload.replacePrevious = meta.replacePrevious;
  return payload;
}

function sameStreamMeta(left = {}, right = {}) {
  const a = streamMeta(left);
  const b = streamMeta(right);
  return (
    a.phase === b.phase &&
    a.ephemeral === b.ephemeral &&
    a.replacePrevious === b.replacePrevious
  );
}

module.exports = {
  STREAM_FLUSH_INTERVAL,
  STREAM_FLUSH_TEXT_THRESHOLD,
  appendTextStream,
  createTextStreamBuffer,
  flushTextStream,
  resetTextStream,
};
