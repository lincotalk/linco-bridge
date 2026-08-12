function resetProgressiveAnswer(session) {
  if (!session) return;
  session.pendingProgressText = '';
}

function appendProgressiveAnswerText(text, ws, session, appendFinalText) {
  if (!text || !session) return;
  session.pendingProgressText = `${session.pendingProgressText || ''}${text}`;
}

function promotePendingProgress(_ws, session) {
  // Progress body already went out as ephemeral assistant_chunk / stream_chunk.
  // Do not dual-emit the same text as thinking mode=progress.
  if (!session) return false;
  const had = Boolean(String(session.pendingProgressText || '').trim());
  session.pendingProgressText = '';
  return had;
}

function flushPendingAnswerText(ws, session, appendFinalText) {
  if (!session) return false;
  const text = session.pendingProgressText || '';
  session.pendingProgressText = '';
  if (!text) return false;
  appendFinalText(text, ws, session);
  return true;
}

function hasPendingAnswerText(session) {
  return Boolean(session?.pendingProgressText);
}

module.exports = {
  appendProgressiveAnswerText,
  flushPendingAnswerText,
  hasPendingAnswerText,
  promotePendingProgress,
  resetProgressiveAnswer,
};
