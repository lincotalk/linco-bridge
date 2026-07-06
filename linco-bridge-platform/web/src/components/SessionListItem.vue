<script setup lang="ts">
import type { ChatSessionItem } from '@/bridge/types'
import { formatRelativeTime } from '@/utils/format'

defineProps<{
  item: ChatSessionItem
}>()

const bridgeAvatarMap: Record<ChatSessionItem['agentType'], string> = {
  codex: '/static/icons/bot/bridge_codex.png',
  claude: '/static/icons/bot/bridge_claude.png',
  hermes: '/static/icons/bot/bridge_hermes.png',
  openclaw: '/static/icons/bot/bridge_claw.png',
}

function avatarFor(item: ChatSessionItem): string {
  return bridgeAvatarMap[item.agentType]
}
</script>

<template>
  <view class="session-item">
    <view class="session-item__avatar-wrap">
      <view class="session-item__avatar-box">
        <image class="session-item__avatar" :src="avatarFor(item)" mode="aspectFit" />
      </view>
      <view class="session-item__status" :class="{ 'session-item__status--online': item.online }" />
    </view>
    <view class="session-item__content">
      <view class="session-item__row">
        <text class="session-item__title">{{ item.title }}</text>
        <text class="session-item__time">{{ formatRelativeTime(item.updatedAt) }}</text>
      </view>
      <text class="session-item__preview text-ellipsis">{{ item.lastMessage }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.session-item {
  display: flex;
  align-items: center;
  padding: 24rpx 30rpx;
  background: #ffffff;
}

.session-item__avatar-wrap {
  position: relative;
  margin-right: 24rpx;
}

.session-item__avatar-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96rpx;
  height: 96rpx;
  border-radius: 20rpx;
  background: #f5f5f5;
}

.session-item__avatar {
  width: 48rpx;
  height: 48rpx;
}

.session-item__status {
  position: absolute;
  right: -4rpx;
  bottom: -4rpx;
  width: 20rpx;
  height: 20rpx;
  border: 4rpx solid #ffffff;
  border-radius: 50%;
  background: #bfbfbf;
}

.session-item__status--online {
  background: #52c41a;
}

.session-item__content {
  flex: 1;
  min-width: 0;
}

.session-item__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.session-item__title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.session-item__time {
  flex-shrink: 0;
  font-size: 24rpx;
  color: #8c8c8c;
}

.session-item__preview {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: #8c8c8c;
}
</style>
