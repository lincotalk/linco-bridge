const BRIDGE_IDENTITY_PROMPT = [
  'You are running inside Linco Connect, a bridge that connects you to Linco IM.',
  'Your normal text responses are automatically delivered to the user. Reply normally, and do not use a separate send mechanism for ordinary text replies.',
].join('\n');

const BRIDGE_INPUT_HINT_MARKER = 'System note: You are running inside Linco Connect, a bridge that connects you to Linco IM.';

function buildBridgeIdentityPrompt() {
  return BRIDGE_IDENTITY_PROMPT;
}

function buildBridgeInputHint() {
  return [
    BRIDGE_INPUT_HINT_MARKER,
    'Your normal text responses are automatically delivered to the user. Reply normally, and do not use a separate send mechanism for ordinary text replies.',
  ].join('\n');
}

function buildFileDeliveryInstructions(session = {}) {
  return `If you need to deliver a generated file or image to the user, save it in the current workspace or the conversation runtime directory.

Return the file using this exact Markdown file reference format:
[filename.ext](absolute-local-path)

The link target must be the original local absolute path. Do not return bare file paths, relative paths, file:// URLs, download commands, or delivery implementation details.

Current workspace: ${session.workspace}
Conversation runtime directory: ${session.runtimeDir}
Attachment directory: ${session.attachmentsDir}

Use meaningful filenames. Do not reference sensitive files unless the user explicitly asks for them.`;
}

function buildAgentSystemPrompt(session = {}, config = {}, options = {}) {
  const agentType = session.agentType || options.agentType || 'claude';
  const instructions = config.agents?.[agentType]?.instructions || '';
  const includeFileDelivery = options.includeFileDelivery !== false;

  return [
    instructions,
    buildBridgeIdentityPrompt(),
    includeFileDelivery ? buildFileDeliveryInstructions(session) : '',
  ].filter(Boolean).join('\n\n');
}

function appendBridgeContextHint(input) {
  if (hasBridgeContextHint(input)) return input;
  const hint = buildBridgeInputHint();
  if (Array.isArray(input)) {
    return [...input, { type: 'text', text: hint }];
  }
  return `${String(input || '')}\n\n${hint}`;
}

function hasBridgeContextHint(input) {
  return extractText(input).includes('You are running inside Linco Connect');
}

function extractText(input) {
  if (!Array.isArray(input)) return String(input || '');
  return input
    .filter(block => block?.type === 'text' || typeof block === 'string')
    .map(block => typeof block === 'string' ? block : (block.text || ''))
    .join('\n');
}

module.exports = {
  appendBridgeContextHint,
  buildAgentSystemPrompt,
  buildBridgeIdentityPrompt,
  buildBridgeInputHint,
  buildFileDeliveryInstructions,
  _internal: {
    BRIDGE_INPUT_HINT_MARKER,
    hasBridgeContextHint,
  },
};
