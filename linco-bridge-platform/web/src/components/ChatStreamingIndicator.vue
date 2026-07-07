<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const activeDot = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => {
    activeDot.value = (activeDot.value + 1) % 3
  }, 420)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <view class="streaming-indicator">
    <view
      v-for="index in 3"
      :key="index"
      class="streaming-indicator__dot"
      :class="{ 'streaming-indicator__dot--active': activeDot === index - 1 }"
    />
  </view>
</template>

<style scoped lang="scss">
.streaming-indicator {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  min-height: 40rpx;
  padding: 8rpx 0;
}

.streaming-indicator__dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.18);
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.streaming-indicator__dot--active {
  transform: scale(1.2);
  background: #00754a;
}
</style>
