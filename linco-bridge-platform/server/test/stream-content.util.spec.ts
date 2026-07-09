import { appendStreamingContent, separateAfterOutbound } from '../src/chat/stream-content.util'

describe('stream-content.util', () => {
  it('separates outbound status from following stream body', () => {
    expect(separateAfterOutbound('已批准工具使用', '## 结果')).toBe('\n\n## 结果')
  })

  it('appends markdown block after plain outbound with blank line', () => {
    const merged = appendStreamingContent(
      '已批准工具使用',
      separateAfterOutbound('已批准工具使用', '## 结果'),
    )
    expect(merged).toBe('已批准工具使用\n\n## 结果')
  })
})
