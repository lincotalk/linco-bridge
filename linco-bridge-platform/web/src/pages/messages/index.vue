<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import SessionListItem from '@/components/SessionListItem.vue'
import { switchRootTab } from '@/constants/tabbar'
import { useSessionStore } from '@/stores'
import type { ChatSessionItem } from '@/bridge/types'

const sessionStore = useSessionStore()

onShow(() => {
  void sessionStore.loadSessions()
})

function openChat(item: ChatSessionItem) {
  uni.navigateTo({ url: `/pages/chat/landing?agentType=${item.agentType}` })
}

function goBridge() {
  switchRootTab('bridge')
}
</script>

<template>
  <view class="page-container messages-page">
    <view v-if="sessionStore.sessions.length === 0" class="empty">
      <text class="empty__title">暂无桥接会话</text>
      <text class="empty__desc">前往「桥接」连接本机 Agent</text>
      <view class="empty__action" @tap="goBridge">去桥接</view>
    </view>
    <view v-else class="messages-page__list">
      <SessionListItem
        v-for="item in sessionStore.sessions"
        :key="item.id"
        :item="item"
        @tap="openChat(item)"
      />
    </view>
  </view>
</template>

<style scoped lang="scss">
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
  background: #1677ff;
  color: #ffffff;
  font-size: 28rpx;
}
</style>
