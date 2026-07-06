<script setup lang="ts">
import type { ChatMessage } from '@/bridge/types'

defineProps<{
  message: ChatMessage
}>()
</script>

<template>
  <view class="bubble-row" :class="`bubble-row--${message.role}`">
    <view class="bubble" :class="`bubble--${message.role}`">
      <text class="bubble__text">{{ message.content }}</text>
      <text v-if="message.streaming" class="bubble__streaming">▍</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.bubble-row {
  display: flex;
  margin-bottom: 24rpx;
}

.bubble-row--user {
  justify-content: flex-end;
}

.bubble-row--assistant,
.bubble-row--system {
  justify-content: flex-start;
}

.bubble {
  max-width: 78%;
  padding: 20rpx 24rpx;
  border-radius: 20rpx;
}

.bubble--user {
  background: #1677ff;
}

.bubble--assistant,
.bubble--system {
  background: #ffffff;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.bubble__text {
  font-size: 28rpx;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble--user .bubble__text {
  color: #ffffff;
}

.bubble--assistant .bubble__text,
.bubble--system .bubble__text {
  color: #1a1a1a;
}

.bubble__streaming {
  margin-left: 4rpx;
  color: #1677ff;
}
</style>
