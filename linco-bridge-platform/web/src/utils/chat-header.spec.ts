import { describe, expect, it } from 'vitest'
import { buildChatSubtitle, resolveChatHeader } from '@/utils/chat-header'

describe('resolveChatHeader', () => {
  it('uses mock history title for hist-* session ids', () => {
    const header = resolveChatHeader('hist-codex-admin')

    expect(header.title).toBe('AIChat-Admin')
    expect(header.agentType).toBe('codex')
    expect(header.subtitle).toContain('Codex')
    expect(header.subtitle).toContain('离线')
  })

  it('includes project path in subtitle for workspace history', () => {
    const header = resolveChatHeader('hist-codex-bpms')

    expect(header.title).toBe('bpms-workbench')
    expect(header.subtitle).toContain('D:\\project\\bpms-workbench')
  })

  it('prefers session store data when available', () => {
    const header = resolveChatHeader('session-1', {
      id: 'session-1',
      agentType: 'codex',
      title: 'Codex Bridge',
      lastMessage: 'hello',
      updatedAt: 1,
      online: true,
    })

    expect(header.title).toBe('Codex Bridge')
    expect(buildChatSubtitle('codex', true)).toBe('Codex · 在线')
    expect(header.subtitle).toBe('Codex · 在线')
  })

  it('parses agent type from new conversation id', () => {
    const header = resolveChatHeader('codex-temp-123456')

    expect(header.agentType).toBe('codex')
    expect(header.title).toBe('Codex')
  })
})
