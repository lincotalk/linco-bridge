import type { AgentBridgeType, AgentWorkspace, BridgeWorkspaceSelection } from '@/bridge/types'
import { useBridgeStore } from '@/stores'
import { showBridgeWorkspacePicker } from '@/utils/bridge-workspace-picker'
import { showToast } from '@/utils/format'

export type PickWorkspaceResult = AgentWorkspace & {
  sessionId?: string
  agentSessionId?: string
  title?: string
}

export function isBoundWorkspacePick(picked: PickWorkspaceResult): boolean {
  return Boolean(picked.sessionId?.trim() && picked.agentSessionId?.trim())
}

export function hasWorkspaceSessionPick(picked: PickWorkspaceResult): boolean {
  return Boolean(picked.sessionId?.trim())
}

export async function ensureBridgeOnline(
  agentType: AgentBridgeType,
  connectionId?: string,
): Promise<string | undefined> {
  const bridgeStore = useBridgeStore()
  if (!bridgeStore.statusByType[agentType]?.connected) {
    await bridgeStore.checkStatus(agentType, connectionId).catch(() => undefined)
  }
  if (!bridgeStore.statusByType[agentType]?.connected) {
    showToast('本机 Agent 尚未连接')
    return undefined
  }
  return connectionId ?? bridgeStore.statusByType[agentType]?.connectionId
}

function mapSelection(selection: BridgeWorkspaceSelection): PickWorkspaceResult {
  return {
    name: selection.projectName || selection.projectPath,
    path: selection.projectPath,
    sessionId: selection.sessionId,
    agentSessionId: selection.agentSessionId,
    title: selection.title,
  }
}

export async function pickBridgeWorkspace(
  agentType: AgentBridgeType,
  connectionId?: string,
  platformSessionId?: string,
): Promise<PickWorkspaceResult | null> {
  const resolvedConnectionId = await ensureBridgeOnline(agentType, connectionId)
  if (!resolvedConnectionId) return null

  const supportsProjectPicker = agentType === 'codex' || agentType === 'claude'
  if (!supportsProjectPicker) {
    showToast('当前 Agent 不支持工作区选择')
    return null
  }

  const selection = await showBridgeWorkspacePicker({
    agentType,
    connectionId: resolvedConnectionId,
    platformSessionId,
    supportsChats: agentType === 'codex',
  })

  if (!selection) return null
  return mapSelection(selection)
}
