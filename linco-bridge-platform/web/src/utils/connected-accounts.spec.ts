import { describe, expect, it } from 'vitest'

import {
  parseAccountsCommandResult,
  connectedAgentToBridgeCard,
  connectedAgentToSessionItem,
} from '@/utils/connected-accounts'

describe('parseAccountsCommandResult', () => {
  it('parses plugin accounts payload with enriched items', () => {
    const result = parseAccountsCommandResult({
      command: 'accounts',
      text: '2 个在线助手',
      payload: {
        channel: 'linco-demo',
        accountIds: ['codex_1', 'claude_1'],
        items: [
          {
            connectionId: 'conn-codex',
            agentType: 'codex',
            accountId: 'codex_1',
            title: 'Codex',
            description: 'Codex 桥接',
            avatar: '/static/icons/bot/bridge_codex.png',
            status: 'online',
            sessionId: 'session-codex',
            updatedAt: 100,
          },
        ],
      },
    })

    expect(result.channel).toBe('linco-demo')
    expect(result.accountIds).toEqual(['codex_1', 'claude_1'])
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.sessionId).toBe('session-codex')
  })

  it('falls back to empty list when payload is missing', () => {
    const result = parseAccountsCommandResult({
      command: 'accounts',
      text: '暂无在线助手',
    })

    expect(result.channel).toBe('linco-demo')
    expect(result.accountIds).toEqual([])
    expect(result.items).toEqual([])
    expect(result.hint).toBe('暂无在线助手')
  })

  it('normalizes legacy linco channel to linco-demo on platform', () => {
    const result = parseAccountsCommandResult({
      command: 'accounts',
      text: '暂无已连接助手',
      payload: {
        channel: 'linco',
        accountIds: [],
        items: [],
      },
    })

    expect(result.channel).toBe('linco-demo')
  })

  it('parses warning hint from payload', () => {
    const result = parseAccountsCommandResult({
      command: 'accounts',
      text: '本机 Agent 未连接',
      payload: {
        channel: 'linco-demo',
        accountIds: [],
        items: [],
        warning: '本机 Agent 未连接',
      },
    })

    expect(result.hint).toBe('本机 Agent 未连接')
  })

  it('falls back to accountIds when server items are missing', () => {
    const result = parseAccountsCommandResult({
      command: 'accounts',
      text: '1 个已连接助手',
      payload: {
        channel: 'linco-demo',
        accountIds: ['codex_a962e6c4'],
        items: [],
      },
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.accountId).toBe('codex_a962e6c4')
    expect(result.items[0]?.agentType).toBe('codex')
    expect(result.items[0]?.connectionId).toBe('codex_a962e6c4')
    expect(result.items[0]?.status).toBe('offline')
  })

  it('maps enriched server item to bridge card row', () => {
    const card = connectedAgentToBridgeCard({
      connectionId: 'conn-1',
      agentType: 'codex',
      accountId: 'codex_a962e6c4',
      title: 'Codex-dd',
      description: 'Codex 桥接',
      avatar: '',
      status: 'online',
      deviceName: 'MacBook',
      lastMessage: 'Ready when you are.',
      updatedAt: 123,
    })

    expect(card.title).toBe('Codex-dd')
    expect(card.subtitle).toBe('Ready when you are.')
    expect(card.icon).toBe('/static/icons/bot/codex.png')
    expect(card.type).toBe('codex')
  })

  it('maps enriched server item to session list row', () => {
    const sessionItem = connectedAgentToSessionItem({
      connectionId: 'conn-1',
      agentType: 'codex',
      accountId: 'codex_a962e6c4',
      title: '我的 Codex',
      description: 'Codex 桥接',
      avatar: '/static/icons/bot/bridge_codex.png',
      status: 'online',
      deviceName: 'MacBook',
      lastMessage: 'Ready when you are.',
      updatedAt: 123,
    })

    expect(sessionItem.title).toBe('我的 Codex')
    expect(sessionItem.connectionId).toBe('conn-1')
    expect(sessionItem.lastMessage).toBe('Ready when you are.')
    expect(sessionItem.online).toBe(true)
  })
})
