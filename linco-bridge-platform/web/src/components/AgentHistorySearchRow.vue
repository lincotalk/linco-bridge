<script setup lang="ts">
import { computed } from 'vue'
import type { AgentHistoryItem } from '@/bridge/types'
import { formatConversationTime } from '@/utils/format'
import { resolveAgentHistoryPreviewText } from '@/utils/agent-history-preview'
import { buildHighlightSegments } from '@/utils/highlight-text'

const props = defineProps<{
  item: AgentHistoryItem
  query: string
  isBatchMode: boolean
  selected: boolean
}>()

const emit = defineEmits<{
  tap: []
  longpress: []
  toggleSelected: []
}>()

const titleSegments = computed(() => buildHighlightSegments(props.item.title, props.query))
const previewText = computed(() =>
  resolveAgentHistoryPreviewText(props.item, '暂无消息预览'),
)
const previewSegments = computed(() => buildHighlightSegments(previewText.value, props.query))

function handleTap() {
  emit('tap')
}

function handleLongPress() {
  emit('longpress')
}

function handleToggleSelected() {
  emit('toggleSelected')
}
</script>

<template>
  <view
    class="history-search-row"
    @tap="handleTap"
    @longpress="handleLongPress"
  >
    <view
      v-if="isBatchMode"
      class="history-search-row__check"
      @tap.stop="handleToggleSelected"
    >
      <view class="history-search-row__circle" :class="{ 'history-search-row__circle--selected': selected }">
        <text v-if="selected" class="history-search-row__checkmark">✓</text>
      </view>
    </view>

    <view class="history-search-row__content">
      <view class="history-search-row__title-line">
        <view v-if="item.unread" class="history-search-row__dot" />
        <text class="history-search-row__title text-ellipsis">
          <text
            v-for="(segment, index) in titleSegments"
            :key="`title-${index}`"
            :class="{ 'history-search-row__highlight': segment.highlight }"
          >
            {{ segment.text }}
          </text>
        </text>
      </view>

      <view class="history-search-row__preview-line">
        <text class="history-search-row__preview">
          <text
            v-for="(segment, index) in previewSegments"
            :key="`preview-${index}`"
            :class="{ 'history-search-row__highlight': segment.highlight }"
          >
            {{ segment.text }}
          </text>
        </text>
      </view>

      <text class="history-search-row__time">{{ formatConversationTime(item.updatedAt) }}</text>
    </view>

    <text v-if="!isBatchMode" class="history-search-row__chevron">›</text>
  </view>
</template>

<style scoped lang="scss">
.history-search-row {
  display: flex;
  align-items: center;
  min-height: 124rpx;
  padding: 16rpx 0;
}

.history-search-row__check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48rpx;
  height: 104rpx;
  margin-right: 12rpx;
}

.history-search-row__circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28rpx;
  height: 28rpx;
  border: 2rpx solid #b8b8b8;
  border-radius: 50%;
}

.history-search-row__circle--selected {
  border-color: #00754a;
  background: #00754a;
}

.history-search-row__checkmark {
  font-size: 18rpx;
  line-height: 1;
  color: #ffffff;
}

.history-search-row__content {
  flex: 1;
  min-width: 0;
}

.history-search-row__title-line {
  display: flex;
  align-items: center;
  min-width: 0;
}

.history-search-row__dot {
  flex-shrink: 0;
  width: 12rpx;
  height: 12rpx;
  margin-right: 12rpx;
  border-radius: 50%;
  background: #00754a;
}

.history-search-row__title {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1.35;
  color: #1a1a1a;
}

.history-search-row__preview-line {
  margin-top: 8rpx;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.history-search-row__preview {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 24rpx;
  line-height: 1.35;
  color: rgba(0, 0, 0, 0.45);
}

.history-search-row__time {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  line-height: 1.35;
  color: rgba(0, 0, 0, 0.3);
}

.history-search-row__highlight {
  color: #00754a;
}

.history-search-row__chevron {
  flex-shrink: 0;
  margin-left: 20rpx;
  font-size: 36rpx;
  line-height: 1;
  color: rgba(0, 0, 0, 0.25);
}
</style>
