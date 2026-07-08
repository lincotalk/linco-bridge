<script setup lang="ts">
import { computed } from 'vue'
import {
  hasMarkdownStructure,
  parseMarkdownBlocks,
  type MarkdownInlineNode,
} from '@/utils/markdown-render'

const props = defineProps<{
  content: string
  variant?: 'user' | 'assistant'
  streaming?: boolean
}>()

const emit = defineEmits<{
  linkTap: [href: string]
}>()

const blocks = computed(() => parseMarkdownBlocks(props.content))
const useMarkdown = computed(() => hasMarkdownStructure(props.content))

function inlineText(nodes: MarkdownInlineNode[]): string {
  return nodes.map((node) => (node.type === 'link' ? node.label : node.value ?? node.label)).join('')
}

function handleLink(href: string) {
  if (props.streaming) return
  emit('linkTap', href)
}
</script>

<template>
  <view
    v-if="!useMarkdown"
    class="message-markdown__plain-wrap"
    :class="`message-markdown__plain-wrap--${variant ?? 'assistant'}`"
  >
    <text class="message-markdown__plain">{{ content }}</text>
  </view>
  <view v-else class="message-markdown" :class="`message-markdown--${variant ?? 'assistant'}`">
    <template v-for="(block, blockIndex) in blocks" :key="`block-${blockIndex}`">
      <view
        v-if="block.type === 'heading'"
        class="message-markdown__heading"
        :class="`message-markdown__heading--${block.level}`"
      >
        <text>{{ inlineText(block.inlines) }}</text>
      </view>

      <view v-else-if="block.type === 'blockquote'" class="message-markdown__quote">
        <text>{{ inlineText(block.inlines) }}</text>
      </view>

      <view v-else-if="block.type === 'hr'" class="message-markdown__hr" />

      <view
        v-else-if="block.type === 'list'"
        class="message-markdown__list"
        :class="{ 'message-markdown__list--ordered': block.ordered }"
      >
        <view
          v-for="(item, itemIndex) in block.items"
          :key="`item-${blockIndex}-${itemIndex}`"
          class="message-markdown__list-item"
        >
          <text class="message-markdown__bullet">{{ block.ordered ? `${itemIndex + 1}.` : '•' }}</text>
          <view class="message-markdown__list-body">
            <text class="message-markdown__text">
              <template v-for="(node, nodeIndex) in item" :key="`inline-${nodeIndex}`">
                <text v-if="node.type === 'text'">{{ node.value }}</text>
                <text v-else-if="node.type === 'bold'" class="message-markdown__bold">{{ node.value }}</text>
                <text v-else-if="node.type === 'code'" class="message-markdown__inline-code">{{ node.value }}</text>
                <text
                  v-else
                  class="message-markdown__link"
                  @tap="handleLink(node.href)"
                >
                  {{ node.label }}
                </text>
              </template>
            </text>
          </view>
        </view>
      </view>

      <view v-else class="message-markdown__paragraph">
        <text class="message-markdown__text">
          <template v-for="(node, nodeIndex) in block.inlines" :key="`p-${blockIndex}-${nodeIndex}`">
            <text v-if="node.type === 'text'">{{ node.value }}</text>
            <text v-else-if="node.type === 'bold'" class="message-markdown__bold">{{ node.value }}</text>
            <text v-else-if="node.type === 'code'" class="message-markdown__inline-code">{{ node.value }}</text>
            <text
              v-else
              class="message-markdown__link"
              @tap="handleLink(node.href)"
            >
              {{ node.label }}
            </text>
          </template>
        </text>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.message-markdown__plain-wrap {
  display: block;
  width: 100%;
  box-sizing: border-box;
}

.message-markdown__plain,
.message-markdown__text {
  display: block;
  width: 100%;
  box-sizing: border-box;
  font-size: 30rpx;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.message-markdown {
  width: 100%;
  box-sizing: border-box;
}

.message-markdown__plain--assistant,
.message-markdown--assistant .message-markdown__text {
  color: rgba(0, 0, 0, 0.85);
}

.message-markdown__plain--user,
.message-markdown--user .message-markdown__text {
  color: rgba(0, 0, 0, 0.85);
}

.message-markdown__heading {
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
  margin: 8rpx 0 12rpx;
}

.message-markdown__heading--1 {
  font-size: 36rpx;
}

.message-markdown__heading--2 {
  font-size: 34rpx;
}

.message-markdown__heading--3 {
  font-size: 32rpx;
}

.message-markdown__paragraph {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 16rpx;
}

.message-markdown__paragraph:last-child {
  margin-bottom: 0;
}

.message-markdown__bold {
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.message-markdown__inline-code {
  padding: 2rpx 8rpx;
  border-radius: 8rpx;
  background: rgba(0, 0, 0, 0.06);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 26rpx;
}

.message-markdown__link {
  color: #00754a;
  text-decoration: underline;
}

.message-markdown__quote {
  margin: 12rpx 0;
  padding: 12rpx 20rpx;
  border-left: 6rpx solid rgba(0, 0, 0, 0.12);
  color: rgba(0, 0, 0, 0.62);
}

.message-markdown__hr {
  height: 1px;
  margin: 20rpx 0;
  background: rgba(0, 0, 0, 0.08);
}

.message-markdown__list {
  margin: 8rpx 0 16rpx;
}

.message-markdown__list-item {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.message-markdown__bullet {
  flex-shrink: 0;
  width: 28rpx;
  font-size: 28rpx;
  line-height: 1.65;
  color: rgba(0, 0, 0, 0.45);
}

.message-markdown__list-body {
  flex: 1;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}
</style>
