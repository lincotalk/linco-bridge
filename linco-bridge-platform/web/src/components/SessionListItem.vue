<script setup lang="ts">
import { computed } from 'vue'
import type { ChatSessionItem } from '@/bridge/types'
import { formatConversationTime, formatSessionPreview } from '@/utils/format'

const props = defineProps<{
  item: ChatSessionItem
}>()

const emit = defineEmits<{
  select: []
}>()

const bridgeAvatarMap: Record<ChatSessionItem['agentType'], string> = {
  codex: '/static/icons/bot/bridge_codex.png',
  claude: '/static/icons/bot/bridge_claude.png',
  hermes: '/static/icons/bot/bridge_hermes.png',
  openclaw: '/static/icons/bot/bridge_claw.png',
}

const previewText = computed(() => formatSessionPreview(props.item.lastMessage))

let lastActivateAt = 0

function handleActivate() {
  const now = Date.now()
  if (now - lastActivateAt < 300) return
  lastActivateAt = now
  emit('select')
}

function avatarFor(item: ChatSessionItem): string {
  return bridgeAvatarMap[item.agentType]
}
</script>

<template>
  <view class="session-item" @tap.stop="handleActivate" @click.stop="handleActivate">
    <view class="session-item__body">
      <view class="session-item__avatar-wrap">
        <image class="session-item__avatar" :src="avatarFor(item)" mode="aspectFill" />
        <view class="session-item__ai-badge">
          <text class="session-item__ai-badge-text">AI</text>
        </view>
      </view>
      <view class="session-item__content">
        <view class="session-item__title-wrap">
          <text class="session-item__title">{{ item.title }}</text>
        </view>
        <view class="session-item__preview-wrap">
          <text class="session-item__preview">{{ previewText }}</text>
        </view>
      </view>
      <text class="session-item__time">{{ formatConversationTime(item.updatedAt) }}</text>
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
  cursor: pointer;
}

.session-item__avatar-wrap {
  position: relative;
  flex-shrink: 0;
  width: 80rpx;
  height: 80rpx;
  margin-right: 24rpx;
}

.session-item__avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: #f5f5f5;
}

.session-item__ai-badge {
  position: absolute;
  right: -2rpx;
  bottom: -2rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  background: #00a870;
  border: 2rpx solid #ffffff;
  box-sizing: border-box;
}

.session-item__ai-badge-text {
  font-size: 14rpx;
  line-height: 1;
  font-weight: 600;
  color: #ffffff;
  transform: scale(0.92);
}

.session-item__content {
  flex: 1;
  min-width: 0;
  padding-right: 72rpx;
}

.session-item__title-wrap,
.session-item__preview-wrap {
  overflow: hidden;
}

.session-item__title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 30rpx;
  font-weight: 500;
  line-height: 1.2;
  color: #1a1a1a;
}

.session-item__preview {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
