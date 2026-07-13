<script setup lang="ts">

import { onShow } from '@dcloudio/uni-app'

import { ref } from 'vue'

import SessionSwipeListItem from '@/components/SessionSwipeListItem.vue'
import SessionListItem from '@/components/SessionListItem.vue'

import { deleteSessionsFromList } from '@/api/session-api'

import { switchRootTab } from '@/constants/tabbar'

import { useSessionStore } from '@/stores'

import type { ChatSessionItem } from '@/bridge/types'

import { showToast } from '@/utils/format'

import { openSessionLanding } from '@/utils/open-agent-landing'
import { getCustomNavPagePaddingStyle } from '@/utils/page-safe-area'
import { isH5Runtime } from '@/utils/platform-runtime'

const pageSafeStyle = getCustomNavPagePaddingStyle()
const useSimpleListOnH5 = isH5Runtime()



const sessionStore = useSessionStore()

const refreshing = ref(false)

const openedSwipeId = ref<string | null>(null)

const deletingId = ref<string | null>(null)
let lastItemTapAt = 0



onShow(() => {

  void sessionStore.loadSessions()

})



async function handleRefresh() {

  refreshing.value = true

  try {

    await sessionStore.loadSessions()

  } catch (err) {

    showToast(err instanceof Error ? err.message : '刷新失败')

  } finally {

    refreshing.value = false

  }

}



function openSession(item: ChatSessionItem) {
  openSessionLanding(item)
}



function handleScrollBackgroundTap() {
  if (!useSimpleListOnH5 && openedSwipeId.value) {
    openedSwipeId.value = null
  }
}



function handleItemTap(item: ChatSessionItem) {
  const now = Date.now()
  if (now - lastItemTapAt < 400) return
  lastItemTapAt = now

  if (openedSwipeId.value === item.id) {
    openedSwipeId.value = null
    return
  }
  if (openedSwipeId.value) {
    openedSwipeId.value = null
  }
  openSession(item)
}



function handleSwipeOpen(sessionId: string) {

  openedSwipeId.value = sessionId

}



function handleSwipeClose(sessionId: string) {

  if (openedSwipeId.value === sessionId) {

    openedSwipeId.value = null

  }

}



function confirmDeleteSession(item: ChatSessionItem) {

  if (deletingId.value) {

    return

  }

  uni.showModal({

    title: '删除会话',

    content: '将永久删除该连接下的会话与消息记录，无法恢复。本机 Agent 与连接器配置不受影响。',

    confirmText: '删除',

    confirmColor: '#ff4d4f',

    success: (res) => {

      if (res.confirm) {

        void deleteSession(item)

      } else {

        openedSwipeId.value = null

      }

    },

  })

}



async function deleteSession(item: ChatSessionItem) {
  deletingId.value = item.id
  try {
    const deletedCount = await deleteSessionsFromList([item.id])
    if (deletedCount <= 0) {
      throw new Error('删除失败，请刷新后重试')
    }
    if (item.connectionId) {
      sessionStore.removeSessionsByConnection(item.connectionId)
    } else {
      sessionStore.removeSession(item.id)
    }
    openedSwipeId.value = null
    showToast('已删除', 'success')
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

  <view class="page-container messages-page" :style="pageSafeStyle">

    <scroll-view

      class="messages-page__scroll"

      scroll-y

      refresher-enabled

      :refresher-triggered="refreshing"

      @refresherrefresh="handleRefresh"

      @tap="handleScrollBackgroundTap"

    >

      <view v-if="sessionStore.loadingSessions && sessionStore.sessions.length === 0" class="empty">

        <text class="empty__desc">加载中…</text>

      </view>



      <view v-else-if="sessionStore.sessions.length === 0" class="empty">

        <text class="empty__title">暂无桥接会话</text>

        <text class="empty__desc">前往「桥接」连接本机 Agent</text>

        <view class="empty__action" @tap="goBridge">去桥接</view>

      </view>



      <view v-else class="messages-page__list">
        <template v-if="useSimpleListOnH5">
          <SessionListItem
            v-for="item in sessionStore.sessions"
            :key="item.id"
            :item="item"
            @select="handleItemTap(item)"
          />
        </template>
        <template v-else>
          <SessionSwipeListItem
            v-for="item in sessionStore.sessions"
            :key="item.id"
            :item="item"
            :open="openedSwipeId === item.id"
            @open="handleSwipeOpen(item.id)"
            @close="handleSwipeClose(item.id)"
            @tap="handleItemTap(item)"
            @delete="confirmDeleteSession(item)"
          />
        </template>
      </view>

    </scroll-view>

  </view>

</template>



<style scoped lang="scss">

.messages-page {

  display: flex;

  flex-direction: column;

  height: 100vh;

  background: #ffffff;

}



.messages-page__scroll {

  flex: 1;

  min-height: 0;

}



.messages-page__list {

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

