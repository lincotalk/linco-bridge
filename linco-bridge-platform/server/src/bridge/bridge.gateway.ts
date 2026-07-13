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



const AUTH_FAIL_WINDOW_MS = 60_000

const AUTH_FAIL_MAX = 30



@WebSocketGateway({ path: '/bridge/ws' })

export class BridgeGateway implements OnGatewayConnection, OnGatewayDisconnect {

  private readonly logger = new Logger(BridgeGateway.name)

  private readonly authFailures = new Map<string, { count: number; resetAt: number }>()



  constructor(

    private readonly bridgeService: BridgeService,

    private readonly presence: BridgePresenceService,

    private readonly relay: BridgeRelayService,

  ) {}



  handleConnection(client: BridgeSocket, req: IncomingMessage): void {

    const clientIp = this.resolveClientIp(req)

    if (this.isAuthRateLimited(clientIp)) {

      client.close(1008, 'Too many auth failures')

      return

    }



    const token = this.extractToken(req.url ?? '', req)

    if (!token) {

      this.recordAuthFailure(clientIp)

      client.close(1008, 'Missing token')

      return

    }



    const connection = this.bridgeService.authenticateToken(token)

    if (!connection) {

      this.recordAuthFailure(clientIp)

      client.close(1008, 'Invalid token')

      return

    }



    client.__connectionId = connection.id

    this.presence.attach(connection.id, client)

    this.bridgeService.markConnectionOnline(connection.id)

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

    this.bridgeService.markConnectionOffline(connectionId)

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

      let clientVersion: string | undefined

      const clientInfo = frame.client

      if (clientInfo && typeof clientInfo === 'object') {

        const record = clientInfo as Record<string, unknown>

        if (typeof record.version === 'string') {

          clientVersion = record.version

        }

      }

      if (device && typeof device === 'object') {

        const record = device as Record<string, unknown>

        this.bridgeService.persistConnectionDeviceInfo(client.__connectionId, {

          id: typeof record.id === 'string' ? record.id : undefined,

          name: typeof record.name === 'string' ? record.name : undefined,

        }, clientVersion)

      } else if (clientVersion) {

        this.bridgeService.persistConnectionDeviceInfo(client.__connectionId, {}, clientVersion)

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



  private extractToken(url: string, req: IncomingMessage): string | null {

    try {

      const parsed = new URL(url, 'ws://localhost')

      const fromQuery = parsed.searchParams.get('token')

      if (fromQuery?.trim()) return fromQuery.trim()

    } catch {

      // ignore malformed URL

    }



    const authorization = req.headers.authorization

    if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {

      const token = authorization.slice('Bearer '.length).trim()

      if (token) return token

    }



    return null

  }



  private resolveClientIp(req: IncomingMessage): string {

    const forwarded = req.headers['x-forwarded-for']

    if (typeof forwarded === 'string' && forwarded.trim()) {

      return forwarded.split(',')[0]?.trim() || 'unknown'

    }

    return req.socket.remoteAddress ?? 'unknown'

  }



  private isAuthRateLimited(clientIp: string): boolean {

    const now = Date.now()

    const entry = this.authFailures.get(clientIp)

    if (!entry || now >= entry.resetAt) return false

    return entry.count >= AUTH_FAIL_MAX

  }



  private recordAuthFailure(clientIp: string): void {

    const now = Date.now()

    const entry = this.authFailures.get(clientIp)

    if (!entry || now >= entry.resetAt) {

      this.authFailures.set(clientIp, { count: 1, resetAt: now + AUTH_FAIL_WINDOW_MS })

      return

    }

    entry.count += 1

  }

}


