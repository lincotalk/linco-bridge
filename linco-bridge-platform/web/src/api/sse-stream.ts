import type { ChatMessage, ChatMessageAttachment, AgentTrace } from '@/bridge/types'

export interface StreamChunkPayload {
  delta?: string
  fullText: string
  phase?: string
  ephemeral?: boolean
  replacePrevious?: boolean
}

export interface StreamReasoningPayload {
  delta?: string
  fullText: string
}

export interface StreamMessageHandlers {
  onStart?: (payload: { streamId: string }) => void
  onUserMessage?: (message: ChatMessage) => void
  onChunk?: (payload: StreamChunkPayload) => void
  onReasoning?: (payload: StreamReasoningPayload) => void
  onReasoningEnd?: () => void
  onReasoningClear?: () => void
  onAgentTrace?: (trace: AgentTrace) => void
  onAttachment?: (attachment: ChatMessageAttachment) => void
  onDone?: (message: ChatMessage) => void
  onError?: (message: string) => void
}

export function parseSseBlock(block: string): { event: string; data: string } | null {
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

export function decodeChunkData(data: string | ArrayBuffer): string {
  if (typeof data === 'string') return data
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(data)
  }
  const bytes = new Uint8Array(data)
  let result = ''
  for (const byte of bytes) {
    result += String.fromCharCode(byte)
  }
  try {
    return decodeURIComponent(escape(result))
  } catch {
    return result
  }
}

export function dispatchSseBlock(
  block: string,
  handlers: StreamMessageHandlers,
  onFinalMessage?: (message: ChatMessage) => void,
): void {
  const parsed = parseSseBlock(block)
  if (!parsed) return

  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(parsed.data) as Record<string, unknown>
  } catch {
    return
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
        phase: typeof payload.phase === 'string' ? payload.phase : undefined,
        ephemeral: typeof payload.ephemeral === 'boolean' ? payload.ephemeral : undefined,
        replacePrevious:
          typeof payload.replacePrevious === 'boolean' ? payload.replacePrevious : undefined,
      })
      break
    case 'reasoning':
      handlers.onReasoning?.({
        delta: typeof payload.delta === 'string' ? payload.delta : '',
        fullText: typeof payload.fullText === 'string' ? payload.fullText : '',
      })
      break
    case 'reasoning_end':
      handlers.onReasoningEnd?.()
      break
    case 'reasoning_clear':
      handlers.onReasoningClear?.()
      break
    case 'agent_trace': {
      const trace = payload.trace as AgentTrace | undefined
      if (trace) handlers.onAgentTrace?.(trace)
      break
    }
    case 'attachment': {
      const attachment = payload.attachment as ChatMessageAttachment | undefined
      if (attachment) handlers.onAttachment?.(attachment)
      break
    }
    case 'done': {
      const message = payload.message as ChatMessage | undefined
      if (message) {
        onFinalMessage?.(message)
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

export function consumeSseBuffer(
  buffer: string,
  handlers: StreamMessageHandlers,
  onFinalMessage?: (message: ChatMessage) => void,
): string {
  const blocks = buffer.split('\n\n')
  const remainder = blocks.pop() ?? ''
  for (const block of blocks) {
    dispatchSseBlock(block, handlers, onFinalMessage)
  }
  return remainder
}
