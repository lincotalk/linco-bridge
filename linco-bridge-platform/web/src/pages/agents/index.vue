<script setup lang="ts">

import { onShow } from '@dcloudio/uni-app'

import { ref } from 'vue'



import ConnectedAgentSwipeListItem from '@/components/ConnectedAgentSwipeListItem.vue'

import DemoDataNotice from '@/components/DemoDataNotice.vue'

import { fetchConnectedAccounts } from '@/api/accounts-api'

import { switchRootTab } from '@/constants/tabbar'

import { useBridgeStore, useSessionStore } from '@/stores'

import type { ConnectedAgentItem } from '@/utils/connected-accounts'

import { showToast } from '@/utils/format'

import { openConnectedAgent } from '@/utils/open-connected-agent'

import { getCustomNavPagePaddingStyle } from '@/utils/page-safe-area'



const pageSafeStyle = getCustomNavPagePaddingStyle()



const bridgeStore = useBridgeStore()

const sessionStore = useSessionStore()



const loading = ref(false)

const refreshing = ref(false)

const items = ref<ConnectedAgentItem[]>([])

const emptyHint = ref('前往「桥接」连接本机 Agent 后刷新')

const openedSwipeId = ref<string | null>(null)

const deletingId = ref<string | null>(null)



async function loadAccounts(options?: { silent?: boolean }) {

  if (!options?.silent) {

    loading.value = true

  }

  try {

    const result = await fetchConnectedAccounts()

    items.value = result.items
    emptyHint.value =
      result.hint && result.hint !== '暂无已连接助手'
        ? result.hint
        : '前往「桥接」连接本机 Agent 后刷新'

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

  void sessionStore.loadSessions()

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

  if (openedSwipeId.value === item.connectionId) {

    openedSwipeId.value = null

    return

  }

  if (openedSwipeId.value) {

    openedSwipeId.value = null

    return

  }

  openConnectedAgent(item)

}



function handleSwipeOpen(connectionId: string) {

  openedSwipeId.value = connectionId

}



function handleSwipeClose(connectionId: string) {

  if (openedSwipeId.value === connectionId) {

    openedSwipeId.value = null

  }

}



function confirmDeleteAgent(item: ConnectedAgentItem) {

  if (deletingId.value) {

    return

  }



  uni.showModal({

    title: '删除助手',

    content: '将永久删除该助手、聊天记录，并通知本机连接器清除配置，无法恢复。',

    confirmText: '删除',

    confirmColor: '#ff4d4f',

    success: (res) => {

      if (res.confirm) {

        void deleteAgent(item)

      } else {

        openedSwipeId.value = null

      }

    },

  })

}



async function deleteAgent(item: ConnectedAgentItem) {

  deletingId.value = item.connectionId

  try {

    const result = await bridgeStore.sdk.deleteConnection(item.agentType, item.connectionId)

    if (!result.deleted) {

      throw new Error('删除失败，请稍后重试')

    }



    sessionStore.removeSessionsByConnection(item.connectionId)

    items.value = items.value.filter((row) => row.connectionId !== item.connectionId)

    openedSwipeId.value = null



    await sessionStore.loadSessions().catch(() => undefined)



    if (result.commandSent) {

      showToast('已删除助手，已通知电脑端清除配置', 'success')

    } else {

      showToast('已删除助手', 'success')

    }

  } catch (err) {

    showToast(err instanceof Error ? err.message : '删除失败')

  } finally {

    deletingId.value = null

  }

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

        <text class="empty__title">暂无已连接助手</text>

        <text class="empty__desc">{{ emptyHint }}</text>

        <view class="empty__action" @tap="goBridge">去桥接</view>

      </view>



      <view v-else class="agents-page__list">

        <ConnectedAgentSwipeListItem

          v-for="item in items"

          :key="item.connectionId"

          :item="item"

          :open="openedSwipeId === item.connectionId"

          @open="handleSwipeOpen(item.connectionId)"

          @close="handleSwipeClose(item.connectionId)"

          @tap="handleItemTap(item)"

          @delete="confirmDeleteAgent"

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
  padding: 16rpx 30rpx 24rpx;
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


