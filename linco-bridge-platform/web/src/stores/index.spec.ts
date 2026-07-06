import { describe, expect, it, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '@/stores'

vi.mock('@/api/session-api', () => ({
  fetchSessions: vi.fn(async () => [
    {
      id: 'session-1',
      agentType: 'codex',
      title: 'Codex',
      lastMessage: 'hello',
      updatedAt: 1,
      online: true,
    },
  ]),
  fetchMessages: vi.fn(async () => []),
  sendSessionMessage: vi.fn(async () => ({
    id: 'm-assistant',
    sessionId: 'session-1',
    role: 'assistant',
    content: 'ack',
    createdAt: 2,
  })),
}))

describe('useSessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('loads sessions from API layer', async () => {
    const store = useSessionStore()
    await store.loadSessions()
    expect(store.sessions).toHaveLength(1)
    expect(store.sessions[0]?.title).toBe('Codex')
  })
})
