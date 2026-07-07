<script setup lang="ts">
import MessageMarkdown from '@/components/MessageMarkdown.vue'

defineProps<{
  visible: boolean
  content: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <view v-if="visible" class="thinking-sheet">
    <view class="thinking-sheet__mask" @tap="emit('close')" />
    <view class="thinking-sheet__panel">
      <view class="thinking-sheet__header">
        <text class="thinking-sheet__title">思考过程</text>
        <text class="thinking-sheet__close" @tap="emit('close')">关闭</text>
      </view>
      <scroll-view class="thinking-sheet__body" scroll-y>
        <MessageMarkdown v-if="content.trim()" :content="content" />
        <text v-else class="thinking-sheet__empty">暂无思考内容</text>
      </scroll-view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.thinking-sheet {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.thinking-sheet__mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
}

.thinking-sheet__panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 72vh;
  border-radius: 24rpx 24rpx 0 0;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}

.thinking-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx 16rpx;
}

.thinking-sheet__title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.thinking-sheet__close {
  font-size: 28rpx;
  color: #00754a;
}

.thinking-sheet__body {
  flex: 1;
  min-height: 0;
  padding: 0 32rpx calc(env(safe-area-inset-bottom) + 32rpx);
}

.thinking-sheet__empty {
  font-size: 28rpx;
  color: rgba(0, 0, 0, 0.45);
}
</style>
