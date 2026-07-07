import { describe, expect, it } from 'vitest'
import { stashPendingLaunch, takePendingLaunch } from './pendingLaunchTransfer'

describe('pendingLaunchTransfer', () => {
  it('stashes and takes launch message for matching session', () => {
    stashPendingLaunch('session-a', 'hello temp')
    expect(takePendingLaunch('session-a')).toBe('hello temp')
    expect(takePendingLaunch('session-a')).toBeUndefined()
  })

  it('ignores mismatched session id', () => {
    stashPendingLaunch('session-a', 'hello')
    expect(takePendingLaunch('session-b')).toBeUndefined()
    expect(takePendingLaunch('session-a')).toBe('hello')
  })
})
