import type { ChatMessage, ChatSessionItem } from '@/bridge/types'
import { apiGet, apiPost, getApiBaseUrl } from './http-client'

export async function fetchSessions(): Promise<ChatSessionItem[]> {
  const res = await apiGet<ChatSessionItem[]>('/api/sessions')
  if (!res.success || !res.data) {
    throw new Error(res.message || '加载会话失败')
  }
  return res.data
}

export async function fetchMessages(sessionId: string, limit?: number): Promise<ChatMessage[]> {
  const query = typeof limit === 'number' && limit > 0 ? `?limit=${limit}` : ''
  const res = await apiGet<ChatMessage[]>(`/api/sessions/${sessionId}/messages${query}`)
  if (!res.success || !res.data) {
    throw new Error(res.message || '加载消息失败')
  }
  return res.data
}

export async function sendSessionMessage(sessionId: string, content: string): Promise<ChatMessage> {
  const res = await apiPost<ChatMessage>(`/api/sessions/${sessionId}/messages`, { content })
  if (!res.success || !res.data) {
    throw new Error(res.message || '发送消息失败')
  }
  return res.data
}

export interface OutboundChatFile {
  name?: string
  mimeType?: string
  base64?: string
  url?: string
}

export interface BridgeCommandResult {
  command: string
  text: string
  payload?: Record<string, unknown>
  file?: {
    name: string
    mimeType?: string
    previewUrl?: string
    base64?: string
  }
}

export interface StreamChunkPayload {
  delta?: string
  fullText: string
}

export interface StreamMessageHandlers {
  onStart?: (payload: { streamId: string }) => void
  onUserMessage?: (message: ChatMessage) => void
  onChunk?: (payload: StreamChunkPayload) => void
  onDone?: (message: ChatMessage) => void
  onError?: (message: string) => void
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split('\n').filter(Boolean)
  let event = 'message'
  const dataLines: string[] = []
  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }
  if (dataLines.length === 0) return null
  return { event, data: dataLines.join('\n') }
}

export async function streamSessionMessage(
  sessionId: string,
  content: string,
  handlers: StreamMessageHandlers,
  signal?: AbortSignal,
  files: OutboundChatFile[] = [],
): Promise<ChatMessage> {
  const response = await fetch(`${getApiBaseUrl()}/api/sessions/${sessionId}/messages/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ content, files }),
    signal,
  })

  if (!response.ok || !response.body) {
    throw new Error(`流式发送失败 (${response.status})`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalMessage: ChatMessage | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''

    for (const block of blocks) {
      const parsed = parseSseBlock(block)
      if (!parsed) continue

      let payload: Record<string, unknown> = {}
      try {
        payload = JSON.parse(parsed.data) as Record<string, unknown>
      } catch {
        continue
      }

      switch (parsed.event) {
        case 'start':
          handlers.onStart?.({ streamId: String(payload.streamId ?? '') })
          break
        case 'user': {
          const message = payload.message as ChatMessage | undefined
          if (message) handlers.onUserMessage?.(message)
          break
        }
        case 'chunk':
          handlers.onChunk?.({
            delta: typeof payload.delta === 'string' ? payload.delta : '',
            fullText: typeof payload.fullText === 'string' ? payload.fullText : '',
          })
          break
        case 'done': {
          const message = payload.message as ChatMessage | undefined
          if (message) {
            finalMessage = message
            handlers.onDone?.(message)
          }
          break
        }
        case 'error':
          handlers.onError?.(typeof payload.message === 'string' ? payload.message : 'stream error')
          break
        default:
          break
      }
    }
  }

  if (!finalMessage) {
    throw new Error('流式响应未完成')
  }
  return finalMessage
}

export async function cancelStreamMessage(
  sessionId: string,
  streamId: string,
): Promise<ChatMessage | null> {
  const res = await apiPost<{ cancelled: boolean; message: ChatMessage | null }>(
    `/api/sessions/${sessionId}/messages/cancel`,
    { streamId },
  )
  if (!res.success) {
    throw new Error(res.message || '停止生成失败')
  }
  return res.data?.message ?? null
}

export async function runSessionBridgeCommand(
  sessionId: string,
  command: string,
): Promise<BridgeCommandResult> {
  const res = await apiPost<BridgeCommandResult>(`/api/sessions/${sessionId}/bridge-command`, {
    command,
  })
  if (!res.success || !res.data) {
    throw new Error(res.message || '命令执行失败')
  }
  return res.data
}

export async function runAgentBridgeCommand(
  agentType: string,
  command: string,
): Promise<BridgeCommandResult> {
  const res = await apiPost<BridgeCommandResult>(`/api/agent-chat/${agentType}/bridge-command`, {
    command,
  })
  if (!res.success || !res.data) {
    throw new Error(res.message || '命令执行失败')
  }
  return res.data
}
