import { describe, expect, it } from 'vitest'
import { resolveStreamingTailIndicator } from '@/utils/chat-streaming-indicator'

describe('resolveStreamingTailIndicator', () => {
  it('shows 正在思考 for pure empty streaming placeholder', () => {
    expect(resolveStreamingTailIndicator({ streaming: true })).toEqual({
      show: true,
      label: '正在思考',
    })
  })

  it('shows 输出中 for mini program blocking wait', () => {
    expect(
      resolveStreamingTailIndicator({
        streaming: true,
        useBlockingOutputLabel: true,
      }),
    ).toEqual({
      show: true,
      label: '输出中',
    })
  })

  it('shows 正在思考 when reasoning entry exists but body is still empty', () => {
    expect(
      resolveStreamingTailIndicator({
        streaming: true,
        hasReasoningEntry: true,
      }),
    ).toEqual({
      show: true,
      label: '正在思考',
    })
  })

  it('shows 继续生成中 when body exists and stream is active', () => {
    expect(
      resolveStreamingTailIndicator({
        streaming: true,
        content: 'partial reply',
        hasReasoningEntry: true,
      }),
    ).toEqual({
      show: true,
      label: '继续生成中',
    })
  })

  it('hides tail indicator when stream finished', () => {
    expect(
      resolveStreamingTailIndicator({
        streaming: false,
        content: 'final reply',
        hasReasoningEntry: true,
      }),
    ).toEqual({
      show: false,
      label: null,
    })
  })
})
