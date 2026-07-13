<script setup lang="ts">
import BridgeSourceCard from '@/components/BridgeSourceCard.vue'
import { BRIDGE_SOURCE_CARDS } from '@/bridge/constants'
import type { BridgeSourceCard as BridgeSourceCardType } from '@/bridge/types'
import { navigateOnce } from '@/utils/navigate-once'
import { getCustomNavPagePaddingStyle } from '@/utils/page-safe-area'

const pageSafeStyle = getCustomNavPagePaddingStyle()

function handleSelect(item: BridgeSourceCardType) {
  navigateOnce(item.route)
}
</script>

<template>
  <view class="page-container bridge-page" :style="pageSafeStyle">
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
