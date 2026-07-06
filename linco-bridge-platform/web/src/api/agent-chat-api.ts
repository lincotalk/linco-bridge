import { createMockAgentChatSdk, createRestAgentChatSdk } from '@/bridge/sdk/agent-chat'
import type { AgentChatSdk } from '@/bridge/sdk/agent-chat-types'

const useRemoteAgentChat = import.meta.env.VITE_AGENT_CHAT_SDK === 'rest'

/** Swap mock ↔ REST when plugin / backend endpoints land. */
export function createAppAgentChatSdk(): AgentChatSdk {
  return useRemoteAgentChat ? createRestAgentChatSdk() : createMockAgentChatSdk()
}
