import type { ChatSessionItem } from '@/bridge/types'
import { useSessionStore } from '@/stores'
import type { ConnectedAgentItem } from '@/utils/connected-accounts'
import { connectedAgentToSessionItem } from '@/utils/connected-accounts'
import { showToast } from '@/utils/format'
import { openAgentLanding } from '@/utils/open-agent-landing'

function resolveConnectedAgentSession(item: ConnectedAgentItem): ChatSessionItem | null {
  const sessionStore = useSessionStore()
  const sessionItem = connectedAgentToSessionItem(item)

  if (item.sessionId) {
    const bySessionId = sessionStore.getSession(item.sessionId)
    if (bySessionId) return bySessionId
  }

  if (item.connectionId) {
    const byConnectionId = sessionStore.sessions.find(
      (row) => row.connectionId === item.connectionId,
    )
    if (byConnectionId) return byConnectionId
  }

  return sessionStore.sessions.find((row) => row.id === sessionItem.id) ?? null
}

export function openConnectedAgent(item: ConnectedAgentItem): void {
  const matchedSession = resolveConnectedAgentSession(item)
  const connectionId = matchedSession?.connectionId?.trim() || item.connectionId?.trim()

  if (!connectionId) {
    showToast('助手连接信息无效')
    return
  }

  openAgentLanding({
    agentType: matchedSession?.agentType ?? item.agentType,
    connectionId,
  })
}
