<script setup lang="ts">
import BridgeSourceCard from '@/components/BridgeSourceCard.vue'
import DemoDataNotice from '@/components/DemoDataNotice.vue'
import { BRIDGE_SOURCE_CARDS } from '@/bridge/constants'
import type { BridgeSourceCard as BridgeSourceCardType } from '@/bridge/types'

function handleSelect(item: BridgeSourceCardType) {
  uni.navigateTo({ url: item.route })
}
</script>

<template>
  <view class="page-container bridge-page">
    <DemoDataNotice />
    <view class="bridge-page__list">
      <BridgeSourceCard
        v-for="item in BRIDGE_SOURCE_CARDS"
        :key="item.type"
        :item="item"
        @select="handleSelect"
      />
    </view>
  </view>
</template>

<style scoped lang="scss">
.bridge-page {
  background: #ffffff;
}

.bridge-page__list {
  padding: 16rpx 30rpx 24rpx;
}
</style>
