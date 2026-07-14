export type LazyMarkdownChunk = {
  source: string
  hasHeavyContent: boolean
}

export const LAZY_MARKDOWN_MIN_LINES = 32
export const LAZY_MARKDOWN_TARGET_LINES = 24

export function shouldUseLazyMarkdown(content: string): boolean {
  return normalizeLines(content).length >= LAZY_MARKDOWN_MIN_LINES
}

export function splitLazyMarkdownChunks(
  content: string,
  targetLineCount = LAZY_MARKDOWN_TARGET_LINES,
): LazyMarkdownChunk[] {
  if (targetLineCount <= 0) {
    throw new Error('targetLineCount must be greater than zero')
  }

  const lines = normalizeLines(content)
  if (lines.length === 0) return []

  const units: LazyMarkdownChunk[] = []
  let proseLines: string[] = []
  let codeLines: string[] = []
  let fenceLanguage = ''
  let inFence = false

  const flushProse = () => {
    const text = proseLines.join('\n').trim()
    proseLines = []
    if (!text) return
    for (const part of splitLongProse(text, targetLineCount)) {
      units.push({ source: part, hasHeavyContent: false })
    }
  }

  const flushCode = (complete: boolean) => {
    const code = codeLines.join('\n').replace(/\n$/, '')
    codeLines = []
    const label = fenceLanguage.trim()
    fenceLanguage = ''
    if (!code && !label) return
    const fenceBody = label ? `\`\`\`${label}\n${code}` : `\`\`\`\n${code}`
    units.push({
      source: complete ? `${fenceBody}\n\`\`\`` : fenceBody,
      hasHeavyContent: true,
    })
  }

  for (const line of lines) {
    const trimmedLeft = line.trimStart()
    if (trimmedLeft.startsWith('```')) {
      if (inFence) {
        flushCode(true)
        inFence = false
      } else {
        flushProse()
        fenceLanguage = trimmedLeft.slice(3).trim()
        inFence = true
      }
      continue
    }

    if (inFence) {
      codeLines.push(line)
    } else {
      proseLines.push(line)
    }
  }

  if (inFence) {
    flushCode(false)
  } else {
    flushProse()
  }

  if (units.length === 0) {
    return [{ source: content.trim(), hasHeavyContent: false }]
  }

  const chunks: LazyMarkdownChunk[] = []
  let pending: LazyMarkdownChunk[] = []
  let pendingLineCount = 0

  const flushPending = () => {
    if (pending.length === 0) return
    chunks.push({
      source: pending.map((unit) => unit.source).join('\n\n'),
      hasHeavyContent: pending.some((unit) => unit.hasHeavyContent),
    })
    pending = []
    pendingLineCount = 0
  }

  for (const unit of units) {
    const lineCount = unit.source.split('\n').length
    if (pending.length > 0 && pendingLineCount + lineCount > targetLineCount) {
      flushPending()
    }
    pending.push(unit)
    pendingLineCount += lineCount
  }
  flushPending()

  return chunks
}

function normalizeLines(content: string): string[] {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
}

function splitLongProse(text: string, targetLineCount: number): string[] {
  const lines = text.split('\n')
  if (lines.length <= targetLineCount) return [text]

  const parts: string[] = []
  for (let index = 0; index < lines.length; index += targetLineCount) {
    const slice = lines.slice(index, index + targetLineCount).join('\n').trim()
    if (slice) parts.push(slice)
  }
  return parts.length > 0 ? parts : [text]
}
