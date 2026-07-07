<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChatMessage } from '@/bridge/types'
import AgentThinkingEntry from '@/components/AgentThinkingEntry.vue'
import ChatStreamingIndicator from '@/components/ChatStreamingIndicator.vue'
import MessageAttachmentList from '@/components/MessageAttachmentList.vue'
import MessageContent from '@/components/MessageContent.vue'
import ThinkingProcessSheet from '@/components/ThinkingProcessSheet.vue'

const props = defineProps<{
  message: ChatMessage
}>()

const sheetVisible = ref(false)

const hasReasoning = computed(() => Boolean(props.message.reasoning?.content.trim()))
const showThinkingIndicator = computed(
  () =>
    props.message.streaming &&
    (!props.message.content.trim() || props.message.reasoningStreaming),
)
const reasoningContent = computed(() => props.message.reasoning?.content ?? '')
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
      <AgentThinkingEntry
        v-if="hasReasoning"
        :started-at="message.reasoning!.startedAt"
        :ended-at="message.reasoning!.endedAt"
        :streaming="message.reasoningStreaming"
        @tap="sheetVisible = true"
      />

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
        v-if="showThinkingIndicator"
        class="message-row__thinking"
        label="正在思考"
      />
    </view>

    <ThinkingProcessSheet
      :visible="sheetVisible"
      :content="reasoningContent"
      @close="sheetVisible = false"
    />
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
  margin-top: 8rpx;
}

.message-row__thinking {
  margin-top: 8rpx;
}
</style>
