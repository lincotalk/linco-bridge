<script setup lang="ts">
import { copyToClipboard, showToast } from '@/utils/format'

const props = defineProps<{
  commands: string
}>()

const emit = defineEmits<{
  copied: []
}>()

async function handleCopy() {
  try {
    await copyToClipboard(props.commands)
    showToast('已复制命令', 'success')
    emit('copied')
  } catch {
    showToast('复制失败')
  }
}
</script>

<template>
  <view class="command-block card">
    <view class="command-block__header">
      <text class="command-block__label">连接命令</text>
      <view class="command-block__copy" @tap="handleCopy">
        <text>复制</text>
      </view>
    </view>
    <text class="command-block__content" selectable>{{ commands }}</text>
  </view>
</template>

<style scoped lang="scss">
.command-block {
  padding: 24rpx;
}

.command-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.command-block__label {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.command-block__copy {
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  background: #f0f0f0;
  font-size: 24rpx;
  color: #1677ff;
}

.command-block__content {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 24rpx;
  line-height: 1.6;
  color: #434343;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
