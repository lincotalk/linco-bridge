export const DEMO_USER_ID = 'demo'

export const AGENT_BRIDGE_TYPES = ['codex', 'claude', 'hermes', 'openclaw'] as const

export type AgentBridgeType = (typeof AGENT_BRIDGE_TYPES)[number]

export function isAgentBridgeType(value: string): value is AgentBridgeType {
  return (AGENT_BRIDGE_TYPES as readonly string[]).includes(value)
}

export function defaultAccountId(type: AgentBridgeType): string {
  return type === 'openclaw' ? 'openclaw_1' : `${type}_1`
}

export function agentDisplayName(type: AgentBridgeType): string {
  switch (type) {
    case 'codex':
      return 'Codex'
    case 'hermes':
      return 'Hermes'
    case 'openclaw':
      return 'OpenClaw'
    case 'claude':
    default:
      return 'Claude Code'
  }
}

export function connectAgentFlag(type: AgentBridgeType): string {
  return type
}
