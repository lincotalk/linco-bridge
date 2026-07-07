import assert from 'node:assert/strict'
import test from 'node:test'
import { buildHighlightSegments } from './highlight-text.ts'

test('buildHighlightSegments returns single segment when query empty', () => {
  assert.deepEqual(buildHighlightSegments('今天星期几', ''), [
    { text: '今天星期几', highlight: false },
  ])
})

test('buildHighlightSegments highlights matching substring', () => {
  assert.deepEqual(buildHighlightSegments('今天星期几啊', '星期'), [
    { text: '今天', highlight: false },
    { text: '星期', highlight: true },
    { text: '几啊', highlight: false },
  ])
})
