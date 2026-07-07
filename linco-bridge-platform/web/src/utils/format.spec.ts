import { describe, expect, it } from 'vitest'
import { formatConversationTime, formatRelativeTime, formatSessionPreview } from '@/utils/format'

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

describe('formatConversationTime', () => {
  const now = new Date('2026-07-06T12:00:00.000Z').getTime()

  it('returns HH:mm for same day', () => {
    const ts = new Date('2026-07-06T02:28:00.000Z').getTime()
    expect(formatConversationTime(ts, now)).toMatch(/^\d{2}:\d{2}$/)
  })

  it('returns MM-DD for previous days', () => {
    expect(formatConversationTime(new Date('2026-07-01T08:00:00.000Z').getTime(), now)).toBe('07-01')
  })
})

describe('formatSessionPreview', () => {
  it('collapses multiline markdown to one line', () => {
    const preview = formatSessionPreview(
      '我会在项目根目录新建一个纯文本攻略文\n\n[beijing-travel-guide.txt](D:/project/bpms-workbench/beijing-travel-guide.txt)\n\n文件放在项目根目录',
    )
    expect(preview).not.toContain('\n')
    expect(preview).toContain('beijing-travel-guide.txt')
  })
})
