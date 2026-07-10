<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'

import ConnectedAgentListItem from '@/components/ConnectedAgentListItem.vue'
import DemoDataNotice from '@/components/DemoDataNotice.vue'
import { fetchConnectedAccounts } from '@/api/accounts-api'
import { switchRootTab } from '@/constants/tabbar'
import type { ConnectedAgentItem } from '@/utils/connected-accounts'
import { showToast } from '@/utils/format'
import { openConnectedAgent } from '@/utils/open-connected-agent'
import { getCustomNavPagePaddingStyle } from '@/utils/page-safe-area'

const pageSafeStyle = getCustomNavPagePaddingStyle()

const loading = ref(false)
const refreshing = ref(false)
const items = ref<ConnectedAgentItem[]>([])

async function loadAccounts(options?: { silent?: boolean }) {
  if (!options?.silent) {
    loading.value = true
  }
  try {
    const result = await fetchConnectedAccounts()
    items.value = result.items
  } catch (err) {
    if (!options?.silent) {
      showToast(err instanceof Error ? err.message : '加载失败')
    }
  } finally {
    if (!options?.silent) {
      loading.value = false
    }
  }
}

onShow(() => {
  void loadAccounts({ silent: items.value.length > 0 })
})

async function handleRefresh() {
  refreshing.value = true
  try {
    await loadAccounts({ silent: true })
  } catch (err) {
    showToast(err instanceof Error ? err.message : '刷新失败')
  } finally {
    refreshing.value = false
  }
}

function handleItemTap(item: ConnectedAgentItem) {
  if (item.status !== 'online') {
    showToast('助手当前离线，请确认本机连接器已启动')
    return
  }
  openConnectedAgent(item)
}

function goBridge() {
  switchRootTab('bridge')
}
</script>

<template>
  <view class="page-container agents-page" :style="pageSafeStyle">
    <DemoDataNotice />

    <scroll-view
      class="agents-page__scroll"
      scroll-y
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="handleRefresh"
    >
      <view v-if="loading && items.length === 0" class="empty">
        <text class="empty__desc">加载中…</text>
      </view>

      <view v-else-if="items.length === 0" class="empty">
        <text class="empty__title">暂无在线助手</text>
        <text class="empty__desc">前往「桥接」连接本机 Agent 后刷新</text>
        <view class="empty__action" @tap="goBridge">去桥接</view>
      </view>

      <view v-else class="agents-page__list">
        <ConnectedAgentListItem
          v-for="item in items"
          :key="item.connectionId"
          :item="item"
          @tap="handleItemTap(item)"
        />
      </view>
    </scroll-view>
  </view>
</template>

<style scoped lang="scss">
.agents-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #ffffff;
}

.agents-page__scroll {
  flex: 1;
  min-height: 0;
}

.agents-page__list {
  margin-top: 8rpx;
  background: #ffffff;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 48rpx 0;
}

.empty__title {
  font-size: 34rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.empty__desc {
  margin-top: 16rpx;
  font-size: 28rpx;
  color: #8c8c8c;
  text-align: center;
}

.empty__action {
  margin-top: 40rpx;
  padding: 18rpx 48rpx;
  border-radius: 999rpx;
  background: #00754a;
  color: #ffffff;
  font-size: 28rpx;
}
</style>
