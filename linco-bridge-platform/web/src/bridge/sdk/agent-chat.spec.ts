import { describe, expect, it } from 'vitest'
import {
  createMockAgentChatSdk,
  buildLandingSubtitle,
  findMockHistoryItem,
  parseAgentTypeFromSessionId,
} from '@/bridge/sdk/agent-chat'

describe('createMockAgentChatSdk', () => {
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
    expect(parseAgentTypeFromSessionId('codex-new')).toBe('codex')
    expect(parseAgentTypeFromSessionId('unknown')).toBeNull()
  })
})
