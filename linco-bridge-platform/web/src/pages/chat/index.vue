<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { watch } from 'vue'
import AgentLandingAppBar from '@/components/AgentLandingAppBar.vue'
import ChatBubble from '@/components/ChatBubble.vue'
import ChatInputArea from '@/components/ChatInputArea.vue'
import { useChatSession } from '@/composables/useChatSession'
import { showToast } from '@/utils/format'

const chat = useChatSession()
const {
  draft,
  sending,
  loading,
  header,
  messages,
  scrollAnchor,
  loadSession,
  sendMessage,
  scrollToBottom,
} = chat

onLoad((query) => {
  const id = String(query?.sessionId ?? '')
  const initialDraft = query?.draft ? decodeURIComponent(String(query.draft)) : undefined
  if (id) {
    void loadSession(id, initialDraft)
  }
})

watch(
  () => messages.value.length,
  () => {
    scrollToBottom()
  },
)

function handleWorkspace() {
  showToast('工作区选择待插件接入')
}

function handleMore() {
  showToast('Agent 侧栏待 SDK 接入')
}

function handleAdd() {
  showToast('附件选择待 SDK 接入')
}

function handleSend() {
  void sendMessage()
}

function handleVoice() {
  showToast('语音输入待 SDK 接入')
}

function handleStop() {
  showToast('停止生成待 SDK 接入')
}
</script>

<template>
  <view class="page-container chat-page">
    <AgentLandingAppBar
      v-if="header"
      :title="header.title"
      :subtitle="header.subtitle"
      :avatar="header.avatar"
      show-workspace
      @workspace="handleWorkspace"
      @more="handleMore"
    />

    <scroll-view
      class="chat-page__messages"
      scroll-y
      :scroll-with-animation="true"
      :scroll-into-view="scrollAnchor"
    >
      <view v-if="loading" class="chat-page__state">
        <text class="chat-page__state-text">加载中…</text>
      </view>

      <view v-else-if="messages.length === 0" class="chat-page__state">
        <text class="chat-page__state-text">发送消息开始对话</text>
      </view>

      <view v-else class="chat-page__list">
        <ChatBubble v-for="item in messages" :key="item.id" :message="item" />
      </view>

      <view id="chat-bottom" class="chat-page__bottom-spacer" />
    </scroll-view>

    <ChatInputArea
      v-model="draft"
      :disabled="loading"
      :sending="sending"
      :is-send-disabled="loading"
      @send="handleSend"
      @stop="handleStop"
      @add="handleAdd"
      @voice="handleVoice"
    />
  </view>
</template>

<style scoped lang="scss">
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #ffffff;
}

.chat-page__messages {
  flex: 1;
  min-height: 0;
  background: #ffffff;
}

.chat-page__list {
  padding: 24rpx 24rpx 16rpx;
}

.chat-page__state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 480rpx;
}

.chat-page__state-text {
  font-size: 28rpx;
  color: rgba(0, 0, 0, 0.45);
}

.chat-page__bottom-spacer {
  height: 24rpx;
}
</style>
