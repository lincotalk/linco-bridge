import type { ChatMessageAttachment } from '@/bridge/types'
import type { OutboundChatFile } from '@/api/session-api'

export function mapOutboundFilesToAttachments(files: OutboundChatFile[]): ChatMessageAttachment[] {
  return files.map((file) => {
    const name = file.name?.trim() || 'attachment'
    const mimeType = file.mimeType?.trim() || 'application/octet-stream'
    const previewUrl =
      file.base64 && mimeType.startsWith('image/')
        ? `data:${mimeType};base64,${file.base64}`
        : file.url
    return { name, mimeType, previewUrl }
  })
}

export function isImageAttachment(attachment: ChatMessageAttachment): boolean {
  const mime = attachment.mimeType?.toLowerCase() ?? ''
  return mime.startsWith('image/') || Boolean(attachment.previewUrl?.startsWith('data:image/'))
}
