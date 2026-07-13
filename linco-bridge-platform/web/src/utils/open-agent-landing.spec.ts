import { describe, expect, it, vi } from 'vitest'
import {
  buildAgentHistoryUrl,
  buildAgentLandingUrl,
  openSessionLanding,
} from '@/utils/open-agent-landing'
import type { ChatSessionItem } from '@/bridge/types'

describe('open-agent-landing', () => {
  it('builds landing url with agent type only', () => {
    expect(buildAgentLandingUrl({ agentType: 'codex' })).toBe(
      '/pages/chat/landing?agentType=codex',
    )
  })

  it('builds landing url with connection id', () => {
    expect(
      buildAgentLandingUrl({
        agentType: 'codex',
        connectionId: 'conn-abc',
      }),
    ).toBe('/pages/chat/landing?agentType=codex&connectionId=conn-abc')
  })

  it('builds history url with connection id', () => {
    expect(
      buildAgentHistoryUrl({
        agentType: 'codex',
        connectionId: 'conn-abc',
      }),
    ).toBe('/pages/chat/history?agentType=codex&connectionId=conn-abc')
  })

  it('opens landing page from session list item', () => {
    const navigateTo = vi.fn()
    vi.stubGlobal('uni', { navigateTo })

    const item: ChatSessionItem = {
      id: 'session-1',
      agentType: 'codex',
      connectionId: 'conn-abc',
      title: 'Codex-aa',
      lastMessage: 'hello',
      updatedAt: 1,
      online: true,
    }

    openSessionLanding(item)

    expect(navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/pages/chat/landing?agentType=codex&connectionId=conn-abc',
      }),
    )
  })
})
