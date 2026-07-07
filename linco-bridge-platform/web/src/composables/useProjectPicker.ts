import type { AgentBridgeType, AgentWorkspace } from '@/bridge/types'
import { pickBridgeWorkspace } from '@/utils/pick-workspace'

export function useProjectPicker() {
  async function pickWorkspace(
    agentType: AgentBridgeType,
    connectionId?: string,
    platformSessionId?: string,
  ): Promise<AgentWorkspace | null> {
    return pickBridgeWorkspace(agentType, connectionId, platformSessionId)
  }

  return { pickWorkspace }
}
