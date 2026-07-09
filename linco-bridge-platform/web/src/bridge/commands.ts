import type { AgentBridgeType } from './types'

/** Official Linco Talk IM channel inside linco-connect. */
export const LINCO_OFFICIAL_CHANNEL = 'linco' as const

/**
 * Self-hosted linco-bridge-platform channel (not official `linco`).
 * Must match linco-bridge-connect `CHANNEL_PRESETS['linco-demo']`.
 */
export const BRIDGE_CONNECT_CHANNEL = 'linco-demo' as const

export const DEFAULT_BRIDGE_WS_URL = 'ws://127.0.0.1:3300/bridge/ws'

export interface BridgeCommandParams {
  appId: string
  appSecret: string
  accountId: string
  /** IM channel for linco-connect; defaults to {@link BRIDGE_CONNECT_CHANNEL}. */
  channel?: string
  /** Optional WS override; omit to use linco-connect channel preset wsUrl. */
  wsUrl?: string
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

/** Unique account slot for linco-connect multi-account on one device. */
export function generateConnectionAccountId(type: AgentBridgeType): string {
  const suffix = Math.random().toString(16).slice(2, 10)
  return `${type}_${suffix}`
}

/**
 * Single init command — must stay aligned with Flutter:
 * - import_local_agent_page.dart LocalAgentBridgeSpec.initCommand
 * - import_openclaw_page.dart OpenClawBridgeCommands.init
 */
export function buildInitCommand(type: AgentBridgeType, params: BridgeCommandParams): string {
  const agentFlag = getConnectAgentFlag(type)
  const channel = params.channel?.trim() || BRIDGE_CONNECT_CHANNEL
  const parts = [
    `linco-connect init --token "${params.appId}:${params.appSecret}"`,
    `--agent ${agentFlag}`,
    `--channel ${channel}`,
    `--account ${params.accountId}`,
  ]
  const wsOverride = params.wsUrl?.trim()
  if (wsOverride) {
    parts.push(`--ws-url ${wsOverride}`)
  }
  // linco-demo preset uses ws://127.0.0.1:3300/bridge/ws/{agent}; local init needs explicit opt-in.
  if (!wsOverride || wsOverride.startsWith('ws://')) {
    parts.push('--allow-insecure-ws')
  }
  return parts.join(' ')
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
