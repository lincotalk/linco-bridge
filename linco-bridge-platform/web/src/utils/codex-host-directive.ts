const CODEX_HOST_DIRECTIVE_NAMES = [
  'git-stage',
  'git-commit',
  'git-push',
  'git-create-branch',
  'git-create-pr',
  'code-comment',
] as const

const CODEX_HOST_DIRECTIVE_LINE =
  /^[ \t]{0,3}::(?:git-stage|git-commit|git-push|git-create-branch|git-create-pr|code-comment)\{.*\}[ \t]*$/

const NEWLINE_PATTERN = /\r\n|\n|\r/g
const BLANK_LINE_PATTERN = /^[ \t]*$/
const PARTIAL_DIRECTIVE_LINE_PATTERN = /^[ \t]{0,3}(?:(?:`{1,2}|~{1,2})|(?:`{3,}|~{3,}).*)$/
const FENCE_MARKER_PATTERN = /^[ \t]{0,3}(`{3,}|~{3,})(.*)$/
const PARTIAL_NAME_PATTERN = /^[ \t]{0,3}(.*)$/

function isCodexHostDirectiveLine(line: string): boolean {
  return CODEX_HOST_DIRECTIVE_LINE.test(line)
}

function isPotentialCodexHostDirectiveLine(line: string): boolean {
  const match = PARTIAL_NAME_PATTERN.exec(line)
  if (!match) return false
  const candidate = match[1] ?? ''
  if (!candidate.startsWith(':')) return false
  if (candidate === ':') return true
  if (!candidate.startsWith('::')) return false

  const body = candidate.slice(2)
  const braceIndex = body.indexOf('{')
  const name = braceIndex >= 0 ? body.slice(0, braceIndex) : body
  if (!CODEX_HOST_DIRECTIVE_NAMES.some((item) => item.startsWith(name))) {
    return false
  }
  return braceIndex < 0 || (CODEX_HOST_DIRECTIVE_NAMES as readonly string[]).includes(name)
}

export class CodexHostDirectiveStreamFilter {
  private pending = ''
  private pendingSeparator = ''
  private inFence = false
  private fenceChar = ''
  private fenceLength = 0
  private atLineStart = true
  private removedDirectiveAtEnd = false

  add(value: string): string {
    const startsAtLineStart = this.pending.length > 0 ? true : this.atLineStart
    const combined = `${this.pending}${value}`
    this.pending = ''
    if (!combined) return ''

    const output: string[] = []
    let cursor = 0
    let lineStartsAtBoundary = startsAtLineStart

    for (const match of combined.matchAll(NEWLINE_PATTERN)) {
      const line = combined.slice(cursor, match.index)
      const newline = match[0] ?? ''
      if (lineStartsAtBoundary && BLANK_LINE_PATTERN.test(line)) {
        this.pendingSeparator = `${this.pendingSeparator}${line}${newline}`
      } else if (lineStartsAtBoundary && !this.inFence && isCodexHostDirectiveLine(line)) {
        this.removedDirectiveAtEnd = true
      } else {
        output.push(this.pendingSeparator)
        output.push(line)
        this.pendingSeparator = newline
        this.removedDirectiveAtEnd = false
        if (lineStartsAtBoundary) {
          this.updateMarkdownFenceState(line)
        }
      }
      this.atLineStart = true
      lineStartsAtBoundary = true
      cursor = match.index! + newline.length
    }

    const tail = combined.slice(cursor)
    let result = output.join('')
    if (lineStartsAtBoundary && this.shouldHoldPartialLine(tail)) {
      this.pending = tail
    } else {
      result = `${result}${this.pendingSeparator}${tail}`
      this.pendingSeparator = ''
      if (tail.length > 0) {
        this.atLineStart = false
        this.removedDirectiveAtEnd = false
      }
    }
    return result
  }

  close(): string {
    if (this.pending.length > 0) {
      const pending = this.pending
      this.pending = ''
      if (!this.inFence && isCodexHostDirectiveLine(pending)) {
        this.pendingSeparator = ''
        this.removedDirectiveAtEnd = false
        return ''
      }
      const output = `${this.pendingSeparator}${pending}`
      this.pendingSeparator = ''
      this.removedDirectiveAtEnd = false
      this.atLineStart = false
      return output
    }
    if (this.removedDirectiveAtEnd) {
      this.pendingSeparator = ''
      this.removedDirectiveAtEnd = false
      return ''
    }
    const output = this.pendingSeparator
    this.pendingSeparator = ''
    return output
  }

  reset(): void {
    this.pending = ''
    this.pendingSeparator = ''
    this.inFence = false
    this.fenceChar = ''
    this.fenceLength = 0
    this.atLineStart = true
    this.removedDirectiveAtEnd = false
  }

  private shouldHoldPartialLine(line: string): boolean {
    if (BLANK_LINE_PATTERN.test(line)) return true
    if (!this.inFence && isPotentialCodexHostDirectiveLine(line)) return true
    if (!this.inFence) {
      return PARTIAL_DIRECTIVE_LINE_PATTERN.test(line)
    }
    if (!this.fenceChar) return false
    const marker = this.fenceChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`^[ \\t]{0,3}${marker}+[ \\t]*$`).test(line)
  }

  private updateMarkdownFenceState(line: string): void {
    const match = FENCE_MARKER_PATTERN.exec(line)
    if (!match) return
    const marker = match[1] ?? ''
    const markerChar = marker[0] ?? ''
    if (!this.inFence) {
      this.inFence = true
      this.fenceChar = markerChar
      this.fenceLength = marker.length
      return
    }
    const trailing = (match[2] ?? '').trim()
    if (markerChar === this.fenceChar && marker.length >= this.fenceLength && trailing.length === 0) {
      this.inFence = false
      this.fenceChar = ''
      this.fenceLength = 0
    }
  }
}

export function sanitizeCodexHostDirectives(value: string): string {
  const filter = new CodexHostDirectiveStreamFilter()
  return `${filter.add(value)}${filter.close()}`
}
