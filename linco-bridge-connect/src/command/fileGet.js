const { buildOutboundFileMessage, resolveGetTarget, validateGetFile } = require('../core/fileReferences');
const { send, sendError } = require('../core/protocol');

function handleGet(rawTarget, ws, session, config) {
  const resolved = resolveGetTarget(rawTarget, session);
  if (!resolved) {
    sendError(ws, '用法：/get <文件路径>');
    return;
  }

  const validation = validateGetFile(resolved, session, config);
  if (!validation.ok) {
    sendError(ws, validation.message);
    return;
  }

  send(ws, 'outbound_message', buildOutboundFileMessage(session, validation.path, validation.size));
}

module.exports = {
  handleGet,
};
