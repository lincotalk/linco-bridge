import { appendAgentTypeQuery } from '@/bridge/sdk/agent-chat'
import type { ConnectedAgentItem } from '@/utils/connected-accounts'
import { openAgentLanding } from '@/utils/open-agent-landing'
import { showToast } from '@/utils/format'

export function openConnectedAgent(item: ConnectedAgentItem): void {
  const sessionId = item.sessionId?.trim()
  if (sessionId) {
    const params = new URLSearchParams({ sessionId })
    appendAgentTypeQuery(params, item.agentType)
    uni.navigateTo({ url: `/pages/chat/index?${params.toString()}` })
    return
  }

  if (!item.connectionId?.trim()) {
    showToast('助手连接信息无效')
    return
  }

  openAgentLanding({
    agentType: item.agentType,
    connectionId: item.connectionId,
  })
}
