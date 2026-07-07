<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatThinkingDuration } from '@/utils/format-duration'

const props = defineProps<{
  startedAt: number
  endedAt?: number
  streaming?: boolean
}>()

const emit = defineEmits<{
  tap: []
}>()

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

const durationLabel = computed(() => {
  const end = props.endedAt ?? (props.streaming ? now.value : props.startedAt)
  return formatThinkingDuration(props.startedAt, end)
})

onMounted(() => {
  if (!props.streaming) return
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <view class="thinking-entry" @tap="emit('tap')">
    <text class="thinking-entry__label">思考过程 · {{ durationLabel }}</text>
    <text class="thinking-entry__arrow">›</text>
  </view>
</template>

<style scoped lang="scss">
.thinking-entry {
  display: flex;
  align-items: center;
  max-width: 100%;
  padding: 4rpx 0;
}

.thinking-entry__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 28rpx;
  line-height: 1.4;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.35);
}

.thinking-entry__arrow {
  flex-shrink: 0;
  margin-left: 8rpx;
  font-size: 28rpx;
  line-height: 1.4;
  color: rgba(0, 0, 0, 0.35);
}
</style>
