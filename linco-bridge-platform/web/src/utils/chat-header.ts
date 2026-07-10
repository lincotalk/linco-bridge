import { getAgentDisplayName } from '@/bridge/commands'
import { requiresContextBinding } from '@/bridge/constants'
import {
  getAgentAvatar,
  parseAgentTypeFromSessionId,
} from '@/bridge/sdk/agent-chat'
import type { AgentBridgeType, AgentLandingHeader, ChatSessionItem } from '@/bridge/types'

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

export function buildBridgeHeaderSubtitle(
  agentType: AgentBridgeType,
  online: boolean,
  deviceName?: string,
  boundContextName?: string,
): string {
  const status = online ? '在线' : '离线'
  const device = deviceName?.trim() ?? ''
  const profile = boundContextName?.trim() ?? ''
  const parts: string[] = []

  if (requiresContextBinding(agentType)) {
    if (profile) parts.push(profile)
    if (device) parts.push(device)
  } else if (device) {
    parts.push(device)
  }

  parts.push(status)
  return parts.join(' · ')
}

/** @deprecated Use buildBridgeHeaderSubtitle — chat header no longer shows agent name. */
export function buildChatSubtitle(
  agentType: AgentBridgeType,
  online: boolean,
  deviceName?: string,
  boundContextName?: string,
): string {
  return buildBridgeHeaderSubtitle(agentType, online, deviceName, boundContextName)
}

export function buildLandingSubtitle(header: AgentLandingHeader): string {
  return buildBridgeHeaderSubtitle(
    header.agentType,
    header.status === 'online',
    header.deviceId,
    header.boundContextName,
  )
}

export function resolveChatHeader(
  sessionId: string,
  session?: ChatSessionItem | null,
  bridgeOnline?: boolean,
  deviceName?: string,
  boundContextName?: string,
): ChatHeaderView {
  const agentType: AgentBridgeType =
    session?.agentType ?? parseAgentTypeFromSessionId(sessionId) ?? 'codex'

  const online = session?.online ?? bridgeOnline ?? false
  const resolvedDeviceName = deviceName?.trim() || session?.deviceName?.trim() || ''
  const rawTitle =
    session?.conversationTitle?.trim() ||
    session?.title?.trim() ||
    getAgentDisplayName(agentType)
  const title = resolvedDeviceName
    ? stripDeviceSuffixFromTitle(rawTitle, resolvedDeviceName)
    : rawTitle

  return {
    title,
    subtitle: buildBridgeHeaderSubtitle(
      agentType,
      online,
      resolvedDeviceName,
      boundContextName,
    ),
    avatar: getAgentAvatar(agentType),
    agentType,
  }
}
