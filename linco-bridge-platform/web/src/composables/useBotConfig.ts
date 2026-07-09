import { computed, ref } from 'vue'

import type { AgentBridgeConnectionDetail, AgentBridgeType } from '@/bridge/types'
import { useBridgeStore, useSessionStore } from '@/stores'
import { showToast, copyToClipboard } from '@/utils/format'

export function useBotConfig() {
  const bridgeStore = useBridgeStore()
  const sessionStore = useSessionStore()

  const loading = ref(false)
  const refreshing = ref(false)
  const savingName = ref(false)
  const deleting = ref(false)
  const detail = ref<AgentBridgeConnectionDetail | null>(null)
  const showSecret = ref(false)
  const error = ref<string | null>(null)

  const isOnline = computed(() => detail.value?.status === 'online')
  const commandText = computed(() => detail.value?.setupCommands?.trim() ?? '')

  async function loadDetail(agentType: AgentBridgeType, connectionId?: string) {
    loading.value = true
    error.value = null
    try {
      detail.value = await bridgeStore.sdk.getConnectionDetail(agentType, connectionId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载助手详情失败'
      detail.value = null
    } finally {
      loading.value = false
    }
  }

  async function refreshDetail(agentType: AgentBridgeType, connectionId?: string) {
    refreshing.value = true
    error.value = null
    try {
      detail.value = await bridgeStore.sdk.getConnectionDetail(agentType, connectionId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '刷新连接状态失败'
    } finally {
      refreshing.value = false
    }
  }

  async function saveDisplayName(agentType: AgentBridgeType, connectionId: string, displayName: string) {
    const normalized = displayName.trim()
    if (!normalized) {
      showToast('名称不能为空')
      return false
    }
    savingName.value = true
    try {
      detail.value = await bridgeStore.sdk.renameConnection(agentType, connectionId, normalized)
      showToast('名称已保存', 'success')
      return true
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存名称失败')
      return false
    } finally {
      savingName.value = false
    }
  }

  async function copySetupCommand() {
    const text = commandText.value
    if (!text) {
      showToast('暂无可复制的配置命令')
      return
    }
    try {
      await copyToClipboard(text)
      showToast('已复制配置命令', 'success')
    } catch {
      showToast('复制失败')
    }
  }

  async function deleteRobot(agentType: AgentBridgeType, connectionId: string): Promise<boolean> {
    deleting.value = true
    try {
      const result = await bridgeStore.sdk.deleteConnection(agentType, connectionId)
      if (!result.deleted) {
        showToast('删除失败，请稍后重试')
        return false
      }
      sessionStore.removeSessionsByConnection(connectionId)
      await sessionStore.loadSessions().catch(() => undefined)
      if (result.commandSent) {
        showToast('已删除机器人，已通知电脑端确认删除桥接', 'success')
      } else {
        showToast('已删除机器人', 'success')
      }
      return true
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败，请稍后重试')
      return false
    } finally {
      deleting.value = false
    }
  }

  function toggleSecretVisibility() {
    showSecret.value = !showSecret.value
  }

  function formatLastSeen(timestamp?: number): string {
    if (!timestamp) return '未知'
    const date = new Date(timestamp)
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  return {
    loading,
    refreshing,
    savingName,
    deleting,
    detail,
    showSecret,
    error,
    isOnline,
    commandText,
    loadDetail,
    refreshDetail,
    saveDisplayName,
    copySetupCommand,
    deleteRobot,
    toggleSecretVisibility,
    formatLastSeen,
  }
}
