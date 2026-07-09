import {
  BRIDGE_CONNECT_CHANNEL,
  buildInitCommand,
  buildSetupCommands,
  type BridgeCommandParams,
} from '../bridge/bridge.commands'
import type { AgentBridgeType } from '../shared/constants'
import { shouldEmbedWsUrlInSetupCommands } from '../shared/public-endpoint.util'

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
  connectChannel: string
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
    channel: BRIDGE_CONNECT_CHANNEL,
    ...(shouldEmbedWsUrlInSetupCommands() ? { wsUrl } : {}),
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
    connectChannel: BRIDGE_CONNECT_CHANNEL,
    initCommand,
    startCommand,
    setupCommands,
  }
}
