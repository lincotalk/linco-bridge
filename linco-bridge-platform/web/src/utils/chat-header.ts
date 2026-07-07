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

export function stripDeviceSuffixFromTitle(title: string, deviceName: string): string {
  const normalizedTitle = title.trim()
  const normalizedDevice = deviceName.trim()
  if (!normalizedTitle || !normalizedDevice) return normalizedTitle

  const suffix = ` - ${normalizedDevice}`
  if (normalizedTitle.endsWith(suffix)) {
    return normalizedTitle.slice(0, -suffix.length).trim() || normalizedTitle
  }

  const parts = normalizedTitle.split(' - ')
  if (parts.length >= 2) {
    const trailing = parts[parts.length - 1]?.trim().toLowerCase() ?? ''
    if (trailing === normalizedDevice.toLowerCase()) {
      return parts.slice(0, -1).join(' - ').trim() || normalizedTitle
    }
  }

  return normalizedTitle
}

export function buildBridgeHeaderSubtitle(deviceName: string | undefined, online: boolean): string {
  const status = online ? '在线' : '离线'
  const name = deviceName?.trim() ?? ''
  return name ? `${name} · ${status}` : status
}

/** @deprecated Use buildBridgeHeaderSubtitle — chat header no longer shows agent name. */
export function buildChatSubtitle(
  _agentType: AgentBridgeType,
  online: boolean,
  deviceName?: string,
): string {
  return buildBridgeHeaderSubtitle(deviceName, online)
}

export function resolveChatHeader(
  sessionId: string,
  session?: ChatSessionItem | null,
  bridgeOnline?: boolean,
  deviceName?: string,
): ChatHeaderView {
  const mockHistory = findMockHistoryItem(sessionId)
  const agentType: AgentBridgeType =
    session?.agentType ?? parseAgentTypeFromSessionId(sessionId) ?? 'codex'

  const online = session?.online ?? bridgeOnline ?? false
  const resolvedDeviceName = deviceName?.trim() || session?.deviceName?.trim() || ''
  const rawTitle =
    session?.conversationTitle?.trim() ||
    session?.title?.trim() ||
    mockHistory?.title ||
    getAgentDisplayName(agentType)
  const title = resolvedDeviceName
    ? stripDeviceSuffixFromTitle(rawTitle, resolvedDeviceName)
    : rawTitle

  return {
    title,
    subtitle: buildBridgeHeaderSubtitle(resolvedDeviceName, online),
    avatar: getAgentAvatar(agentType),
    agentType,
  }
}
