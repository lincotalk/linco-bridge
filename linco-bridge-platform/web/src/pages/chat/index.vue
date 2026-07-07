<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref, watch } from 'vue'
import AgentLandingAppBar from '@/components/AgentLandingAppBar.vue'
import ChatBubble from '@/components/ChatBubble.vue'
import ChatInputArea from '@/components/ChatInputArea.vue'
import { parseAgentTypeFromSessionId } from '@/bridge/sdk/agent-chat'
import type { AgentBridgeType } from '@/bridge/types'
import { useChatSession } from '@/composables/useChatSession'
import { useProjectPicker } from '@/composables/useProjectPicker'
import { useAgentPanel } from '@/composables/useAgentPanel'
import { useAttachmentPicker } from '@/composables/useAttachmentPicker'
import { useVoiceInput } from '@/composables/useVoiceInput'
import { showToast } from '@/utils/format'
import { isBoundWorkspacePick } from '@/utils/pick-workspace'
import { openBoundBridgeChat, reloadBoundChatSession } from '@/utils/open-bound-chat'

const chat = useChatSession()
const { pickWorkspace } = useProjectPicker()
const agentType = ref<AgentBridgeType | null>(null)
const refreshing = ref(false)
const {
  draft,
  sending,
  loading,
  header,
  messages,
  scrollAnchor,
  loadSession,
  sendMessage,
  stopGeneration,
  scrollToBottom,
  reloadHistory,
} = chat

const agentPanel = useAgentPanel({
  sessionId: chat.sessionId,
  agentType,
  onReloadHistory: reloadHistory,
})
const { pickFiles, pendingFiles, clearFiles, removeFile } = useAttachmentPicker()
const { startVoice } = useVoiceInput((text) => {
  draft.value = draft.value ? `${draft.value} ${text}` : text
})

onLoad((query) => {
  const id = String(query?.sessionId ?? '')
  const initialDraft = query?.draft ? decodeURIComponent(String(query.draft)) : undefined
  const reloadHistory =
    query?.reloadHistory === '1' ||
    query?.reloadHistory === 'true' ||
    query?.reloadHistory === true
  agentType.value = parseAgentTypeFromSessionId(id)
  if (id) {
    void loadSession(id, { initialDraft, reloadHistory })
  }
})

watch(
  () => messages.value.length,
  () => {
    scrollToBottom()
  },
)

watch(
  () => {
    const last = messages.value[messages.value.length - 1]
    if (!last?.streaming) return ''
    return `${last.id}:${last.content.length}`
  },
  () => {
    scrollToBottom()
  },
)

async function handleWorkspace() {
  if (!agentType.value) {
    showToast('当前会话不支持切换工作区')
    return
  }
  try {
    const picked = await pickWorkspace(agentType.value, undefined, chat.sessionId.value)
    if (!picked) return
    if (isBoundWorkspacePick(picked)) {
      if (picked.sessionId !== chat.sessionId.value) {
        await openBoundBridgeChat(picked)
        return
      }
      await reloadBoundChatSession(picked.sessionId!, reloadHistory)
      showToast(`已切换至 ${picked.title ?? picked.name}`)
      return
    }
    if (picked.sessionId && picked.sessionId !== chat.sessionId.value) {
      uni.redirectTo({
        url: `/pages/chat/index?sessionId=${encodeURIComponent(picked.sessionId)}`,
      })
      return
    }
    await chat.loadSession(chat.sessionId.value)
    showToast(`已选择 ${picked.name}`)
  } catch (error) {
    showToast(error instanceof Error ? error.message : '切换工作区失败')
  }
}

function handleMore() {
  agentPanel.openPanel()
}

async function handleAdd() {
  await pickFiles()
}

function handleSend() {
  const files = pendingFiles.value
  void sendMessage(undefined, files).finally(() => {
    clearFiles()
  })
}

function handleVoice() {
  startVoice()
}

async function handleRefresh() {
  refreshing.value = true
  try {
    await reloadHistory()
  } finally {
    refreshing.value = false
  }
}

function handleStop() {
  void stopGeneration()
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
      refresher-enabled
      :refresher-triggered="refreshing"
      :scroll-with-animation="true"
      :scroll-into-view="scrollAnchor"
      @refresherrefresh="handleRefresh"
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
      :pending-files="pendingFiles"
      @send="handleSend"
      @stop="handleStop"
      @add="handleAdd"
      @voice="handleVoice"
      @remove-file="removeFile"
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
  padding: 24rpx 32rpx 16rpx;
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
