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
      { type: 'code', language: 'ts', content: 'const x = 1' },
      { type: 'text', content: 'after' },
    ])
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
