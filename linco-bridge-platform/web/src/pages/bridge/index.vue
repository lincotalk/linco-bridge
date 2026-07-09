<script setup lang="ts">
import BridgeSourceCard from '@/components/BridgeSourceCard.vue'
import { BRIDGE_SOURCE_CARDS } from '@/bridge/constants'
import type { BridgeSourceCard as BridgeSourceCardType } from '@/bridge/types'

function handleSelect(item: BridgeSourceCardType) {
  uni.navigateTo({ url: item.route })
}
</script>

<template>
  <view class="page-container bridge-page">
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
  padding: calc(env(safe-area-inset-top) + 24rpx) 30rpx 24rpx;
}
</style>
