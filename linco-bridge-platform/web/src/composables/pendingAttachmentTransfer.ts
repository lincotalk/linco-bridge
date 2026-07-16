import type { OutboundChatFile } from '@/api/session-api'
import { cloneOutboundFiles } from '@/utils/chat-attachments'

let pending: { sessionId: string; files: OutboundChatFile[] } | null = null

export function stashPendingFiles(sessionId: string, files: OutboundChatFile[]) {
  const snapshot = cloneOutboundFiles(files)
  if (snapshot.length === 0) return
  pending = { sessionId, files: snapshot }
}

export function takePendingFiles(sessionId: string): OutboundChatFile[] {
  if (pending?.sessionId !== sessionId) return []
  const files = pending.files
  pending = null
  return files
}
