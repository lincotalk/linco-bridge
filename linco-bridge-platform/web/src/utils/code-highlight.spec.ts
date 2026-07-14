import { describe, expect, it } from 'vitest'
import { escapeHtml, highlightCode } from './code-highlight'

describe('code-highlight', () => {
  it('escapes plain code safely', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('highlights javascript fences', () => {
    const html = highlightCode('const value = 1', 'javascript')
    expect(html).toContain('hljs-keyword')
    expect(html).toContain('const')
  })
})
