import { createMockAgentChatSdk } from '@/bridge/sdk/agent-chat'
import type { AgentChatSdk } from '@/bridge/sdk/agent-chat-types'
import type {
  AgentBridgeType,
  AgentHistoryItem,
  AgentLandingHeader,
  StartConversationInput,
  StartConversationResult,
} from '@/bridge/types'
import { pickBridgeWorkspace } from '@/utils/pick-workspace'
import { apiGet, apiPost } from './http-client'

const useRemoteApi = import.meta.env.VITE_USE_REMOTE_API !== 'false'
const forceMockAgentChat = import.meta.env.VITE_AGENT_CHAT_SDK === 'mock'

export function createRestAgentChatSdk(): AgentChatSdk {
  const sdk: AgentChatSdk = {
    async getLandingHeader(agentType: AgentBridgeType): Promise<AgentLandingHeader> {
      const res = await apiGet<AgentLandingHeader>(`/api/agent-chat/${agentType}/landing-header`)
      if (!res.success || !res.data) {
        throw new Error(res.message || '加载 Agent 信息失败')
      }
      return res.data
    },

    async listHistory(
      agentType: AgentBridgeType,
      options?: { limit?: number; offset?: number },
    ): Promise<AgentHistoryItem[]> {
      const params = new URLSearchParams()
      if (options?.limit != null) params.set('limit', String(options.limit))
      if (options?.offset != null) params.set('offset', String(options.offset))
      const query = params.toString()
      const path = `/api/agent-chat/${agentType}/history${query ? `?${query}` : ''}`
      const res = await apiGet<AgentHistoryItem[]>(path)
      if (!res.success || !res.data) {
        throw new Error(res.message || '加载历史会话失败')
      }
      return res.data
    },

    async startConversation(input: StartConversationInput): Promise<StartConversationResult> {
      const res = await apiPost<{ sessionId: string }>(
        `/api/agent-chat/${input.agentType}/conversations`,
        {
          message: input.message,
          tempSession: input.tempSession,
          title: input.title,
        },
      )
      if (!res.success || !res.data?.sessionId) {
        throw new Error(res.message || '创建会话失败')
      }
      return { sessionId: res.data.sessionId }
    },

    pickWorkspace(agentType) {
      return pickBridgeWorkspace(agentType)
    },

    watchLandingHeader(agentType, listener) {
      let stopped = false
      const poll = async () => {
        if (stopped) return
        try {
          const header = await sdk.getLandingHeader(agentType)
          listener(header)
        } catch {
          // ignore polling errors
        }
        if (!stopped) {
          setTimeout(poll, 5000)
        }
      }
      void poll()
      return () => {
        stopped = true
      }
    },
  }
  return sdk
}

/** Agent landing uses REST when remote API is enabled (same gate as BridgeSdk). */
export function createAppAgentChatSdk(): AgentChatSdk {
  if (!useRemoteApi || forceMockAgentChat) {
    return createMockAgentChatSdk()
  }
  return createRestAgentChatSdk()
}