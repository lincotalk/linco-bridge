import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createAppBridgeSdk } from '@/api'
import {
  cancelStreamMessage,
  fetchMessages,
  fetchSessions,
  streamSessionMessage,
  type OutboundChatFile,
} from '@/api/session-api'
import type { BridgeSdk } from '@/bridge/sdk/types'
import type { AgentBridgeSetup, AgentBridgeType, BridgeStatusResult } from '@/bridge/types'
import type { ChatMessage, ChatSessionItem } from '@/bridge/types'

export const useBridgeStore = defineStore('bridge', () => {
  const sdk = ref<BridgeSdk>(createAppBridgeSdk())
  const setupByType = ref<Partial<Record<AgentBridgeType, AgentBridgeSetup>>>({})
  const statusByType = ref<Partial<Record<AgentBridgeType, BridgeStatusResult>>>({})

  function setSdk(next: BridgeSdk) {
    sdk.value = next
  }

  async function loadSetup(type: AgentBridgeType) {
    const setup = await sdk.value.getSetup(type)
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

  async function loadMessages(sessionId: string, limit?: number) {
    loadingMessages.value = {
      ...loadingMessages.value,
      [sessionId]: true,
    }
    try {
      messagesBySession.value = {
        ...messagesBySession.value,
        [sessionId]: await fetchMessages(sessionId, limit),
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

  function patchStreamingAssistant(sessionId: string, assistantId: string, content: string) {
    const current = messagesBySession.value[sessionId] ?? []
    const index = current.findIndex((item) => item.id === assistantId)
    const nextMessage: ChatMessage = {
      id: assistantId,
      sessionId,
      role: 'assistant',
      content,
      createdAt: Date.now(),
      streaming: true,
    }
    const next =
      index >= 0
        ? current.map((item, idx) => (idx === index ? { ...nextMessage, createdAt: item.createdAt } : item))
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
      signal?: AbortSignal
      onStreamId?: (streamId: string) => void
      files?: OutboundChatFile[]
    },
  ) {
    const assistantPlaceholderId = `stream-assistant-${Date.now()}`
    let assistantStarted = false

    const reply = await streamSessionMessage(
      sessionId,
      content,
      {
        onStart: ({ streamId }) => {
          if (streamId) options?.onStreamId?.(streamId)
          if (!assistantStarted) {
            assistantStarted = true
            patchStreamingAssistant(sessionId, assistantPlaceholderId, '')
          }
        },
        onUserMessage: (message) => {
          const current = messagesBySession.value[sessionId] ?? []
          messagesBySession.value = {
            ...messagesBySession.value,
            [sessionId]: [...current, message],
          }
        },
        onChunk: ({ fullText }) => {
          if (!assistantStarted) {
            assistantStarted = true
            patchStreamingAssistant(sessionId, assistantPlaceholderId, fullText)
            return
          }
          patchStreamingAssistant(sessionId, assistantPlaceholderId, fullText)
        },
        onDone: (message) => {
          upsertMessage(sessionId, { ...message, streaming: false })
        },
      },
      options?.signal,
      options?.files ?? [],
    )

    await loadSessions().catch(() => undefined)
    return reply
  }

  async function cancelActiveStream(sessionId: string, streamId: string) {
    const message = await cancelStreamMessage(sessionId, streamId)
    if (message) {
      upsertMessage(sessionId, message)
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
