import { describe, expect, it } from 'vitest'

import { AbortError, createCancelToken, isAbortError } from '@/utils/platform-runtime'

describe('platform-runtime', () => {
  it('creates cancel token and aborts listeners', () => {
    const token = createCancelToken()
    let called = false
    token.onAbort(() => {
      called = true
    })
    token.abort()
    expect(token.aborted).toBe(true)
    expect(called).toBe(true)
  })

  it('detects abort errors', () => {
    expect(isAbortError(new AbortError())).toBe(true)
    expect(isAbortError(new Error('x'))).toBe(false)
  })
})
