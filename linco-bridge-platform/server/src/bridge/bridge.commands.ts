import type { AgentBridgeType } from '../shared/constants'

export interface BridgeCommandParams {
  appId: string
  appSecret: string
  accountId: string
}

/** Aligned with web/src/bridge/commands.ts and Flutter LocalAgentBridgeSpec. */
export function buildInitCommand(type: AgentBridgeType, params: BridgeCommandParams): string {
  return `linco-connect init --token "${params.appId}:${params.appSecret}" --agent ${type} --account ${params.accountId}`
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
