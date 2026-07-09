<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AgentTraceAction } from '@/bridge/types'
import MessageMarkdown from '@/components/MessageMarkdown.vue'
import {
  actionPreview,
  actionTitle,
  hiddenActionDetail,
  isActionActive,
  isActionSuccess,
  planTodosForAction,
} from '@/utils/agent-trace-view'

const props = defineProps<{
  action: AgentTraceAction
}>()

const expanded = ref(false)

const title = computed(() => actionTitle(props.action))
const preview = computed(() => actionPreview(props.action))
const hiddenDetail = computed(() => hiddenActionDetail(props.action, preview.value))
const todos = computed(() => planTodosForAction(props.action))
const canExpand = computed(
  () =>
    hiddenDetail.value.length > 0 ||
    (props.action.detail_kind === 'markdown' && (props.action.detail?.trim().length ?? 0) > 0),
)
const statusClass = computed(() => {
  if (isActionSuccess(props.action.status)) return 'is-success'
  if (isActionActive(props.action.status)) return 'is-active'
  if (props.action.status === 'failed') return 'is-failed'
  return 'is-idle'
})
</script>

<template>
  <view class="trace-action" :class="statusClass">
    <view class="trace-action__head">
      <view class="trace-action__status-dot" />
      <view class="trace-action__main">
        <view class="trace-action__title-row">
          <text class="trace-action__title">{{ title }}</text>
          <text
            v-if="canExpand"
            class="trace-action__toggle"
            @tap.stop="expanded = !expanded"
          >
            {{ expanded ? '收起' : '展开' }}
          </text>
        </view>
        <text v-if="preview && !expanded" class="trace-action__preview">{{ preview }}</text>
        <view v-if="expanded && action.detail_kind === 'markdown' && action.detail" class="trace-action__markdown">
          <MessageMarkdown :content="action.detail" variant="assistant" />
        </view>
        <text v-else-if="expanded && hiddenDetail" class="trace-action__detail">{{ hiddenDetail }}</text>
        <view v-if="todos.length" class="trace-action__todos">
          <view v-for="(todo, index) in todos" :key="`${action.id}-todo-${index}`" class="trace-action__todo">
            <text class="trace-action__todo-icon">{{ todo.status === 'completed' || todo.status === 'success' ? '✓' : '○' }}</text>
            <text class="trace-action__todo-text">{{ todo.text }}</text>
          </view>
        </view>
        <text v-if="action.error_message" class="trace-action__error">{{ action.error_message }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.trace-action {
  margin-bottom: 16rpx;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  background: #f7f8f9;
  border: 1px solid #eceff1;
}

.trace-action__head {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}

.trace-action__status-dot {
  width: 16rpx;
  height: 16rpx;
  margin-top: 10rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
  flex-shrink: 0;
}

.trace-action.is-active .trace-action__status-dot {
  background: #1677ff;
}

.trace-action.is-success .trace-action__status-dot {
  background: #52c41a;
}

.trace-action.is-failed .trace-action__status-dot {
  background: #ff4d4f;
}

.trace-action__main {
  flex: 1;
  min-width: 0;
}

.trace-action__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.trace-action__title {
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.4;
  color: rgba(0, 0, 0, 0.88);
}

.trace-action__toggle {
  flex-shrink: 0;
  font-size: 24rpx;
  color: rgba(0, 0, 0, 0.45);
}

.trace-action__preview,
.trace-action__detail {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.55);
  white-space: pre-wrap;
  word-break: break-word;
}

.trace-action__markdown {
  margin-top: 12rpx;
}

.trace-action__todos {
  margin-top: 12rpx;
}

.trace-action__todo {
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  margin-top: 8rpx;
}

.trace-action__todo-icon {
  width: 24rpx;
  font-size: 22rpx;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.45);
}

.trace-action__todo-text {
  flex: 1;
  font-size: 24rpx;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.55);
}

.trace-action__error {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #ff4d4f;
}
</style>
