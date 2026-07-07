const { pruneUndefined } = require('./messages');

function lincoFilesToAttachments(files) {
  if (!Array.isArray(files)) return [];
  return files.map((file) => ({
    name: file?.name || file?.mediaName || 'attachment',
    mimeType: file?.type || file?.mimeType || file?.mediaType || '',
    base64: file?.base64 || file?.mediaBase64 || '',
    url: file?.url || file?.mediaUrl || '',
  }));
}

function normalizeLincoFiles(msg = {}) {
  const files = Array.isArray(msg.files) ? [...msg.files] : [];
  if (msg.mediaUrl || msg.mediaBase64) {
    files.push({
      mediaName: msg.mediaName,
      mediaType: msg.mediaType,
      mediaUrl: msg.mediaUrl,
      mediaBase64: msg.mediaBase64,
    });
  }
  return files;
}

function normalizeOutboundFiles(payload = {}) {
  const files = Array.isArray(payload.files) ? [...payload.files] : [];
  if (payload.mediaUrl || payload.mediaBase64) {
    files.push(pruneUndefined({
      name: payload.mediaName,
      type: payload.mediaType,
      mimeType: payload.mediaType,
      url: payload.mediaUrl,
      base64: payload.mediaBase64,
      mediaUrl: payload.mediaUrl,
      mediaBase64: payload.mediaBase64,
    }));
  }
  return files;
}

module.exports = {
  lincoFilesToAttachments,
  normalizeLincoFiles,
  normalizeOutboundFiles,
};
