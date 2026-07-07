<script setup lang="ts">
defineProps<{
  label?: string
}>()
</script>

<template>
  <view class="streaming-indicator">
    <view class="streaming-indicator__spinner" />
    <text v-if="label" class="streaming-indicator__label">{{ label }}</text>
  </view>
</template>

<style scoped lang="scss">
.streaming-indicator {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  min-height: 40rpx;
  padding: 8rpx 0;
}

.streaming-indicator__spinner {
  width: 24rpx;
  height: 24rpx;
  border: 3rpx solid rgba(0, 0, 0, 0.12);
  border-top-color: rgba(0, 0, 0, 0.45);
  border-radius: 50%;
  animation: streaming-spin 0.9s linear infinite;
}

.streaming-indicator__label {
  font-size: 30rpx;
  line-height: 1.4;
  color: rgba(0, 0, 0, 0.45);
}

@keyframes streaming-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
