import { appendAgentTypeQuery } from '@/bridge/sdk/agent-chat'
import { BRIDGE_HISTORY_SYNC_LIMIT } from '@/bridge/constants'
import { useSessionStore } from '@/stores'
import { appendQueryToPath, createQueryParams, setQueryParam } from '@/utils/query-string'
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

  let params = createQueryParams({ sessionId })
  params = appendAgentTypeQuery(params, sessionStore.getSession(sessionId)?.agentType ?? null)
  if (shouldReloadHistoryOnOpen(picked)) {
    params = setQueryParam(params, 'reloadHistory', '1')
  }

  uni.redirectTo({
    url: appendQueryToPath('/pages/chat/index', params),
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
