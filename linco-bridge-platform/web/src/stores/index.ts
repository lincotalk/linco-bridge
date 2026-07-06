import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createAppBridgeSdk } from '@/api'
import { fetchMessages, fetchSessions, sendSessionMessage } from '@/api/session-api'
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

  async function loadMessages(sessionId: string) {
    loadingMessages.value = {
      ...loadingMessages.value,
      [sessionId]: true,
    }
    try {
      messagesBySession.value = {
        ...messagesBySession.value,
        [sessionId]: await fetchMessages(sessionId),
      }
    } finally {
      loadingMessages.value = {
        ...loadingMessages.value,
        [sessionId]: false,
      }
    }
  }

  async function sendMessage(sessionId: string, content: string) {
    const reply = await sendSessionMessage(sessionId, content)
    const current = messagesBySession.value[sessionId] ?? []
    messagesBySession.value = {
      ...messagesBySession.value,
      [sessionId]: [
        ...current,
        {
          id: `local-user-${Date.now()}`,
          sessionId,
          role: 'user',
          content,
          createdAt: Date.now(),
        },
        reply,
      ],
    }

    const session = getSession(sessionId)
    if (session) {
      session.lastMessage = reply.content
      session.updatedAt = reply.createdAt
    }
    return reply
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

  function setMessages(sessionId: string, messages: ChatMessage[]) {
    messagesBySession.value = {
      ...messagesBySession.value,
      [sessionId]: messages,
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
    sendMessage,
    appendDemoExchange,
    setMessages,
  }
})
