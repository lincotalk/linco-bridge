import {
  buildInitCommand,
  buildSetupCommands,
  type BridgeCommandParams,
} from '../bridge/bridge.commands'
import type { AgentBridgeType } from '../shared/constants'

export interface BridgeSetupDto {
  bridgeType: AgentBridgeType
  connectionId: string
  appId: string
  appSecret: string
  accountId: string
  credentialStatus: string
  occupied: boolean
  wsBaseUrl: string
  wsUrl: string
  initCommand: string
  startCommand: string
  setupCommands: string
}

export function toBridgeSetupDto(
  input: {
    bridgeType: AgentBridgeType
    connectionId: string
    appId: string
    appSecret: string
    accountId: string
    boundContextId?: string | null
  },
  wsUrl: string,
): BridgeSetupDto {
  const params: BridgeCommandParams = {
    appId: input.appId,
    appSecret: input.appSecret,
    accountId: input.accountId,
  }
  const initCommand = buildInitCommand(input.bridgeType, params)
  const startCommand = 'linco-connect start --daemon'
  const setupCommands = buildSetupCommands(input.bridgeType, params)
  const occupied = Boolean(input.boundContextId)

  return {
    bridgeType: input.bridgeType,
    connectionId: input.connectionId,
    appId: input.appId,
    appSecret: input.appSecret,
    accountId: input.accountId,
    credentialStatus: occupied ? 'bound' : 'available',
    occupied,
    wsBaseUrl: wsUrl,
    wsUrl,
    initCommand,
    startCommand,
    setupCommands,
  }
}
