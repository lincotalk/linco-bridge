import { Logger } from '@nestjs/common'
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets'
import { IncomingMessage } from 'node:http'
import { RawData, WebSocket } from 'ws'
import { BridgePresenceService } from './bridge-presence.service'
import { BridgeRelayService } from './bridge-relay.service'
import { BridgeService } from './bridge.service'

type BridgeSocket = WebSocket & {
  __connectionId?: string
}

@WebSocketGateway({ path: '/bridge/ws' })
export class BridgeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(BridgeGateway.name)

  constructor(
    private readonly bridgeService: BridgeService,
    private readonly presence: BridgePresenceService,
    private readonly relay: BridgeRelayService,
  ) {}

  handleConnection(client: BridgeSocket, req: IncomingMessage): void {
    const token = this.extractToken(req.url ?? '')
    if (!token) {
      client.close(1008, 'Missing token')
      return
    }

    const connection = this.bridgeService.authenticateToken(token)
    if (!connection) {
      client.close(1008, 'Invalid token')
      return
    }

    client.__connectionId = connection.id
    this.presence.attach(connection.id, client)
    this.logger.log(`Bridge connected type=${connection.bridge_type} id=${connection.id}`)

    client.on('message', (data: RawData) => {
      this.handleMessage(client, data)
    })

    client.send(
      JSON.stringify({
        type: 'hello',
        bridgeType: connection.bridge_type,
        connectionId: connection.id,
      }),
    )
  }

  handleDisconnect(client: BridgeSocket): void {
    const connectionId = client.__connectionId
    if (!connectionId) return
    this.presence.detach(connectionId, client)
    this.logger.log(`Bridge disconnected id=${connectionId}`)
  }

  private handleMessage(client: BridgeSocket, data: RawData): void {
    let frame: Record<string, unknown>
    try {
      const text = this.rawDataToString(data)
      frame = JSON.parse(text) as Record<string, unknown>
    } catch {
      return
    }

    if (frame.type === 'ping') {
      client.send(JSON.stringify({ type: 'pong' }))
      return
    }

    if (frame.type === 'presence_event' && client.__connectionId) {
      const device = frame.device
      if (device && typeof device === 'object') {
        const record = device as Record<string, unknown>
        this.presence.updateDeviceInfo(client.__connectionId, {
          id: typeof record.id === 'string' ? record.id : undefined,
          name: typeof record.name === 'string' ? record.name : undefined,
        })
      }
      return
    }

    this.relay.handleConnectorFrame(frame)
  }

  private rawDataToString(data: RawData): string {
    if (typeof data === 'string') return data
    if (Buffer.isBuffer(data)) return data.toString('utf-8')
    if (Array.isArray(data)) {
      return Buffer.concat(data).toString('utf-8')
    }
    return Buffer.from(data).toString('utf-8')
  }

  private extractToken(url: string): string | null {
    try {
      const parsed = new URL(url, 'ws://localhost')
      return parsed.searchParams.get('token')
    } catch {
      return null
    }
  }
}
