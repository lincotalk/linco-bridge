<script setup lang="ts">
import { onMounted, ref } from 'vue'

import {
  DEMO_DATA_RETENTION_NOTICE,
  DEMO_DATA_RETENTION_TITLE,
  DEMO_NOTICE_DISMISS_STORAGE_KEY,
} from '@/constants/demo-notice'

const props = withDefaults(
  defineProps<{
    dismissible?: boolean
  }>(),
  {
    dismissible: true,
  },
)

const visible = ref(!props.dismissible)

onMounted(() => {
  if (!props.dismissible) {
    visible.value = true
    return
  }
  if (typeof localStorage === 'undefined') {
    visible.value = true
    return
  }
  visible.value = localStorage.getItem(DEMO_NOTICE_DISMISS_STORAGE_KEY) !== '1'
})

function dismiss() {
  visible.value = false
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(DEMO_NOTICE_DISMISS_STORAGE_KEY, '1')
  }
}
</script>

<template>
  <view v-if="visible" class="demo-notice">
    <view class="demo-notice__content">
      <text class="demo-notice__title">{{ DEMO_DATA_RETENTION_TITLE }}</text>
      <text class="demo-notice__text">{{ DEMO_DATA_RETENTION_NOTICE }}</text>
    </view>
    <view v-if="dismissible" class="demo-notice__close" @tap.stop="dismiss">知道了</view>
  </view>
</template>

<style scoped lang="scss">
.demo-notice {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin: 16rpx 24rpx 0;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  background: #f6ffed;
  border: 1rpx solid #b7eb8f;
}

.demo-notice__content {
  flex: 1;
  min-width: 0;
}

.demo-notice__title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #135200;
}

.demo-notice__text {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #389e0d;
}

.demo-notice__close {
  flex-shrink: 0;
  padding: 4rpx 0;
  font-size: 24rpx;
  color: #00754a;
}
</style>
