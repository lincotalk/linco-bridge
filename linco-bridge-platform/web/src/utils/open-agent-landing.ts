import { resumeSession } from '@/api/session-api'
import { appendAgentTypeQuery } from '@/bridge/sdk/agent-chat'
import type { AgentBridgeType, AgentHistoryItem, ChatSessionItem } from '@/bridge/types'
import { useSessionStore } from '@/stores'
import { showToast } from '@/utils/format'
import { navigateOnce } from '@/utils/navigate-once'
import { isH5Runtime } from '@/utils/platform-runtime'
import { appendQueryToPath, createQueryParams, setQueryParam } from '@/utils/query-string'

export interface AgentLandingRouteInput {
  agentType: AgentBridgeType
  connectionId?: string
}

function buildAgentRoute(path: string, input: AgentLandingRouteInput): string {
  let params = createQueryParams({ agentType: input.agentType })
  const connectionId = input.connectionId?.trim()
  if (connectionId) {
    params = setQueryParam(params, 'connectionId', connectionId)
  }
  return appendQueryToPath(path, params)
}

export function buildAgentLandingUrl(input: AgentLandingRouteInput): string {
  return buildAgentRoute('/pages/chat/landing', input)
}

export function buildAgentHistoryUrl(input: AgentLandingRouteInput): string {
  return buildAgentRoute('/pages/chat/history', input)
}

export function buildBotConfigUrl(input: AgentLandingRouteInput): string {
  return buildAgentRoute('/pages/chat/bot-config', input)
}

export function openBotConfig(input: AgentLandingRouteInput): void {
  navigateOnce(buildBotConfigUrl(input))
}

export function openAgentLanding(input: AgentLandingRouteInput): void {
  navigateOnce(buildAgentLandingUrl(input))
}

/** 消息 / 助手列表点击：进入 Agent 落地页（与 Flutter 一致） */
export function openSessionLanding(item: ChatSessionItem): void {
  const connectionId = item.connectionId?.trim()
  if (!connectionId) {
    showToast('会话连接信息无效')
    return
  }
  openAgentLanding({
    agentType: item.agentType,
    connectionId,
  })
}

function buildChatIndexUrl(sessionId: string, options?: { agentType?: AgentBridgeType | null; reloadHistory?: boolean }): string {
  let params = createQueryParams({ sessionId })
  params = appendAgentTypeQuery(params, options?.agentType ?? null)
  if (options?.reloadHistory) {
    params = setQueryParam(params, 'reloadHistory', '1')
  }
  return appendQueryToPath('/pages/chat/index', params)
}

/** Resume bridge binding then open chat with history reload (aligned with Flutter landing history tap). */
export async function openHistorySession(item: AgentHistoryItem): Promise<void> {
  const sessionId = item.id?.trim()
  if (!sessionId) {
    showToast('会话信息无效')
    return
  }

  const sessionStore = useSessionStore()
  const knownSession = sessionStore.getSession(sessionId)

  // H5：恢复改小程序兼容前的体验——先跳转，resume 在后台执行，避免点击无反应
  if (isH5Runtime()) {
    navigateOnce(
      buildChatIndexUrl(sessionId, {
        agentType: knownSession?.agentType ?? null,
      }),
    )
    void resumeSession(sessionId)
      .then(async (result) => {
        await sessionStore.loadSessions().catch(() => undefined)
        if (result.agentSessionId?.trim()) {
          // 聊天页 onShow 会读 reloadHistory；此处仅刷新列表
        }
      })
      .catch((err) => {
        showToast(err instanceof Error ? err.message : '恢复会话失败')
      })
    return
  }

  try {
    const result = await resumeSession(sessionId)
    await sessionStore.loadSessions().catch(() => undefined)
    navigateOnce(
      buildChatIndexUrl(result.sessionId, {
        agentType: sessionStore.getSession(result.sessionId)?.agentType ?? null,
        reloadHistory: Boolean(result.agentSessionId?.trim()),
      }),
    )
  } catch (err) {
    showToast(err instanceof Error ? err.message : '打开会话失败')
  }
}
