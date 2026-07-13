import { describe, expect, it } from 'vitest'

import { appendQueryToPath, setQueryParam, toQueryString } from '@/utils/query-string'

describe('query-string', () => {
  it('serializes query params', () => {
    expect(
      toQueryString({
        agentType: 'codex',
        connectionId: 'conn-abc',
      }),
    ).toBe('agentType=codex&connectionId=conn-abc')
  })

  it('appends query to path', () => {
    expect(
      appendQueryToPath('/pages/chat/landing', {
        agentType: 'codex',
      }),
    ).toBe('/pages/chat/landing?agentType=codex')
  })

  it('sets and removes query params immutably', () => {
    const base = { agentType: 'codex' }
    expect(setQueryParam(base, 'connectionId', 'conn-1')).toEqual({
      agentType: 'codex',
      connectionId: 'conn-1',
    })
    expect(setQueryParam(base, 'connectionId', undefined)).toEqual({ agentType: 'codex' })
  })
})
