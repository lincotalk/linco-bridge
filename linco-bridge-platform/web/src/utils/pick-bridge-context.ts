import type { AgentBridgeType, BridgeBindContextResult } from '@/bridge/types'
import { supportsBridgeContextSelector } from '@/bridge/constants'
import { useBridgeStore } from '@/stores'
import { showBridgeContextPicker } from '@/utils/bridge-context-picker'
import { ensureBridgeOnline } from '@/utils/pick-workspace'
import { showToast } from '@/utils/format'

export async function pickBridgeContext(
  agentType: AgentBridgeType,
  connectionId?: string,
): Promise<BridgeBindContextResult | null> {
  if (!supportsBridgeContextSelector(agentType)) {
    showToast('当前 Agent 不支持切换 Profile')
    return null
  }

  const resolvedConnectionId = await ensureBridgeOnline(agentType, connectionId)
  if (!resolvedConnectionId) return null

  const bridgeStore = useBridgeStore()
  const status = bridgeStore.statusByType[agentType]
  const selectedContextId = await showBridgeContextPicker({
    agentType,
    connectionId: resolvedConnectionId,
    selectedContextId: status?.boundContextId,
  })
  if (!selectedContextId) return null

  try {
    const result = await bridgeStore.sdk.bindContext(
      agentType,
      selectedContextId,
      resolvedConnectionId,
    )
    await bridgeStore.checkStatus(agentType, resolvedConnectionId).catch(() => undefined)
    return result
  } catch (err) {
    showToast(err instanceof Error ? err.message : '切换 Profile 失败')
    return null
  }
}
