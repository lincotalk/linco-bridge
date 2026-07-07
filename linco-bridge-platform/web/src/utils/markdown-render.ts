export type MarkdownInlineNode =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; label: string; href: string }

export type MarkdownBlock =
  | { type: 'paragraph'; inlines: MarkdownInlineNode[] }
  | { type: 'heading'; level: number; inlines: MarkdownInlineNode[] }
  | { type: 'list'; ordered: boolean; items: MarkdownInlineNode[][] }
  | { type: 'blockquote'; inlines: MarkdownInlineNode[] }
  | { type: 'hr' }

const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g
const BOLD_PATTERN = /\*\*(.+?)\*\*/g
const INLINE_CODE_PATTERN = /`([^`\n]+)`/g

export function normalizeCodeFences(content: string): string {
  return content.replace(/([^\n])(```)/g, '$1\n\n$2')
}

export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const normalized = normalizeCodeFences(content.replace(/\r\n/g, '\n'))
  const lines = normalized.split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' })
      index += 1
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1]?.length ?? 1,
        inlines: parseInlineNodes(headingMatch[2] ?? ''),
      })
      index += 1
      continue
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/)
    if (quoteMatch) {
      const quoteLines: string[] = []
      while (index < lines.length) {
        const current = lines[index]?.trim() ?? ''
        const match = current.match(/^>\s?(.*)$/)
        if (!match) break
        quoteLines.push(match[1] ?? '')
        index += 1
      }
      blocks.push({
        type: 'blockquote',
        inlines: parseInlineNodes(quoteLines.join('\n')),
      })
      continue
    }

    const unorderedMatch = trimmed.match(/^[-*+]\s+(.+)$/)
    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/)
    if (unorderedMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch)
      const items: MarkdownInlineNode[][] = []
      while (index < lines.length) {
        const current = lines[index]?.trim() ?? ''
        const unordered = current.match(/^[-*+]\s+(.+)$/)
        const orderedItem = current.match(/^\d+\.\s+(.+)$/)
        if (ordered && !orderedItem) break
        if (!ordered && !unordered) break
        items.push(parseInlineNodes((ordered ? orderedItem?.[1] : unordered?.[1]) ?? ''))
        index += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    const paragraphLines: string[] = [line]
    index += 1
    while (index < lines.length) {
      const next = lines[index]?.trim() ?? ''
      if (
        !next ||
        /^#{1,6}\s/.test(next) ||
        /^>\s?/.test(next) ||
        /^[-*+]\s+/.test(next) ||
        /^\d+\.\s+/.test(next) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(next)
      ) {
        break
      }
      paragraphLines.push(lines[index] ?? '')
      index += 1
    }

    blocks.push({
      type: 'paragraph',
      inlines: parseInlineNodes(paragraphLines.join('\n')),
    })
  }

  if (blocks.length === 0 && content.trim()) {
    blocks.push({ type: 'paragraph', inlines: parseInlineNodes(content) })
  }

  return blocks
}

export function hasMarkdownStructure(content: string): boolean {
  const normalized = content.trim()
  if (!normalized) return false
  return (
    /^#{1,6}\s/m.test(normalized) ||
    /^>\s/m.test(normalized) ||
    /^[-*+]\s/m.test(normalized) ||
    /^\d+\.\s/m.test(normalized) ||
    /\*\*.+?\*\*/.test(normalized) ||
    /`[^`\n]+`/.test(normalized) ||
    LINK_PATTERN.test(normalized)
  )
}

export function parseInlineNodes(text: string): MarkdownInlineNode[] {
  if (!text) return []

  type Token = MarkdownInlineNode & { start: number; end: number }
  const tokens: Token[] = []

  const collect = (pattern: RegExp, map: (match: RegExpExecArray) => MarkdownInlineNode) => {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      tokens.push({
        ...map(match),
        start: match.index,
        end: match.index + match[0].length,
      })
    }
  }

  collect(LINK_PATTERN, (match) => ({
    type: 'link',
    label: (match[1] ?? match[2] ?? '').trim(),
    href: (match[2] ?? '').trim(),
  }))
  collect(BOLD_PATTERN, (match) => ({
    type: 'bold',
    value: (match[1] ?? '').trim(),
  }))
  collect(INLINE_CODE_PATTERN, (match) => ({
    type: 'code',
    value: match[1] ?? '',
  }))

  tokens.sort((a, b) => a.start - b.start)

  const nodes: MarkdownInlineNode[] = []
  let cursor = 0
  for (const token of tokens) {
    if (token.start < cursor) continue
    if (token.start > cursor) {
      nodes.push({ type: 'text', value: text.slice(cursor, token.start) })
    }
    nodes.push({
      type: token.type,
      ...(token.type === 'link'
        ? { label: token.label, href: token.href }
        : { value: (token as { value: string }).value }),
    } as MarkdownInlineNode)
    cursor = token.end
  }

  if (cursor < text.length) {
    nodes.push({ type: 'text', value: text.slice(cursor) })
  }

  return nodes.length > 0 ? nodes : [{ type: 'text', value: text }]
}
