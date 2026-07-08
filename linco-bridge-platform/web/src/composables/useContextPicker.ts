import type { AgentBridgeType, BridgeBindContextResult } from '@/bridge/types'
import { pickBridgeContext } from '@/utils/pick-bridge-context'

export function useContextPicker() {
  async function pickContext(
    agentType: AgentBridgeType,
    connectionId?: string,
  ): Promise<BridgeBindContextResult | null> {
    return pickBridgeContext(agentType, connectionId)
  }

  return { pickContext }
}
