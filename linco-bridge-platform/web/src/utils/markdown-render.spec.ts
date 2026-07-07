import { describe, expect, it } from 'vitest'

import { hasMarkdownStructure, parseMarkdownBlocks, parseInlineNodes } from '@/utils/markdown-render'

describe('markdown-render', () => {
  it('parses headings and lists', () => {
    const blocks = parseMarkdownBlocks('## Title\n\n- one\n- two')
    expect(blocks.some((block) => block.type === 'heading')).toBe(true)
    expect(blocks.some((block) => block.type === 'list')).toBe(true)
  })

  it('parses inline bold and code', () => {
    const nodes = parseInlineNodes('hello **world** and `code`')
    expect(nodes.some((node) => node.type === 'bold')).toBe(true)
    expect(nodes.some((node) => node.type === 'code')).toBe(true)
  })

  it('detects markdown structure', () => {
    expect(hasMarkdownStructure('plain text')).toBe(false)
    expect(hasMarkdownStructure('**bold** text')).toBe(true)
  })
})
