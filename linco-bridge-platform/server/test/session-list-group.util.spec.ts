import { groupSessionsForMessageList } from '../src/chat/session-list-group.util'
import type { ChatSessionDto } from '../src/chat/chat.service'

describe('groupSessionsForMessageList', () => {
  it('keeps only the latest session per connection', () => {
    const sessions: ChatSessionDto[] = [
      {
        id: 's1',
        agentType: 'codex',
        connectionId: 'conn-1',
        title: '旧会话 - HQ-TS-0182',
        lastMessage: 'old',
        updatedAt: 100,
        online: true,
      },
      {
        id: 's2',
        agentType: 'codex',
        connectionId: 'conn-1',
        title: '深圳最近会下雨吗 - HQ-TS-0182',
        lastMessage: 'new',
        updatedAt: 200,
        online: true,
      },
    ]

    const grouped = groupSessionsForMessageList(sessions)
    expect(grouped).toHaveLength(1)
    expect(grouped[0]?.id).toBe('s2')
    expect(grouped[0]?.title).toBe('深圳最近会下雨吗 - HQ-TS-0182')
  })

  it('keeps separate rows for different connections', () => {
    const sessions: ChatSessionDto[] = [
      {
        id: 's1',
        agentType: 'codex',
        connectionId: 'conn-a',
        title: 'A - Device-A',
        lastMessage: 'a',
        updatedAt: 100,
        online: true,
      },
      {
        id: 's2',
        agentType: 'codex',
        connectionId: 'conn-b',
        title: 'B - Device-B',
        lastMessage: 'b',
        updatedAt: 50,
        online: false,
      },
    ]

    const grouped = groupSessionsForMessageList(sessions)
    expect(grouped).toHaveLength(2)
  })
})
