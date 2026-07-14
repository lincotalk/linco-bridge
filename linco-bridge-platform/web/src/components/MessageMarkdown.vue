<script setup lang="ts">
import { computed } from 'vue'
import MessageMarkdownBody from '@/components/MessageMarkdownBody.vue'
import RichMessageChunk from '@/components/RichMessageChunk.vue'
import {
  shouldUseLazyMarkdown,
  splitLazyMarkdownChunks,
} from '@/utils/lazy-markdown-chunks'

const props = defineProps<{
  content: string
  variant?: 'user' | 'assistant'
  streaming?: boolean
}>()

const emit = defineEmits<{
  linkTap: [href: string]
}>()

const lazyChunks = computed(() => {
  if (props.streaming || !shouldUseLazyMarkdown(props.content)) {
    return null
  }
  return splitLazyMarkdownChunks(props.content)
})

function handleLink(href: string) {
  emit('linkTap', href)
}
</script>

<template>
  <view
    v-if="lazyChunks"
    class="message-markdown message-markdown--lazy"
    :class="`message-markdown--${variant ?? 'assistant'}`"
  >
    <view
      v-for="(chunk, chunkIndex) in lazyChunks"
      :key="`chunk-${chunkIndex}-${chunk.source.length}`"
      class="message-markdown__chunk"
    >
      <RichMessageChunk
        v-if="chunk.hasHeavyContent"
        :content="chunk.source"
        :variant="variant"
        :streaming="streaming"
        @link-tap="handleLink"
      />
      <MessageMarkdownBody
        v-else
        :content="chunk.source"
        :variant="variant"
        :streaming="streaming"
        @link-tap="handleLink"
      />
    </view>
  </view>
  <MessageMarkdownBody
    v-else
    :content="content"
    :variant="variant"
    :streaming="streaming"
    @link-tap="handleLink"
  />
</template>

<style scoped lang="scss">
.message-markdown {
  width: 100%;
  box-sizing: border-box;
}

.message-markdown--lazy .message-markdown__chunk + .message-markdown__chunk {
  margin-top: 16rpx;
}
</style>
