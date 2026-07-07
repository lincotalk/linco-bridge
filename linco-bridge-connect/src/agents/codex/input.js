const {
  buildFileReferenceHint,
  buildImageGenerationDeliveryHint,
  _internal: fileReferenceInternals,
} = require('../../core/fileReferences');

function buildCodexDeliveryInput(input, session) {
  const text = stringifyInput(input);
  if (fileReferenceInternals.isImageGenerationRequest(text)) {
    return buildImageGenerationDeliveryHint(input, session);
  }
  return buildFileReferenceHint(input, session);
}

function buildCodexInput(input, workspace) {
  if (Array.isArray(input)) {
    const result = [];
    for (const block of input) {
      if (typeof block === 'string') {
        result.push({ type: 'text', text: block });
      } else if (block?.type === 'text') {
        result.push({ type: 'text', text: block.text || '' });
      } else if (block?.type === 'image' && block.path) {
        // Codex sandbox can only read from workspace — copy image into workspace
        const fs = require('fs');
        const path = require('path');
        const basename = path.basename(block.path);
        const copyDir = path.join(workspace, '_linco_attachments');
        const copyPath = path.join(copyDir, basename);
        try {
          fs.mkdirSync(copyDir, { recursive: true });
          fs.copyFileSync(block.path, copyPath);
        } catch {
          // If copy fails, fall back to original path
        }
        const mediaType = block.source?.media_type || '';
        result.push({ type: 'text', text: `用户发送了一张图片（${mediaType}），文件已保存到 ${copyPath}，请按需读取` });
      } else if (block?.type === 'image') {
        result.push({ type: 'text', text: '[图片附件]' });
      } else if (block?.type === 'meta') {
        continue;
      } else {
        result.push({ type: 'text', text: JSON.stringify(block) });
      }
    }
    return result;
  }
  return [{ type: 'text', text: String(input || '') }];
}

function stringifyInput(input) {
  if (Array.isArray(input)) {
    return input.map(block => {
      if (typeof block === 'string') return block;
      if (block?.type === 'text') return block.text || '';
      if (block?.type === 'meta') return '';
      if (block?.type === 'image') return '[图片附件：Codex 当前适配器暂不直接传入图片内容]';
      return JSON.stringify(block);
    }).filter(Boolean).join('\n');
  }
  return String(input || '');
}

module.exports = {
  buildCodexDeliveryInput,
  buildCodexInput,
  stringifyInput,
};
