<script setup lang="ts">
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AgentHistoryRow from '@/components/AgentHistoryRow.vue'
import AgentLandingAppBar from '@/components/AgentLandingAppBar.vue'
import AgentLandingInput from '@/components/AgentLandingInput.vue'
import { useAgentLanding } from '@/composables/useAgentLanding'
import { useAttachmentPicker } from '@/composables/useAttachmentPicker'
import { useVoiceInput } from '@/composables/useVoiceInput'
import { stashPendingFiles } from '@/composables/pendingAttachmentTransfer'
import { stashPendingLaunch } from '@/composables/pendingLaunchTransfer'
import type { AgentBridgeType, AgentHistoryItem } from '@/bridge/types'
import { appendAgentTypeQuery } from '@/bridge/sdk/agent-chat'
import { useSessionStore } from '@/stores'
import { showToast } from '@/utils/format'
import { showAgentSidePanel } from '@/utils/agent-side-panel'
import { openBoundBridgeChat } from '@/utils/open-bound-chat'
import { hasWorkspaceSessionPick } from '@/utils/pick-workspace'
import { buildAgentHistoryUrl, openHistorySession } from '@/utils/open-agent-landing'
import { supportsBridgeContextSelector, supportsBridgeWorkspaceSelector } from '@/bridge/constants'
import { useContextPicker } from '@/composables/useContextPicker'

const VISIBLE_COUNT = 3

const agentType = ref<AgentBridgeType>('codex')
const connectionId = ref<string | undefined>()
const draft = ref('')

const landing = useAgentLanding()
const sessionStore = useSessionStore()
const {
  header,
  subtitle,
  history,
  loading,
  starting,
  loadLanding,
  startConversation,
  pickWorkspace,
  dispose,
} = landing

const { pickFiles, pendingFiles, clearFiles, removeFile } = useAttachmentPicker()
const { pickContext } = useContextPicker()
const { startVoice } = useVoiceInput((text) => {
  draft.value = draft.value ? `${draft.value} ${text}` : text
})

const visibleItems = computed(() => history.value.slice(0, VISIBLE_COUNT))
const hasMore = computed(() => history.value.length > VISIBLE_COUNT)
const showCount = ref(0)

onLoad((query) => {
  const type = String(query?.agentType ?? 'codex') as AgentBridgeType
  agentType.value = type
  connectionId.value = query?.connectionId ? String(query.connectionId) : undefined
})

onShow(() => {
  showCount.value += 1
  void loadLanding(agentType.value, connectionId.value, {
    silent: showCount.value > 1 && history.value.length > 0,
  })
})

onUnload(() => {
  dispose()
})

function openHistoryItem(item: AgentHistoryItem) {
  void openHistorySession(item)
}

function viewAllHistory() {
  uni.navigateTo({
    url: buildAgentHistoryUrl({
      agentType: agentType.value,
      connectionId: connectionId.value,
    }),
  })
}

async function handleWorkspace() {
  try {
    const picked = await pickWorkspace(agentType.value, connectionId.value)
    if (!picked) return
    if (hasWorkspaceSessionPick(picked)) {
      await openBoundBridgeChat(picked)
      return
    }
    showToast(`已选择 ${picked.name}`)
    await loadLanding(agentType.value, connectionId.value)
  } catch (error) {
    showToast(error instanceof Error ? error.message : '切换工作区失败')
  }
}

function reloadLandingHistory() {
  return loadLanding(agentType.value, connectionId.value)
}

async function handleContext() {
  try {
    const result = await pickContext(agentType.value, connectionId.value)
    if (!result) return
    showToast(`已切换至 ${result.contextName}`, 'success')
    await loadLanding(agentType.value, connectionId.value)
  } catch (error) {
    showToast(error instanceof Error ? error.message : '切换 Profile 失败')
  }
}

