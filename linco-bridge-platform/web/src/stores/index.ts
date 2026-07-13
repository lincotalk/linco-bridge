import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createAppBridgeSdk } from '@/api'
import {
  cancelStreamMessage,
  fetchMessages,
  fetchSessions,
  streamSessionMessage,
  type CancelToken,
  type OutboundChatFile,
} from '@/api/session-api'
import type { BridgeSdk } from '@/bridge/sdk/types'
import type { AgentBridgeSetup, AgentBridgeType, BridgeStatusResult } from '@/bridge/types'
import type { AgentTrace, ChatMessage, ChatMessageAttachment, ChatSessionItem } from '@/bridge/types'

const STREAMING_ASSISTANT_ID_PREFIX = 'stream-assistant-'

function isStreamingAssistantPlaceholder(message: ChatMessage): boolean {
  return (
    message.role === 'assistant' &&
    message.streaming === true &&
    message.id.startsWith(STREAMING_ASSISTANT_ID_PREFIX)
  )
}

export const useBridgeStore = defineStore('bridge', () => {
  const sdk = ref<BridgeSdk>(createAppBridgeSdk())
  const setupByType = ref<Partial<Record<AgentBridgeType, AgentBridgeSetup>>>({})
  const statusByType = ref<Partial<Record<AgentBridgeType, BridgeStatusResult>>>({})

  function setSdk(next: BridgeSdk) {
    sdk.value = next
  }

  async function loadSetup(type: AgentBridgeType, connectionId?: string) {
    const setup = await sdk.value.getSetup(type, connectionId)
    setupByType.value = { ...setupByType.value, [type]: setup }
    return setup
  }

  async function checkStatus(type: AgentBridgeType, connectionId?: string) {
    const status = await sdk.value.checkStatus(type, connectionId)
    statusByType.value = { ...statusByType.value, [type]: status }
    return status
  }

  return {
    sdk,
    setupByType,
    statusByType,
    setSdk,
    loadSetup,
    checkStatus,
  }
})

