import type { AgentBridgeType } from '../shared/constants'

/** Self-hosted platform channel — not official `linco` gateway. */
export const BRIDGE_CONNECT_CHANNEL = 'linco-demo'

export const DEFAULT_BRIDGE_WS_URL = 'ws://127.0.0.1:3300/bridge/ws'

export interface BridgeCommandParams {
  appId: string
  appSecret: string
  accountId: string
  channel?: string
  wsUrl?: string
}

/** Aligned with web/src/bridge/commands.ts and linco-connect init flags. */
export function buildInitCommand(type: AgentBridgeType, params: BridgeCommandParams): string {
  const channel = params.channel?.trim() || BRIDGE_CONNECT_CHANNEL
  const wsUrl = params.wsUrl?.trim() || `${DEFAULT_BRIDGE_WS_URL}/${type}`
  return [
    `linco-connect init --token "${params.appId}:${params.appSecret}"`,
    `--agent ${type}`,
    `--channel ${channel}`,
    `--account ${params.accountId}`,
    `--ws-url ${wsUrl}`,
    '--allow-insecure-ws',
  ].join(' ')
}

export function buildSetupCommands(type: AgentBridgeType, params: BridgeCommandParams): string {
  return [
    'npm install -g linco-connect',
    '',
    buildInitCommand(type, params),
    '',
    'linco-connect start --daemon',
  ].join('\n')
}
