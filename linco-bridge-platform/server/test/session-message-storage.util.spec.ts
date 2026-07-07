import type { ChatSessionRow } from '../src/database/database.service'
import { shouldPersistSessionMessages } from '../src/chat/session-message-storage.util'

describe('shouldPersistSessionMessages', () => {
  const base: Pick<ChatSessionRow, 'is_temp_session' | 'bridge_project_path'> = {
    is_temp_session: 0,
    bridge_project_path: null,
  }

  it('returns true for temp sessions', () => {
    expect(shouldPersistSessionMessages({ ...base, is_temp_session: 1 })).toBe(true)
  })

  it('returns true for project-bound sessions', () => {
    expect(
      shouldPersistSessionMessages({
        ...base,
        bridge_project_path: 'D:\\project\\demo',
      }),
    ).toBe(true)
  })

  it('returns false for plain bound sessions without project path', () => {
    expect(shouldPersistSessionMessages(base)).toBe(false)
  })
})
