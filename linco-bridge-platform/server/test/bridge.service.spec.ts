import { ConflictException } from '@nestjs/common'
import type { WebSocket } from 'ws'
import { BridgePresenceService } from '../src/bridge/bridge-presence.service'
import { BridgeService } from '../src/bridge/bridge.service'
import { DatabaseService } from '../src/database/database.service'

describe('BridgeService', () => {
  let database: DatabaseService
  let presence: BridgePresenceService
  let service: BridgeService

  beforeEach(() => {
    database = DatabaseService.createInMemory()
    presence = new BridgePresenceService()
    service = new BridgeService(database, presence)
  })

  it('returns setup for codex seed connection', () => {
    const setup = service.getSetup('codex')
    expect(setup.bridgeType).toBe('codex')
    expect(setup.appId).toBe('demo-codex-app')
    expect(setup.setupCommands).toContain('linco-connect init')
    expect(setup.setupCommands).toContain('--channel linco-demo')
  })

  it('reports offline before connector attaches', () => {
    const status = service.getStatus('claude')
    expect(status.connected).toBe(false)
    expect(status.bridgeType).toBe('claude')
  })

  it('requires online connector before listing contexts', () => {
    const connection = database.getConnectionByType('hermes')
    expect(connection).toBeDefined()
    expect(() => service.listContexts('hermes', connection!.id)).toThrow(ConflictException)
  })

  it('syncAgent links seeded session when connector is online', () => {
    const connection = database.getConnectionByType('codex')
    expect(connection).toBeDefined()
    presence.attach(connection!.id, { readyState: 1, OPEN: 1 } as unknown as WebSocket)

    const synced = service.syncAgent('codex', connection!.id)
    expect(synced.sessionId).toBeTruthy()
    expect(synced.agentName).toBe('Codex')
  })

  it('authenticates token from seeded credentials', () => {
    const row = service.authenticateToken('demo-openclaw-app:demo-openclaw-secret')
    expect(row?.bridge_type).toBe('openclaw')
  })
})
