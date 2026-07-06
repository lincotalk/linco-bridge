<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AppNavBar from '@/components/AppNavBar.vue'
import ChatBubble from '@/components/ChatBubble.vue'
import { useSessionStore } from '@/stores'

const sessionStore = useSessionStore()
const sessionId = ref('')
const draft = ref('')
const sending = ref(false)

const messages = computed(() => sessionStore.getMessages(sessionId.value))

onLoad((query) => {
  sessionId.value = String(query?.sessionId ?? '')
  if (sessionId.value) {
    void sessionStore.loadMessages(sessionId.value)
  }
})

async function handleSend() {
  const content = draft.value.trim()
  if (!content || !sessionId.value || sending.value) return

  sending.value = true
  draft.value = ''
  try {
    await sessionStore.sendMessage(sessionId.value, content)
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '发送失败',
      icon: 'none',
    })
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <view class="page-container chat-page">
    <AppNavBar show-back />
    <scroll-view class="chat-page__messages" scroll-y :scroll-with-animation="true">
      <ChatBubble v-for="item in messages" :key="item.id" :message="item" />
    </scroll-view>
    <view class="chat-page__composer">
      <input
        v-model="draft"
        class="chat-page__input"
        type="text"
        confirm-type="send"
        placeholder="输入消息…"
        @confirm="handleSend"
      />
      <view class="chat-page__send" @tap="handleSend">发送</view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.chat-page__messages {
  flex: 1;
  padding: 24rpx 24rpx 16rpx;
  box-sizing: border-box;
}

.chat-page__composer {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background: #ffffff;
  border-top: 1rpx solid #ebebeb;
}

.chat-page__input {
  flex: 1;
  height: 72rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: #f5f5f5;
  font-size: 28rpx;
}

.chat-page__send {
  padding: 16rpx 28rpx;
  border-radius: 999rpx;
  background: #1677ff;
  color: #ffffff;
  font-size: 28rpx;
}
</style>
