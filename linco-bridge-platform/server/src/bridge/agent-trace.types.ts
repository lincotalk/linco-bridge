export type AgentTraceTask = {
  status: string
  started_at?: number
  completed_at?: number
  total_duration?: number
}

export type AgentTraceAction = {
  id: string
  type: string
  status: string
  label: string
  tool_name?: string
  detail?: string
  detail_kind?: string
  detail_object?: unknown
  duration?: number
  started_at?: number
  completed_at?: number
  error_message?: string
  children?: AgentTraceAction[]
}

export type AgentTrace = {
  task?: AgentTraceTask
  actions: AgentTraceAction[]
}

export function isEmptyAgentTrace(trace: AgentTrace | undefined | null): boolean {
  if (!trace) return true
  return !trace.task?.status && trace.actions.length === 0
}

export function cloneAgentTrace(trace: AgentTrace): AgentTrace {
  return JSON.parse(JSON.stringify(trace)) as AgentTrace
}
