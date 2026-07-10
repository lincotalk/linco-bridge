import { buildBridgeHeaderSubtitle } from '@/utils/chat-header'import type { AgentBridgeType, AgentLandingHeader } from '../types'

const BRIDGE_AVATAR: Record<AgentBridgeType, string> = {
  codex: '/static/icons/bot/bridge_codex.png',
  claude: '/static/icons/bot/bridge_claude.png',
  hermes: '/static/icons/bot/bridge_hermes.png',
  openclaw: '/static/icons/bot/bridge_claw.png',
}

export function buildLandingSubtitle(header: AgentLandingHeader): string {
  return buildBridgeHeaderSubtitle(
    header.agentType,
    header.status === 'online',
    header.deviceId,
    header.boundContextName,
  )
}

export function getAgentAvatar(agentType: AgentBridgeType): string {
  return BRIDGE_AVATAR[agentType]
}

export function parseAgentTypeFromSessionId(sessionId: string): AgentBridgeType | null {
  const histMatch = sessionId.match(/^hist-(codex|claude|hermes|openclaw)-/)
  if (histMatch?.[1]) return histMatch[1] as AgentBridgeType

  for (const type of Object.keys(BRIDGE_AVATAR) as AgentBridgeType[]) {
    if (sessionId.startsWith(`${type}-`)) return type
  }
  return null
}

export function parseAgentTypeFromQuery(value: string | undefined | null): AgentBridgeType | null {
  const normalized = value?.trim() ?? ''
  if (!normalized) return null
  return (Object.keys(BRIDGE_AVATAR) as AgentBridgeType[]).includes(normalized as AgentBridgeType)
    ? (normalized as AgentBridgeType)
    : null
}

/** Resolve agent type from session metadata, query, or legacy sessionId prefix. */
export function resolveSessionAgentType(input: {
  sessionId?: string
  sessionAgentType?: AgentBridgeType | null
  queryAgentType?: AgentBridgeType | null
}): AgentBridgeType | null {
  if (input.sessionAgentType) return input.sessionAgentType
  if (input.queryAgentType) return input.queryAgentType
  if (input.sessionId?.trim()) return parseAgentTypeFromSessionId(input.sessionId.trim())
  return null
}

export function appendAgentTypeQuery(
  params: URLSearchParams,
  agentType: AgentBridgeType | null | undefined,
): URLSearchParams {
  if (agentType) params.set('agentType', agentType)
  return params
}
