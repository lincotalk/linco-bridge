/** Streaming text merge helpers (aligned with aichat-service own-api-contract). */

export function separateAfterOutbound(current: string, incoming: string): string {
  if (!current.trim() || !incoming) return incoming
  if (/^[\r\n]/.test(incoming)) return incoming
  return `\n\n${incoming.replace(/^[ \t]+/, '')}`
}

export function appendStreamingContent(current: string, incoming: string): string {
  if (!current || !incoming) return `${current}${incoming}`
  if (
    lineEndsWithHeadingMarker(current) &&
    !startsWithMarkdownBoundary(incoming)
  ) {
    return `${current} ${trimLeadingHorizontalWhitespace(incoming)}`
  }
  const normalizedIncoming = trimLeadingHorizontalWhitespace(incoming)
  if (endsWithBlankLine(current) || /^[\r\n]/.test(incoming)) {
    return normalizeMarkdownBoundaries(`${current}${incoming}`)
  }
  if (!startsMarkdownBlock(normalizedIncoming)) {
    return normalizeStreamingMarkdownText(`${current}${incoming}`)
  }
  if (current.endsWith('\n')) return `${current}\n${normalizedIncoming}`
  return `${current}\n\n${normalizedIncoming}`
}

export function normalizeStreamingMarkdownText(value: string): string {
  return normalizeMarkdownBoundaries(normalizeInlineBlockStarts(value))
}

function endsWithBlankLine(value: string): boolean {
  return value.endsWith('\n\n') || value.endsWith('\r\n\r\n')
}

function startsMarkdownBlock(value: string): boolean {
  return /^(#{1,6}(?:\s|$|[^#])|```|~~~|>\s|[-*+]\s|\d+[.)]\s|\|.+\||-{3,}\s*$|\*{3,}\s*$)/.test(
    value,
  )
}

function trimLeadingHorizontalWhitespace(value: string): string {
  return value.replace(/^[ \t]+/, '')
}

function lineEndsWithHeadingMarker(value: string): boolean {
  const lineStart = value.lastIndexOf('\n') + 1
  const lastLine = value.substring(lineStart).trimStart()
  return /^#{1,6}$/.test(lastLine)
}

function startsWithMarkdownBoundary(value: string): boolean {
  return /^[\s\r\n]/.test(value)
}

function normalizeMarkdownBoundaries(value: string): string {
  return value.replace(/(^|\n)(#{1,6})(?=[^\s#])/g, '$1$2 ')
}

function normalizeInlineBlockStarts(value: string): string {
  return value.replace(/([^\n])([ \t]*)(#{2,6})(?=\s|[^\s#])/g, '$1\n\n$3')
}
