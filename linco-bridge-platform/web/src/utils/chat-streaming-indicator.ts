export type StreamingTailIndicatorLabel = '正在思考' | '继续生成中' | '输出中'

export interface StreamingTailIndicatorInput {
  streaming?: boolean
  content?: string
  hasReasoningEntry?: boolean
  /** Reserved for agentTrace parity — when true, tail uses continue/thinking rules like Flutter. */
  hasAgentTrace?: boolean
  /** 小程序阻塞 HTTP：等待完整回复期间显示「输出中」 */
  useBlockingOutputLabel?: boolean
}

export interface StreamingTailIndicatorState {
  show: boolean
  label: StreamingTailIndicatorLabel | null
}

/**
 * Tail spinner label/order aligned with Flutter AiStreamingMessage:
 * - entry / trace / body first
 * - tail "正在思考" while streaming with no body yet
 * - tail "继续生成中" while streaming with body text
 */
export function resolveStreamingTailIndicator(
  input: StreamingTailIndicatorInput,
): StreamingTailIndicatorState {
  if (input.streaming !== true) {
    return { show: false, label: null }
  }

  const hasBody = Boolean(input.content?.trim())
  const hasProcessEntry = input.hasReasoningEntry === true || input.hasAgentTrace === true
  const showContinue = hasBody

  if (input.useBlockingOutputLabel === true && !hasBody) {
    return { show: true, label: '输出中' }
  }

  if (showContinue) {
    return { show: true, label: '继续生成中' }
  }

  if (hasProcessEntry || !hasBody) {
    return { show: true, label: '正在思考' }
  }

  return { show: false, label: null }
}
