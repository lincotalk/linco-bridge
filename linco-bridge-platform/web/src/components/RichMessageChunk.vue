<script setup lang="ts">
import { computed } from 'vue'
import ChatCodeBlock from '@/components/ChatCodeBlock.vue'
import ChatHtmlBlock from '@/components/ChatHtmlBlock.vue'
import MessageMarkdownBody from '@/components/MessageMarkdownBody.vue'
import { parseMessageSegments } from '@/utils/message-content'

const props = defineProps<{
  content: string
  variant?: 'user' | 'assistant'
  streaming?: boolean
}>()

const emit = defineEmits<{
  linkTap: [href: string]
}>()

const segments = computed(() => parseMessageSegments(props.content, { streaming: props.streaming }))
</script>

<template>
  <view class="rich-message-chunk">
    <template v-for="(segment, index) in segments" :key="`${segment.type}-${index}`">
      <ChatHtmlBlock
        v-if="segment.type === 'html'"
        :html="segment.content"
        :incomplete="segment.incomplete === true"
        :streaming="streaming === true"
      />
      <ChatCodeBlock
        v-else-if="segment.type === 'code'"
        :code="segment.content"
        :language="segment.language"
        :variant="variant"
        :show-streaming-indicator="streaming === true && segment.incomplete === true"
      />
      <MessageMarkdownBody
        v-else-if="segment.type === 'text'"
        :content="segment.content"
        :variant="variant"
        :streaming="streaming"
        @link-tap="emit('linkTap', $event)"
      />
    </template>
  </view>
</template>

<style scoped lang="scss">
.rich-message-chunk {
  width: 100%;
}
</style>
