import { AgentTraceReducer } from '../src/bridge/agent-trace.reducer'

describe('AgentTraceReducer', () => {
  it('accumulates thinking into trace actions', () => {
    const reducer = new AgentTraceReducer()
    reducer.handleThinking({
      fullText: 'Inspect workspace',
    })

    const trace = reducer.snapshot()
    expect(trace.actions).toHaveLength(1)
    expect(trace.actions[0]?.type).toBe('thinking')
    expect(trace.actions[0]?.detail).toBe('Inspect workspace')
  })

  it('clears thinking actions on thinking_clear', () => {
    const reducer = new AgentTraceReducer()
    reducer.handleThinking({ fullText: 'plan' })
    reducer.handleThinkingClear()
    expect(reducer.snapshot().actions).toHaveLength(0)
  })

  it('upserts tool actions from tool_call and tool_result', () => {
    const reducer = new AgentTraceReducer()
    reducer.handleToolCall({ id: 'tool-1', name: 'read_file', input: { path: 'a.txt' } })
    reducer.handleToolResult({ id: 'tool-1', name: 'read_file', output: 'ok' })

    const trace = reducer.snapshot()
    expect(trace.actions).toHaveLength(1)
    expect(trace.actions[0]?.status).toBe('success')
    expect(trace.actions[0]?.label).toBe('read_file')
  })

  it('merges agent_action patches by id', () => {
    const reducer = new AgentTraceReducer()
    reducer.handleAgentAction({
      event: 'started',
      action: {
        id: 'plan-1',
        type: 'plan',
        status: 'running',
        label: '执行计划',
        detail_object: {
          todos: [{ content: 'Step 1', status: 'running' }],
        },
      },
    })
    reducer.handleAgentAction({
      event: 'completed',
      patch: {
        id: 'plan-1',
        status: 'success',
      },
    })

    const action = reducer.snapshot().actions[0]
    expect(action?.status).toBe('success')
    expect(action?.type).toBe('plan')
  })
})
