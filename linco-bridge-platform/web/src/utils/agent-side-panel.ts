import { reactive } from 'vue'

import type { AgentBridgeType, AgentHistoryItem, AgentLandingHeader } from '@/bridge/types'

export interface AgentSidePanelOpenOptions {
  agentType: AgentBridgeType
  connectionId?: string
  sessionId?: string
  header: AgentLandingHeader
  history: AgentHistoryItem[]
  onReloadHistory?: () => Promise<void>
  onNewConversation?: () => void
  onOpenHistoryItem?: (item: AgentHistoryItem) => void
  onViewAllHistory?: () => void
}

export interface AgentSidePanelState {
  visible: boolean
  options: AgentSidePanelOpenOptions | null
}

export const agentSidePanelState = reactive<AgentSidePanelState>({
  visible: false,
  options: null,
})

export function showAgentSidePanel(options: AgentSidePanelOpenOptions) {
  agentSidePanelState.options = { ...options }
  agentSidePanelState.visible = true
}

export function closeAgentSidePanel() {
  agentSidePanelState.visible = false
  agentSidePanelState.options = null
}
