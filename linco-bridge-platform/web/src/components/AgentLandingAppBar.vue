<script setup lang="ts">
import { CHAT_ICON } from '@/constants/chat-icons'

defineProps<{
  title: string
  subtitle?: string
  avatar: string
  showWorkspace?: boolean
}>()

const emit = defineEmits<{
  back: []
  workspace: []
  more: []
}>()

const statusBarHeight = uni.getSystemInfoSync().statusBarHeight ?? 20

function handleBack() {
  emit('back')
  uni.navigateBack()
}
</script>

<template>
  <view class="landing-bar" :style="{ paddingTop: `${statusBarHeight}px` }">
    <view class="landing-bar__inner">
      <view class="landing-bar__leading">
        <view class="landing-bar__back" @tap="handleBack">
          <text class="landing-bar__back-icon">‹</text>
        </view>
        <image class="landing-bar__avatar" :src="avatar" mode="aspectFill" />
      </view>

      <view class="landing-bar__title-block">
        <text class="landing-bar__title text-ellipsis">{{ title }}</text>
        <text v-if="subtitle" class="landing-bar__subtitle text-ellipsis">{{ subtitle }}</text>
      </view>

      <view class="landing-bar__actions">
        <view v-if="showWorkspace" class="landing-bar__action" @tap="emit('workspace')">
          <image class="landing-bar__folder" :src="CHAT_ICON.folder" mode="aspectFit" />
        </view>
        <view class="landing-bar__action" @tap="emit('more')">
          <text class="landing-bar__more">···</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.landing-bar {
  background: #ffffff;
}

.landing-bar__inner {
  display: flex;
  align-items: center;
  height: 88rpx;
  padding: 0 32rpx 0 16rpx;
  box-sizing: border-box;
}

.landing-bar__leading {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.landing-bar__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
}

.landing-bar__back-icon {
  font-size: 48rpx;
  line-height: 1;
  color: #1a1a1a;
}

.landing-bar__avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #f5f5f5;
}

.landing-bar__title-block {
  flex: 1;
  min-width: 0;
  margin-left: 16rpx;
}

.landing-bar__title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.2;
  color: #1a1a1a;
}

.landing-bar__subtitle {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  line-height: 1.35;
  color: rgba(0, 0, 0, 0.45);
}

.landing-bar__actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: 8rpx;
}

.landing-bar__action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80rpx;
  height: 88rpx;
}

.landing-bar__folder {
  width: 40rpx;
  height: 40rpx;
}

.landing-bar__more {
  font-size: 40rpx;
  line-height: 1;
  color: #1a1a1a;
  letter-spacing: 2rpx;
}
</style>
