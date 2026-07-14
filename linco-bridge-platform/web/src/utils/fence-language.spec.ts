import { describe, expect, it } from 'vitest'
import {
  formatJsonCode,
  isHtmlFence,
  isMarkdownFenceLanguage,
  normalizeFenceLanguage,
  resolveCodeLanguage,
} from './fence-language'

describe('fence-language', () => {
  it('normalizes show-widget fence labels', () => {
    expect(normalizeFenceLanguage('show-widget type=react')).toBe('react')
  })

  it('detects html fences by language and plaintext body', () => {
    expect(isHtmlFence('html', '<section></section>')).toBe(true)
    expect(isHtmlFence('plaintext', '<!DOCTYPE html><html></html>')).toBe(true)
    expect(isHtmlFence('ts', 'const x = 1')).toBe(false)
  })

  it('formats json fences', () => {
    expect(formatJsonCode('{"a":1}', 'json')).toBe('{\n  "a": 1\n}')
  })

  it('infers json language from plaintext body', () => {
    expect(resolveCodeLanguage('plaintext', '{"a":1}')).toBe('json')
  })

  it('detects markdown fences', () => {
    expect(isMarkdownFenceLanguage('md')).toBe(true)
    expect(isMarkdownFenceLanguage('typescript')).toBe(false)
  })
})
