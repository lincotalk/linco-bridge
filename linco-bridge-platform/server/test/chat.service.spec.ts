import { WebSocket } from 'ws'
import { BridgePresenceService } from '../src/bridge/bridge-presence.service'
import { BridgeRelayService } from '../src/bridge/bridge-relay.service'
import { BridgeService } from '../src/bridge/bridge.service'
import { ChatService } from '../src/chat/chat.service'
import { DatabaseService } from '../src/database/database.service'

describe('ChatService', () => {
  let chatService: ChatService
  let database: DatabaseService
  let presence: BridgePresenceService
  let relay: BridgeRelayService

  beforeEach(() => {
    database = DatabaseService.createInMemory()
    presence = new BridgePresenceService()
    const bridgeService = new BridgeService(database, presence, relay)
    relay = new BridgeRelayService()
    chatService = new ChatService(database, presence, bridgeService, relay)
  })

  it('lists seeded bridge sessions', () => {
    const sessions = chatService.listSessions()
    expect(sessions.length).toBe(4)
    expect(sessions.map((item) => item.agentType)).toEqual(
      expect.arrayContaining(['codex', 'claude', 'hermes', 'openclaw']),
    )
  })

  it('returns empty messages when connector is offline', async () => {
    const [session] = chatService.listSessions()
    const messages = await chatService.listMessages(session.id)
    expect(messages).toEqual([])
  })

  it('loads messages from history-reload when connector is online', async () => {
    const connection = database.getConnectionByType('codex')!
    const mockSocket = {
      readyState: WebSocket.OPEN,
      OPEN: WebSocket.OPEN,
      send: jest.fn(),
    } as unknown as WebSocket
    presence.attach(connection.id, mockSocket)

    let capturedStreamId = ''
    jest.spyOn(presence, 'sendJson').mockImplementation((_connectionId, payload) => {
      capturedStreamId = String(payload.streamId)
      return true
    })

    const session = database.getSessionByConnectionId(connection.id)
    expect(session).toBeDefined()

    const pending = chatService.listMessages(session!.id)
    await Promise.resolve()

    expect(capturedStreamId).toBeTruthy()

    relay.handleConnectorFrame({
      type: 'slash_command_result',
      streamId: capturedStreamId,
      command: 'history',
      data: {
        rounds: [
          {
            index: 1,
            user: { text: 'hello bridge', timestampMs: 1000 },
            assistant: { text: 'reply', timestampMs: 1001 },
          },
        ],
      },
    })

    const messages = await pending
    expect(messages.some((item) => item.role === 'user' && item.content === 'hello bridge')).toBe(
      true,
    )
    expect(messages.some((item) => item.role === 'assistant' && item.content === 'reply')).toBe(
      true,
    )
  })

  it('sendMessage returns offline hint when connector is offline', async () => {
    const [session] = chatService.listSessions()
    const reply = await chatService.sendMessage(session.id, 'hello bridge')
    expect(reply.role).toBe('assistant')
    expect(reply.content).toContain('未连接')

    const messages = await chatService.listMessages(session.id)
    expect(messages).toEqual([])
  })

  it('createConversation creates session without persisting first message', async () => {
    const result = await chatService.createConversation({
      agentType: 'claude',
      message: 'first hello',
      tempSession: true,
    })

    const messages = await chatService.listMessages(result.sessionId)
    expect(messages).toEqual([])
  })
})
