<script setup lang="ts">
import { copyToClipboard, showToast } from '@/utils/format'

const props = defineProps<{
  code: string
  language?: string
  variant?: 'user' | 'assistant'
}>()

async function handleCopy() {
  try {
    await copyToClipboard(props.code)
    showToast('已复制代码', 'success')
  } catch {
    showToast('复制失败')
  }
}
</script>

<template>
  <view class="chat-code" :class="`chat-code--${variant ?? 'assistant'}`">
    <view class="chat-code__header">
      <text class="chat-code__lang">{{ language || 'code' }}</text>
      <view class="chat-code__copy" @tap="handleCopy">
        <text class="chat-code__copy-text">复制</text>
      </view>
    </view>
    <text class="chat-code__body" selectable>{{ code }}</text>
  </view>
</template>

<style scoped lang="scss">
.chat-code {
  margin: 12rpx 0;
  overflow: hidden;
  border-radius: 12rpx;
}

.chat-code--assistant {
  background: #1e1e1e;
}

.chat-code--user {
  background: rgba(0, 0, 0, 0.24);
}

.chat-code__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10rpx 16rpx;
  background: rgba(255, 255, 255, 0.08);
}

.chat-code__lang {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.65);
}

.chat-code__copy {
  padding: 4rpx 12rpx;
}

.chat-code__copy-text {
  font-size: 22rpx;
  color: #7fdcb3;
}

.chat-code__body {
  display: block;
  padding: 16rpx;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 24rpx;
  line-height: 1.55;
  color: #f5f5f5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
