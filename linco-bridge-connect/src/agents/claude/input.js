const { buildFileReferenceHint } = require('../../core/fileReferences');

function buildClaudePayload(input, session) {
  const cleanInput = stripMetaBlocks(input);
  return {
    type: 'user',
    message: {
      role: 'user',
      content: buildFileReferenceHint(cleanInput, session),
    },
  };
}

function buildClaudeSlashPayload(command) {
  return {
    type: 'user',
    message: {
      role: 'user',
      content: command,
    },
  };
}

function stripMetaBlocks(input) {
  if (!Array.isArray(input)) return input;
  return input.filter(block => block?.type !== 'meta');
}

function extractText(input) {
  if (!Array.isArray(input)) return String(input || '');
  return input
    .filter(block => block?.type === 'text')
    .map(block => block.text || '')
    .join('\n');
}

module.exports = {
  buildClaudePayload,
  buildClaudeSlashPayload,
  extractText,
  stripMetaBlocks,
};
