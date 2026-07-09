import { appendStreamingContent } from '../chat/stream-content.util'
import {
  cloneAgentTrace,
  type AgentTrace,
  type AgentTraceAction,
  type AgentTraceTask,
} from './agent-trace.types'

type TraceEvent = 'started' | 'completed' | 'failed' | 'cancelled'

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function traceEvent(value: unknown): TraceEvent {
  switch (firstString(value)) {
    case 'completed':
    case 'done':
    case 'success':
      return 'completed'
    case 'failed':
    case 'error':
      return 'failed'
    case 'cancelled':
    case 'canceled':
      return 'cancelled'
    default:
      return 'started'
  }
}

function statusFromEvent(event: TraceEvent): string {
  switch (event) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'failed'
    case 'cancelled':
      return 'cancelled'
    default:
      return 'running'
  }
}

function previewText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  if (value == null) return undefined
  try {
    const text = JSON.stringify(value)
    return text.length > 240 ? `${text.slice(0, 237)}...` : text
  } catch {
    return undefined
  }
}

export class AgentTraceReducer {
  private trace: AgentTrace = { actions: [] }
  private thinkingCounter = 0

  snapshot(): AgentTrace {
    return cloneAgentTrace(this.trace)
  }

  handleThinkingClear(): void {
    this.trace.actions = this.trace.actions.filter((item) => item.type !== 'thinking')
  }

  handleThinking(frame: Record<string, unknown>): string {
    const detail = this.thinkingDetail(frame)
    if (!detail.trim()) return ''
    const last = this.trace.actions.at(-1)
    const id =
      last?.type === 'thinking' ? last.id : `bridge_thinking_${++this.thinkingCounter}`
    this.upsertAction(
      {
        id,
        type: 'thinking',
        status: 'success',
        label: '思考中',
        detail,
        detail_kind: 'markdown',
      },
      'completed',
    )
    return detail
  }

  handleAgentTask(frame: Record<string, unknown>): void {
    const status = firstString(frame.status)
    if (!status) return
    this.ensureTaskStarted()
    const existing = this.trace.task ?? { status }
    const now = Date.now()
    const startedAt =
      numberValue(frame.started_at ?? frame.startedAt) ||
      numberValue(existing.started_at) ||
      now
    const completedAt =
      numberValue(frame.completed_at ?? frame.completedAt) ||
      numberValue(existing.completed_at)
    const isTerminal =
      status === 'task_success' ||
      status === 'task_failed' ||
      status === 'task_cancelled'
    const resolvedCompletedAt = completedAt || (isTerminal ? now : 0)
    const task: AgentTraceTask = {
      ...existing,
      status,
      started_at: startedAt,
      ...(resolvedCompletedAt > 0 ? { completed_at: resolvedCompletedAt } : {}),
      ...(resolvedCompletedAt > 0 && startedAt > 0
        ? {
            total_duration:
              numberValue(frame.total_duration ?? frame.totalDuration) ||
              resolvedCompletedAt - startedAt,
          }
        : {}),
    }
    this.trace.task = task
  }

  handleAgentAction(frame: Record<string, unknown>): void {
    const rawAction = asRecord(frame.action) ?? {}
    const rawPatch = asRecord(frame.patch) ?? {}
    const id = firstString(frame.id, frame.action_id, frame.actionId, rawAction.id, rawPatch.id)
    if (!id) return
    const event = traceEvent(frame.event)
    const status =
      firstString(rawPatch.status, rawAction.status) || statusFromEvent(event)
    this.upsertAction(
      {
        ...this.normalizeAction(rawAction),
        ...this.normalizeAction(rawPatch),
        id,
        status,
      },
      event,
    )
  }

  handleToolCall(frame: Record<string, unknown>): void {
    const id = firstString(frame.id, frame.tool_call_id, frame.toolCallId)
    if (!id) return
    const toolName = firstString(frame.name, frame.toolName, frame.tool_name) || 'tool'
    this.upsertAction(
      {
        id,
        type: 'tool',
        status: 'running',
        label: toolName,
        tool_name: toolName,
        detail: previewText(frame.input ?? frame.toolInput),
        detail_kind: 'plain_text',
      },
      'started',
    )
  }

