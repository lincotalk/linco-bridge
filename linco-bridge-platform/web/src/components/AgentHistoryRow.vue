<script setup lang="ts">
import type { AgentHistoryItem } from '@/bridge/types'
import { formatConversationTime } from '@/utils/format'
import { resolveAgentHistoryPreviewText } from '@/utils/agent-history-preview'

defineOptions({
  // 小程序：去掉自定义组件额外宿主节点，避免高度塌陷/样式落不到根上
  virtualHost: true,
})

const props = defineProps<{
  item: AgentHistoryItem
}>()

function previewText(): string {
  return resolveAgentHistoryPreviewText(props.item)
}
</script>

<template>
  <view class="history-row">
    <view class="history-row__head">
      <view v-if="item.unread" class="history-row__dot" />
      <text v-if="item.pinned" class="history-row__pin">📌</text>
      <text class="history-row__title text-ellipsis">{{ item.title }}</text>
      <text class="history-row__time">{{ formatConversationTime(item.updatedAt) }}</text>
    </view>
    <view class="history-row__preview-line">
      <text class="history-row__preview" :class="{ 'history-row__preview--working': item.working }">
        {{ previewText() }}
      </text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.history-row {
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
}

.history-row__head {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  min-width: 0;
  min-height: 36rpx;
}

.history-row__dot {
  flex-shrink: 0;
  width: 12rpx;
  height: 12rpx;
  margin-right: 12rpx;
  border-radius: 50%;
  background: #00754a;
}

.history-row__pin {
  flex-shrink: 0;
  margin-right: 8rpx;
  font-size: 22rpx;
  line-height: 22rpx;
  opacity: 0.55;
}

.history-row__title {
  flex: 1;
  min-width: 0;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 36rpx;
  color: #1a1a1a;
}

.history-row__time {
  flex-shrink: 0;
  margin-left: 20rpx;
  font-size: 21rpx;
  line-height: 28rpx;
  color: rgba(0, 0, 0, 0.3);
}

.history-row__preview-line {
  margin-top: 12rpx;
  width: 100%;
  min-width: 0;
  min-height: 32rpx;
  overflow: hidden;
}

.history-row__preview {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 26rpx;
  line-height: 32rpx;
  color: rgba(0, 0, 0, 0.45);
}

.history-row__preview--working {
  color: rgba(0, 0, 0, 0.55);
}
</style>
