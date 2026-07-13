<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open?: boolean
    actionText?: string
  }>(),
  {
    open: false,
    actionText: '删除',
  },
)

const emit = defineEmits<{
  open: []
  close: []
  action: []
  tap: []
}>()

const ACTION_WIDTH = uni.upx2px(160)
const offsetX = ref(0)
const dragging = ref(false)
let startX = 0
let startY = 0
let startOffset = 0
let horizontalSwipe = false
let maxAbsDeltaX = 0
let maxAbsDeltaY = 0
let tapEmittedFromTouch = false

const TAP_MOVE_THRESHOLD = 10

const contentStyle = computed(() => ({
  transform: `translateX(${offsetX.value}px)`,
  transition: dragging.value ? 'none' : 'transform 0.2s ease',
}))

watch(
  () => props.open,
  (open) => {
    offsetX.value = open ? -ACTION_WIDTH : 0
  },
  { immediate: true },
)

function isTapGesture(): boolean {
  return maxAbsDeltaX < TAP_MOVE_THRESHOLD && maxAbsDeltaY < TAP_MOVE_THRESHOLD && !horizontalSwipe
}

function emitTapIfNeeded() {
  if (!isTapGesture()) return
  tapEmittedFromTouch = true
  emit('tap')
}

function onTouchStart(event: TouchEvent) {
  startX = event.touches[0]?.clientX ?? 0
  startY = event.touches[0]?.clientY ?? 0
  startOffset = offsetX.value
  dragging.value = true
  horizontalSwipe = false
  maxAbsDeltaX = 0
  maxAbsDeltaY = 0
  tapEmittedFromTouch = false
}

function onTouchMove(event: TouchEvent) {
  const currentX = event.touches[0]?.clientX ?? startX
  const currentY = event.touches[0]?.clientY ?? startY
  const deltaX = currentX - startX
  const deltaY = currentY - startY
  maxAbsDeltaX = Math.max(maxAbsDeltaX, Math.abs(deltaX))
  maxAbsDeltaY = Math.max(maxAbsDeltaY, Math.abs(deltaY))

  if (!horizontalSwipe) {
    if (Math.abs(deltaX) < 8 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return
    }
    horizontalSwipe = true
  }

  offsetX.value = Math.min(0, Math.max(-ACTION_WIDTH, startOffset + deltaX))
}

function snapOpen(open: boolean) {
  offsetX.value = open ? -ACTION_WIDTH : 0
  if (open) {
    emit('open')
  } else {
    emit('close')
  }
}

function onTouchEnd() {
  dragging.value = false
  const canTap = isTapGesture()
  horizontalSwipe = false
  snapOpen(offsetX.value < -ACTION_WIDTH / 2)
  if (canTap) {
    emitTapIfNeeded()
  }
}

function onContentTap() {
  if (tapEmittedFromTouch) {
    tapEmittedFromTouch = false
    return
  }
  emitTapIfNeeded()
}

function onActionTap() {
  emit('action')
}

function close() {
  dragging.value = false
  snapOpen(false)
}

defineExpose({ close })
</script>

<template>
  <view class="swipe-item">
    <view class="swipe-item__action" @tap.stop="onActionTap">
      <text class="swipe-item__action-text">{{ actionText }}</text>
    </view>
    <view
      class="swipe-item__content"
      :style="contentStyle"
      @touchstart.stop="onTouchStart"
      @touchmove.stop="onTouchMove"
      @touchend.stop="onTouchEnd"
      @touchcancel.stop="onTouchEnd"
      @tap.stop="onContentTap"
    >
      <slot />
    </view>
  </view>
</template>

<style scoped lang="scss">
.swipe-item {
  position: relative;
  overflow: hidden;
  background: #ffffff;
}

.swipe-item__action {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 160rpx;
  background: #ff4d4f;
}

.swipe-item__action-text {
  font-size: 28rpx;
  font-weight: 500;
  color: #ffffff;
}

.swipe-item__content {
  position: relative;
  z-index: 1;
  background: #ffffff;
}
</style>