export const useSessionStore = defineStore('session', () => {
  const sessions = ref<ChatSessionItem[]>([])
  const messagesBySession = ref<Record<string, ChatMessage[]>>({})
  const loadingSessions = ref(false)
  const loadingMessages = ref<Record<string, boolean>>({})

  function getSession(sessionId: string) {
    return sessions.value.find((item) => item.id === sessionId)
  }

  function getMessages(sessionId: string) {
    return messagesBySession.value[sessionId] ?? []
  }

  async function loadSessions() {
    loadingSessions.value = true
    try {
      sessions.value = await fetchSessions()
    } finally {
      loadingSessions.value = false
    }
  }

  function removeSession(sessionId: string) {
    sessions.value = sessions.value.filter((item) => item.id !== sessionId)
    const nextMessages = { ...messagesBySession.value }
    delete nextMessages[sessionId]
    messagesBySession.value = nextMessages
  }

  function removeSessionsByConnection(connectionId: string) {
    const normalized = connectionId.trim()
    if (!normalized) return
    const removingIds = sessions.value
      .filter((item) => item.connectionId === normalized)
      .map((item) => item.id)
    sessions.value = sessions.value.filter((item) => item.connectionId !== normalized)
    const nextMessages = { ...messagesBySession.value }
    for (const sessionId of removingIds) {
      delete nextMessages[sessionId]
    }
    messagesBySession.value = nextMessages
  }

  async function loadMessages(
    sessionId: string,
    options?: { limit?: number; reload?: boolean },
  ) {
    loadingMessages.value = {
      ...loadingMessages.value,
      [sessionId]: true,
    }
    try {
      messagesBySession.value = {
        ...messagesBySession.value,
        [sessionId]: await fetchMessages(sessionId, options),
      }
    } finally {
      loadingMessages.value = {
        ...loadingMessages.value,
        [sessionId]: false,
      }
    }
  }

  function setMessages(sessionId: string, messages: ChatMessage[]) {
    messagesBySession.value = {
      ...messagesBySession.value,
      [sessionId]: messages,
    }
  }

  function upsertMessage(sessionId: string, message: ChatMessage) {
    const current = messagesBySession.value[sessionId] ?? []
    const index = current.findIndex((item) => item.id === message.id)
    const next =
      index >= 0
        ? current.map((item, idx) => (idx === index ? message : item))
        : [...current, message]
    messagesBySession.value = {
      ...messagesBySession.value,
      [sessionId]: next,
    }
  }

  function findStreamingAssistantPlaceholder(sessionId: string) {
    const current = messagesBySession.value[sessionId] ?? []
    return current.find((item) => isStreamingAssistantPlaceholder(item))
  }

  function finalizeStreamingAssistant(
    sessionId: string,
    placeholderId: string,
    message: ChatMessage,
  ) {
    const current = messagesBySession.value[sessionId] ?? []
    const existing = current.find((item) => item.id === placeholderId)
    const withoutPlaceholder = current.filter((item) => item.id !== placeholderId)
    messagesBySession.value = {
      ...messagesBySession.value,
      [sessionId]: [
        ...withoutPlaceholder,
        {
          ...message,
          streaming: false,
          reasoningStreaming: false,
          attachments: message.attachments ?? existing?.attachments,
          reasoning: existing?.reasoning
            ? {
                ...existing.reasoning,
                endedAt: existing.reasoning.endedAt ?? Date.now(),
              }
            : undefined,
          agentTrace: message.agentTrace ?? existing?.agentTrace,
        },
      ],
    }
  }

  function patchStreamingAssistant(
    sessionId: string,
    assistantId: string,
    patch: {
      content?: string
      attachments?: ChatMessageAttachment[]
      reasoning?: ChatMessage['reasoning'] | null
      reasoningStreaming?: boolean
      agentTrace?: AgentTrace | null
    },
  ) {
    const current = messagesBySession.value[sessionId] ?? []
    const index = current.findIndex((item) => item.id === assistantId)
    const existing = index >= 0 ? current[index] : undefined
    const nextReasoning =
      patch.reasoning === null
        ? undefined
        : patch.reasoning !== undefined
          ? patch.reasoning
          : existing?.reasoning
    const nextAgentTrace =
      patch.agentTrace === null
        ? undefined
        : patch.agentTrace !== undefined
          ? patch.agentTrace
          : existing?.agentTrace
    const nextMessage: ChatMessage = {
      id: assistantId,
      sessionId,
      role: 'assistant',
      content: patch.content ?? existing?.content ?? '',
      createdAt: existing?.createdAt ?? Date.now(),
      streaming: true,
      attachments: patch.attachments ?? existing?.attachments,
      reasoning: nextReasoning,
      reasoningStreaming: patch.reasoningStreaming ?? existing?.reasoningStreaming,
      agentTrace: nextAgentTrace,
    }
    const next =
      index >= 0
        ? current.map((item, idx) => (idx === index ? nextMessage : item))
        : [...current, nextMessage]
    messagesBySession.value = {
      ...messagesBySession.value,
      [sessionId]: next,
    }
  }

  async function sendMessageStream(
    sessionId: string,
    content: string,
    options?: {
      cancel?: CancelToken
      onStreamId?: (streamId: string) => void
      files?: OutboundChatFile[]
    },
  ) {
    const assistantPlaceholderId = `stream-assistant-${Date.now()}`
    const optimisticUserId = `optimistic-user-${Date.now()}`
    const trimmed = content.trim()
    let assistantStarted = false
    const reasoningStartedAt = Date.now()

    if (trimmed) {
      upsertMessage(sessionId, {
        id: optimisticUserId,
        sessionId,
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      })
    }

    const reply = await streamSessionMessage(
      sessionId,
      content,
      {
        onStart: ({ streamId }) => {
          if (streamId) options?.onStreamId?.(streamId)
          if (!assistantStarted) {
            assistantStarted = true
            patchStreamingAssistant(sessionId, assistantPlaceholderId, { content: '' })
          }
        },
        onUserMessage: (message) => {
          const current = messagesBySession.value[sessionId] ?? []
          const withoutOptimistic = current.filter((item) => item.id !== optimisticUserId)
          messagesBySession.value = {
            ...messagesBySession.value,
            [sessionId]: [...withoutOptimistic, message],
          }
        },
        onReasoning: ({ fullText }) => {
          if (!assistantStarted) {
            assistantStarted = true
            patchStreamingAssistant(sessionId, assistantPlaceholderId, { content: '' })
          }
          patchStreamingAssistant(sessionId, assistantPlaceholderId, {
            reasoning: {
              content: fullText,
              startedAt: reasoningStartedAt,
            },
            reasoningStreaming: true,
          })
        },
        onReasoningEnd: () => {
          const current = messagesBySession.value[sessionId] ?? []
          const existing = current.find((item) => item.id === assistantPlaceholderId)
          if (!existing?.reasoning) return
          patchStreamingAssistant(sessionId, assistantPlaceholderId, {
            reasoning: {
              ...existing.reasoning,
              endedAt: Date.now(),
            },
            reasoningStreaming: false,
          })
        },
        onReasoningClear: () => {
          patchStreamingAssistant(sessionId, assistantPlaceholderId, {
            reasoning: null,
            reasoningStreaming: false,
          })
        },
        onAgentTrace: (trace) => {
          if (!assistantStarted) {
            assistantStarted = true
            patchStreamingAssistant(sessionId, assistantPlaceholderId, { content: '' })
          }
          patchStreamingAssistant(sessionId, assistantPlaceholderId, { agentTrace: trace })
        },
        onChunk: ({ fullText, phase, ephemeral, replacePrevious }) => {
          const isEphemeral = ephemeral === true || phase === 'progress'
          if (!assistantStarted) {
            assistantStarted = true
            patchStreamingAssistant(sessionId, assistantPlaceholderId, { content: fullText })
            return
          }
          if (!isEphemeral && replacePrevious) {
            patchStreamingAssistant(sessionId, assistantPlaceholderId, { content: '' })
          }
          patchStreamingAssistant(sessionId, assistantPlaceholderId, { content: fullText })
        },
        onAttachment: (attachment) => {
          if (!assistantStarted) {
            assistantStarted = true
            patchStreamingAssistant(sessionId, assistantPlaceholderId, {
              content: '',
              attachments: [attachment],
            })
            return
          }
          const current = messagesBySession.value[sessionId] ?? []
          const existing = current.find((item) => item.id === assistantPlaceholderId)
          const attachments = [...(existing?.attachments ?? []), attachment]
          patchStreamingAssistant(sessionId, assistantPlaceholderId, { attachments })
        },
        onDone: (message) => {
          finalizeStreamingAssistant(sessionId, assistantPlaceholderId, message)
        },
      },
      options?.cancel,
      options?.files ?? [],
    )

    await loadSessions().catch(() => undefined)
    return reply
  }

  async function cancelActiveStream(sessionId: string, streamId: string) {
    const placeholder = findStreamingAssistantPlaceholder(sessionId)
    const message = await cancelStreamMessage(sessionId, streamId)
    if (message) {
      if (placeholder) {
        finalizeStreamingAssistant(sessionId, placeholder.id, message)
      } else {
        upsertMessage(sessionId, { ...message, streaming: false, reasoningStreaming: false })
      }
    } else if (placeholder) {
      const current = messagesBySession.value[sessionId] ?? []
      messagesBySession.value = {
        ...messagesBySession.value,
        [sessionId]: current.filter((item) => item.id !== placeholder.id),
      }
    }
    await loadSessions().catch(() => undefined)
    return message
  }

  function appendDemoExchange(sessionId: string, content: string) {
    const current = messagesBySession.value[sessionId] ?? []
    const now = Date.now()
    messagesBySession.value = {
      ...messagesBySession.value,
      [sessionId]: [
        ...current,
        {
          id: `local-user-${now}`,
          sessionId,
          role: 'user',
          content,
          createdAt: now,
        },
        {
          id: `local-assistant-${now + 1}`,
          sessionId,
          role: 'assistant',
          content: `[Demo] 已收到：${content}`,
          createdAt: now + 1,
        },
      ],
    }
  }

  return {
    sessions,
    messagesBySession,
    loadingSessions,
    loadingMessages,
    getSession,
    getMessages,
    loadSessions,
    removeSession,
    removeSessionsByConnection,
    loadMessages,
    sendMessage: sendMessageStream,
    sendMessageStream,
    cancelActiveStream,
    appendDemoExchange,
    setMessages,
    upsertMessage,
    patchStreamingAssistant,
  }
})
