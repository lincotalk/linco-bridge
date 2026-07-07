import { describe, expect, it } from 'vitest'
import { buildAgentHistoryUrl, buildAgentLandingUrl } from '@/utils/open-agent-landing'

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
})
