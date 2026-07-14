export const HTML_PREVIEW_MAX_BYTES = 50 * 1024

export function canPreviewHtml(html: string): boolean {
  return html.length <= HTML_PREVIEW_MAX_BYTES
}

export function fixMalformedHtml(html: string): string {
  let output = html

  output = output.replace(/<!DOCTYPE(\w)/gi, '<!DOCTYPE $1')

  const tags =
    'html|head|body|div|span|meta|link|script|style|title|' +
    'h[1-6]|p|br|hr|a|ul|ol|li|table|thead|tbody|tfoot|tr|th|td|' +
    'form|input|button|select|option|textarea|img|nav|header|' +
    'footer|section|article|main|aside|figure|figcaption|label|' +
    'fieldset|legend|details|summary|canvas|video|audio|' +
    'source|iframe|pre|code|blockquote'

  output = output.replace(new RegExp(`<(${tags})([a-zA-Z])`, 'gi'), '<$1 $2')

  output = output.replace(
    />([a-z][a-z0-9-]*="[^"<>]*"(?:[a-z][a-z0-9-]*="[^"<>]*")*)>(?=<)/g,
    (_, attrs: string) => {
      const normalized = attrs.replace(/"([a-z][a-z0-9-]*=)/g, '" $1')
      return `><meta ${normalized}>`
    },
  )

  return output
}

export function injectCspMeta(html: string): string {
  if (html.includes('Content-Security-Policy')) return html

  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'self' *; style-src 'self' 'unsafe-inline' *; script-src 'self' 'unsafe-inline' 'unsafe-eval' *; img-src 'self' data: blob: *; font-src 'self' *; connect-src 'self' *; frame-src 'self' *; object-src 'none';">`

  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>\n${cspMeta}`)
  }

  if (/<!DOCTYPE/i.test(html)) {
    const doctypeEnd = html.indexOf('>', html.search(/<!DOCTYPE/i)) + 1
    return `${html.slice(0, doctypeEnd)}\n<html><head>\n${cspMeta}</head>${html.slice(doctypeEnd)}`
  }

  return `<html><head>\n${cspMeta}</head><body>${html}</body></html>`
}

export function prepareHtmlPreviewDocument(html: string): string {
  return injectCspMeta(fixMalformedHtml(html))
}

export function wrapHtmlPreviewDocument(html: string): string {
  const trimmed = html.trim()
  if (/<!DOCTYPE/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    return prepareHtmlPreviewDocument(trimmed)
  }
  return prepareHtmlPreviewDocument(`<!DOCTYPE html><html><body>${trimmed}</body></html>`)
}
