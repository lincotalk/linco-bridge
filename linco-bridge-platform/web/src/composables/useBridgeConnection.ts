import { computed, ref, type Ref } from 'vue'
import { buildSetupCommands, getAgentDisplayName, requiresContextBinding } from '@/bridge'
import type {
  AgentBridgeBindableContext,
  AgentBridgeSetup,
  AgentBridgeType,
  BridgeBindContextResult,
  BridgeSyncResult,
} from '@/bridge/types'
import { useBridgeStore, useSessionStore } from '@/stores'
import { showToast } from '@/utils/format'

export interface BridgeConnectionCompleteResult {
  agentType: AgentBridgeType
  sessionId: string
  agentName: string
}

export function useBridgeConnection(type: Ref<AgentBridgeType>) {
  const bridgeStore = useBridgeStore()
  const sessionStore = useSessionStore()

  const loading = ref(false)
  const refreshing = ref(false)
  const checking = ref(false)
  const binding = ref(false)
  const completing = ref(false)
  const error = ref<string | null>(null)
  const setup = ref<AgentBridgeSetup | null>(null)
  const connected = ref<boolean | null>(null)
  const contexts = ref<AgentBridgeBindableContext[]>([])
  const selectedContextId = ref<string | null>(null)
  const hasCopied = ref(false)

  const agentName = computed(() => getAgentDisplayName(type.value))
  const needsContextBinding = computed(() => requiresContextBinding(type.value))
  const connectionId = computed(() => setup.value?.connectionId ?? '')
  const commandText = computed(() => {
    if (setup.value?.setupCommands?.trim()) {
      return setup.value.setupCommands
    }
    if (!setup.value) return ''
    return buildSetupCommands(type.value, {
      appId: setup.value.appId,
      appSecret: setup.value.appSecret,
      accountId: setup.value.accountId,
    })
  })

  async function loadSetup() {
    loading.value = true
    error.value = null
    try {
      setup.value = await bridgeStore.loadSetup(type.value)
      connected.value = null
      contexts.value = []
      selectedContextId.value = null
      hasCopied.value = false
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取连接配置失败'
    } finally {
      loading.value = false
    }
  }

  async function refreshSetup() {
    if (!connectionId.value) {
      showToast('当前没有可刷新的连接配置')
      return false
    }
    refreshing.value = true
    error.value = null
    try {
      setup.value = await bridgeStore.sdk.refreshSetup(type.value, connectionId.value)
      connected.value = null
      contexts.value = []
      selectedContextId.value = null
      hasCopied.value = false
      showToast('配置已刷新', 'success')
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '刷新连接配置失败'
      return false
    } finally {
      refreshing.value = false
    }
  }

  async function checkConnection() {
    checking.value = true
    error.value = null
    try {
      const status = await bridgeStore.checkStatus(type.value, connectionId.value || undefined)
      connected.value = status.connected

      if (!status.connected) {
        showToast('尚未检测到本机连接')
        return false
      }

      if (needsContextBinding.value) {
        contexts.value = await bridgeStore.sdk.listContexts(
          type.value,
          connectionId.value || undefined,
        )
        if (contexts.value.length === 1) {
          selectedContextId.value = contexts.value[0]?.id ?? null
        }
      }

      showToast('已检测到本机连接', 'success')
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '检测连接失败'
      connected.value = false
      return false
    } finally {
      checking.value = false
    }
  }

  async function bindSelectedContext(): Promise<BridgeBindContextResult | null> {
    if (!needsContextBinding.value) return null
    if (!selectedContextId.value) {
      showToast('请选择要绑定的上下文')
      return null
    }
    binding.value = true
    try {
      const result = await bridgeStore.sdk.bindContext(
        type.value,
        selectedContextId.value,
        connectionId.value || undefined,
      )
      showToast('绑定成功', 'success')
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : '绑定失败'
      return null
    } finally {
      binding.value = false
    }
  }

  async function syncAgentConnection(): Promise<BridgeSyncResult | null> {
    if (needsContextBinding.value) return null
    try {
      return await bridgeStore.sdk.syncAgent(type.value, connectionId.value || undefined)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '同步 Agent 失败'
      return null
    }
  }

  async function completeConnection(): Promise<BridgeConnectionCompleteResult | null> {
    if (!hasCopied.value) {
      showToast('请先复制连接命令')
      return null
    }

    completing.value = true
    error.value = null
    try {
      const online = connected.value === true ? true : await checkConnection()
      if (!online) return null

      let sessionId = ''
      let resolvedName = agentName.value

      if (needsContextBinding.value) {
        const bindResult = await bindSelectedContext()
        if (!bindResult?.sessionId) return null
        sessionId = bindResult.sessionId
        resolvedName = bindResult.agentName
      } else {
        const syncResult = await syncAgentConnection()
        if (!syncResult?.sessionId) return null
        sessionId = syncResult.sessionId
        resolvedName = syncResult.agentName
      }

      await sessionStore.loadSessions()
      showToast(`${resolvedName} 已连接`, 'success')
      return {
        agentType: type.value,
        sessionId,
        agentName: resolvedName,
      }
    } finally {
      completing.value = false
    }
  }

  function markCopied() {
    hasCopied.value = true
  }

  function navigateAfterConnect(result: BridgeConnectionCompleteResult) {
    uni.redirectTo({
      url: `/pages/chat/landing?agentType=${encodeURIComponent(result.agentType)}`,
    })
  }

  return {
    loading,
    refreshing,
    checking,
    binding,
    completing,
    error,
    setup,
    connected,
    contexts,
    selectedContextId,
    hasCopied,
    agentName,
    needsContextBinding,
    connectionId,
    commandText,
    loadSetup,
    refreshSetup,
    checkConnection,
    bindSelectedContext,
    completeConnection,
    navigateAfterConnect,
    markCopied,
  }
}
