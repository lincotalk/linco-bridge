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
  streamSessionMessage: vi.fn(async (_sessionId, _content, handlers) => {
    handlers.onUserMessage?.({
      id: 'm-user',
      sessionId: 'session-1',
      role: 'user',
      content: 'hi',
      createdAt: 1,
    })
    handlers.onChunk?.({ fullText: 'ack' })
    const reply = {
      id: 'm-assistant',
      sessionId: 'session-1',
      role: 'assistant' as const,
      content: 'ack',
      createdAt: 2,
    }
    handlers.onDone?.(reply)
    return reply
  }),
  cancelStreamMessage: vi.fn(async () => null),
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

  it('replaces streaming placeholder on done instead of duplicating assistant message', async () => {
    const store = useSessionStore()
    await store.sendMessageStream('session-1', 'hi')

    const messages = store.getMessages('session-1')
    const assistantMessages = messages.filter((item) => item.role === 'assistant')

    expect(assistantMessages).toHaveLength(1)
    expect(assistantMessages[0]?.content).toBe('ack')
    expect(assistantMessages[0]?.streaming).toBe(false)
  })

  it('shows optimistic user message before stream user event', async () => {
    const { streamSessionMessage } = await import('@/api/session-api')
    vi.mocked(streamSessionMessage).mockImplementationOnce(
      async (_sessionId, _content, handlers) => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        handlers.onUserMessage?.({
          id: 'm-user',
          sessionId: 'session-1',
          role: 'user',
          content: 'hi',
          createdAt: 1,
        })
        const reply = {
          id: 'm-assistant',
          sessionId: 'session-1',
          role: 'assistant' as const,
          content: 'ack',
          createdAt: 2,
        }
        handlers.onDone?.(reply)
        return reply
      },
    )

    const store = useSessionStore()
    const pending = store.sendMessageStream('session-1', 'hi')
    expect(store.getMessages('session-1').some((item) => item.role === 'user' && item.content === 'hi')).toBe(
      true,
    )
    await pending
  })
})
