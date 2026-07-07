import { computed, ref, type Ref } from 'vue'

import {
  BRIDGE_CONNECT_CHANNEL,
  buildSetupCommands,
  getAgentDisplayName,
  requiresContextBinding,
} from '@/bridge'

import type {
  AgentBridgeBindableContext,
  AgentBridgeSetup,
  AgentBridgeType,
  BridgeBindContextResult,
  BridgeSyncResult,
} from '@/bridge/types'

import { useBridgeStore, useSessionStore } from '@/stores'

import { showToast } from '@/utils/format'
import { buildAgentLandingUrl } from '@/utils/open-agent-landing'

export interface BridgeConnectionCompleteResult {
  agentType: AgentBridgeType
  sessionId: string
  agentName: string
  connectionId?: string
}

/**
 * Bridge import flow aligned with Flutter:
 * - import_local_agent_page.dart (codex/claude/hermes)
 * - import_openclaw_page.dart (openclaw)
 */
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
    if (setup.value?.appId && setup.value.appSecret && setup.value.accountId) {
      return buildSetupCommands(type.value, {
        appId: setup.value.appId,
        appSecret: setup.value.appSecret,
        accountId: setup.value.accountId,
        channel: setup.value.connectChannel ?? BRIDGE_CONNECT_CHANNEL,
      })
    }
    return setup.value?.setupCommands?.trim() ?? ''
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

  async function loadContexts() {
    if (!needsContextBinding.value || !connectionId.value) return
    contexts.value = await bridgeStore.sdk.listContexts(type.value, connectionId.value)
    selectedContextId.value = contexts.value[0]?.id ?? null
  }

  async function syncAgentConnection(): Promise<BridgeSyncResult | null> {
    try {
      return await bridgeStore.sdk.syncAgent(type.value, connectionId.value || undefined)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '同步 Agent 失败'
      return null
    }
  }

  /** Flutter `_checkStatus`: online → sync (codex/claude) or load contexts (hermes/openclaw). */
  async function checkConnection() {
    checking.value = true
    error.value = null
    try {
      const status = await bridgeStore.checkStatus(type.value, connectionId.value || undefined)
      connected.value = status.connected

      if (!status.connected) {
        showToast(`未检测到 ${agentName.value} 在线，请确认已完成本机配置并重试`)
        return false
      }

      if (needsContextBinding.value) {
        await loadContexts()
      } else {
        await syncAgentConnection()
        await sessionStore.loadSessions()
      }

      showToast(`已连接 ${agentName.value}`, 'success')
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

  /** Codex / Claude: sync then open agent landing (Flutter stays on page; demo goes to landing). */
  async function enterAgentLanding(): Promise<BridgeConnectionCompleteResult | null> {
    if (!hasCopied.value) {
      showToast('请先复制连接命令')
      return null
    }

    completing.value = true
    error.value = null
    try {
      const online = connected.value === true ? true : await checkConnection()
      if (!online) return null

      const syncResult = await syncAgentConnection()
      if (!syncResult) return null

      await sessionStore.loadSessions()
      return {
        agentType: type.value,
        sessionId: syncResult.sessionId ?? '',
        agentName: syncResult.agentName ?? agentName.value,
        connectionId: connectionId.value || syncResult.connectionId,
      }
    } finally {
      completing.value = false
    }
  }

  /** Hermes / OpenClaw: bind context then open chat detail (Flutter ConversationDetailPage). */
  async function bindAndNavigate(): Promise<BridgeConnectionCompleteResult | null> {
    if (!hasCopied.value) {
      showToast('请先复制连接命令')
      return null
    }

    completing.value = true
    error.value = null
    try {
      const online = connected.value === true ? true : await checkConnection()
      if (!online) return null

      const bindResult = await bindSelectedContext()
      if (!bindResult?.sessionId) {
        if (bindResult) {
          showToast('绑定成功但未获取到会话，请重新检测连接状态')
        }
        return null
      }

      await sessionStore.loadSessions()
      return {
        agentType: type.value,
        sessionId: bindResult.sessionId,
        agentName: bindResult.agentName ?? agentName.value,
      }
    } finally {
      completing.value = false
    }
  }

  async function completeConnection(): Promise<BridgeConnectionCompleteResult | null> {
    return needsContextBinding.value ? bindAndNavigate() : enterAgentLanding()
  }

  function navigateAfterConnect(result: BridgeConnectionCompleteResult) {
    if (requiresContextBinding(result.agentType)) {
      uni.redirectTo({
        url: `/pages/chat/index?sessionId=${encodeURIComponent(result.sessionId)}`,
      })
      return
    }

    uni.redirectTo({
      url: buildAgentLandingUrl({
        agentType: result.agentType,
        connectionId: result.connectionId,
      }),
    })
  }

  function markCopied() {
    hasCopied.value = true
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
    enterAgentLanding,
    bindAndNavigate,
    completeConnection,
    navigateAfterConnect,
    markCopied,
  }
}
