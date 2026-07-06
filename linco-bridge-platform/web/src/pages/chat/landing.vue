<script setup lang="ts">
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AgentHistoryRow from '@/components/AgentHistoryRow.vue'
import AgentLandingAppBar from '@/components/AgentLandingAppBar.vue'
import AgentLandingInput from '@/components/AgentLandingInput.vue'
import { useAgentLanding } from '@/composables/useAgentLanding'
import type { AgentBridgeType, AgentHistoryItem } from '@/bridge/types'
import { showToast } from '@/utils/format'

const VISIBLE_COUNT = 3

const agentType = ref<AgentBridgeType>('codex')
const draft = ref('')
const tempSession = ref(false)

const landing = useAgentLanding()
const {
  header,
  subtitle,
  history,
  loading,
  starting,
  loadLanding,
  startConversation,
  pickWorkspace,
  openAgentPanel,
  dispose,
} = landing

const visibleItems = computed(() => history.value.slice(0, VISIBLE_COUNT))
const hasMore = computed(() => history.value.length > VISIBLE_COUNT)

onLoad((query) => {
  const type = String(query?.agentType ?? 'codex') as AgentBridgeType
  agentType.value = type
  void loadLanding(type)
})

onUnload(() => {
  dispose()
})

function openHistoryItem(item: AgentHistoryItem) {
  uni.navigateTo({ url: `/pages/chat/index?sessionId=${encodeURIComponent(item.id)}` })
}

function viewAllHistory() {
  showToast('历史搜索页待 SDK 接入')
}

async function handleWorkspace() {
  const picked = await pickWorkspace(agentType.value)
  if (picked) {
    showToast(`已选择 ${picked.name}`)
  } else {
    showToast('工作区选择待插件接入')
  }
}

function handleMore() {
  openAgentPanel(agentType.value)
  showToast('Agent 侧栏待 SDK 接入')
}

function handleAdd() {
  showToast('附件选择待 SDK 接入')
}

function handleVoice() {
  showToast('语音输入待 SDK 接入')
}

async function handleSend() {
  const message = draft.value.trim()
  if (!message || starting.value) return

  try {
    const result = await startConversation({
      agentType: agentType.value,
      message,
      tempSession: tempSession.value,
    })
    draft.value = ''
    uni.navigateTo({
      url: `/pages/chat/index?sessionId=${encodeURIComponent(result.sessionId)}&draft=${encodeURIComponent(message)}`,
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
      show-workspace
      @workspace="handleWorkspace"
      @more="handleMore"
    />

    <scroll-view class="landing-page__body" scroll-y>
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
          @tap="openHistoryItem"
        />
        <view v-if="hasMore" class="landing-page__view-all" @tap="viewAllHistory">
          <text class="landing-page__view-all-text">查看历史对话</text>
        </view>
      </view>
    </scroll-view>

    <AgentLandingInput
      v-model="draft"
      :disabled="starting"
      :temp-session="tempSession"
      @send="handleSend"
      @add="handleAdd"
      @voice="handleVoice"
      @toggle-temp="tempSession = !tempSession"
    />
  </view>
</template>

<style scoped lang="scss">
.landing-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #ffffff;
}

.landing-page__body {
  flex: 1;
  min-height: 0;
  background: #ffffff;
}

.landing-page__history {
  padding: 172rpx 84rpx 32rpx;
}

.landing-page__history-gap {
  margin-bottom: 48rpx;
}

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
  min-height: 480rpx;
}

.landing-page__empty-text,
.landing-page__loading-text {
  font-size: 28rpx;
  color: rgba(0, 0, 0, 0.45);
}
</style>
