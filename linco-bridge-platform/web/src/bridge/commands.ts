import type { AgentBridgeType } from './types'

export interface BridgeCommandParams {
  appId: string
  appSecret: string
  accountId: string
}

const LOCAL_AGENT_TYPES = new Set<AgentBridgeType>(['codex', 'claude', 'hermes'])

/** Human-readable agent name (aligned with Flutter LocalAgentBridgeSpec). */
export function getAgentDisplayName(type: AgentBridgeType): string {
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

/** CLI agent flag passed to linco-connect init --agent. */
export function getConnectAgentFlag(type: AgentBridgeType): string {
  return type === 'openclaw' ? 'openclaw' : type === 'claude' ? 'claude' : type
}

export function defaultAccountId(type: AgentBridgeType): string {
  return type === 'openclaw' ? 'openclaw_1' : `${type}_1`
}

/**
 * Single init command — must stay aligned with Flutter:
 * - import_local_agent_page.dart LocalAgentBridgeSpec.initCommand
 * - import_openclaw_page.dart OpenClawBridgeCommands.init
 */
export function buildInitCommand(type: AgentBridgeType, params: BridgeCommandParams): string {
  const agentFlag = getConnectAgentFlag(type)
  return `linco-connect init --token "${params.appId}:${params.appSecret}" --agent ${agentFlag} --account ${params.accountId}`
}

/**
 * Full setup block shown on the connection page.
 * Order and wording must match Flutter allCommands / OpenClawBridgeCommands.all.
 */
export function buildSetupCommands(type: AgentBridgeType, params: BridgeCommandParams): string {
  return [
    'npm install -g linco-connect',
    '',
    buildInitCommand(type, params),
    '',
    'linco-connect start --daemon',
  ].join('\n')
}

export function isLocalAgentType(type: AgentBridgeType): boolean {
  return LOCAL_AGENT_TYPES.has(type)
}

export function parseAgentBridgeType(raw: string): AgentBridgeType | null {
  const normalized = raw.trim().toLowerCase()
  if (
    normalized === 'codex' ||
    normalized === 'claude' ||
    normalized === 'hermes' ||
    normalized === 'openclaw'
  ) {
    return normalized
  }
  return null
}
