<script setup lang="ts">
import type { ConnectedAgentItem } from '@/utils/connected-accounts'

defineProps<{
  item: ConnectedAgentItem
}>()

const emit = defineEmits<{
  tap: []
}>()
</script>

<template>
  <view class="agent-item">
    <view class="agent-item__body" @tap="emit('tap')">
      <view class="agent-item__avatar-wrap">
        <image class="agent-item__avatar" :src="item.avatar" mode="aspectFill" />
        <view
          class="agent-item__status-dot"
          :class="item.status === 'online' ? 'agent-item__status-dot--online' : 'agent-item__status-dot--offline'"
        />
      </view>
      <view class="agent-item__content">
        <text class="agent-item__title">{{ item.title }}</text>
        <text class="agent-item__subtitle">
          {{ item.deviceName || item.description }}
          <text v-if="item.boundContextName"> · {{ item.boundContextName }}</text>
        </text>
      </view>
      <text class="agent-item__badge">{{ item.status === 'online' ? '在线' : '离线' }}</text>
    </view>
    <view class="agent-item__divider" />
  </view>
</template>

<style scoped lang="scss">
.agent-item {
  background: #ffffff;
}

.agent-item__body {
  display: flex;
  align-items: center;
  min-height: 148rpx;
  padding: 24rpx 32rpx;
  box-sizing: border-box;
}

.agent-item__avatar-wrap {
  position: relative;
  flex-shrink: 0;
  width: 80rpx;
  height: 80rpx;
  margin-right: 24rpx;
}

.agent-item__avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: #f5f5f5;
}

.agent-item__status-dot {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  border: 2rpx solid #ffffff;
  box-sizing: border-box;
}

.agent-item__status-dot--online {
  background: #00a870;
}

.agent-item__status-dot--offline {
  background: #bfbfbf;
}

.agent-item__content {
  flex: 1;
  min-width: 0;
  padding-right: 16rpx;
}

.agent-item__title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 30rpx;
  font-weight: 500;
  line-height: 1.2;
  color: #1a1a1a;
}

.agent-item__subtitle {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 8rpx;
  font-size: 26rpx;
  line-height: 1.2;
  color: rgba(0, 0, 0, 0.45);
}

.agent-item__badge {
  flex-shrink: 0;
  font-size: 22rpx;
  line-height: 1.2;
  color: rgba(0, 0, 0, 0.35);
}

.agent-item__divider {
  height: 1px;
  margin: 0 32rpx;
  background-color: rgba(0, 0, 0, 0.06);
}
</style>
