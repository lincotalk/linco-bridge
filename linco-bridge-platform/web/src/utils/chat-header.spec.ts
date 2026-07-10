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
  it('shows device name and online status for codex', () => {
    expect(buildBridgeHeaderSubtitle('codex', true, 'HQ-TS-0182')).toBe('HQ-TS-0182 · 在线')
  })

  it('shows bound profile, device and online status for openclaw', () => {
    expect(
      buildBridgeHeaderSubtitle('openclaw', true, 'HQ-TS-0182', 'My Agent'),
    ).toBe('My Agent · HQ-TS-0182 · 在线')
  })

  it('shows bound profile, device and online status for hermes', () => {
    expect(
      buildBridgeHeaderSubtitle('hermes', true, 'HQ-TS-0184', 'Product Profile'),
    ).toBe('Product Profile · HQ-TS-0184 · 在线')
  })

  it('falls back to device name for hermes when profile is missing', () => {
    expect(buildBridgeHeaderSubtitle('hermes', false, 'HQ-TS-0184')).toBe('HQ-TS-0184 · 离线')
  })

  it('shows only status when device name is missing', () => {
    expect(buildBridgeHeaderSubtitle('codex', false)).toBe('离线')
  })
})

describe('resolveChatHeader', () => {
  it('uses agent display name when session has no title', () => {
    const header = resolveChatHeader('hist-codex-admin')

    expect(header.title).toBe('Codex')
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

  it('shows bound profile in subtitle for hermes chat', () => {
    const header = resolveChatHeader(
      'session-hermes',
      {
        id: 'session-hermes',
        agentType: 'hermes',
        title: 'Hermes',
        lastMessage: 'hello',
        updatedAt: 1,
        online: true,
        deviceName: 'HQ-TS-0184',
      },
      true,
      'HQ-TS-0184',
      'Product Profile',
    )

    expect(header.subtitle).toBe('Product Profile · HQ-TS-0184 · 在线')
  })

  it('parses agent type from new conversation id', () => {
    const header = resolveChatHeader('codex-temp-123456')

    expect(header.agentType).toBe('codex')
    expect(header.title).toBe('Codex')
    expect(header.subtitle).toBe('离线')
  })
})
