import type { ChatMessageAttachment } from '@/bridge/types'
import type { OutboundChatFile } from '@/api/session-api'

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|heic)$/i

/** 微信 chooseMessageFile 的 type 是 image/video/file，不是 MIME。 */
export function normalizeAttachmentMimeType(
  name: string,
  typeHint?: string,
  fallback = 'application/octet-stream',
): string {
  const hint = typeHint?.trim().toLowerCase() ?? ''
  if (hint.includes('/')) {
    return hint
  }
  if (hint === 'image') {
    return guessMimeType(name, 'image/jpeg')
  }
  if (hint === 'video') {
    return guessMimeType(name, 'video/mp4')
  }
  return guessMimeType(name, fallback)
}

export function guessMimeType(name: string, fallback = 'application/octet-stream'): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.bmp')) return 'image/bmp'
  if (lower.endsWith('.heic')) return 'image/heic'
  if (lower.endsWith('.mp4')) return 'video/mp4'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.txt')) return 'text/plain'
  return fallback
}

export function isImageMimeType(mimeType?: string): boolean {
  const mime = mimeType?.trim().toLowerCase() ?? ''
  return mime.startsWith('image/') || mime === 'image'
}

export function isImageAttachment(attachment: ChatMessageAttachment): boolean {
  if (isImageMimeType(attachment.mimeType)) return true
  if (attachment.previewUrl?.startsWith('data:image/')) return true
  if (attachment.previewUrl && IMAGE_EXT_RE.test(attachment.previewUrl)) return true
  return IMAGE_EXT_RE.test(attachment.name ?? '')
}

export function mapOutboundFilesToAttachments(files: OutboundChatFile[]): ChatMessageAttachment[] {
  return files.map((file) => {
    const name = file.name?.trim() || 'attachment'
    const mimeType = normalizeAttachmentMimeType(name, file.mimeType)
    // 小程序 <image> 对 data: URL 支持差，优先用本地临时路径预览
    const previewUrl =
      file.localPath?.trim() ||
      (file.base64 && isImageMimeType(mimeType) ? `data:${mimeType};base64,${file.base64}` : undefined) ||
      file.url
    return { name, mimeType, previewUrl }
  })
}

/** 发给服务端时去掉仅本地使用的字段 */
export function toApiOutboundFiles(files: OutboundChatFile[]): OutboundChatFile[] {
  return files.map((file) => {
    const name = file.name?.trim() || 'attachment'
    return {
      name,
      mimeType: normalizeAttachmentMimeType(name, file.mimeType),
      base64: file.base64,
      url: file.url,
    }
  })
}
