import { computed, ref, type Ref } from 'vue'
import { buildSetupCommands, getAgentDisplayName, requiresContextBinding } from '@/bridge'
import type { AgentBridgeBindableContext, AgentBridgeSetup, AgentBridgeType } from '@/bridge/types'
import { useBridgeStore } from '@/stores'
import { showToast } from '@/utils/format'

export function useBridgeConnection(type: Ref<AgentBridgeType>) {
  const bridgeStore = useBridgeStore()

  const loading = ref(false)
  const checking = ref(false)
  const binding = ref(false)
  const error = ref<string | null>(null)
  const setup = ref<AgentBridgeSetup | null>(null)
  const connected = ref<boolean | null>(null)
  const contexts = ref<AgentBridgeBindableContext[]>([])
  const selectedContextId = ref<string | null>(null)
  const hasCopied = ref(false)

  const agentName = computed(() => getAgentDisplayName(type.value))
  const needsContextBinding = computed(() => requiresContextBinding(type.value))
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

  async function checkConnection() {
    checking.value = true
    error.value = null
    try {
      const status = await bridgeStore.checkStatus(type.value)
      connected.value = status.connected
      if (!status.connected) {
        showToast('尚未检测到本机连接')
        return false
      }
      if (needsContextBinding.value) {
        contexts.value = await bridgeStore.sdk.listContexts(type.value)
        if (contexts.value.length === 1) {
          selectedContextId.value = contexts.value[0]?.id ?? null
        }
      }
      showToast('已检测到本机连接', 'success')
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '检测连接失败'
      return false
    } finally {
      checking.value = false
    }
  }

  async function bindSelectedContext() {
    if (!needsContextBinding.value) return true
    if (!selectedContextId.value) {
      showToast('请选择要绑定的上下文')
      return false
    }
    binding.value = true
    try {
      await bridgeStore.sdk.bindContext(type.value, selectedContextId.value)
      showToast('绑定成功', 'success')
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '绑定失败'
      return false
    } finally {
      binding.value = false
    }
  }

  function markCopied() {
    hasCopied.value = true
  }

  return {
    loading,
    checking,
    binding,
    error,
    setup,
    connected,
    contexts,
    selectedContextId,
    hasCopied,
    agentName,
    needsContextBinding,
    commandText,
    loadSetup,
    checkConnection,
    bindSelectedContext,
    markCopied,
  }
}
