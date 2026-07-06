const DEFAULT_PREVIEW_CHARS = 80;

function normalizePreviewText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function textPreview(value, maxChars = DEFAULT_PREVIEW_CHARS) {
  const text = normalizePreviewText(value);
  if (text.length <= maxChars) {
    return { preview: text, chars: text.length, truncated: false };
  }
  return {
    preview: text.slice(0, maxChars),
    chars: text.length,
    truncated: true,
  };
}

function extractText(input) {
  if (!Array.isArray(input)) return String(input || '');
  return input
    .filter(block => block?.type === 'text')
    .map(block => block.text || '')
    .join('\n');
}

function logUserInput(config, session, fields = {}) {
  const logger = config?.logger || session?._conversationLogger;
  if (!logger || !session) return;

  const text = fields.text != null ? fields.text : extractText(fields.input);
  const preview = textPreview(text);
  session._conversationLogger = logger;
  logger.info('conversation user input', {
    direction: 'input',
    sessionId: session.id,
    agentType: session.agentType,
    source: fields.source,
    chars: String(text || '').length,
    preview: preview.preview,
    truncated: preview.truncated,
    attachments: fields.attachments,
  });
}

function startAssistantReplyLog(session, config, fields = {}) {
  if (!session) return;
  session._conversationLogger = config?.logger || session._conversationLogger;
  session._assistantReplyLog = {
    agentType: fields.agentType || session.agentType,
    source: fields.source,
    chars: 0,
    rawPreview: '',
  };
}

function captureAssistantReplyText(session, text) {
  const state = session?._assistantReplyLog;
  if (!state || !text) return;

  const delta = String(text);
  state.chars += delta.length;
  if (state.rawPreview.length < DEFAULT_PREVIEW_CHARS * 2) {
    state.rawPreview = `${state.rawPreview}${delta}`.slice(0, DEFAULT_PREVIEW_CHARS * 2);
  }
}

function logAssistantReply(session, reason = 'completed', fields = {}) {
  const state = session?._assistantReplyLog;
  const logger = session?._conversationLogger;
  if (!state || !logger) return;

  const preview = textPreview(state.rawPreview);
  logger.info('conversation assistant reply', {
    direction: 'output',
    sessionId: session.id,
    agentType: state.agentType || session.agentType,
    reason,
    chars: state.chars,
    preview: preview.preview,
    truncated: state.chars > preview.preview.length || preview.truncated,
    requestId: fields.requestId,
    streamId: fields.streamId,
  });
  session._assistantReplyLog = null;
}

module.exports = {
  captureAssistantReplyText,
  extractText,
  logAssistantReply,
  logUserInput,
  startAssistantReplyLog,
  textPreview,
};
