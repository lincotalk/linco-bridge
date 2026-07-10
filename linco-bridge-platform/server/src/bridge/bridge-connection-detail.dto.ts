import type { AgentBridgeType } from '../shared/constants'

export interface BridgeConnectionDetailDto {
  bridgeType: AgentBridgeType
  connectionId: string
  displayName: string
  description: string
  avatar: string
  appId: string
  appSecret: string
  secretMasked?: boolean
  accountId: string
  status: 'online' | 'offline'
  deviceName?: string
  lastSeenAt?: number
  clientVersion?: string
  setupCommands: string
  connectChannel: string
}
