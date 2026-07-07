import { describe, expect, it } from 'vitest'
import { formatThinkingDuration } from '@/utils/format-duration'

describe('formatThinkingDuration', () => {
  it('formats elapsed seconds', () => {
    expect(formatThinkingDuration(1000, 15000)).toBe('14s')
  })

  it('uses at least 1 second', () => {
    expect(formatThinkingDuration(1000, 1200)).toBe('1s')
  })
})