  handleToolResult(frame: Record<string, unknown>): void {
    const id = firstString(frame.id, frame.tool_call_id, frame.toolCallId)
    if (!id) return
    const toolName = firstString(frame.name, frame.toolName, frame.tool_name) || 'tool'
    const isError = frame.is_error === true || frame.isError === true
    this.upsertAction(
      {
        id,
        type: 'tool',
        status: isError ? 'failed' : 'success',
        label: toolName,
        tool_name: toolName,
        detail: previewText(frame.output ?? frame.result ?? frame.content),
        detail_kind: 'plain_text',
        ...(isError
          ? { error_message: firstString(frame.error, frame.message, frame.text) || '工具执行失败' }
          : {}),
      },
      isError ? 'failed' : 'completed',
    )
  }

  private thinkingDetail(frame: Record<string, unknown>): string {
    const fullText = firstString(frame.fullText, frame.text)
    if (fullText) return fullText

    const delta = firstString(frame.delta)
    if (!delta) return ''

    const last = this.trace.actions.at(-1)
    if (last?.type === 'thinking' && typeof last.detail === 'string') {
      return appendStreamingContent(last.detail, delta)
    }
    return delta
  }

  private normalizeAction(raw: Record<string, unknown>): Partial<AgentTraceAction> {
    const action: Partial<AgentTraceAction> = {}
    const id = firstString(raw.id)
    if (id) action.id = id
    const type = firstString(raw.type)
    if (type) action.type = type
    const status = firstString(raw.status)
    if (status) action.status = status
    const label = firstString(raw.label)
    if (label) action.label = label
    const toolName = firstString(raw.tool_name, raw.toolName)
    if (toolName) action.tool_name = toolName
    const detail = firstString(raw.detail)
    if (detail) action.detail = detail
    const detailKind = firstString(raw.detail_kind, raw.detailKind)
    if (detailKind) action.detail_kind = detailKind
    if (raw.detail_object !== undefined || raw.detailObject !== undefined) {
      action.detail_object = raw.detail_object ?? raw.detailObject
    }
    const duration = numberValue(raw.duration)
    if (duration) action.duration = duration
    const startedAt = numberValue(raw.started_at ?? raw.startedAt)
    if (startedAt) action.started_at = startedAt
    const completedAt = numberValue(raw.completed_at ?? raw.completedAt)
    if (completedAt) action.completed_at = completedAt
    const errorMessage = firstString(raw.error_message, raw.errorMessage)
    if (errorMessage) action.error_message = errorMessage
    return action
  }

  private ensureTaskStarted(): void {
    if (this.trace.task?.status && numberValue(this.trace.task.started_at) > 0) return
    this.trace.task = {
      ...(this.trace.task ?? {}),
      status: this.trace.task?.status || 'task_running',
      started_at: numberValue(this.trace.task?.started_at) || Date.now(),
    }
  }

  private upsertAction(partial: Partial<AgentTraceAction> & { id: string }, event: TraceEvent): void {
    this.ensureTaskStarted()
    const index = this.trace.actions.findIndex((item) => item.id === partial.id)
    const existing = index >= 0 ? this.trace.actions[index] : undefined
    const next = this.withActionTiming(
      {
        ...(existing ?? {}),
        ...partial,
        id: partial.id,
        type: partial.type || existing?.type || 'step',
        status: partial.status || existing?.status || statusFromEvent(event),
        label: partial.label || existing?.label || partial.type || '执行步骤',
      } as AgentTraceAction,
      existing,
      event,
    )
    if (index >= 0) {
      this.trace.actions[index] = next
    } else {
      this.trace.actions.push(next)
    }
  }

  private withActionTiming(
    action: AgentTraceAction,
    existing: AgentTraceAction | undefined,
    event: TraceEvent,
  ): AgentTraceAction {
    const now = Date.now()
    const startedAt =
      numberValue(action.started_at) ||
      numberValue(existing?.started_at) ||
      (event === 'started' ? now : 0)
    const completedAt =
      numberValue(action.completed_at) ||
      (event === 'completed' || event === 'failed' || event === 'cancelled' ? now : 0)
    const duration = numberValue(action.duration)
    return {
      ...action,
      ...(startedAt > 0 ? { started_at: startedAt } : {}),
      ...(completedAt > 0 ? { completed_at: completedAt } : {}),
      ...(!duration && startedAt > 0 && completedAt >= startedAt
        ? { duration: completedAt - startedAt }
        : {}),
    }
  }
}
