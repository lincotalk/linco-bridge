import { describe, expect, it } from 'vitest'
import {
  LAZY_MARKDOWN_MIN_LINES,
  shouldUseLazyMarkdown,
  splitLazyMarkdownChunks,
} from './lazy-markdown-chunks'

describe('lazy-markdown-chunks', () => {
  it('does not lazy-render short markdown', () => {
    const content = Array.from({ length: LAZY_MARKDOWN_MIN_LINES - 1 }, (_, index) => `line ${index + 1}`).join('\n')
    expect(shouldUseLazyMarkdown(content)).toBe(false)
  })

  it('splits long prose into multiple chunks', () => {
    const content = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join('\n')
    const chunks = splitLazyMarkdownChunks(content, 24)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.source.trim().length > 0)).toBe(true)
  })

  it('keeps code fences intact as heavy chunks', () => {
    const content = [
      'intro',
      '```ts',
      'const x = 1',
      '```',
      ...Array.from({ length: 36 }, (_, index) => `line ${index + 1}`),
    ].join('\n')
    const chunks = splitLazyMarkdownChunks(content, 24)
    expect(chunks.some((chunk) => chunk.hasHeavyContent && chunk.source.includes('```ts'))).toBe(true)
  })
})
