import { isLocalFileLinkTarget } from '@/utils/attachment-open'
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

export type MessageLinkSegment = {
  type: 'link'
  label: string
  target: string
  localFile: boolean
}

export type MessageSegment = MessageTextSegment | MessageCodeSegment | MessageLinkSegment

export type ParseMessageOptions = {
  streaming?: boolean
}

const FENCED_CODE_PATTERN = /```([^\n`]*)\n?([\s\S]*?)```/g
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g

export function parseMessageSegments(content: string, options?: ParseMessageOptions): MessageSegment[] {
  const normalized = normalizeCodeFences(content)
  if (!normalized.trim()) return []

  if (options?.streaming) {
    return parseStreamingMessageSegments(normalized)
  }

  return parseCompleteMessageSegments(normalized)
}

export function hasRichMessageContent(content: string, streaming = false): boolean {
  return (
    hasMarkdownStructure(content) ||
    parseMessageSegments(content, { streaming }).some(
      (segment) => segment.type === 'code' || segment.type === 'link',
    )
  )
}

function parseStreamingMessageSegments(content: string): MessageSegment[] {
  const lastFenceIndex = content.lastIndexOf('```')
  if (lastFenceIndex === -1) {
    return parseCompleteMessageSegments(content)
  }

  const fencesBeforeLast = content.slice(0, lastFenceIndex).match(/```/g) ?? []
  if (fencesBeforeLast.length % 2 !== 0) {
    return parseCompleteMessageSegments(content)
  }

  const completePart = content.slice(0, lastFenceIndex)
  const tail = content.slice(lastFenceIndex)
  const segments = parseCompleteMessageSegments(completePart)
  appendTextSegments(segments, tail)
  return segments.length > 0 ? segments : [{ type: 'text', content }]
}

function parseCompleteMessageSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  FENCED_CODE_PATTERN.lastIndex = 0
  while ((match = FENCED_CODE_PATTERN.exec(content)) !== null) {
    const index = match.index
    if (index > lastIndex) {
      appendTextSegments(segments, content.slice(lastIndex, index))
    }
    segments.push({
      type: 'code',
      language: (match[1] ?? '').trim(),
      content: (match[2] ?? '').replace(/\n$/, ''),
    })
    lastIndex = FENCED_CODE_PATTERN.lastIndex
  }

  if (lastIndex < content.length) {
    appendTextSegments(segments, content.slice(lastIndex))
  }

  if (segments.length === 0) {
    appendTextSegments(segments, content)
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
      localFile: isLocalFileLinkTarget(target),
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
