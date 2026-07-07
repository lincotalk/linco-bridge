import { describe, expect, it } from 'vitest'
import { isLocalFileLinkTarget, quoteGetPath } from './attachment-open'

describe('attachment-open', () => {
  it('quotes paths with spaces', () => {
    expect(quoteGetPath('D:\\project\\a b.pdf')).toBe('"D:\\project\\a b.pdf"')
  })

  it('detects local file link targets', () => {
    expect(isLocalFileLinkTarget('D:\\tmp\\report.pdf')).toBe(true)
    expect(isLocalFileLinkTarget('https://example.com/a.pdf')).toBe(false)
  })
})
