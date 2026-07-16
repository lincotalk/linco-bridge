import type { ChatMessage, ChatMessageAttachment, ChatSessionItem, ResumeSessionResult } from '@/bridge/types'
import {
  consumeSseBuffer,
  decodeChunkData,
  type StreamChunkPayload,
  type StreamMessageHandlers,
  type StreamReasoningPayload,
} from '@/api/sse-stream'
import { appendQueryToPath, createQueryParams, setQueryParam } from '@/utils/query-string'
import {
  isH5Runtime,
  isMiniProgramRuntime,
  supportsFetchStream,
  throwIfCancelled,
  type CancelToken,
} from '@/utils/platform-runtime'
import { mapOutboundFilesToAttachments, toApiOutboundFiles } from '@/utils/chat-attachments'
import { apiGet, apiPost, buildApiRequestHeaders, getApiBaseUrl } from './http-client'
import { CHAT_REQUEST_TIMEOUT_MS } from './http-transport'
import { ensureVisitorSession } from './visitor-bootstrap'

export type { CancelToken }

export async function fetchSessions(): Promise<ChatSessionItem[]> {
  const res = await apiGet<ChatSessionItem[]>('/api/sessions')
  if (!res.success || !res.data) {
    throw new Error(res.message || '加载会话失败')
  }
  return res.data
}

export async function deleteSessionsFromList(sessionIds: string[]): Promise<number> {
  const res = await apiPost<{ deletedCount: number }>('/api/sessions/delete', { sessionIds })
  if (!res.success || !res.data) {
    throw new Error(res.message || '删除会话失败')
  }
  return res.data.deletedCount
}

export async function resumeSession(sessionId: string): Promise<ResumeSessionResult> {
  const res = await apiPost<ResumeSessionResult>(
    `/api/sessions/${encodeURIComponent(sessionId)}/resume`,
  )
  if (!res.success || !res.data?.sessionId) {
    throw new Error(res.message || '打开会话失败')
  }
  return res.data
}

export async function fetchMessages(
  sessionId: string,
  options?: { limit?: number; reload?: boolean },
): Promise<ChatMessage[]> {
  let params = createQueryParams()
  if (typeof options?.limit === 'number' && options.limit > 0) {
    params = setQueryParam(params, 'limit', options.limit)
  }
  if (options?.reload) {
    params = setQueryParam(params, 'reload', '1')
  }
  const res = await apiGet<ChatMessage[]>(
    appendQueryToPath(`/api/sessions/${sessionId}/messages`, params),
  )
  if (!res.success || !res.data) {
    throw new Error(res.message || '加载消息失败')
  }
  return res.data
}

export async function sendSessionMessage(
  sessionId: string,
  content: string,
  files: OutboundChatFile[] = [],
): Promise<ChatMessage> {
  try {
    const res = await apiPost<ChatMessage>(
      `/api/sessions/${sessionId}/messages`,
      { content, files: toApiOutboundFiles(files) },
      { timeout: CHAT_REQUEST_TIMEOUT_MS },
    )
    if (!res.success || !res.data) {
      throw new Error(res.message || '发送消息失败')
    }
    return res.data
  } catch (err) {
    const statusCode = (err as Error & { statusCode?: number }).statusCode
    const message = err instanceof Error ? err.message : '发送消息失败'
    if (statusCode === 413 || /附件过大|entity too large/i.test(message)) {
      throw new Error('附件过大，请压缩后重试')
    }
    if (statusCode === 500 && /Internal server error/i.test(message)) {
      throw new Error('发送失败，请确认服务端已重启（需支持大附件）')
    }
    throw err instanceof Error ? err : new Error(message)
  }
}

export interface OutboundChatFile {
  name?: string
  mimeType?: string
  base64?: string
  url?: string
  /** 小程序本地临时路径，仅用于预览，不上报服务端 */
  localPath?: string
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

export type {
  StreamChunkPayload,
  StreamMessageHandlers,
  StreamReasoningPayload,
} from '@/api/sse-stream'

async function streamSessionMessageViaFetch(
  sessionId: string,
  content: string,
  handlers: StreamMessageHandlers,
  cancel?: CancelToken,
  files: OutboundChatFile[] = [],
): Promise<ChatMessage> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  cancel?.onAbort(() => controller?.abort())

