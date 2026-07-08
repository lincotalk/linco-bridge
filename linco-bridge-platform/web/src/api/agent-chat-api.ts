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

function withConnectionId(path: string, connectionId?: string): string {
  const normalized = connectionId?.trim()
  if (!normalized) return path
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}connectionId=${encodeURIComponent(normalized)}`
}

export function createRestAgentChatSdk(): AgentChatSdk {
  const sdk: AgentChatSdk = {
    async getLandingHeader(
      agentType: AgentBridgeType,
      connectionId?: string,
    ): Promise<AgentLandingHeader> {
      const path = withConnectionId(`/api/agent-chat/${agentType}/landing-header`, connectionId)
      const res = await apiGet<AgentLandingHeader>(path)
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
      if (options?.connectionId?.trim()) {
        params.set('connectionId', options.connectionId.trim())
      }
      const query = params.toString()
      const path = `/api/agent-chat/${agentType}/history${query ? `?${query}` : ''}`
      const res = await apiGet<AgentHistoryItem[]>(path)
      if (!res.success || !res.data) {
        throw new Error(res.message || '加载历史会话失败')
      }
      return res.data
    },

    async hideHistorySessions(
      agentType: AgentBridgeType,
      sessionIds: string[],
    ): Promise<number> {
      const res = await apiPost<{ hiddenCount: number }>(
        `/api/agent-chat/${agentType}/history/hide`,
        { sessionIds },
      )
      if (!res.success || res.data == null) {
        throw new Error(res.message || '删除历史会话失败')
      }
      return res.data.hiddenCount
    },

    async startConversation(input: StartConversationInput): Promise<StartConversationResult> {
      const res = await apiPost<{ sessionId: string }>(
        `/api/agent-chat/${input.agentType}/conversations`,
        {
          message: input.message,
          tempSession: input.tempSession,
          title: input.title,
          connectionId: input.connectionId,
          bridgeSettings: input.bridgeSettings,
        },
      )
      if (!res.success || !res.data?.sessionId) {
        throw new Error(res.message || '创建会话失败')
      }
      return { sessionId: res.data.sessionId }
    },

    pickWorkspace(agentType, connectionId) {
      return pickBridgeWorkspace(agentType, connectionId)
    },

    watchLandingHeader(agentType, listener, connectionId) {
      let stopped = false
      const poll = async () => {
        if (stopped) return
        try {
          const header = await sdk.getLandingHeader(agentType, connectionId)
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