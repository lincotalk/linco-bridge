import { ConflictException } from '@nestjs/common'
import type { WebSocket } from 'ws'
import { WebSocket as WsConst } from 'ws'
import { BridgePresenceService } from '../src/bridge/bridge-presence.service'
import { BridgeRelayService } from '../src/bridge/bridge-relay.service'
import { BridgeService } from '../src/bridge/bridge.service'
import { DatabaseService } from '../src/database/database.service'

function onlineSocket(): WebSocket {
  return {
    readyState: WsConst.OPEN,
    OPEN: WsConst.OPEN,
    send: jest.fn(),
  } as unknown as WebSocket
}

describe('BridgeService', () => {
  let database: DatabaseService
  let presence: BridgePresenceService
  let relay: BridgeRelayService
  let service: BridgeService

  beforeEach(() => {
    database = DatabaseService.createInMemory()
    presence = new BridgePresenceService()
    relay = new BridgeRelayService()
    service = new BridgeService(database, presence, relay)
  })

  it('returns setup for codex seed connection with auto-allocated secret', () => {
    const setup = service.getSetup('codex')
    expect(setup.bridgeType).toBe('codex')
    expect(setup.appId).toBe('demo-codex-app')
    expect(setup.appSecret).not.toBe('demo-codex-secret')
    expect(setup.appSecret).toHaveLength(16)
    expect(setup.setupCommands).toContain('linco-connect init')
    expect(setup.setupCommands).toContain(`--token "demo-codex-app:${setup.appSecret}"`)
    expect(setup.setupCommands).toContain('--channel linco-demo')
    expect(setup.setupCommands).toContain('--allow-insecure-ws')
    expect(setup.setupCommands).not.toContain('--ws-url')
  })

  it('reuses allocated secret on subsequent getSetup calls', () => {
    const first = service.getSetup('claude')
    const second = service.getSetup('claude')
    expect(second.appSecret).toBe(first.appSecret)
  })

  it('reports offline before connector attaches', () => {
    const status = service.getStatus('claude')
    expect(status.connected).toBe(false)
    expect(status.bridgeType).toBe('claude')
  })

  it('requires online connector before listing contexts', async () => {
    const connection = database.getConnectionByType('hermes')
    expect(connection).toBeDefined()
    await expect(service.listContexts('hermes', connection!.id)).rejects.toThrow(ConflictException)
  })

  it('syncAgent links seeded session when connector is online', () => {
    const connection = database.getConnectionByType('codex')
    expect(connection).toBeDefined()
    presence.attach(connection!.id, onlineSocket())

    const synced = service.syncAgent('codex', connection!.id)
    expect(synced.sessionId).toBeTruthy()
    expect(synced.agentName).toBe('Codex')
    expect(database.getSession(synced.sessionId)).toBeDefined()
  })

  it('lists connector sessions for codex when slash command succeeds', async () => {
    const connection = database.getConnectionByType('codex')
    expect(connection).toBeDefined()
    presence.attach(connection!.id, onlineSocket())

    let capturedStreamId = ''
    jest.spyOn(presence, 'sendJson').mockImplementation((_connectionId, payload) => {
      capturedStreamId = String(payload.streamId)
      return true
    })

    const pending = service.listContexts('codex', connection!.id)
    await Promise.resolve()

    relay.handleConnectorFrame({
      type: 'slash_command_result',
      streamId: capturedStreamId,
      command: 'sessions',
      data: {
        workspace: 'D:\\project\\demo',
        items: [
          {
            id: 'session-a',
            title: 'First session',
            bindCommand: '/bind --project "D:\\project\\demo" "session-a"',
          },
        ],
      },
    })

    const contexts = await pending
    expect(contexts).toHaveLength(1)
    expect(contexts[0]?.id).toBe('session-a')
    expect(contexts[0]?.bindCommand).toContain('/bind')
  })

  it('lists openclaw agents from connector', async () => {
    const connection = database.getConnectionByType('openclaw')
    expect(connection).toBeDefined()
    presence.attach(connection!.id, onlineSocket())

    let capturedStreamId = ''
    jest.spyOn(presence, 'sendJson').mockImplementation((_connectionId, payload) => {
      capturedStreamId = String(payload.streamId)
      return true
    })

    const pending = service.listContexts('openclaw', connection!.id)
    await Promise.resolve()

    relay.handleConnectorFrame({
      type: 'slash_command_result',
      streamId: capturedStreamId,
      command: 'agent',
      data: {
        items: [{ id: 'main', bindCommand: '/agent --bind main' }],
      },
    })

    const contexts = await pending
    expect(contexts).toHaveLength(1)
    expect(contexts[0]?.id).toBe('main')
  })

  it('lists hermes profiles from connector', async () => {
    const connection = database.getConnectionByType('hermes')
    expect(connection).toBeDefined()
    presence.attach(connection!.id, onlineSocket())

    let capturedStreamId = ''
    jest.spyOn(presence, 'sendJson').mockImplementation((_connectionId, payload) => {
      capturedStreamId = String(payload.streamId)
      return true
    })

    const pending = service.listContexts('hermes', connection!.id)
    await Promise.resolve()

    relay.handleConnectorFrame({
      type: 'slash_command_result',
      streamId: capturedStreamId,
      command: 'profile',
      data: {
        items: [{ name: 'default', bindCommand: '/profile --bind default' }],
      },
    })

    const contexts = await pending
    expect(contexts).toHaveLength(1)
    expect(contexts[0]?.id).toBe('default')
  })

  it('lists connector projects for codex', async () => {
    const connection = database.getConnectionByType('codex')!
    presence.attach(connection!.id, onlineSocket())

    let capturedStreamId = ''
    jest.spyOn(presence, 'sendJson').mockImplementation((_connectionId, payload) => {
      capturedStreamId = String(payload.streamId)
      return true
    })

    const pending = service.listProjects('codex', connection!.id)
    await Promise.resolve()

    relay.handleConnectorFrame({
      type: 'slash_command_result',
      streamId: capturedStreamId,
      command: 'project',
      data: {
        items: [
          {
            label: 'demo',
            path: 'D:\\project\\demo',
            command: '/project --select "D:\\project\\demo"',
          },
        ],
      },
    })

    const projects = await pending
    expect(projects).toHaveLength(1)
    expect(projects[0]?.path).toBe('D:\\project\\demo')
  })

  it('authenticates token from seeded credentials', () => {
    const row = service.authenticateToken('demo-openclaw-app:demo-openclaw-secret')
    expect(row?.bridge_type).toBe('openclaw')
  })

  it('lists project sessions scoped by project path', async () => {
    const connection = database.getConnectionByType('codex')!
    presence.attach(connection.id, onlineSocket())

    let capturedStreamId = ''
    jest.spyOn(presence, 'sendJson').mockImplementation((_connectionId, payload) => {
      capturedStreamId = String(payload.streamId)
      return true
    })

    const pending = service.listProjectSessions('codex', connection.id, 'D:\\project\\demo', 10)
    await Promise.resolve()

    relay.handleConnectorFrame({
      type: 'slash_command_result',
      streamId: capturedStreamId,
      command: 'sessions',
      data: {
        workspace: 'D:\\project\\demo',
        items: [{ id: 'session-a', title: 'Session A' }],
      },
    })

    const sessions = await pending
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.id).toBe('session-a')
  })

  it('applyWorkspaceSelection reuses platform session for first bind and creates new for another desktop session', async () => {
    const connection = database.getConnectionByType('codex')!
    presence.attach(connection.id, onlineSocket())
    const seededSession = database.getSessionByConnectionId(connection.id)!

    const sendSpy = jest.spyOn(presence, 'sendJson').mockReturnValue(true)
    let commandIndex = 0
    const streamIds: string[] = []

    sendSpy.mockImplementation((_connectionId, payload) => {
      const streamId = String(payload.streamId ?? `stream-${commandIndex++}`)
      streamIds.push(streamId)
      queueMicrotask(() => {
        relay.handleConnectorFrame({
          type: 'turn_end',
          streamId,
          text: 'ok',
        })
      })
      return true
    })

    const first = await service.applyWorkspaceSelection('codex', connection.id, {
      projectPath: 'D:\\project\\demo',
      projectName: 'demo',
      agentSessionId: 'session-a',
      sessionTitle: 'Session A',
      bindCommand: '/bind --project "D:\\project\\demo" session-a',
      selectProjectCommand: '/project --select "D:\\project\\demo"',
      platformSessionId: seededSession.id,
    })

    expect(first.sessionId).toBe(seededSession.id)
    expect(first.agentSessionId).toBe('session-a')

    const second = await service.applyWorkspaceSelection('codex', connection.id, {
      projectPath: 'D:\\project\\demo',
      projectName: 'demo',
      agentSessionId: 'session-b',
      sessionTitle: 'Session B',
      bindCommand: '/bind --project "D:\\project\\demo" session-b',
      selectProjectCommand: '/project --select "D:\\project\\demo"',
      platformSessionId: seededSession.id,
    })

    expect(second.sessionId).not.toBe(seededSession.id)
    expect(database.findSessionByBridgeBinding(connection.id, 'D:\\project\\demo', 'session-a')?.id).toBe(
      seededSession.id,
    )
    expect(database.findSessionByBridgeBinding(connection.id, 'D:\\project\\demo', 'session-b')?.id).toBe(
      second.sessionId,
    )

    const third = await service.applyWorkspaceSelection('codex', connection.id, {
      projectPath: 'D:\\project\\demo',
      projectName: 'demo',
      agentSessionId: 'session-a',
      sessionTitle: 'Session A',
      bindCommand: '/bind --project "D:\\project\\demo" session-a',
      selectProjectCommand: '/project --select "D:\\project\\demo"',
      platformSessionId: seededSession.id,
    })

    expect(third.sessionId).toBe(seededSession.id)
  })

  it('applyWorkspaceSelection creates platform session for new project session without desktop bind', async () => {
    const connection = database.getConnectionByType('codex')!
    presence.attach(connection.id, onlineSocket())
    const seededSession = database.getSessionByConnectionId(connection.id)!

    jest.spyOn(presence, 'sendJson').mockImplementation((_connectionId, payload) => {
      const streamId = String(payload.streamId ?? 'stream-project-new')
      queueMicrotask(() => {
        relay.handleConnectorFrame({
          type: 'turn_end',
          streamId,
          text: 'ok',
        })
      })
      return true
    })

    const first = await service.applyWorkspaceSelection('codex', connection.id, {
      projectPath: 'D:\\project\\demo',
      projectName: 'demo',
      selectProjectCommand: '/project --select "D:\\project\\demo"',
    })

    expect(first.sessionId).not.toBe(seededSession.id)
    expect(first.agentSessionId).toBeUndefined()
    expect(database.getSession(first.sessionId)?.bridge_project_path).toBe('D:\\project\\demo')
    expect(database.getSession(first.sessionId)?.bridge_agent_session_id).toBeNull()

    const second = await service.applyWorkspaceSelection('codex', connection.id, {
      projectPath: 'D:\\project\\demo',
      projectName: 'demo',
      selectProjectCommand: '/project --select "D:\\project\\demo"',
    })

    expect(second.sessionId).toBe(first.sessionId)
  })

  it('applyWorkspaceSelection relays project-only select to resolved platform session', async () => {
    const connection = database.getConnectionByType('codex')!
    presence.attach(connection.id, onlineSocket())
    const seededSession = database.getSessionByConnectionId(connection.id)!

    const sendSpy = jest.spyOn(presence, 'sendJson').mockImplementation((_connectionId, payload) => {
      const streamId = String(payload.streamId ?? 'stream-project-select')
      queueMicrotask(() => {
        relay.handleConnectorFrame({
          type: 'turn_end',
          streamId,
          text: 'ok',
        })
      })
      return true
    })

    const result = await service.applyWorkspaceSelection('codex', connection.id, {
      projectPath: 'D:\\project\\demo',
      projectName: 'demo',
      selectProjectCommand: '/project --select "D:\\project\\demo"',
    })

    expect(result.sessionId).not.toBe(seededSession.id)
    expect(sendSpy).toHaveBeenCalled()
    const relayPayload = sendSpy.mock.calls[0]?.[1] as { sessionKey?: string }
    expect(relayPayload.sessionKey).toBe(result.sessionId)
  })

  it('applyWorkspaceSelection reuses preferred platform session for same project-only bind', async () => {
    const connection = database.getConnectionByType('codex')!
    presence.attach(connection.id, onlineSocket())

    jest.spyOn(presence, 'sendJson').mockImplementation((_connectionId, payload) => {
      const streamId = String(payload.streamId ?? 'stream-project-select')
      queueMicrotask(() => {
        relay.handleConnectorFrame({
          type: 'turn_end',
          streamId,
          text: 'ok',
        })
      })
      return true
    })

    const first = await service.applyWorkspaceSelection('codex', connection.id, {
      projectPath: 'D:\\project\\demo',
      projectName: 'demo',
      selectProjectCommand: '/project --select "D:\\project\\demo"',
    })

    const second = await service.applyWorkspaceSelection('codex', connection.id, {
      projectPath: 'D:\\project\\demo',
      projectName: 'demo',
      selectProjectCommand: '/project --select "D:\\project\\demo"',
      platformSessionId: first.sessionId,
    })

    expect(second.sessionId).toBe(first.sessionId)
  })
})
