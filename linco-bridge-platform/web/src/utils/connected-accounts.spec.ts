import { describe, expect, it } from 'vitest'

import { parseAccountsCommandResult } from '@/utils/connected-accounts'

describe('parseAccountsCommandResult', () => {
  it('parses plugin accounts payload with enriched items', () => {
    const result = parseAccountsCommandResult({
      command: 'accounts',
      text: '2 个在线助手',
      payload: {
        channel: 'linco',
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

    expect(result.channel).toBe('linco')
    expect(result.accountIds).toEqual(['codex_1', 'claude_1'])
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.sessionId).toBe('session-codex')
  })

  it('falls back to empty list when payload is missing', () => {
    const result = parseAccountsCommandResult({
      command: 'accounts',
      text: '暂无在线助手',
    })

    expect(result.channel).toBe('linco')
    expect(result.accountIds).toEqual([])
    expect(result.items).toEqual([])
  })
})
