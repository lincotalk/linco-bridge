import { describe, expect, it } from 'vitest'

import { isBoundWorkspacePick } from '@/utils/pick-workspace'

describe('isBoundWorkspacePick', () => {
  it('returns true when both sessionId and agentSessionId are present', () => {
    expect(
      isBoundWorkspacePick({
        name: 'demo',
        path: 'D:\\project\\demo',
        sessionId: 'platform-1',
        agentSessionId: 'session-a',
      }),
    ).toBe(true)
  })

  it('returns false when only project is selected', () => {
    expect(
      isBoundWorkspacePick({
        name: 'demo',
        path: 'D:\\project\\demo',
        sessionId: 'platform-1',
      }),
    ).toBe(false)
  })
})
