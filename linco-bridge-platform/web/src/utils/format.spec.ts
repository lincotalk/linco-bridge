import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from '@/utils/format'

describe('formatRelativeTime', () => {
  const now = new Date('2026-07-06T12:00:00.000Z').getTime()

  it('returns 刚刚 for recent timestamps', () => {
    expect(formatRelativeTime(now - 10_000, now)).toBe('刚刚')
  })

  it('returns minutes ago', () => {
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 分钟前')
  })

  it('returns date for older timestamps', () => {
    expect(formatRelativeTime(new Date('2026-01-02T08:00:00.000Z').getTime(), now)).toBe('01-02')
  })
})
