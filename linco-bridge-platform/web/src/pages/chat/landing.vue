<script setup lang="ts">
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AgentHistoryRow from '@/components/AgentHistoryRow.vue'
import AgentLandingAppBar from '@/components/AgentLandingAppBar.vue'
import AppOverlayHost from '@/components/AppOverlayHost.vue'
import AgentLandingInput from '@/components/AgentLandingInput.vue'
import { useAgentLanding } from '@/composables/useAgentLanding'
import { useAttachmentPicker } from '@/composables/useAttachmentPicker'
import { useVoiceInput } from '@/composables/useVoiceInput'
import { stashPendingFiles } from '@/composables/pendingAttachmentTransfer'
import { cloneOutboundFiles } from '@/utils/chat-attachments'
import { stashPendingLaunch } from '@/composables/pendingLaunchTransfer'
import type { AgentBridgeType, AgentHistoryItem } from '@/bridge/types'
import { appendAgentTypeQuery } from '@/bridge/sdk/agent-chat'
import { useSessionStore } from '@/stores'
import { showToast } from '@/utils/format'
import { showAgentSidePanel } from '@/utils/agent-side-panel'
import { openBoundBridgeChat } from '@/utils/open-bound-chat'
import { hasWorkspaceSessionPick } from '@/utils/pick-workspace'
import { appendQueryToPath, createQueryParams } from '@/utils/query-string'
import { buildAgentHistoryUrl, openHistorySession } from '@/utils/open-agent-landing'
import {
  supportsBridgeSettingsSelector,
  supportsBridgeSlashCommands,
  supportsBridgeWorkspaceSelector,
} from '@/bridge/constants'
import { useBridgeSettings } from '@/composables/useBridgeSettings'
import { useSlashCommands } from '@/composables/useSlashCommands'

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
const bridgeSettings = useBridgeSettings()
const { commands: slashCommandList, preload: preloadSlashCommands } = useSlashCommands()
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
  if (supportsBridgeSettingsSelector(agentType.value)) {
    void bridgeSettings.preloadOptions(agentType.value, connectionId.value)
  }
  if (supportsBridgeSlashCommands(agentType.value)) {
    void preloadSlashCommands({
      agentType: agentType.value,
      connectionId: connectionId.value,
    })
  }
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

async function handlePickSettings() {
  if (!supportsBridgeSettingsSelector(agentType.value)) return
  try {
    await bridgeSettings.pickSettings({
      agentType: agentType.value,
      connectionId: connectionId.value,
      persist: false,
    })
  } catch (error) {
    showToast(error instanceof Error ? error.message : '加载设置失败')
  }
}

async function handleSend() {
  const message = draft.value.trim()
  const files = cloneOutboundFiles(pendingFiles.value)
  if ((!message && files.length === 0) || starting.value) return

  try {
    const result = await startConversation({
      agentType: agentType.value,
      connectionId: connectionId.value,
      tempSession: true,
      message,
      bridgeSettings: bridgeSettings.pendingSettings.value ?? undefined,
    })
    stashPendingFiles(result.sessionId, files)
    stashPendingLaunch(result.sessionId, message)
    draft.value = ''
    clearFiles()
    await sessionStore.loadSessions().catch(() => undefined)
    let params = createQueryParams({ sessionId: result.sessionId })
    params = appendAgentTypeQuery(params, agentType.value)
    uni.navigateTo({
      url: appendQueryToPath('/pages/chat/index', params),
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
      show-more
      @workspace="handleWorkspace"
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
          <!-- 间距放在外层 view：小程序自定义组件不吃父级 class 的 margin -->
          <view
            v-for="(item, index) in visibleItems"
            :key="item.id"
            class="landing-page__history-item"
            :class="{ 'landing-page__history-item--gap': index < visibleItems.length - 1 }"
          >
            <AgentHistoryRow :item="item" @tap="openHistoryItem(item)" />
          </view>
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
      :use-bridge-compact-toolbar="supportsBridgeSettingsSelector(agentType)"
      :bridge-settings-label="bridgeSettings.settingsLabel.value"
      :slash-commands="slashCommandList"
      @send="handleSend"
      @add="handleAdd"
      @voice="handleVoice"
      @remove-file="removeFile"
      @pick-settings="handlePickSettings"
    />
    <!-- #ifndef H5 -->
    <AppOverlayHost />
    <!-- #endif -->
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

.landing-page__history-item {
  width: 100%;
}

.landing-page__history-item--gap {
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
