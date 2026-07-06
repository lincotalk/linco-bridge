import { computed, ref } from 'vue'
import { parseAgentTypeFromSessionId } from '@/bridge/sdk/agent-chat'
import { useBridgeStore, useSessionStore } from '@/stores'
import { resolveChatHeader, type ChatHeaderView } from '@/utils/chat-header'
import { showToast } from '@/utils/format'

export function useChatSession() {
  const sessionStore = useSessionStore()
  const bridgeStore = useBridgeStore()

  const sessionId = ref('')
  const draft = ref('')
  const sending = ref(false)
  const loading = ref(false)
  const header = ref<ChatHeaderView | null>(null)
  const scrollAnchor = ref('')
  const pendingDraft = ref('')

  const messages = computed(() => sessionStore.getMessages(sessionId.value))
  const lastMessageId = computed(() => {
    const items = messages.value
    return items.length > 0 ? (items[items.length - 1]?.id ?? '') : ''
  })

  async function refreshHeader() {
    if (!sessionId.value) return

    const session = sessionStore.getSession(sessionId.value)
    const agentType = session?.agentType ?? parseAgentTypeFromSessionId(sessionId.value)

    if (agentType && !bridgeStore.statusByType[agentType]) {
      await bridgeStore.checkStatus(agentType).catch(() => undefined)
    }

    const online =
      session?.online ?? (agentType ? bridgeStore.statusByType[agentType]?.connected : false)

    header.value = resolveChatHeader(sessionId.value, session, online)
  }

  async function loadSession(id: string, initialDraft?: string) {
    sessionId.value = id
    pendingDraft.value = initialDraft?.trim() ?? ''
    loading.value = true

    try {
      if (sessionStore.sessions.length === 0) {
        await sessionStore.loadSessions().catch(() => undefined)
      }

      header.value = resolveChatHeader(id, sessionStore.getSession(id))

      try {
        await sessionStore.loadMessages(id)
      } catch {
        sessionStore.setMessages(id, [])
      }

      await refreshHeader()
      scrollToBottom()

      if (pendingDraft.value) {
        const text = pendingDraft.value
        pendingDraft.value = ''
        draft.value = text
        await sendMessage(text)
      }
    } finally {
      loading.value = false
    }
  }

  function scrollToBottom() {
    scrollAnchor.value = ''
    requestAnimationFrame(() => {
      scrollAnchor.value = lastMessageId.value || 'chat-bottom'
    })
  }

  async function sendMessage(contentOverride?: string) {
    const content = (contentOverride ?? draft.value).trim()
    if (!content || !sessionId.value || sending.value) return

    sending.value = true
    if (!contentOverride) draft.value = ''

    try {
      await sessionStore.sendMessage(sessionId.value, content)
    } catch {
      sessionStore.appendDemoExchange(sessionId.value, content)
      showToast('已本地演示发送，接入 SDK 后将同步到 Agent')
    } finally {
      sending.value = false
      scrollToBottom()
    }
  }

  return {
    sessionId,
    draft,
    sending,
    loading,
    header,
    messages,
    scrollAnchor,
    loadSession,
    sendMessage,
    scrollToBottom,
  }
}
