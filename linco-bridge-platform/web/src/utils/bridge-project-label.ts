import type { AgentBridgeType, ChatSessionItem } from '@/bridge/types'

const BRIDGE_PROJECT_AGENT_TYPES = new Set<AgentBridgeType>(['codex', 'claude'])

export function bridgePathBasename(path: string): string {
  const normalized = path.trim().replace(/[\\/]+$/, '')
  if (!normalized) return ''
  const segments = normalized.split(/[/\\]/)
  return segments[segments.length - 1]?.trim() ?? ''
}

export function resolveBridgeProjectLabel(session: ChatSessionItem | undefined): string | undefined {
  if (!session || !BRIDGE_PROJECT_AGENT_TYPES.has(session.agentType)) {
    return undefined
  }

  const projectPath = session.bridgeProjectPath?.trim() ?? ''
  if (projectPath) {
    return bridgePathBasename(projectPath) || projectPath
  }

  return '临时会话'
}
