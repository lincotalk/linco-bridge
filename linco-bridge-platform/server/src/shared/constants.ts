import { randomUUID } from 'node:crypto'

export const DEMO_USER_ID = 'demo'

export const AGENT_BRIDGE_TYPES = ['codex', 'claude', 'hermes', 'openclaw'] as const

export type AgentBridgeType = (typeof AGENT_BRIDGE_TYPES)[number]

export function isAgentBridgeType(value: string): value is AgentBridgeType {
  return (AGENT_BRIDGE_TYPES as readonly string[]).includes(value)
}

export function defaultAccountId(type: AgentBridgeType): string {
  return type === 'openclaw' ? 'openclaw_1' : `${type}_1`
}

/** Unique account slot for linco-connect multi-account on one device. */
export function generateConnectionAccountId(type: AgentBridgeType): string {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8)
  return `${type}_${suffix}`
}

/** Unique app_id for an additional bridge connection row. */
export function generateConnectionAppId(type: AgentBridgeType): string {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8)
  return `demo-${type}-${suffix}-app`
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

export function agentBridgeSubtitle(type: AgentBridgeType): string {
  return `${agentDisplayName(type)} 桥接`
}

export function resolveConnectionDisplayName(
  connection: { display_name?: string | null; bridge_type: AgentBridgeType },
): string {
  const custom = connection.display_name?.trim()
  return custom || agentDisplayName(connection.bridge_type)
}

export function connectAgentFlag(type: AgentBridgeType): string {
  return type
}