  const response = await fetch(`${getApiBaseUrl()}/api/sessions/${sessionId}/messages/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...buildApiRequestHeaders({
        Accept: 'text/event-stream',
      }),
    },
    body: JSON.stringify({ content, files }),
    signal: controller?.signal,
  })

  if (!response.ok || !response.body) {
    let detail = ''
    try {
      const errBody = (await response.json()) as { message?: string }
      detail = errBody.message?.trim() || ''
    } catch {
      detail = ''
    }
    throw new Error(detail || `发送失败 (${response.status})`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalMessage: ChatMessage | null = null

  while (true) {
    throwIfCancelled(cancel)
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    buffer = consumeSseBuffer(buffer, handlers, (message) => {
      finalMessage = message
    })
  }

  if (!finalMessage) {
    throw new Error('流式响应未完成')
  }
  return finalMessage
}

type ChunkCapableRequestTask = UniApp.RequestTask & {
  onChunkReceived?: (listener: (res: { data: ArrayBuffer }) => void) => void
  offChunkReceived?: (listener: (res: { data: ArrayBuffer }) => void) => void
  abort?: () => void
}

const MP_STREAM_TIMEOUT_MS = CHAT_REQUEST_TIMEOUT_MS

async function streamSessionMessageViaBlocking(
  sessionId: string,
  content: string,
  handlers: StreamMessageHandlers,
  cancel?: CancelToken,
  files: OutboundChatFile[] = [],
): Promise<ChatMessage> {
  throwIfCancelled(cancel)
  const streamId = `block-${Date.now()}`

  // 先落用户消息，再创建「输出中」占位，避免指示器插到用户气泡上方
  const trimmed = content.trim()
  const attachments = mapOutboundFilesToAttachments(files)
  if (trimmed || attachments.length > 0) {
    handlers.onUserMessage?.({
      id: `block-user-${Date.now()}`,
      sessionId,
      role: 'user',
      content: trimmed || `[${attachments.length} 个附件]`,
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: Date.now(),
    })
  }
  handlers.onStart?.({ streamId })

  const assistantMessage = await sendSessionMessage(sessionId, content, files)
  throwIfCancelled(cancel)

  if (assistantMessage.content.trim()) {
    handlers.onChunk?.({
      fullText: assistantMessage.content,
      delta: assistantMessage.content,
    })
  }
  for (const attachment of assistantMessage.attachments ?? []) {
    handlers.onAttachment?.(attachment)
  }
  handlers.onDone?.(assistantMessage)
  return assistantMessage
}

async function streamSessionMessageViaUniRequest(
  sessionId: string,
  content: string,
  handlers: StreamMessageHandlers,
  cancel?: CancelToken,
  files: OutboundChatFile[] = [],
): Promise<ChatMessage> {
  await ensureVisitorSession()

  return new Promise((resolve, reject) => {
    let buffer = ''
    let finalMessage: ChatMessage | null = null
    let settled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      if (err) {
        reject(err)
        return
      }
      if (!finalMessage) {
        reject(new Error('流式响应未完成'))
        return
      }
      resolve(finalMessage)
    }

    const onChunk = (chunk: string | ArrayBuffer) => {
      if (settled || cancel?.aborted) return
      buffer += decodeChunkData(chunk)
      buffer = consumeSseBuffer(buffer, handlers, (message) => {
        finalMessage = message
      })
    }

    timeoutId = setTimeout(() => {
      task.abort?.()
      finish(new Error('流式响应超时'))
    }, MP_STREAM_TIMEOUT_MS)

    let task = uni.request({
      url: `${getApiBaseUrl()}/api/sessions/${sessionId}/messages/stream`,
      method: 'POST',
      header: buildApiRequestHeaders({
        Accept: 'text/event-stream',
      }),
      data: { content, files: toApiOutboundFiles(files) },
      enableChunked: true,
      responseType: 'arraybuffer',
      timeout: CHAT_REQUEST_TIMEOUT_MS,
      success: (res) => {
        if (cancel?.aborted) {
          finish(new Error('Aborted'))
          return
        }
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          finish(new Error(`流式发送失败 (${res.statusCode})`))
          return
        }
        if (res.data) {
          onChunk(res.data as string | ArrayBuffer)
        }
        finish()
      },
      fail: (err) => {
        finish(new Error(err.errMsg || '流式发送失败'))
      },
    }) as ChunkCapableRequestTask

    cancel?.onAbort(() => {
      task.abort?.()
      finish(new Error('Aborted'))
    })

    task.onChunkReceived?.((res) => {
      onChunk(res.data)
    })
  })
}

export async function streamSessionMessage(
  sessionId: string,
  content: string,
  handlers: StreamMessageHandlers,
  cancel?: CancelToken,
  files: OutboundChatFile[] = [],
): Promise<ChatMessage> {
  await ensureVisitorSession()
  throwIfCancelled(cancel)

  // H5：始终走浏览器 fetch SSE（与改附件前一致），勿改此分支顺序
  if (supportsFetchStream()) {
    return streamSessionMessageViaFetch(
      sessionId,
      content,
      handlers,
      cancel,
      toApiOutboundFiles(files),
    )
  }

  // 小程序：不支持 fetch SSE；统一走阻塞 HTTP，并携带 files（避免旧逻辑回退丢附件）
  if (isMiniProgramRuntime()) {
    return streamSessionMessageViaBlocking(sessionId, content, handlers, cancel, files)
  }

  if (isH5Runtime()) {
    return streamSessionMessageViaBlocking(sessionId, content, handlers, cancel, files)
  }

  try {
    return await streamSessionMessageViaUniRequest(sessionId, content, handlers, cancel, files)
  } catch (err) {
    if (cancel?.aborted) throw err
    return streamSessionMessageViaBlocking(sessionId, content, handlers, cancel, files)
  }
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
  connectionId?: string,
): Promise<BridgeCommandResult> {
  const res = await apiPost<BridgeCommandResult>(`/api/agent-chat/${agentType}/bridge-command`, {
    command,
    connectionId: connectionId?.trim() || undefined,
  })
  if (!res.success || !res.data) {
    throw new Error(res.message || '命令执行失败')
  }
  return res.data
}
