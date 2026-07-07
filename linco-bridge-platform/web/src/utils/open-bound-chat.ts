import { useSessionStore } from '@/stores'
import { isBoundWorkspacePick, type PickWorkspaceResult } from '@/utils/pick-workspace'

export { isBoundWorkspacePick as isBoundWorkspaceSession }

export async function openBoundBridgeChat(picked: PickWorkspaceResult): Promise<boolean> {
  const sessionId = picked.sessionId?.trim()
  if (!sessionId) return false

  const sessionStore = useSessionStore()
  await sessionStore.loadSessions().catch(() => undefined)

  const params = new URLSearchParams({ sessionId })
  if (isBoundWorkspacePick(picked)) {
    params.set('reloadHistory', '1')
  }

  uni.navigateTo({
    url: `/pages/chat/index?${params.toString()}`,
  })
  return true
}

export async function reloadBoundChatSession(
  sessionId: string,
  reloadHistory: () => Promise<void>,
): Promise<void> {
  const sessionStore = useSessionStore()
  sessionStore.setMessages(sessionId, [])
  await sessionStore.loadSessions().catch(() => undefined)
  await reloadHistory()
}
