import { appendAgentTypeQuery } from '@/bridge/sdk/agent-chat'
import { BRIDGE_HISTORY_SYNC_LIMIT } from '@/bridge/constants'
import { useSessionStore } from '@/stores'
import { isBoundWorkspacePick, hasWorkspaceSessionPick, type PickWorkspaceResult } from '@/utils/pick-workspace'

export { isBoundWorkspacePick as isBoundWorkspaceSession }

export function shouldReloadHistoryOnOpen(picked: PickWorkspaceResult): boolean {
  return isBoundWorkspacePick(picked)
}

export async function openBoundBridgeChat(picked: PickWorkspaceResult): Promise<boolean> {
  if (!hasWorkspaceSessionPick(picked)) return false

  const sessionId = picked.sessionId!.trim()
  const sessionStore = useSessionStore()
  await sessionStore.loadSessions().catch(() => undefined)

  const params = new URLSearchParams({ sessionId })
  appendAgentTypeQuery(params, sessionStore.getSession(sessionId)?.agentType ?? null)
  if (shouldReloadHistoryOnOpen(picked)) {
    params.set('reloadHistory', '1')
  }

  uni.redirectTo({
    url: `/pages/chat/index?${params.toString()}`,
  })
  return true
}

export async function reloadBoundChatSession(
  sessionId: string,
  reloadHistory: (limit?: number, reload?: boolean) => Promise<void>,
): Promise<void> {
  const sessionStore = useSessionStore()
  sessionStore.setMessages(sessionId, [])
  await sessionStore.loadSessions().catch(() => undefined)
  await reloadHistory(BRIDGE_HISTORY_SYNC_LIMIT, true)
}
