<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AgentHistoryRow from '@/components/AgentHistoryRow.vue'
import AgentLandingAppBar from '@/components/AgentLandingAppBar.vue'
import { createAppAgentChatSdk } from '@/api/agent-chat-api'
import { getAgentAvatar } from '@/bridge/sdk/agent-chat'
import { getAgentDisplayName } from '@/bridge'
import type { AgentBridgeType, AgentHistoryItem } from '@/bridge/types'
import { showToast } from '@/utils/format'

const agentType = ref<AgentBridgeType>('codex')
const keyword = ref('')
const loading = ref(false)
const history = ref<AgentHistoryItem[]>([])
const sdk = createAppAgentChatSdk()

const filteredItems = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  if (!query) return history.value
  return history.value.filter((item) => {
    const haystack = `${item.title} ${item.preview} ${item.projectPath ?? ''}`.toLowerCase()
    return haystack.includes(query)
  })
})

async function loadHistory(type: AgentBridgeType) {
  loading.value = true
  try {
    history.value = await sdk.listHistory(type, { limit: 100 })
  } catch (err) {
    showToast(err instanceof Error ? err.message : '加载历史失败')
    history.value = []
  } finally {
    loading.value = false
  }
}

onLoad((query) => {
  const type = String(query?.agentType ?? 'codex') as AgentBridgeType
  agentType.value = type
  void loadHistory(type)
})

function openHistoryItem(item: AgentHistoryItem) {
  uni.navigateTo({ url: `/pages/chat/index?sessionId=${encodeURIComponent(item.id)}` })
}
</script>

<template>
  <view class="page-container history-page">
    <AgentLandingAppBar
      :title="'历史对话'"
      :subtitle="getAgentDisplayName(agentType)"
      :avatar="getAgentAvatar(agentType)"
    />

    <view class="history-page__search">
      <input
        v-model="keyword"
        class="history-page__search-input"
        type="text"
        placeholder="搜索会话标题或预览"
        confirm-type="search"
      />
    </view>

    <scroll-view class="history-page__body" scroll-y>
      <view v-if="loading" class="history-page__state">
        <text class="history-page__state-text">加载中…</text>
      </view>

      <view v-else-if="filteredItems.length === 0" class="history-page__state">
        <text class="history-page__state-text">暂无匹配的历史会话</text>
      </view>

      <view v-else class="history-page__list">
        <AgentHistoryRow
          v-for="(item, index) in filteredItems"
          :key="item.id"
          :item="item"
          :class="{ 'history-page__gap': index < filteredItems.length - 1 }"
          @tap="openHistoryItem"
        />
      </view>
    </scroll-view>
  </view>
</template>

<style scoped lang="scss">
.history-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #ffffff;
}

.history-page__search {
  padding: 16rpx 32rpx 8rpx;
}

.history-page__search-input {
  width: 100%;
  height: 72rpx;
  padding: 0 24rpx;
  border-radius: 36rpx;
  background: #f5f5f5;
  font-size: 28rpx;
}

.history-page__body {
  flex: 1;
  min-height: 0;
}

.history-page__list {
  padding: 24rpx 84rpx 32rpx;
}

.history-page__gap {
  margin-bottom: 48rpx;
}

.history-page__state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 480rpx;
}

.history-page__state-text {
  font-size: 28rpx;
  color: rgba(0, 0, 0, 0.45);
}
</style>
