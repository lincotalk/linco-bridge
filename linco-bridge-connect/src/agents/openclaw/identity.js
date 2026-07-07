const crypto = require('crypto');
const { saveSessionMetadata } = require('../../core/session');

function resolveOpenClawAgentId(input, session, agentConfig) {
  const messageAgentId = readInputMeta(input, 'openclawAgentId');
  if (session.openclawAgentId) return String(session.openclawAgentId).trim() || 'main';
  const agentId = String(messageAgentId || agentConfig.openclawAgentId || 'main').trim() || 'main';
  if (session) {
    session.openclawAgentId = agentId;
    if (session.runtimeDir) saveSessionMetadata(session);
  }
  return agentId;
}

function buildOpenClawSessionKey(agentId, session) {
  const safeAgentId = sanitizeKeyPart(agentId || 'main');
  const safeChatType = sanitizeKeyPart(session.linco?.chatType || 'direct');
  const safeSessionId = sanitizeKeyPart(session.storageId || session.id || crypto.randomUUID());
  return `agent:${safeAgentId}:linco:${safeChatType}:${safeSessionId}`;
}

function buildOpenClawSessionLabel(input, session) {
  const prefix = stripInternalOutboxHint(firstText(input)).replace(/\s+/g, ' ').trim().slice(0, 64) || `DDChat ${session.id}`;
  const suffix = crypto.randomUUID().slice(0, 8);
  return `${prefix} #${suffix}`.slice(0, 80);
}

function isSessionKeyForAgent(sessionKey, agentId) {
  const key = String(sessionKey || '');
  const safeAgentId = sanitizeKeyPart(agentId || 'main');
  return key.startsWith(`agent:${safeAgentId}:linco:`);
}

function firstText(input) {
  if (!Array.isArray(input)) return String(input || '');
  return input
    .filter(block => block?.type === 'text' || typeof block === 'string')
    .map(block => typeof block === 'string' ? block : (block.text || ''))
    .join('\n');
}

function stripInternalOutboxHint(text) {
  return String(text || '').split(/\n\s*系统提示：用户正在要求发送或获取文件\/图片。/)[0];
}

function sanitizeOpenClawErrorMessage(message) {
  return stripInternalOutboxHint(message).trim() || 'unknown error';
}

function readInputMeta(input, key) {
  if (Array.isArray(input)) {
    for (const block of input) {
      if (block && typeof block === 'object' && block[key]) return block[key];
      if (block?._lincoMeta?.[key]) return block._lincoMeta[key];
    }
    return '';
  }
  if (input && typeof input === 'object') {
    return input[key] || input._lincoMeta?.[key] || '';
  }
  return '';
}

function sanitizeKeyPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'main';
}

module.exports = {
  buildOpenClawSessionKey,
  buildOpenClawSessionLabel,
  firstText,
  isSessionKeyForAgent,
  readInputMeta,
  resolveOpenClawAgentId,
  sanitizeKeyPart,
  sanitizeOpenClawErrorMessage,
  stripInternalOutboxHint,
};
