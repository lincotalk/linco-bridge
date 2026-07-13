import { describe, expect, it } from 'vitest'

import { buildHighlightSegments } from '@/utils/highlight-text'

describe('buildHighlightSegments', () => {
  it('returns single segment when query empty', () => {
    expect(buildHighlightSegments('今天星期几', '')).toEqual([
      { text: '今天星期几', highlight: false },
    ])
  })

  it('highlights matching substring', () => {
    expect(buildHighlightSegments('今天星期几啊', '星期')).toEqual([
      { text: '今天', highlight: false },
      { text: '星期', highlight: true },
      { text: '几啊', highlight: false },
    ])
  })
})
