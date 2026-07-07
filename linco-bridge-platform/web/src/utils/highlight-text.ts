export interface HighlightSegment {
  text: string
  highlight: boolean
}

export function buildHighlightSegments(text: string, query: string): HighlightSegment[] {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return [{ text, highlight: false }]
  }

  const lowerText = text.toLowerCase()
  const lowerQuery = trimmedQuery.toLowerCase()
  const segments: HighlightSegment[] = []
  let start = 0
  let index = lowerText.indexOf(lowerQuery)

  while (index !== -1) {
    if (index > start) {
      segments.push({ text: text.slice(start, index), highlight: false })
    }
    const end = index + trimmedQuery.length
    segments.push({ text: text.slice(index, end), highlight: true })
    start = end
    index = lowerText.indexOf(lowerQuery, start)
  }

  if (start < text.length) {
    segments.push({ text: text.slice(start), highlight: false })
  }

  return segments.length > 0 ? segments : [{ text, highlight: false }]
}
