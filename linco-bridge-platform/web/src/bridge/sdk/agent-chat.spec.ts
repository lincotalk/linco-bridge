import { describe, expect, it } from 'vitest'
import {
  createMockAgentChatSdk,
  buildLandingSubtitle,
  findMockHistoryItem,
  parseAgentTypeFromSessionId,
  parseAgentTypeFromQuery,
  resolveSessionAgentType,
} from '@/bridge/sdk/agent-chat'

describe('createMockAgentChatSdk', () => {
  it('returns openclaw landing header with bound profile subtitle', async () => {
    const sdk = createMockAgentChatSdk({ online: { openclaw: true } })
    const header = await sdk.getLandingHeader('openclaw')

    expect(header.boundContextName).toBe('main')
    expect(buildLandingSubtitle(header)).toBe('main · HQ-TS-0185 · 在线')
  })

  it('returns hermes landing header with bound profile subtitle', async () => {
    const sdk = createMockAgentChatSdk({ online: { hermes: true } })
    const header = await sdk.getLandingHeader('hermes')

    expect(header.title).toBe('Hermes')
    expect(header.boundContextName).toBe('Default Profile')
    expect(buildLandingSubtitle(header)).toBe('Default Profile · HQ-TS-0184 · 在线')
  })

  it('returns codex landing header with device id and offline status', async () => {
    const sdk = createMockAgentChatSdk()
    const header = await sdk.getLandingHeader('codex')

    expect(header.title).toBe('Codex')
    expect(header.deviceId).toBe('HQ-TS-0182')
    expect(header.status).toBe('offline')
    expect(buildLandingSubtitle(header)).toBe('HQ-TS-0182 · 离线')
  })

  it('lists mock history for codex', async () => {
    const sdk = createMockAgentChatSdk()
    const items = await sdk.listHistory('codex')

    expect(items.length).toBeGreaterThanOrEqual(3)
    expect(items[0]?.title).toBe('AIChat-Admin')
  })

  it('starts conversation with temp session id', async () => {
    const sdk = createMockAgentChatSdk()
    const result = await sdk.startConversation({
      agentType: 'codex',
      message: 'hello',
      tempSession: true,
    })

    expect(result.sessionId).toMatch(/^codex-temp-/)
  })

  it('finds mock history by id', () => {
    const item = findMockHistoryItem('hist-codex-admin')
    expect(item?.title).toBe('AIChat-Admin')
  })

  it('parses agent type from session id', () => {
    expect(parseAgentTypeFromSessionId('hist-codex-admin')).toBe('codex')
    expect(parseAgentTypeFromSessionId('hist-claude-admin')).toBe('claude')
    expect(parseAgentTypeFromSessionId('codex-new')).toBe('codex')
    expect(parseAgentTypeFromSessionId('unknown')).toBeNull()
    expect(parseAgentTypeFromSessionId('a1b2c3d4-uuid')).toBeNull()
  })

  it('parses agent type from query', () => {
    expect(parseAgentTypeFromQuery('claude')).toBe('claude')
    expect(parseAgentTypeFromQuery(' codex ')).toBe('codex')
    expect(parseAgentTypeFromQuery('')).toBeNull()
    expect(parseAgentTypeFromQuery('invalid')).toBeNull()
  })

  it('resolves agent type for uuid temp sessions from store metadata', () => {
    expect(
      resolveSessionAgentType({
        sessionId: 'f8d2f0f6-4f7b-4f1a-9f0a-111111111111',
        sessionAgentType: 'claude',
      }),
    ).toBe('claude')
    expect(
      resolveSessionAgentType({
        sessionId: 'f8d2f0f6-4f7b-4f1a-9f0a-111111111111',
        queryAgentType: 'claude',
      }),
    ).toBe('claude')
  })

  it('lists mock history for claude', async () => {
    const sdk = createMockAgentChatSdk()
    const items = await sdk.listHistory('claude')

    expect(items.length).toBeGreaterThanOrEqual(2)
    expect(items.some((item) => item.id === 'hist-claude-admin')).toBe(true)
  })
})
