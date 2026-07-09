import { describe, expect, it } from 'vitest'
import {
  actionPreview,
  actionTitle,
  planTodosForAction,
} from '@/utils/agent-trace-view'
import type { AgentTraceAction } from '@/bridge/types'

describe('agent-trace-view', () => {
  it('prefers action label for title', () => {
    expect(
      actionTitle({
        id: '1',
        type: 'tool',
        status: 'running',
        label: '读取 package.json',
      }),
    ).toBe('读取 package.json')
  })

  it('extracts first line preview', () => {
    expect(
      actionPreview({
        id: '1',
        type: 'thinking',
        status: 'success',
        label: '思考中',
        detail: 'line one\nline two',
      }),
    ).toBe('line one')
  })

  it('parses plan todos from detail_object', () => {
    const action: AgentTraceAction = {
      id: 'plan-1',
      type: 'plan',
      status: 'running',
      label: '执行计划',
      detail_object: {
        todos: [
          { content: 'Inspect repo', status: 'completed' },
          { content: 'Apply patch', status: 'running' },
        ],
      },
    }
    expect(planTodosForAction(action)).toEqual([
      { text: 'Inspect repo', status: 'completed' },
      { text: 'Apply patch', status: 'running' },
    ])
  })
})