function handleMore() {
  if (!header.value) return
  showAgentSidePanel({
    agentType: agentType.value,
    connectionId: connectionId.value,
    header: header.value,
    history: history.value,
    onReloadHistory: reloadLandingHistory,
    onNewConversation: () => {
      draft.value = ''
    },
    onOpenHistoryItem: openHistoryItem,
    onViewAllHistory: viewAllHistory,
  })
}

async function handleAdd() {
  await pickFiles()
}

function handleVoice() {
  startVoice()
}

async function handleSend() {
  const message = draft.value.trim()
  const files = pendingFiles.value
  if ((!message && files.length === 0) || starting.value) return

  try {
    const result = await startConversation({
      agentType: agentType.value,
      connectionId: connectionId.value,
      tempSession: true,
      message,
    })
    stashPendingFiles(result.sessionId, files)
    stashPendingLaunch(result.sessionId, message)
    draft.value = ''
    clearFiles()
    await sessionStore.loadSessions().catch(() => undefined)
    const params = new URLSearchParams({ sessionId: result.sessionId })
    appendAgentTypeQuery(params, agentType.value)
    uni.navigateTo({
      url: `/pages/chat/index?${params.toString()}`,
    })
  } catch (error) {
    showToast(error instanceof Error ? error.message : '发起会话失败')
  }
}
</script>

<template>
  <view class="page-container landing-page">
    <AgentLandingAppBar
      v-if="header"
      :title="header.title"
      :subtitle="subtitle"
      :avatar="header.avatar"
      :show-workspace="supportsBridgeWorkspaceSelector(agentType)"
      :show-context="supportsBridgeContextSelector(agentType)"
      show-more
      @workspace="handleWorkspace"
      @context="handleContext"
      @more="handleMore"
    />

    <scroll-view class="landing-page__body" scroll-y :show-scrollbar="false">
      <view
        class="landing-page__body-inner"
        :class="{ 'landing-page__body-inner--center': loading || visibleItems.length === 0 }"
      >
        <view v-if="loading" class="landing-page__loading">
          <text class="landing-page__loading-text">加载中…</text>
        </view>

        <view v-else-if="visibleItems.length === 0" class="landing-page__empty">
          <text class="landing-page__empty-text">暂无历史会话</text>
        </view>

        <view v-else class="landing-page__history">
          <AgentHistoryRow
            v-for="(item, index) in visibleItems"
            :key="item.id"
            :item="item"
            :class="{ 'landing-page__history-gap': index < visibleItems.length - 1 }"
            @tap="openHistoryItem(item)"
          />
          <view v-if="hasMore" class="landing-page__view-all" @tap="viewAllHistory">
            <text class="landing-page__view-all-text">查看历史对话</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <AgentLandingInput
      v-model="draft"
      :disabled="starting"
      :starting="starting"
      :pending-files="pendingFiles"
      @send="handleSend"
      @add="handleAdd"
      @voice="handleVoice"
      @remove-file="removeFile"
    />
  </view>
</template>

<style scoped lang="scss">
.landing-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: #ffffff;
  overflow: hidden;
}

.landing-page__body {
  flex: 1;
  min-height: 0;
  background: #ffffff;
}

.landing-page__body-inner {
  min-height: 100%;
  box-sizing: border-box;
}

.landing-page__body-inner--center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Flutter _AgentHistoryList: EdgeInsets.fromLTRB(42, 86, 42, 16) */
.landing-page__history {
  padding: 172rpx 84rpx 32rpx;
  box-sizing: border-box;
}

.landing-page__history-gap {
  margin-bottom: 48rpx;
}

/* Flutter separator before「查看历史对话」: SizedBox(height: 42) */
.landing-page__view-all {
  display: flex;
  justify-content: center;
  margin-top: 84rpx;
}

.landing-page__view-all-text {
  font-size: 24rpx;
  color: rgba(0, 0, 0, 0.45);
}

.landing-page__empty,
.landing-page__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 32rpx;
  box-sizing: border-box;
}

.landing-page__empty-text,
.landing-page__loading-text {
  font-size: 28rpx;
  color: rgba(0, 0, 0, 0.45);
}
</style>
