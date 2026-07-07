import type { AgentBridgeType } from '../shared/constants'
import { agentDisplayName } from '../shared/constants'

export const TEMP_SESSION_TITLE_MAX_CHARS = 30

const PLACEHOLDER_TITLES = new Set(['临时会话', '新的会话'])

export function buildTempSessionTitle(text: string): string {
  const normalized = text.trim().replace(/\s+/g, ' ')
  if (!normalized) return ''

  if (normalized.length <= TEMP_SESSION_TITLE_MAX_CHARS) {
    return normalized
  }

  return `${normalized.slice(0, TEMP_SESSION_TITLE_MAX_CHARS)}...`
}

export function isTempSessionPlaceholderTitle(
  title: string,
  agentType: AgentBridgeType,
): boolean {
  const normalized = title.trim()
  if (!normalized) return true
  if (PLACEHOLDER_TITLES.has(normalized)) return true
  if (normalized === agentDisplayName(agentType)) return true
  if (normalized === `与 ${agentDisplayName(agentType)} 的对话`) return true
  return false
}

export function resolveTempSessionTitle(input: {
  message?: string
  title?: string
  agentType: AgentBridgeType
}): string {
  const fromMessage = buildTempSessionTitle(input.message ?? '')
  if (fromMessage) return fromMessage

  const fromTitle = buildTempSessionTitle(input.title ?? '')
  if (fromTitle && !isTempSessionPlaceholderTitle(fromTitle, input.agentType)) {
    return fromTitle
  }

  return '新的会话'
}
