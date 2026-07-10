import { describe, expect, it } from 'vitest'
import { createMockAgentChatSdk } from '@/bridge/sdk/agent-chat.mock'
import {
  appendAgentTypeQuery,
  buildLandingSubtitle,
  parseAgentTypeFromQuery,
  parseAgentTypeFromSessionId,
  resolveSessionAgentType,
} from '@/bridge/sdk/agent-chat'

describe('createMockAgentChatSdk', () => {
  it('returns empty history without fake project rows', async () => {
    const sdk = createMockAgentChatSdk()
    await expect(sdk.listHistory('codex')).resolves.toEqual([])
  })

  it('builds openclaw landing subtitle from online state only', async () => {
    const sdk = createMockAgentChatSdk({ online: { openclaw: true } })
    const header = await sdk.getLandingHeader('openclaw')

    expect(header.status).toBe('online')
    expect(buildLandingSubtitle(header)).toBe('在线')
  })

  it('builds hermes landing subtitle without fake profile/device', async () => {
    const sdk = createMockAgentChatSdk({ online: { hermes: true } })
    const header = await sdk.getLandingHeader('hermes')

    expect(header.deviceId).toBeUndefined()
    expect(header.boundContextName).toBeUndefined()
    expect(buildLandingSubtitle(header)).toBe('在线')
  })

  it('returns offline codex header without fake device id', async () => {
    const sdk = createMockAgentChatSdk()
    const header = await sdk.getLandingHeader('codex')

    expect(header.title).toBe('Codex')
    expect(header.deviceId).toBeUndefined()
    expect(header.status).toBe('offline')
  })

  it('creates temp conversation ids', async () => {
    const sdk = createMockAgentChatSdk()
    const result = await sdk.startConversation({ agentType: 'codex', tempSession: true })

    expect(result.sessionId.startsWith('codex-temp-')).toBe(true)
  })

  it('counts hidden history ids', async () => {
    const sdk = createMockAgentChatSdk()
    const hidden = await sdk.hideHistorySessions('codex', ['a', 'a', ''])

    expect(hidden).toBe(1)
  })
})

describe('agent type helpers', () => {
  it('parses hist-* session ids for agent type only', () => {
    expect(parseAgentTypeFromSessionId('hist-codex-admin')).toBe('codex')
  })

  it('parses agent type from query', () => {
    expect(parseAgentTypeFromQuery('hermes')).toBe('hermes')
    expect(parseAgentTypeFromQuery('unknown')).toBeNull()
  })

  it('resolves agent type from session metadata first', () => {
    expect(
      resolveSessionAgentType({
        sessionId: 'hist-codex-admin',
        sessionAgentType: 'claude',
      }),
    ).toBe('claude')
  })

  it('appends agentType query param', () => {
    const params = appendAgentTypeQuery(new URLSearchParams(), 'codex')
    expect(params.get('agentType')).toBe('codex')
  })
})
