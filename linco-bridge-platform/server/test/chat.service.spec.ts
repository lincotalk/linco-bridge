import { BridgePresenceService } from '../src/bridge/bridge-presence.service'
import { BridgeRelayService } from '../src/bridge/bridge-relay.service'
import { BridgeService } from '../src/bridge/bridge.service'
import { ChatService } from '../src/chat/chat.service'
import { DatabaseService } from '../src/database/database.service'

describe('ChatService', () => {
  let chatService: ChatService
  let database: DatabaseService

  beforeEach(() => {
    database = DatabaseService.createInMemory()
    const presence = new BridgePresenceService()
    const bridgeService = new BridgeService(database, presence)
    const relay = new BridgeRelayService()
    chatService = new ChatService(database, presence, bridgeService, relay)
  })

  it('lists seeded bridge sessions', () => {
    const sessions = chatService.listSessions()
    expect(sessions.length).toBe(4)
    expect(sessions.map((item) => item.agentType)).toEqual(
      expect.arrayContaining(['codex', 'claude', 'hermes', 'openclaw']),
    )
  })

  it('stores user and assistant messages in demo mode', async () => {
    const [session] = chatService.listSessions()
    const reply = await chatService.sendMessage(session.id, 'hello bridge')
    expect(reply.role).toBe('assistant')
    expect(reply.content).toContain('hello bridge')

    const messages = chatService.listMessages(session.id)
    expect(messages.some((item) => item.role === 'user' && item.content === 'hello bridge')).toBe(
      true,
    )
  })
})
