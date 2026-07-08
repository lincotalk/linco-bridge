import { describe, expect, it } from 'vitest'
import { resolveAgentHistoryPreviewText } from '@/utils/agent-history-preview'

describe('resolveAgentHistoryPreviewText', () => {
  it('returns working placeholder when session is in progress', () => {
    expect(resolveAgentHistoryPreviewText({ preview: '', working: true })).toBe('正在回复...')
  })

  it('formats stored preview text', () => {
    expect(
      resolveAgentHistoryPreviewText({
        preview: '我会先按本会话的技能要求加载基础工作流说明',
        working: false,
      }),
    ).toContain('技能要求')
  })
})
