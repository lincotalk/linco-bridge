import { describe, expect, it } from 'vitest'
import {
  buildBridgeHeaderSubtitle,
  resolveChatHeader,
  stripDeviceSuffixFromTitle,
} from '@/utils/chat-header'

describe('stripDeviceSuffixFromTitle', () => {
  it('removes trailing device suffix from title', () => {
    expect(stripDeviceSuffixFromTitle('调整设置页推理与模型 - HQ-TS-0182', 'HQ-TS-0182')).toBe(
      '调整设置页推理与模型',
    )
  })
})

describe('buildBridgeHeaderSubtitle', () => {
  it('shows device name and online status', () => {
    expect(buildBridgeHeaderSubtitle('HQ-TS-0182', true)).toBe('HQ-TS-0182 · 在线')
  })

  it('shows only status when device name is missing', () => {
    expect(buildBridgeHeaderSubtitle('', false)).toBe('离线')
  })
})

describe('resolveChatHeader', () => {
  it('uses mock history title for hist-* session ids', () => {
    const header = resolveChatHeader('hist-codex-admin')

    expect(header.title).toBe('AIChat-Admin')
    expect(header.agentType).toBe('codex')
    expect(header.subtitle).toBe('离线')
  })

  it('strips device suffix from title and shows device in subtitle', () => {
    const header = resolveChatHeader(
      'session-1',
      {
        id: 'session-1',
        agentType: 'codex',
        title: 'Codex - HQ-TS-0182',
        conversationTitle: '调整设置页推理与模型',
        lastMessage: 'hello',
        updatedAt: 1,
        online: true,
        deviceName: 'HQ-TS-0182',
      },
      true,
      'HQ-TS-0182',
    )

    expect(header.title).toBe('调整设置页推理与模型')
    expect(header.subtitle).toBe('HQ-TS-0182 · 在线')
  })

  it('parses agent type from new conversation id', () => {
    const header = resolveChatHeader('codex-temp-123456')

    expect(header.agentType).toBe('codex')
    expect(header.title).toBe('Codex')
    expect(header.subtitle).toBe('离线')
  })
})
