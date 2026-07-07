import { computed, ref } from 'vue'
import { parseAgentTypeFromSessionId } from '@/bridge/sdk/agent-chat'
import type { OutboundChatFile } from '@/api/session-api'
import { useBridgeStore, useSessionStore } from '@/stores'
import { takePendingFiles } from '@/composables/pendingAttachmentTransfer'
import { takePendingLaunch } from '@/composables/pendingLaunchTransfer'
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
  const activeStreamId = ref('')
  const abortController = ref<AbortController | null>(null)

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
      await bridgeStore
        .checkStatus(agentType, session?.connectionId)
        .catch(() => undefined)
    }

    const status = agentType ? bridgeStore.statusByType[agentType] : undefined
    const online = session?.online ?? status?.connected ?? false
    const deviceName = status?.deviceName ?? session?.deviceName

    header.value = resolveChatHeader(sessionId.value, session, online, deviceName)
  }

  async function loadSession(
    id: string,
    options?: string | { initialDraft?: string; reloadHistory?: boolean },
  ) {
    const normalized =
      typeof options === 'string'
        ? { initialDraft: options, reloadHistory: false }
        : { initialDraft: options?.initialDraft, reloadHistory: options?.reloadHistory ?? false }

    sessionId.value = id
    draft.value = ''
    const launchMessage = takePendingLaunch(id)
    const autoSendText = launchMessage ?? normalized.initialDraft?.trim() ?? ''
    const hasAutoSend = autoSendText.length > 0
    pendingDraft.value = autoSendText
    loading.value = true

    try {
      if (sessionStore.sessions.length === 0) {
        await sessionStore.loadSessions().catch(() => undefined)
      }

      const session = sessionStore.getSession(id)
      const agentType = session?.agentType ?? parseAgentTypeFromSessionId(id)
      if (agentType && !bridgeStore.statusByType[agentType]) {
        await bridgeStore
          .checkStatus(agentType, session?.connectionId)
          .catch(() => undefined)
      }

      const status = agentType ? bridgeStore.statusByType[agentType] : undefined
      const deviceName = status?.deviceName ?? session?.deviceName
      header.value = resolveChatHeader(id, session, session?.online ?? status?.connected, deviceName)

      if (hasAutoSend) {
        sessionStore.setMessages(id, [])
      } else {
        if (normalized.reloadHistory) {
          sessionStore.setMessages(id, [])
        }

        try {
          await sessionStore.loadMessages(id, normalized.reloadHistory ? 5 : undefined)
        } catch (err) {
          sessionStore.setMessages(id, [])
          const message = err instanceof Error ? err.message : '加载消息失败'
          if (message.includes('会话不存在')) {
            showToast(message)
          }
        }
      }
    } finally {
      loading.value = false
    }

    void refreshHeader()
    scrollToBottom()

    const pendingFiles = takePendingFiles(id)
    if (pendingDraft.value || pendingFiles.length > 0) {
      const text = pendingDraft.value
      pendingDraft.value = ''
      await sendMessage(text, pendingFiles)
    }
  }

  function scrollToBottom() {
    scrollAnchor.value = ''
    requestAnimationFrame(() => {
      scrollAnchor.value = lastMessageId.value || 'chat-bottom'
    })
  }

  async function sendMessage(contentOverride?: string, files: OutboundChatFile[] = []) {
    const content = (contentOverride ?? draft.value).trim()
    if ((!content && files.length === 0) || !sessionId.value || sending.value) return

    sending.value = true
    activeStreamId.value = ''
    draft.value = ''

    const controller = new AbortController()
    abortController.value = controller

    try {
      await sessionStore.sendMessageStream(sessionId.value, content, {
        signal: controller.signal,
        onStreamId: (streamId) => {
          activeStreamId.value = streamId
        },
        files,
      })
    } catch (err) {
      if (controller.signal.aborted) {
        showToast('已停止生成')
      } else {
        const message = err instanceof Error ? err.message : '发送失败'
        showToast(message)
      }
    } finally {
      abortController.value = null
      activeStreamId.value = ''
      sending.value = false
      await refreshHeader()
      scrollToBottom()
    }
  }

  async function stopGeneration() {
    if (!sending.value || !sessionId.value) return

    abortController.value?.abort()

    const streamId = activeStreamId.value
    if (streamId) {
      try {
        await sessionStore.cancelActiveStream(sessionId.value, streamId)
      } catch (err) {
        const message = err instanceof Error ? err.message : '停止生成失败'
        showToast(message)
      }
    }

    sending.value = false
    activeStreamId.value = ''
    abortController.value = null
    scrollToBottom()
  }

  async function reloadHistory(limit?: number) {
    if (!sessionId.value) return
    loading.value = true
    try {
      await sessionStore.loadMessages(sessionId.value, limit)
      scrollToBottom()
    } finally {
      loading.value = false
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
    stopGeneration,
    scrollToBottom,
    reloadHistory,
  }
}
