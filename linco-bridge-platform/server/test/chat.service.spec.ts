import { WebSocket } from 'ws'
import { BridgePresenceService } from '../src/bridge/bridge-presence.service'
import { BridgeRelayService } from '../src/bridge/bridge-relay.service'
import { ChatService } from '../src/chat/chat.service'
import { DatabaseService } from '../src/database/database.service'
import { TEST_SEED_OWNER_ID } from '../src/shared/visitor-id.util'
import { createTestServices, resetTestVisitorContext } from './test-services'

describe('ChatService', () => {
  let chatService: ChatService
  let database: DatabaseService
  let presence: BridgePresenceService
  let relay: BridgeRelayService

  beforeEach(() => {
    ;({ chatService, database, presence, relay } = createTestServices())
  })

  afterEach(() => {
    resetTestVisitorContext()
  })

  it('hard-deletes all sessions for a connection when deleting grouped message row', () => {
    const connection = database.getConnectionByType(TEST_SEED_OWNER_ID,'codex')!
    const first = database.getSessionByConnectionId(connection.id)!
    database.touchSession(first.id, '第一条')
    database.updateSessionTitle(first.id, '第一条')

    const second = database.createSession({
      ownerId: TEST_SEED_OWNER_ID,
      agentType: 'codex',
      title: '深圳最近会下雨吗',
      bridgeConnectionId: connection.id,
      bridgeProjectPath: 'D:\\project\\ddjf-aichat',
      lastMessage: 'Ready when you are.',
    })
    database.touchSession(second.id, '第二条预览')
    database.insertMessage({
      sessionId: second.id,
      role: 'user',
      content: 'hello',
    })

    expect(chatService.listSessions()).toHaveLength(1)

    const result = chatService.deleteSessionsFromList([second.id])
    expect(result.deletedCount).toBeGreaterThanOrEqual(2)
    expect(chatService.listSessions()).toHaveLength(0)
    expect(database.getSession(first.id)).toBeUndefined()
    expect(database.getSession(second.id)).toBeUndefined()
    expect(database.listMessages(second.id)).toHaveLength(0)
  })

  it('hard-deletes sessions from message list', () => {
    const connection = database.getConnectionByType(TEST_SEED_OWNER_ID,'codex')!
    const session = database.getSessionByConnectionId(connection.id)!
    database.touchSession(session.id, 'hello from codex')

    expect(chatService.listSessions().some((item) => item.id === session.id)).toBe(true)

    const result = chatService.deleteSessionsFromList([session.id])
    expect(result.deletedCount).toBe(1)
    expect(chatService.listSessions().some((item) => item.id === session.id)).toBe(false)
    expect(database.getSession(session.id)).toBeUndefined()
  })

  it('hides unconnected bridge seed sessions from message list', () => {
    const sessions = chatService.listSessions()
    expect(sessions).toEqual([])
  })

  it('prefers session-scoped device name over connection device name', () => {
    const connection = database.getConnectionByType(TEST_SEED_OWNER_ID,'codex')!
    const session = database.getSessionByConnectionId(connection.id)!
    database.touchSession(session.id, '今天星期几啊')
    database.updateSessionTitle(session.id, '今天星期几啊')
    database.updateSessionBridgeBinding(session.id, { deviceName: 'MacBook Pro' })
    database.updateConnectionDevice(connection.id, { name: 'ThinkPad' })

    const sessions = chatService.listSessions()
    expect(sessions[0]?.title).toBe('Codex')
    expect(sessions[0]?.conversationTitle).toBe('今天星期几啊')
    expect(sessions[0]?.connectionId).toBe(connection.id)
  })

  it('uses connection display name in message list title', () => {
    const connection = database.getConnectionByType(TEST_SEED_OWNER_ID,'codex')!
    database.updateConnectionDisplayName(connection.id, '我的 Codex')
    database.updateConnectionDevice(connection.id, { name: 'HQ-TS-0182' })
    const session = database.getSessionByConnectionId(connection.id)!
    database.touchSession(session.id, '你好，我在。')

    const sessions = chatService.listSessions()
    expect(sessions[0]?.title).toBe('我的 Codex')
  })

  it('scopes agent history by connection id', () => {
    const connection = database.getConnectionByType(TEST_SEED_OWNER_ID,'codex')!
    const session = database.getSessionByConnectionId(connection.id)!
    database.touchSession(session.id, '今天星期几啊')
    database.updateSessionTitle(session.id, '今天星期几啊')

    const scoped = chatService.listAgentHistory('codex', 50, 0, connection.id)
    expect(scoped).toHaveLength(1)
    expect(scoped[0]?.id).toBe(session.id)
    expect(scoped[0]?.title).toBe('今天星期几啊')
  })

  it('strips device suffix from landing history titles', () => {
    const connection = database.getConnectionByType(TEST_SEED_OWNER_ID,'codex')!
    database.updateConnectionDevice(connection.id, { name: 'HQ-TS-0182' })
    const session = database.getSessionByConnectionId(connection.id)!
    database.touchSession(session.id, '今天星期几啊')
    database.updateSessionTitle(session.id, '今天星期几啊 - HQ-TS-0182')

    const scoped = chatService.listAgentHistory('codex', 50, 0, connection.id)
    expect(scoped[0]?.title).toBe('今天星期几啊')
  })

  it('hides agent history sessions without deleting messages', () => {
    const connection = database.getConnectionByType(TEST_SEED_OWNER_ID,'codex')!
    const session = database.getSessionByConnectionId(connection.id)!
    database.touchSession(session.id, '今天星期几啊')
    database.updateSessionTitle(session.id, '今天星期几啊')

    const result = chatService.hideAgentHistorySessions('codex', [session.id])
    expect(result.hiddenCount).toBe(1)
    expect(chatService.listAgentHistory('codex', 50, 0, connection.id)).toHaveLength(0)
    expect(database.getSession(session.id)).toBeDefined()
  })

  it('resumes an existing platform session by id', async () => {
    const connection = database.getConnectionByType(TEST_SEED_OWNER_ID,'codex')!
    const session = database.getSessionByConnectionId(connection.id)!
    database.updateSessionBridgeBinding(session.id, {
      projectPath: 'D:\\project\\ddjf-aichat',
      agentSessionId: 'desktop-session-1',
    })
    database.touchSession(session.id, '今天星期几啊')
    database.updateSessionTitle(session.id, '今天星期几啊')

    const resumed = await chatService.resumeSession(session.id)
    expect(resumed.sessionId).toBe(session.id)
    expect(resumed.title).toBe('今天星期几啊')
    expect(resumed.projectPath).toBe('D:\\project\\ddjf-aichat')
    expect(resumed.agentSessionId).toBe('desktop-session-1')
  })

  it('throws when resuming unknown session', async () => {
    await expect(chatService.resumeSession('missing-session-id')).rejects.toThrow('会话不存在')
  })

  it('groups message list to one row per connection', async () => {
    const connection = database.getConnectionByType(TEST_SEED_OWNER_ID,'codex')!
    const first = database.getSessionByConnectionId(connection.id)!
    database.touchSession(first.id, '第一条')
    database.updateSessionTitle(first.id, '第一条')

    const second = database.createSession({
      ownerId: TEST_SEED_OWNER_ID,
      agentType: 'codex',
      title: '深圳最近会下雨吗',
      bridgeConnectionId: connection.id,
      bridgeProjectPath: 'D:\\project\\ddjf-aichat',
      lastMessage: 'Ready when you are.',
    })

    await new Promise((resolve) => setTimeout(resolve, 15))

    database.touchSession(second.id, '第二条预览')
    database.updateSessionTitle(second.id, '深圳最近会下雨吗')

    const sessions = chatService.listSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.id).toBe(second.id)
    expect(sessions[0]?.title).toBe('Codex')
    expect(sessions[0]?.conversationTitle).toBe('深圳最近会下雨吗')
  })

  it('returns empty messages when connector is offline', async () => {
    const connection = database.getConnectionByType(TEST_SEED_OWNER_ID,'codex')!
    const session = database.getSessionByConnectionId(connection.id)!
    const messages = await chatService.listMessages(session.id)
    expect(messages).toEqual([])
  })

  it('loads messages from history-reload when connector is online', async () => {
    const connection = database.getConnectionByType(TEST_SEED_OWNER_ID,'codex')!
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
    database.updateSessionBridgeBinding(session!.id, {
      projectPath: 'D:\\project\\demo',
      agentSessionId: 'session-a',
    })

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
    expect(database.listMessages(session!.id).length).toBeGreaterThan(0)
  })

  it('sendMessage returns offline hint when connector is offline', async () => {
    const connection = database.getConnectionByType(TEST_SEED_OWNER_ID,'codex')!
    const session = database.getSessionByConnectionId(connection.id)!
    const reply = await chatService.sendMessage(session.id, 'hello bridge')
    expect(reply.role).toBe('assistant')
    expect(reply.content).toContain('未连接')

    const messages = await chatService.listMessages(session.id)
    expect(messages).toEqual([])
  })

  it('creates temp session without relinking connection primary session', async () => {
    const connection = database.getConnectionByType(TEST_SEED_OWNER_ID,'codex')!
    const original = database.getSessionByConnectionId(connection.id)!
    database.linkConnectionSession(connection.id, original.id)
    const linkedSessionId = database.getConnectionById(connection.id)!.session_id

    const result = await chatService.createConversation({
      agentType: 'codex',
      tempSession: true,
      title: '临时会话',
      connectionId: connection.id,
    })

    const refreshedConnection = database.getConnectionById(connection.id)!
    expect(result.sessionId).not.toBe(original.id)
    expect(refreshedConnection.session_id).toBe(linkedSessionId)
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

  it('persists temp session messages in sqlite and loads without bridge history', async () => {
    const result = await chatService.createConversation({
      agentType: 'codex',
      tempSession: true,
      message: 'hello temp',
    })

    const session = database.getSession(result.sessionId)!
    expect(session.title).toBe('hello temp')

    const reply = await chatService.sendMessage(result.sessionId, 'hello temp')
    expect(reply.role).toBe('assistant')

    const messages = await chatService.listMessages(result.sessionId)
    expect(messages.some((item) => item.role === 'user' && item.content === 'hello temp')).toBe(
      true,
    )
    expect(messages.some((item) => item.role === 'assistant')).toBe(true)
    expect(database.listMessages(result.sessionId)).toHaveLength(2)
  })

  it('does not persist messages for bound codex sessions without project path', async () => {
    const connection = database.getConnectionByType(TEST_SEED_OWNER_ID,'codex')!
    const session = database.getSessionByConnectionId(connection.id)!
    await chatService.sendMessage(session.id, 'hello bound')
    expect(database.listMessages(session.id)).toEqual([])
  })

  it('persists messages for bound hermes sessions in sqlite', async () => {
    const connection = database.getConnectionByType(TEST_SEED_OWNER_ID,'hermes')!
    const session = database.getSessionByConnectionId(connection.id)!
    await chatService.sendMessage(session.id, 'hello hermes')

    expect(database.listMessages(session.id).length).toBeGreaterThanOrEqual(2)
    const messages = await chatService.listMessages(session.id)
    expect(messages.some((item) => item.role === 'user' && item.content === 'hello hermes')).toBe(
      true,
    )
  })

  it('persists messages for bound openclaw sessions in sqlite', async () => {
    const connection = database.getConnectionByType(TEST_SEED_OWNER_ID,'openclaw')!
    const session = database.getSessionByConnectionId(connection.id)!
    await chatService.sendMessage(session.id, 'hello openclaw')

    expect(database.listMessages(session.id).length).toBeGreaterThanOrEqual(2)
    const messages = await chatService.listMessages(session.id)
    expect(
      messages.some((item) => item.role === 'user' && item.content === 'hello openclaw'),
    ).toBe(true)
  })

  it('persists project session messages in sqlite', async () => {
    const connection = database.getConnectionByType(TEST_SEED_OWNER_ID,'codex')!
    const session = database.createSession({
      ownerId: TEST_SEED_OWNER_ID,
      agentType: 'codex',
      title: 'demo',
      bridgeConnectionId: connection.id,
      bridgeProjectPath: 'D:\\project\\demo',
    })

    await chatService.sendMessage(session.id, 'hello project')

    expect(database.listMessages(session.id)).toHaveLength(2)
    const messages = await chatService.listMessages(session.id)
    expect(messages.some((item) => item.role === 'user' && item.content === 'hello project')).toBe(
      true,
    )
    expect(messages.some((item) => item.role === 'assistant')).toBe(true)
  })

  it('returns persisted message attachments from sqlite', async () => {
    const session = database.createSession({
      ownerId: TEST_SEED_OWNER_ID,
      agentType: 'codex',
      title: 'temp',
      isTempSession: true,
    })
    database.insertMessage({
      sessionId: session.id,
      role: 'assistant',
      content: '图片已生成',
      attachments: [
        {
          name: 'kitten.png',
          mimeType: 'image/png',
          previewUrl: 'data:image/png;base64,abc123',
        },
      ],
    })

    const messages = await chatService.listMessages(session.id)
    expect(messages).toHaveLength(1)
    expect(messages[0]?.attachments).toEqual([
      {
        name: 'kitten.png',
        mimeType: 'image/png',
        previewUrl: 'data:image/png;base64,abc123',
      },
    ])
  })

  it('imports bridge history into sqlite for project sessions on first load', async () => {
    const connection = database.getConnectionByType(TEST_SEED_OWNER_ID,'codex')!
    const mockSocket = {
      readyState: WebSocket.OPEN,
      OPEN: WebSocket.OPEN,
      send: jest.fn(),
    } as unknown as WebSocket
    presence.attach(connection.id, mockSocket)

    const sendSpy = jest.spyOn(presence, 'sendJson').mockReturnValue(true)
    const session = database.createSession({
      ownerId: TEST_SEED_OWNER_ID,
      agentType: 'codex',
      title: 'demo',
      bridgeConnectionId: connection.id,
      bridgeProjectPath: 'D:\\project\\demo',
      bridgeAgentSessionId: null,
    })

    const messages = await chatService.listMessages(session.id)
    expect(messages).toEqual([])
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('rejects agent bridge command for unknown connection id', async () => {
    await expect(
      chatService.runBridgeCommandByAgent('codex', '/status', 'missing-connection'),
    ).rejects.toThrow('连接配置不存在')
  })
})
