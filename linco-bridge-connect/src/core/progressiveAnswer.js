const { send } = require('./protocol');

function resetProgressiveAnswer(session) {
  if (!session) return;
  session.pendingProgressText = '';
}

function appendProgressiveAnswerText(text, ws, session, appendFinalText) {
  if (!text || !session) return;
  session.pendingProgressText = `${session.pendingProgressText || ''}${text}`;
}

function promotePendingProgress(ws, session) {
  if (!session) return false;
  const text = String(session.pendingProgressText || '').trim();
  session.pendingProgressText = '';
  if (!text) return false;
  send(ws, 'thinking', { text, mode: 'progress' });
  return true;
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
