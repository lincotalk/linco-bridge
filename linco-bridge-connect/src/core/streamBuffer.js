const { send } = require('./protocol');

const STREAM_FLUSH_INTERVAL = 100;
const STREAM_FLUSH_TEXT_THRESHOLD = 24;

function createTextStreamBuffer({ onStart } = {}) {
  return {
    assistantStarted: false,
    pendingText: '',
    flushTimer: null,
    lastFlushAt: 0,
    onStart,
  };
}

function appendTextStream(text, ws, state) {
  if (!state) return;

  if (!state.assistantStarted) {
    state.onStart?.(ws);
    state.assistantStarted = true;
  }

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
  if (ws) send(ws, 'assistant_chunk', { text: state.pendingText });
  state.pendingText = '';
  state.lastFlushAt = Date.now();
}

function resetTextStream(state) {
  if (!state) return;

  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
  }

  state.assistantStarted = false;
  state.pendingText = '';
  state.flushTimer = null;
  state.lastFlushAt = 0;
}

module.exports = {
  STREAM_FLUSH_INTERVAL,
  STREAM_FLUSH_TEXT_THRESHOLD,
  appendTextStream,
  createTextStreamBuffer,
  flushTextStream,
  resetTextStream,
};
