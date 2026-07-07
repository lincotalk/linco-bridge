import { DatabaseService } from '../src/database/database.service'
import { shouldShowSessionInList } from '../src/chat/session-list-filter.util'

describe('shouldShowSessionInList', () => {
  let database: DatabaseService

  beforeEach(() => {
    database = DatabaseService.createInMemory()
  })

  it('hides unconnected bridge seed sessions', () => {
    const connection = database.getConnectionByType('claude')!
    const session = database.getSessionByConnectionId(connection.id)!
    expect(shouldShowSessionInList(session, connection)).toBe(false)
  })

  it('shows sessions with real conversation preview', () => {
    const connection = database.getConnectionByType('codex')!
    const session = database.getSessionByConnectionId(connection.id)!
    database.touchSession(session.id, '今天星期几啊')
    const updated = database.getSession(session.id)!
    expect(shouldShowSessionInList(updated, connection)).toBe(true)
  })

  it('shows sessions bound to a desktop workspace', () => {
    const connection = database.getConnectionByType('codex')!
    const session = database.getSessionByConnectionId(connection.id)!
    database.updateSessionBridgeBinding(session.id, {
      projectPath: 'D:\\project\\demo',
      agentSessionId: 'session-a',
    })
    database.updateSessionTitle(session.id, 'Session A')
    const updated = database.getSession(session.id)!
    expect(shouldShowSessionInList(updated, connection)).toBe(true)
  })
})
