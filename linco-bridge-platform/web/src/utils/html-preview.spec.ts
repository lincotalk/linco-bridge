import { describe, expect, it } from 'vitest'
import { fixMalformedHtml, injectCspMeta, wrapHtmlPreviewDocument } from './html-preview'

describe('html-preview', () => {
  it('fixes malformed doctype spacing', () => {
    expect(fixMalformedHtml('<!DOCTYPEhtml><html><body></body></html>')).toContain('<!DOCTYPE html>')
  })

  it('injects csp meta into head', () => {
    const html = injectCspMeta('<html><head></head><body>hi</body></html>')
    expect(html).toContain('Content-Security-Policy')
  })

  it('wraps fragment html for iframe preview', () => {
    const html = wrapHtmlPreviewDocument('<h1>Hello</h1>')
    expect(html).toContain('<body>')
    expect(html).toContain('<h1>Hello</h1>')
  })
})
