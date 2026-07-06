import { getAgentDisplayName } from '@/bridge/commands'
import {
  findMockHistoryItem,
  getAgentAvatar,
  parseAgentTypeFromSessionId,
} from '@/bridge/sdk/agent-chat'
import type { AgentBridgeType, ChatSessionItem } from '@/bridge/types'

export interface ChatHeaderView {
  title: string
  subtitle: string
  avatar: string
  agentType: AgentBridgeType
}

export function buildChatSubtitle(
  agentType: AgentBridgeType,
  online: boolean,
  projectPath?: string,
): string {
  const parts: string[] = [getAgentDisplayName(agentType)]
  if (projectPath?.trim()) parts.push(projectPath.trim())
  parts.push(online ? '在线' : '离线')
  return parts.join(' · ')
}

export function resolveChatHeader(
  sessionId: string,
  session?: ChatSessionItem | null,
  bridgeOnline?: boolean,
): ChatHeaderView {
  const mockHistory = findMockHistoryItem(sessionId)
  const agentType: AgentBridgeType =
    session?.agentType ?? parseAgentTypeFromSessionId(sessionId) ?? 'codex'

  const online = session?.online ?? bridgeOnline ?? false
  const title = session?.title ?? mockHistory?.title ?? getAgentDisplayName(agentType)

  return {
    title,
    subtitle: buildChatSubtitle(agentType, online, mockHistory?.projectPath),
    avatar: getAgentAvatar(agentType),
    agentType,
  }
}
