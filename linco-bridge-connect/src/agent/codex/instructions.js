const { buildAgentSystemPrompt } = require('../../core/agentPrompt');

function buildCodexBridgeInstructions(session = {}, config = {}) {
  return buildAgentSystemPrompt(
    { ...session, agentType: 'codex' },
    config,
    { agentType: 'codex' },
  );
}

function appendCodexFallbackInstructions(input, session = {}, config = {}) {
  const instructions = buildCodexBridgeInstructions(session, config);
  if (!instructions || containsBridgeInstructions(input)) return input;
  if (Array.isArray(input)) {
    return [...input, { type: 'text', text: instructions }];
  }
  return `${String(input || '')}\n\n${instructions}`;
}

function extractCodexDeveloperInstructions(payload = {}) {
  const candidates = [
    payload.developerInstructions,
    payload.developer_instructions,
    payload.config?.developerInstructions,
    payload.config?.developer_instructions,
    payload.effectiveConfig?.developerInstructions,
    payload.effectiveConfig?.developer_instructions,
    payload.settings?.developerInstructions,
    payload.settings?.developer_instructions,
    payload.instructions?.developer,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return '';
}

function mergeCodexDeveloperInstructions(existing = '', bridge = '') {
  const current = String(existing || '').trim();
  const extra = String(bridge || '').trim();
  if (!current) return extra;
  if (!extra || current.includes('You are running inside Linco Connect')) return current;
  return `${current}\n\n${extra}`;
}

function containsBridgeInstructions(input) {
  if (!Array.isArray(input)) {
    return String(input || '').includes('You are running inside Linco Connect');
  }
  return input.some(block => {
    if (typeof block === 'string') return block.includes('You are running inside Linco Connect');
    return typeof block?.text === 'string' && block.text.includes('You are running inside Linco Connect');
  });
}

module.exports = {
  appendCodexFallbackInstructions,
  buildCodexBridgeInstructions,
  extractCodexDeveloperInstructions,
  mergeCodexDeveloperInstructions,
};
