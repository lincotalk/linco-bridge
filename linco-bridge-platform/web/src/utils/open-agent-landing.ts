import { resumeSession } from '@/api/session-api'
import type { AgentBridgeType, AgentHistoryItem } from '@/bridge/types'
import { showToast } from '@/utils/format'

export interface AgentLandingRouteInput {
  agentType: AgentBridgeType
  connectionId?: string
}

export function buildAgentLandingUrl(input: AgentLandingRouteInput): string {
  const params = new URLSearchParams({ agentType: input.agentType })
  const connectionId = input.connectionId?.trim()
  if (connectionId) {
    params.set('connectionId', connectionId)
  }
  return `/pages/chat/landing?${params.toString()}`
}

export function buildAgentHistoryUrl(input: AgentLandingRouteInput): string {
  const params = new URLSearchParams({ agentType: input.agentType })
  const connectionId = input.connectionId?.trim()
  if (connectionId) {
    params.set('connectionId', connectionId)
  }
  return `/pages/chat/history?${params.toString()}`
}

export function openAgentLanding(input: AgentLandingRouteInput): void {
  uni.navigateTo({ url: buildAgentLandingUrl(input) })
}

/** Resume bridge binding then open chat with history reload (aligned with Flutter landing history tap). */
export async function openHistorySession(item: AgentHistoryItem): Promise<void> {
  const sessionId = item.id?.trim()
  if (!sessionId) {
    showToast('会话信息无效')
    return
  }

  try {
    const result = await resumeSession(sessionId)
    const params = new URLSearchParams({ sessionId: result.sessionId })
    if (result.agentSessionId?.trim()) {
      params.set('reloadHistory', '1')
    }
    uni.navigateTo({ url: `/pages/chat/index?${params.toString()}` })
  } catch (err) {
    showToast(err instanceof Error ? err.message : '打开会话失败')
  }
}
