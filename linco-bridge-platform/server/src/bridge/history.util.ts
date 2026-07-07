import { randomUUID } from 'node:crypto'

export interface HistoryMessageDto {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  attachments?: ChatMessageAttachmentDto[]
}

export interface ChatMessageAttachmentDto {
  name: string
  mimeType?: string
  previewUrl?: string
}

export interface HistoryFilePayload {
  name?: string
  mimeType?: string
  type?: string
  url?: string
  base64?: string
  mediaUrl?: string
  mediaBase64?: string
  mediaName?: string
  mediaType?: string
}

export interface HistoryRoundPayload {
  index?: number
  timestampMs?: number | null
  user?: { text?: string; timestampMs?: number | null; files?: HistoryFilePayload[] }
  assistant?: { text?: string; timestampMs?: number | null; files?: HistoryFilePayload[] }
}

export interface HistoryReloadPayload {
  version?: number
  agentType?: string
  agentSessionId?: string
  replaceConversation?: boolean
  returnedRounds?: number
  rounds?: HistoryRoundPayload[]
}

export function parseHistoryReloadPayload(data: unknown): HistoryReloadPayload | null {
  if (!data || typeof data !== 'object') return null
  return data as HistoryReloadPayload
}

export function mapHistoryFilesToAttachments(files: HistoryFilePayload[]): ChatMessageAttachmentDto[] {
  const attachments: ChatMessageAttachmentDto[] = []
  for (const file of files) {
    const name = (file.name || file.mediaName || 'attachment').trim()
    const mimeType = (file.mimeType || file.type || file.mediaType || 'application/octet-stream').trim()
    const base64 = (file.base64 || file.mediaBase64 || '').trim()
    const url = (file.url || file.mediaUrl || '').trim()
    const previewUrl =
      base64 && mimeType.startsWith('image/')
        ? `data:${mimeType};base64,${base64}`
        : url || undefined
    if (!previewUrl && !name) continue
    attachments.push({ name, mimeType, previewUrl })
  }
  return attachments
}

function buildHistoryContent(text: string, attachments: ChatMessageAttachmentDto[]): string {
  const trimmed = text.trim()
  if (trimmed) return trimmed
  if (attachments.length > 0) return `[${attachments.length} 个附件]`
  return ''
}

export function roundsToMessages(sessionId: string, payload: HistoryReloadPayload): HistoryMessageDto[] {
  const rounds = Array.isArray(payload.rounds) ? payload.rounds : []
  const messages: HistoryMessageDto[] = []

  for (const round of rounds) {
    const index = typeof round.index === 'number' ? round.index : messages.length + 1
    const userText = round.user?.text?.trim() ?? ''
    const assistantText = round.assistant?.text?.trim() ?? ''
    const userAttachments = mapHistoryFilesToAttachments(
      Array.isArray(round.user?.files) ? round.user.files : [],
    )
    const assistantAttachments = mapHistoryFilesToAttachments(
      Array.isArray(round.assistant?.files) ? round.assistant.files : [],
    )
    const baseTs =
      typeof round.timestampMs === 'number' && round.timestampMs > 0
        ? round.timestampMs
        : Date.now()

    const userContent = buildHistoryContent(userText, userAttachments)
    if (userContent || userAttachments.length > 0) {
      const createdAt =
        typeof round.user?.timestampMs === 'number' && round.user.timestampMs > 0
          ? round.user.timestampMs
          : baseTs
      messages.push({
        id: `${sessionId}-history-u-${index}`,
        sessionId,
        role: 'user',
        content: userContent,
        createdAt,
        attachments: userAttachments.length > 0 ? userAttachments : undefined,
      })
    }

    const assistantContent = buildHistoryContent(assistantText, assistantAttachments)
    if (assistantContent || assistantAttachments.length > 0) {
      const createdAt =
        typeof round.assistant?.timestampMs === 'number' && round.assistant.timestampMs > 0
          ? round.assistant.timestampMs
          : baseTs + 1
      messages.push({
        id: `${sessionId}-history-a-${index}`,
        sessionId,
        role: 'assistant',
        content: assistantContent,
        createdAt,
        attachments: assistantAttachments.length > 0 ? assistantAttachments : undefined,
      })
    }
  }

  return messages
}

export function createEphemeralMessage(
  sessionId: string,
  role: HistoryMessageDto['role'],
  content: string,
  attachments: ChatMessageAttachmentDto[] = [],
): HistoryMessageDto {
  return {
    id: randomUUID(),
    sessionId,
    role,
    content,
    createdAt: Date.now(),
    attachments: attachments.length > 0 ? attachments : undefined,
  }
}
