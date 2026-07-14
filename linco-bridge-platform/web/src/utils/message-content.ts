import {
  formatJsonCode,
  isHtmlFence,
  normalizeFenceLanguage,
  resolveCodeLanguage,
} from '@/utils/fence-language'
import { isOpenableFileLinkTarget } from '@/utils/attachment-open'
import { hasMarkdownStructure, normalizeCodeFences } from '@/utils/markdown-render'

export type MessageTextSegment = {
  type: 'text'
  content: string
}

export type MessageCodeSegment = {
  type: 'code'
  content: string
  language: string
  incomplete?: boolean
}

export type MessageHtmlSegment = {
  type: 'html'
  content: string
  incomplete?: boolean
}

export type MessageLinkSegment = {
  type: 'link'
  label: string
  target: string
  localFile: boolean
}

export type MessageSegment =
  | MessageTextSegment
  | MessageCodeSegment
  | MessageHtmlSegment
  | MessageLinkSegment

export type ParseMessageOptions = {
  streaming?: boolean
}

const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g

export function parseMessageSegments(content: string, options?: ParseMessageOptions): MessageSegment[] {
  const normalized = normalizeCodeFences(content)
  if (!normalized.trim()) return []
  return parseFenceAwareSegments(normalized, options?.streaming === true)
}

export function hasRichMessageContent(content: string, streaming = false): boolean {
  return (
    hasMarkdownStructure(content) ||
    parseMessageSegments(content, { streaming }).some(
      (segment) => segment.type === 'code' || segment.type === 'html' || segment.type === 'link',
    )
  )
}

function parseFenceAwareSegments(content: string, streaming: boolean): MessageSegment[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const segments: MessageSegment[] = []
  const proseLines: string[] = []
  const codeLines: string[] = []
  let fenceLanguage = ''
  let inFence = false

  const flushProse = () => {
    const text = proseLines.join('\n').trim()
    proseLines.length = 0
    if (!text) return
    appendTextSegments(segments, text)
  }

  const flushFence = (incomplete: boolean) => {
    const rawCode = codeLines.join('\n').replace(/\n$/, '')
    codeLines.length = 0
    const language = normalizeFenceLanguage(fenceLanguage)
    fenceLanguage = ''
    if (!rawCode && !language) return

    if (isHtmlFence(language, rawCode)) {
      segments.push({
        type: 'html',
        content: rawCode,
        ...(incomplete ? { incomplete: true } : {}),
      })
      return
    }

    const resolvedLanguage = resolveCodeLanguage(language, rawCode)
    segments.push({
      type: 'code',
      language: resolvedLanguage,
      content: formatJsonCode(rawCode, resolvedLanguage),
      ...(incomplete ? { incomplete: true } : {}),
    })
  }

  for (const line of lines) {
    const trimmedLeft = line.trimStart()
    if (trimmedLeft.startsWith('```')) {
      if (inFence) {
        flushFence(false)
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
    flushFence(streaming)
  } else {
    flushProse()
  }

  if (segments.length === 0 && content.trim()) {
    appendTextSegments(segments, content.trim())
  }

  return segments
}

function appendTextSegments(segments: MessageSegment[], raw: string) {
  const text = raw.replace(/^\n+/, '').replace(/\n$/, '')
  if (!text.trim()) return

  let lastIndex = 0
  let match: RegExpExecArray | null
  MARKDOWN_LINK_PATTERN.lastIndex = 0
  while ((match = MARKDOWN_LINK_PATTERN.exec(text)) !== null) {
    const index = match.index
    if (index > lastIndex) {
      pushPlainText(segments, text.slice(lastIndex, index))
    }
    const target = (match[2] ?? '').trim()
    segments.push({
      type: 'link',
      label: (match[1] ?? target).trim(),
      target,
      localFile: isOpenableFileLinkTarget(target),
    })
    lastIndex = MARKDOWN_LINK_PATTERN.lastIndex
  }

  if (lastIndex < text.length) {
    pushPlainText(segments, text.slice(lastIndex))
  }
}

function pushPlainText(segments: MessageSegment[], raw: string) {
  if (raw.trim()) {
    segments.push({ type: 'text', content: raw })
  }
}
