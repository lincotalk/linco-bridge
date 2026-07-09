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
}>()

const ACTION_WIDTH = uni.upx2px(160)
const offsetX = ref(0)
const dragging = ref(false)
let startX = 0
let startY = 0
let startOffset = 0
let horizontalSwipe = false

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

function onTouchStart(event: TouchEvent) {
  startX = event.touches[0]?.clientX ?? 0
  startY = event.touches[0]?.clientY ?? 0
  startOffset = offsetX.value
  dragging.value = true
  horizontalSwipe = offsetX.value !== 0
}

function onTouchMove(event: TouchEvent) {
  const currentX = event.touches[0]?.clientX ?? startX
  const currentY = event.touches[0]?.clientY ?? startY
  const deltaX = currentX - startX
  const deltaY = currentY - startY

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
  horizontalSwipe = false
  snapOpen(offsetX.value < -ACTION_WIDTH / 2)
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
