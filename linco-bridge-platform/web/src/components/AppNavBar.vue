<script setup lang="ts">
defineProps<{
  title?: string
  showBack?: boolean
}>()

const emit = defineEmits<{
  back: []
}>()

const statusBarHeight = uni.getSystemInfoSync().statusBarHeight ?? 20

function handleBack() {
  emit('back')
  uni.navigateBack()
}
</script>

<template>
  <view class="nav-bar" :style="{ paddingTop: `${statusBarHeight}px` }">
    <view class="nav-bar__inner">
      <view v-if="showBack" class="nav-bar__back" @tap="handleBack">
        <text class="nav-bar__back-icon">‹</text>
      </view>
      <text v-if="title" class="nav-bar__title">{{ title }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.nav-bar {
  background: #f5f5f5;
}

.nav-bar__inner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  padding: 0 32rpx;
}

.nav-bar__title {
  font-size: 34rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.nav-bar__back {
  position: absolute;
  left: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
}

.nav-bar__back-icon {
  font-size: 48rpx;
  line-height: 1;
  color: #1a1a1a;
}
</style>
