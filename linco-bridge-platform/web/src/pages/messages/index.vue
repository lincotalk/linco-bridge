<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import SessionSwipeListItem from '@/components/SessionSwipeListItem.vue'
import { switchRootTab } from '@/constants/tabbar'
import { useSessionStore } from '@/stores'
import type { ChatSessionItem } from '@/bridge/types'
import { hideSessionsFromList } from '@/api/session-api'
import { showToast } from '@/utils/format'
import { openAgentLanding } from '@/utils/open-agent-landing'

const sessionStore = useSessionStore()
const refreshing = ref(false)
const openedSwipeId = ref<string | null>(null)
const deletingId = ref<string | null>(null)

onShow(() => {
  void sessionStore.loadSessions()
})

async function handleRefresh() {
  refreshing.value = true
  try {
    await sessionStore.loadSessions()
  } catch (err) {
    showToast(err instanceof Error ? err.message : '刷新失败')
  } finally {
    refreshing.value = false
  }
}

function openSession(item: ChatSessionItem) {
  openAgentLanding({
    agentType: item.agentType,
    connectionId: item.connectionId,
  })
}

function handleItemTap(item: ChatSessionItem) {
  if (openedSwipeId.value === item.id) {
    openedSwipeId.value = null
    return
  }
  if (openedSwipeId.value) {
    openedSwipeId.value = null
    return
  }
  openSession(item)
}

function handleSwipeOpen(sessionId: string) {
  openedSwipeId.value = sessionId
}

function handleSwipeClose(sessionId: string) {
  if (openedSwipeId.value === sessionId) {
    openedSwipeId.value = null
  }
}

function confirmDeleteSession(item: ChatSessionItem) {
  if (deletingId.value) {
    return
  }
  uni.showModal({
    title: '删除会话',
    content: '从消息列表移除，不会删除本机 Agent 记录。',
    confirmText: '删除',
    confirmColor: '#ff4d4f',
    success: (res) => {
      if (res.confirm) {
        void deleteSession(item)
      } else {
        openedSwipeId.value = null
      }
    },
  })
}

async function deleteSession(item: ChatSessionItem) {
  deletingId.value = item.id
  try {
    await hideSessionsFromList([item.id])
    sessionStore.removeSession(item.id)
    openedSwipeId.value = null
    showToast('已删除', 'success')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '删除失败')
  } finally {
    deletingId.value = null
  }
}

function goBridge() {
  switchRootTab('bridge')
}
</script>

<template>
  <view class="page-container messages-page">
    <scroll-view
      class="messages-page__scroll"
      scroll-y
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="handleRefresh"
      @tap="openedSwipeId = null"
    >
      <view v-if="sessionStore.loadingSessions && sessionStore.sessions.length === 0" class="empty">
        <text class="empty__desc">加载中…</text>
      </view>

      <view v-else-if="sessionStore.sessions.length === 0" class="empty">
        <text class="empty__title">暂无桥接会话</text>
        <text class="empty__desc">前往「桥接」连接本机 Agent</text>
        <view class="empty__action" @tap="goBridge">去桥接</view>
      </view>

      <view v-else class="messages-page__list" @tap.stop>
        <SessionSwipeListItem
          v-for="item in sessionStore.sessions"
          :key="item.id"
          :item="item"
          :open="openedSwipeId === item.id"
          @open="handleSwipeOpen(item.id)"
          @close="handleSwipeClose(item.id)"
          @tap="handleItemTap(item)"
          @delete="confirmDeleteSession(item)"
        />
      </view>
    </scroll-view>
  </view>
</template>

<style scoped lang="scss">
.messages-page {
  height: 100vh;
  background: #ffffff;
}

.messages-page__scroll {
  height: 100%;
}

.messages-page__list {
  margin-top: calc(env(safe-area-inset-top) + 8rpx);
  background: #ffffff;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 48rpx 0;
}

.empty__title {
  font-size: 34rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.empty__desc {
  margin-top: 16rpx;
  font-size: 28rpx;
  color: #8c8c8c;
}

.empty__action {
  margin-top: 40rpx;
  padding: 18rpx 48rpx;
  border-radius: 999rpx;
  background: #00754a;
  color: #ffffff;
  font-size: 28rpx;
}
</style>
