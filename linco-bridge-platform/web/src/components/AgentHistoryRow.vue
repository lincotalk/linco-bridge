<script setup lang="ts">
import type { AgentHistoryItem } from '@/bridge/types'
import { formatConversationTime, formatSessionPreview } from '@/utils/format'

const props = defineProps<{
  item: AgentHistoryItem
}>()

function previewText(): string {
  return formatSessionPreview(props.item.preview) || '暂无消息'
}
</script>

<template>
  <view class="history-row">
    <view class="history-row__head">
      <view v-if="item.unread" class="history-row__dot" />
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
  width: 100%;
}

.history-row__head {
  display: flex;
  align-items: center;
  min-width: 0;
}

.history-row__dot {
  flex-shrink: 0;
  width: 12rpx;
  height: 12rpx;
  margin-right: 12rpx;
  border-radius: 50%;
  background: #00754a;
}

.history-row__title {
  flex: 1;
  min-width: 0;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.2;
  color: #1a1a1a;
}

.history-row__time {
  flex-shrink: 0;
  margin-left: 20rpx;
  font-size: 21rpx;
  line-height: 1.35;
  color: rgba(0, 0, 0, 0.3);
}

.history-row__preview-line {
  margin-top: 8rpx;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.history-row__preview {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 26rpx;
  line-height: 1.2;
  color: rgba(0, 0, 0, 0.45);
}

.history-row__preview--working {
  color: rgba(0, 0, 0, 0.55);
}
</style>
