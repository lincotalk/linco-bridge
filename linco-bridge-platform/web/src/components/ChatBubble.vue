<script setup lang="ts">
import type { ChatMessage } from '@/bridge/types'
import ChatStreamingIndicator from '@/components/ChatStreamingIndicator.vue'
import MessageAttachmentList from '@/components/MessageAttachmentList.vue'
import MessageContent from '@/components/MessageContent.vue'

defineProps<{
  message: ChatMessage
}>()
</script>

<template>
  <view class="message-row" :class="`message-row--${message.role}`">
    <view v-if="message.role === 'user'" class="message-row__user-wrap">
      <view class="message-row__user-bubble">
        <MessageAttachmentList
          v-if="message.attachments?.length"
          :attachments="message.attachments"
          variant="user"
        />
        <MessageContent
          v-if="message.content"
          :content="message.content"
          variant="user"
          :session-id="message.sessionId"
          :streaming="message.streaming"
        />
      </view>
    </view>

    <view v-else class="message-row__assistant-wrap">
      <MessageAttachmentList
        v-if="message.attachments?.length"
        :attachments="message.attachments"
        variant="assistant"
      />
      <view v-if="message.content" class="message-row__assistant-body">
        <MessageContent
          :content="message.content"
          variant="assistant"
          :session-id="message.sessionId"
          :streaming="message.streaming"
        />
      </view>
      <ChatStreamingIndicator
        v-if="message.streaming && !message.content"
        class="message-row__thinking"
      />
    </view>
  </view>
</template>

<style scoped lang="scss">
.message-row {
  margin-bottom: 28rpx;
}

.message-row__user-wrap {
  display: flex;
  justify-content: flex-end;
}

.message-row__user-bubble {
  max-width: 76%;
  padding: 24rpx 32rpx;
  border-radius: 24rpx;
  background: #f2f4f5;
}

.message-row__assistant-wrap {
  width: 100%;
  padding-right: 8rpx;
}

.message-row__assistant-body {
  width: 100%;
}

.message-row__thinking {
  margin-top: 8rpx;
}
</style>
