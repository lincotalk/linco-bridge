/**
 * Local-dev-only in-memory AgentChat SDK stub.
 * Not imported on production builds (see agent-chat-api.ts dynamic import).
 */
import { getAgentDisplayName } from '../commands'
import type {
  AgentBridgeType,
  StartConversationInput,
  StartConversationResult,
} from '../types'
import type { AgentChatSdk } from './agent-chat-types'
import { getAgentAvatar } from './agent-chat'

/** Empty stub — no fake history, device id, or project paths. */
export function createMockAgentChatSdk(options?: {
  online?: Partial<Record<AgentBridgeType, boolean>>
}): AgentChatSdk {
  const online = new Map<AgentBridgeType, boolean>(
    Object.entries(options?.online ?? {}) as [AgentBridgeType, boolean][],
  )

  return {
    async getLandingHeader(agentType) {
      const connected = online.get(agentType) ?? false
      return {
        agentType,
        title: getAgentDisplayName(agentType),
        avatar: getAgentAvatar(agentType),
        status: connected ? 'online' : 'offline',
      }
    },

    async listHistory() {
      return []
    },

    async hideHistorySessions(_agentType, sessionIds) {
      return [...new Set(sessionIds.map((id) => id.trim()).filter(Boolean))].length
    },

    async startConversation(input: StartConversationInput): Promise<StartConversationResult> {
      const slug = input.tempSession ? `temp-${Date.now()}` : 'new'
      return { sessionId: `${input.agentType}-${slug}` }
    },

    async pickWorkspace() {
      return null
    },

    openAgentPanel() {
      // Plugin phase: open native side panel
    },
  }
}
