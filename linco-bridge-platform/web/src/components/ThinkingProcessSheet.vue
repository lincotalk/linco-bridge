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
  <view v-if="visible" class="thinking-sheet" @touchmove.stop.prevent>
    <view class="thinking-sheet__mask" @tap="emit('close')" />
    <view class="thinking-sheet__panel">
      <view class="thinking-sheet__handle-wrap">
        <view class="thinking-sheet__handle" />
      </view>

      <view class="thinking-sheet__header">
        <view class="thinking-sheet__header-side" />
        <text class="thinking-sheet__title">思考过程</text>
        <view class="thinking-sheet__close-btn" @tap="emit('close')">
          <text class="thinking-sheet__close-icon">×</text>
        </view>
      </view>

      <view class="thinking-sheet__divider" />

      <scroll-view class="thinking-sheet__body" scroll-y :show-scrollbar="false">
        <view v-if="content.trim()" class="thinking-sheet__content">
          <MessageMarkdown :content="content" variant="assistant" />
        </view>
        <view v-else class="thinking-sheet__empty-wrap">
          <text class="thinking-sheet__empty">暂无思考内容</text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.thinking-sheet {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.thinking-sheet__mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
}

.thinking-sheet__panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  max-height: 78vh;
  min-height: 36vh;
  background: #ffffff;
  border-radius: 24rpx 24rpx 0 0;
  padding-bottom: env(safe-area-inset-bottom);
}

.thinking-sheet__handle-wrap {
  display: flex;
  justify-content: center;
  padding: 20rpx 0 8rpx;
}

.thinking-sheet__handle {
  width: 72rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.1);
}

.thinking-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 24rpx 20rpx;
}

.thinking-sheet__header-side,
.thinking-sheet__close-btn {
  width: 64rpx;
  height: 64rpx;
  flex-shrink: 0;
}

.thinking-sheet__close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}

.thinking-sheet__close-icon {
  font-size: 44rpx;
  line-height: 1;
  color: rgba(0, 0, 0, 0.45);
}

.thinking-sheet__title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  line-height: 1.4;
  color: #4d4c48;
}

.thinking-sheet__divider {
  height: 1px;
  background: #f3f4f6;
}

.thinking-sheet__body {
  flex: 1;
  min-height: 0;
  max-height: calc(78vh - 160rpx);
}

.thinking-sheet__content {
  box-sizing: border-box;
  width: 100%;
  padding: 28rpx 32rpx 40rpx;
}

.thinking-sheet__empty-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240rpx;
  padding: 32rpx;
}

.thinking-sheet__empty {
  font-size: 28rpx;
  color: rgba(0, 0, 0, 0.45);
}

.thinking-sheet__content :deep(.message-markdown__plain),
.thinking-sheet__content :deep(.message-markdown__text) {
  font-size: 28rpx;
  line-height: 1.75;
  color: rgba(0, 0, 0, 0.78);
}

.thinking-sheet__content :deep(.message-markdown__paragraph) {
  margin-bottom: 20rpx;
}

.thinking-sheet__content :deep(.message-markdown__inline-code) {
  padding: 4rpx 10rpx;
  border-radius: 8rpx;
  background: rgba(0, 0, 0, 0.06);
  font-size: 24rpx;
}
</style>
