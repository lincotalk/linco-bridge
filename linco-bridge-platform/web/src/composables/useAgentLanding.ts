import { ref } from 'vue'
import { createAppAgentChatSdk } from '@/api/agent-chat-api'
import { useBridgeStore } from '@/stores'
import { buildLandingSubtitle } from '@/utils/chat-header'
import type { AgentChatSdk } from '@/bridge/sdk/agent-chat-types'
import type {
  AgentBridgeType,
  AgentHistoryItem,
  AgentLandingHeader,
  BridgeStatusResult,
  StartConversationInput,
} from '@/bridge/types'

const VISIBLE_HISTORY_COUNT = 3

function mergeLandingHeader(
  header: AgentLandingHeader,
  bridgeStatus?: BridgeStatusResult,
): AgentLandingHeader {
  return {
    ...header,
    status: bridgeStatus?.connected ? 'online' : header.status,
    boundContextName: header.boundContextName ?? bridgeStatus?.boundContextName,
  }
}

export function useAgentLanding(sdk: AgentChatSdk = createAppAgentChatSdk()) {
  const bridgeStore = useBridgeStore()
  const header = ref<AgentLandingHeader | null>(null)
  const history = ref<AgentHistoryItem[]>([])
  const loading = ref(false)
  const starting = ref(false)
  let unsubscribeHeader: (() => void) | undefined

  const subtitle = ref('')

  async function loadLanding(
    agentType: AgentBridgeType,
    connectionId?: string,
    options?: { silent?: boolean },
  ) {
    const silent = options?.silent === true
    if (!silent) {
      loading.value = true
    }
    try {
      unsubscribeHeader?.()
      unsubscribeHeader = sdk.watchLandingHeader?.(agentType, (next) => {
        const bridgeStatus = bridgeStore.statusByType[agentType]
        header.value = mergeLandingHeader(next, bridgeStatus)
        subtitle.value = buildLandingSubtitle(header.value)
      }, connectionId)

      const [nextHeader, items] = await Promise.all([
        sdk.getLandingHeader(agentType, connectionId),
        sdk.listHistory(agentType, { connectionId }),
        bridgeStore.checkStatus(agentType, connectionId).catch(() => undefined),
      ])

      const bridgeStatus = bridgeStore.statusByType[agentType]
      header.value = mergeLandingHeader(nextHeader, bridgeStatus)
      subtitle.value = buildLandingSubtitle(header.value)
      history.value = items
    } finally {
      if (!silent) {
        loading.value = false
      }
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

  function pickWorkspace(agentType: AgentBridgeType, connectionId?: string) {
    return sdk.pickWorkspace?.(agentType, connectionId) ?? Promise.resolve(null)
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
