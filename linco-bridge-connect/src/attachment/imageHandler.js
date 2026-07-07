const fs = require('fs');
const path = require('path');
const { ensureDir } = require('../config');
const { sendError, sendSystem } = require('../core/protocol');

function handleImageMessage(msg, ws, session, executeAgentQuery) {
  const { base64, mimeType, text } = msg;
  if (!base64) {
    sendError(ws, '❌ 图片数据为空');
    return;
  }

  const ext = mimeType?.split('/')[1] || 'png';
  const imgFile = path.join(session.attachmentsDir, `.upload_${Date.now()}.${ext}`);
  let imageSize = 0;

  try {
    ensureDir(session.attachmentsDir);
    const buffer = Buffer.from(base64, 'base64');
    imageSize = buffer.length;
    fs.writeFileSync(imgFile, buffer);
  } catch (err) {
    sendError(ws, `❌ 保存图片失败: ${err.message}`);
    return;
  }

  sendSystem(ws, `🖼️ 图片已接收 (${(imageSize / 1024).toFixed(1)} KB)`);

  const prompt = text || '请用中文描述这张图片的内容。';
  executeAgentQuery([
    { type: 'text', text: `请始终使用中文直接回答用户。不要描述你的内部工具调用、执行步骤或实现细节，除非用户明确询问。\n\n用户请求：\n${prompt}` },
    { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/png', data: base64 } }
  ], ws, session);
}

module.exports = {
  handleImageMessage,
};
