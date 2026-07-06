import { Injectable } from '@nestjs/common'
import type { WebSocket } from 'ws'
import type { BridgeConnectionRow } from '../database/database.service'

@Injectable()
export class BridgePresenceService {
  private readonly clients = new Map<string, WebSocket>()

  attach(connectionId: string, socket: WebSocket): void {
    const existing = this.clients.get(connectionId)
    if (existing && existing !== socket) {
      existing.close(1008, 'Connection replaced')
    }
    this.clients.set(connectionId, socket)
  }

  detach(connectionId: string, socket: WebSocket): void {
    const current = this.clients.get(connectionId)
    if (current === socket) {
      this.clients.delete(connectionId)
    }
  }

  isOnline(connectionId: string): boolean {
    const socket = this.clients.get(connectionId)
    return Boolean(socket && socket.readyState === socket.OPEN)
  }

  getSocket(connectionId: string): WebSocket | undefined {
    const socket = this.clients.get(connectionId)
    if (!socket || socket.readyState !== socket.OPEN) return undefined
    return socket
  }

  sendJson(connectionId: string, payload: Record<string, unknown>): boolean {
    const socket = this.getSocket(connectionId)
    if (!socket) return false
    socket.send(JSON.stringify(payload))
    return true
  }

  connectionIdsForRow(_row: BridgeConnectionRow): string {
    return _row.id
  }
}
