<script setup lang="ts">
import type { BridgeSourceCard } from '@/bridge/types'

defineProps<{
  item: BridgeSourceCard
}>()

const emit = defineEmits<{
  select: [item: BridgeSourceCard]
}>()
</script>

<template>
  <view class="source-card" @tap="emit('select', item)">
    <view class="source-card__icon-wrap">
      <image class="source-card__icon" :src="item.icon" mode="aspectFit" />
    </view>
    <view class="source-card__content">
      <text class="source-card__title">{{ item.title }}</text>
      <text class="source-card__subtitle">{{ item.subtitle }}</text>
    </view>
    <text class="source-card__chevron">›</text>
  </view>
</template>

<style scoped lang="scss">
.source-card {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  margin-bottom: 24rpx;
  background: #ffffff;
  border: 1rpx solid #ebedf0;
  border-radius: 16rpx;
  box-sizing: border-box;
}

.source-card__icon-wrap {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 80rpx;
  height: 80rpx;
  margin-right: 24rpx;
  border-radius: 20rpx;
  background: #f5f5f5;
}

.source-card__icon {
  width: 40rpx;
  height: 40rpx;
}

.source-card__content {
  flex: 1;
  min-width: 0;
}

.source-card__title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.source-card__subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: #8c8c8c;
}

.source-card__chevron {
  margin-left: 12rpx;
  font-size: 40rpx;
  color: #bfbfbf;
}
</style>
