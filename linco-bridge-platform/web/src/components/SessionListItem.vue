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
    <view class="session-item__body">
      <image class="session-item__avatar" :src="avatarFor(item)" mode="aspectFill" />
      <view class="session-item__content">
        <text class="session-item__title text-ellipsis">{{ item.title }}</text>
        <text class="session-item__preview text-ellipsis">{{ item.lastMessage }}</text>
      </view>
      <text class="session-item__time">{{ formatRelativeTime(item.updatedAt) }}</text>
    </view>
    <view class="session-item__divider" />
  </view>
</template>

<style scoped lang="scss">
.session-item {
  background: #ffffff;
}

.session-item__body {
  position: relative;
  display: flex;
  align-items: center;
  height: 148rpx;
  padding: 0 32rpx;
  box-sizing: border-box;
}

.session-item__avatar {
  flex-shrink: 0;
  width: 80rpx;
  height: 80rpx;
  margin-right: 24rpx;
  border-radius: 50%;
  background: #f5f5f5;
}

.session-item__content {
  flex: 1;
  min-width: 0;
  padding-right: 72rpx;
}

.session-item__title {
  display: block;
  font-size: 30rpx;
  font-weight: 500;
  line-height: 1.2;
  color: #1a1a1a;
}

.session-item__preview {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  line-height: 1.2;
  color: rgba(0, 0, 0, 0.45);
}

.session-item__time {
  position: absolute;
  top: 38rpx;
  right: 32rpx;
  font-size: 21rpx;
  line-height: 1.35;
  color: rgba(0, 0, 0, 0.3);
}

.session-item__divider {
  height: 1px;
  margin: 0 32rpx;
  background-color: rgba(0, 0, 0, 0.06);
}
</style>
