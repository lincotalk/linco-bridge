import { ref } from 'vue'
import { createAppAgentChatSdk } from '@/api/agent-chat-api'
import { useBridgeStore } from '@/stores'
import { buildLandingSubtitle } from '@/bridge/sdk/agent-chat'
import type { AgentChatSdk } from '@/bridge/sdk/agent-chat-types'
import type {
  AgentBridgeType,
  AgentHistoryItem,
  AgentLandingHeader,
  StartConversationInput,
} from '@/bridge/types'

const VISIBLE_HISTORY_COUNT = 3

export function useAgentLanding(sdk: AgentChatSdk = createAppAgentChatSdk()) {
  const bridgeStore = useBridgeStore()
  const header = ref<AgentLandingHeader | null>(null)
  const history = ref<AgentHistoryItem[]>([])
  const loading = ref(false)
  const starting = ref(false)
  let unsubscribeHeader: (() => void) | undefined

  const subtitle = ref('')

  async function loadLanding(agentType: AgentBridgeType, connectionId?: string) {
    loading.value = true
    try {
      unsubscribeHeader?.()
      unsubscribeHeader = sdk.watchLandingHeader?.(agentType, (next) => {
        header.value = next
        subtitle.value = buildLandingSubtitle(next)
      }, connectionId)

      const [nextHeader, items] = await Promise.all([
        sdk.getLandingHeader(agentType, connectionId),
        sdk.listHistory(agentType, { connectionId }),
        bridgeStore.checkStatus(agentType).catch(() => undefined),
      ])

      const bridgeStatus = bridgeStore.statusByType[agentType]
      header.value = {
        ...nextHeader,
        status: bridgeStatus?.connected ? 'online' : nextHeader.status,
      }
      subtitle.value = buildLandingSubtitle(header.value)
      history.value = items
    } finally {
      loading.value = false
    }
  }

  function visibleHistory() {
    return history.value.slice(0, VISIBLE_HISTORY_COUNT)
  }

  function hasMoreHistory() {
    return history.value.length > VISIBLE_HISTORY_COUNT
  }

  async function startConversation(input: StartConversationInput) {
    starting.value = true
    try {
      return await sdk.startConversation(input)
    } finally {
      starting.value = false
    }
  }

  function pickWorkspace(agentType: AgentBridgeType) {
    return sdk.pickWorkspace?.(agentType) ?? Promise.resolve(null)
  }

  function openAgentPanel(agentType: AgentBridgeType) {
    sdk.openAgentPanel?.(agentType)
  }

  function dispose() {
    unsubscribeHeader?.()
    unsubscribeHeader = undefined
  }

  return {
    header,
    subtitle,
    history,
    loading,
    starting,
    loadLanding,
    visibleHistory,
    hasMoreHistory,
    startConversation,
    pickWorkspace,
    openAgentPanel,
    dispose,
    sdk,
  }
}
