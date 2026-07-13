<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { AgentBridgeBindableContext } from '@/bridge/types'
import { useBridgeStore } from '@/stores'
import {
  bridgeContextPickerState,
  resolveBridgeContextPicker,
} from '@/utils/bridge-context-picker'

const bridgeStore = useBridgeStore()

const loading = ref(false)
const error = ref<string | null>(null)
const contexts = ref<AgentBridgeBindableContext[]>([])

const options = computed(() => bridgeContextPickerState.options)
const agentType = computed(() => options.value?.agentType ?? 'hermes')
const selectedContextId = computed(() => options.value?.selectedContextId ?? '')

const sheetTitle = computed(() => {
  if (agentType.value === 'openclaw') return '选择小龙虾'
  return '选择 Profile'
})

watch(
  () => bridgeContextPickerState.visible,
  (visible) => {
    if (visible) {
      void loadContexts()
    } else {
      resetState()
    }
  },
)

function resetState() {
  loading.value = false
  error.value = null
  contexts.value = []
}

async function loadContexts() {
  const connectionId = options.value?.connectionId?.trim()
  if (!connectionId) return
  loading.value = true
  error.value = null
  try {
    contexts.value = await bridgeStore.sdk.listContexts(agentType.value, connectionId)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '无法加载 Profile 列表'
  } finally {
    loading.value = false
  }
}

function handleClose() {
  resolveBridgeContextPicker(null)
}

function handleSelect(contextId: string) {
  if (!contextId.trim()) return
  resolveBridgeContextPicker(contextId.trim())
}

function handleRetry() {
  void loadContexts()
}
</script>

<template>
  <view
    v-if="bridgeContextPickerState.visible"
    class="context-sheet-mask"
    @tap="handleClose"
  >
    <view class="context-sheet" @tap.stop>
      <view class="context-sheet__header">
        <text class="context-sheet__title">{{ sheetTitle }}</text>
        <view class="context-sheet__close" @tap="handleClose">取消</view>
      </view>

      <view v-if="loading" class="context-sheet__state">
        <text>加载中…</text>
      </view>

      <view v-else-if="error" class="context-sheet__state">
        <text>{{ error }}</text>
        <view class="context-sheet__retry" @tap="handleRetry">重试</view>
      </view>

      <view v-else-if="contexts.length === 0" class="context-sheet__state">
        <text>未检测到可绑定的 Profile</text>
      </view>

      <scroll-view v-else class="context-sheet__list" scroll-y>
        <view
          v-for="item in contexts"
          :key="item.id"
          class="context-sheet__item"
          :class="{ 'context-sheet__item--active': selectedContextId === item.id }"
          @tap="handleSelect(item.id)"
        >
          <text class="context-sheet__label">{{ item.label }}</text>
          <text v-if="item.description" class="context-sheet__desc">{{ item.description }}</text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.context-sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: flex-end;
}

.context-sheet {
  width: 100%;
  max-height: 70vh;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding-bottom: env(safe-area-inset-bottom);
}

.context-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx 16rpx;
}

.context-sheet__title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.context-sheet__close {
  font-size: 28rpx;
  color: rgba(0, 0, 0, 0.55);
}

.context-sheet__state {
  padding: 48rpx 32rpx 64rpx;
  text-align: center;
  color: rgba(0, 0, 0, 0.55);
  font-size: 28rpx;
}

.context-sheet__retry {
  margin-top: 20rpx;
  color: #1677ff;
  font-size: 28rpx;
}

.context-sheet__list {
  max-height: calc(70vh - 120rpx);
}

.context-sheet__item {
  padding: 28rpx 32rpx;
  border-top: 1rpx solid rgba(0, 0, 0, 0.06);
}

.context-sheet__item--active {
  background: rgba(22, 119, 255, 0.06);
}

.context-sheet__label {
  display: block;
  font-size: 30rpx;
  color: #1a1a1a;
}

.context-sheet__desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: rgba(0, 0, 0, 0.45);
}
</style>
