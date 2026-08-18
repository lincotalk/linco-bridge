const { buildOutboundFileMessages, resolveGetTarget, validateGetFile } = require('../core/fileReferences');
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

  try {
    const messages = buildOutboundFileMessages(
      session,
      validation.path,
      validation.size,
      { readPath: validation.readPath },
    );
    for (const message of messages) {
      send(ws, 'outbound_message', message);
    }
  } catch (err) {
    sendError(
      ws,
      err?.code === 'file_too_large'
        ? err.message
        : `读取文件失败：${resolved}`,
    );
  }
}

module.exports = {
  handleGet,
};
