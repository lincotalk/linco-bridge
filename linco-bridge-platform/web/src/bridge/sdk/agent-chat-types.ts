import type {
  AgentBridgeType,
  AgentHistoryItem,
  AgentLandingHeader,
  AgentWorkspace,
  StartConversationInput,
  StartConversationResult,
} from '../types'

/**
 * Agent chat landing SDK — UI calls this; plugin / REST implementations swap in later.
 * Methods marked optional are Phase 2 (native bridge plugin).
 */
export interface AgentChatSdk {
  getLandingHeader(agentType: AgentBridgeType): Promise<AgentLandingHeader>
  listHistory(
    agentType: AgentBridgeType,
    options?: { limit?: number; offset?: number },
  ): Promise<AgentHistoryItem[]>
  startConversation(input: StartConversationInput): Promise<StartConversationResult>

  /** Workspace picker — bridge plugin will implement. */
  pickWorkspace?(agentType: AgentBridgeType): Promise<AgentWorkspace | null>
  /** Agent side panel / settings — bridge plugin or native sheet. */
  openAgentPanel?(agentType: AgentBridgeType): void
  /** Attachment picker — bridge plugin or uni.chooseFile. */
  pickAttachments?(): Promise<File[]>
  /** Live bridge status push — WS / plugin subscription. */
  watchLandingHeader?(
    agentType: AgentBridgeType,
    listener: (header: AgentLandingHeader) => void,
  ): () => void
}
