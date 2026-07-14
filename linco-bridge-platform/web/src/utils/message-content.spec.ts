import { describe, expect, it } from 'vitest'
import { hasRichMessageContent, parseMessageSegments } from './message-content'

describe('parseMessageSegments', () => {
  it('returns plain text segment for content without fences', () => {
    expect(parseMessageSegments('hello world')).toEqual([
      { type: 'text', content: 'hello world' },
    ])
  })

  it('splits fenced code blocks', () => {
    expect(
      parseMessageSegments('before\n```ts\nconst x = 1\n```\nafter'),
    ).toEqual([
      { type: 'text', content: 'before' },
      { type: 'code', language: 'typescript', content: 'const x = 1' },
      { type: 'text', content: 'after' },
    ])
  })

  it('marks unfinished fenced code as incomplete while streaming', () => {
    const segments = parseMessageSegments(
      '说明：\n```ts\nconst x = 1\nconst y = 2',
      { streaming: true },
    )
    expect(segments).toEqual([
      { type: 'text', content: '说明：' },
      { type: 'code', language: 'typescript', content: 'const x = 1\nconst y = 2', incomplete: true },
    ])
  })

  it('parses html fences into html segments', () => {
    const segments = parseMessageSegments(
      '输出：\n```html\n<section><h1>Hi</h1></section>\n```',
    )
    expect(segments).toEqual([
      { type: 'text', content: '输出：' },
      { type: 'html', content: '<section><h1>Hi</h1></section>' },
    ])
  })

  it('marks unfinished html fence as incomplete while streaming', () => {
    const segments = parseMessageSegments('```html\n<section>', { streaming: true })
    expect(segments).toEqual([{ type: 'html', content: '<section>', incomplete: true }])
  })

  it('detects rich content', () => {
    expect(hasRichMessageContent('```js\n1\n```')).toBe(true)
    expect(hasRichMessageContent('[a](D:\\tmp\\a.pdf)')).toBe(true)
    expect(hasRichMessageContent('plain')).toBe(false)
  })

  it('marks workspace-relative file links as local files', () => {
    const segments = parseMessageSegments('文件：[卤肉饭制作过程.txt](卤肉饭制作过程.txt)')
    expect(segments).toEqual([
      { type: 'text', content: '文件：' },
      {
        type: 'link',
        label: '卤肉饭制作过程.txt',
        target: '卤肉饭制作过程.txt',
        localFile: true,
      },
    ])
  })
})
