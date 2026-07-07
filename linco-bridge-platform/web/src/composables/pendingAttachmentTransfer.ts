import type { OutboundChatFile } from '@/api/session-api'

let pending: { sessionId: string; files: OutboundChatFile[] } | null = null

export function stashPendingFiles(sessionId: string, files: OutboundChatFile[]) {
  if (files.length === 0) return
  pending = { sessionId, files }
}

export function takePendingFiles(sessionId: string): OutboundChatFile[] {
  if (pending?.sessionId !== sessionId) return []
  const files = pending.files
  pending = null
  return files
}
