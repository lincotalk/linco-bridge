<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { BridgeSettingsOptions, BridgeSettingsPickerResult } from '@/bridge/types'
import { useBridgeStore } from '@/stores'
import {
  bridgeSettingsPickerState,
  resolveBridgeSettingsPicker,
} from '@/utils/bridge-settings-picker'
import {
  reasoningStrengthLabel,
  resolveInitialModelId,
  resolveInitialReasoningId,
} from '@/utils/bridge-settings'
import { showToast } from '@/utils/format'

const bridgeStore = useBridgeStore()

const loading = ref(false)
const error = ref<string | null>(null)
const options = ref<BridgeSettingsOptions | null>(null)
const selectedReasoningId = ref('')
const selectedModelId = ref('')

const openOptions = computed(() => bridgeSettingsPickerState.options)
const visible = computed(() => bridgeSettingsPickerState.visible)

watch(
  () => bridgeSettingsPickerState.visible,
  (nextVisible) => {
    if (nextVisible) {
      void loadOptions()
    } else {
      resetState()
    }
  },
)

function resetState() {
  loading.value = false
  error.value = null
  options.value = null
  selectedReasoningId.value = ''
  selectedModelId.value = ''
}

async function loadOptions() {
  const ctx = openOptions.value
  if (!ctx) return
  loading.value = true
  error.value = null
  try {
    const loaded =
      ctx.options ??
      (await bridgeStore.sdk.loadSettingsOptions(
        ctx.agentType,
        ctx.connectionId,
        ctx.sessionId,
      ))
    options.value = loaded
    selectedReasoningId.value = resolveInitialReasoningId(loaded, ctx.initialSettings)
    selectedModelId.value = resolveInitialModelId(loaded, ctx.initialSettings)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载设置失败'
  } finally {
    loading.value = false
  }
}

function closeSheet(result: BridgeSettingsPickerResult | null) {
  resolveBridgeSettingsPicker(result)
}

function confirmSelection() {
  const loaded = options.value
  if (!loaded) return

  const reasoningOption = loaded.reasoning.options.find(
    (item) => item.id.trim() === selectedReasoningId.value.trim(),
  )
  const modelOption = loaded.model.items.find(
    (item) => item.id.trim() === selectedModelId.value.trim(),
  )
  if (!reasoningOption && !modelOption) {
    showToast('请至少选择一项设置')
    return
  }

  closeSheet({
    reasoningEffort:
      (reasoningOption?.id ?? selectedReasoningId.value).trim() || undefined,
    modelId: (modelOption?.id ?? selectedModelId.value).trim() || undefined,
    modelName:
      (modelOption?.label ?? modelOption?.id ?? selectedModelId.value).trim() || undefined,
  })
}

function onMaskTap() {
  closeSheet(null)
}
</script>

<template>
  <view v-if="visible" class="settings-picker">
    <view class="settings-picker__mask" @tap="onMaskTap" />
    <view class="settings-picker__panel" @tap.stop>
      <view class="settings-picker__handle-wrap">
        <view class="settings-picker__handle" />
      </view>

      <view class="settings-picker__header">
        <text class="settings-picker__title">选择模型</text>
        <view class="settings-picker__close" @tap="closeSheet(null)">
          <text class="settings-picker__close-icon">×</text>
        </view>
      </view>

      <view v-if="loading" class="settings-picker__state">
        <text class="settings-picker__state-text">加载中…</text>
      </view>
      <view v-else-if="error" class="settings-picker__state">
        <text class="settings-picker__state-text">{{ error }}</text>
      </view>
      <view v-else-if="options" class="settings-picker__body">
        <text class="settings-picker__section-label">模型</text>
        <scroll-view
          class="settings-picker__model-list"
          scroll-y
          :show-scrollbar="false"
        >
          <view class="settings-picker__model-list-inner">
            <view
              v-for="item in options.model.items"
              :key="item.id"
              class="settings-picker__model-row"
              :class="{ 'settings-picker__model-row--selected': item.id === selectedModelId }"
              @tap="selectedModelId = item.id"
            >
              <text class="settings-picker__model-label">{{ item.label }}</text>
              <view v-if="item.id === selectedModelId" class="settings-picker__model-check">
                <text class="settings-picker__model-check-icon">✓</text>
              </view>
            </view>
          </view>
        </scroll-view>

        <view class="settings-picker__divider" />

        <text class="settings-picker__section-label settings-picker__section-label--reasoning">
          推理强度
        </text>
        <view class="settings-picker__reasoning-row">
          <view
            v-for="(item, index) in options.reasoning.options"
            :key="item.id"
            class="settings-picker__reasoning-btn"
            :class="{
              'settings-picker__reasoning-btn--selected': item.id === selectedReasoningId,
              'settings-picker__reasoning-btn--spaced': index > 0,
            }"
            @tap="selectedReasoningId = item.id"
          >
            <text class="settings-picker__reasoning-text">
              {{ reasoningStrengthLabel(item.id) }}
            </text>
          </view>
        </view>

        <view class="settings-picker__confirm" @tap="confirmSelection">
          <text class="settings-picker__confirm-text">确定</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
/* Aligned with Flutter bridge_reasoning_picker_sheet.dart + AppBottomSheetFrame (560.w) */
.settings-picker {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: flex-end;
}

.settings-picker__mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
}

.settings-picker__panel {
  position: relative;
  width: 100%;
  height: 1120rpx;
  max-height: 82vh;
  padding: 0 36rpx calc(36rpx + env(safe-area-inset-bottom));
  border-radius: 32rpx 32rpx 0 0;
  background: #ffffff;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-picker__handle-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 52rpx;
  flex-shrink: 0;
}

.settings-picker__handle {
  width: 72rpx;
  height: 6rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.1);
}

.settings-picker__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 0 24rpx;
  flex-shrink: 0;
}

.settings-picker__title {
  font-size: 32rpx;
  line-height: 48rpx;
  font-weight: 600;
  color: #4d4c48;
}

.settings-picker__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 88rpx;
  margin-right: -16rpx;
}

.settings-picker__close-icon {
  font-size: 44rpx;
  line-height: 1;
  font-weight: 300;
  color: rgba(0, 0, 0, 0.45);
}

.settings-picker__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.settings-picker__section-label {
  flex-shrink: 0;
  font-size: 26rpx;
  line-height: 40rpx;
  font-weight: 500;
  color: #667085;
}

.settings-picker__section-label--reasoning {
  margin-top: 48rpx;
}

.settings-picker__model-list {
  flex: 1;
  min-height: 0;
  margin-top: 20rpx;
}

.settings-picker__model-list-inner {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding-bottom: 8rpx;
}

.settings-picker__model-row {
  display: flex;
  align-items: center;
  min-height: 104rpx;
  padding: 0 20rpx;
  border-radius: 20rpx;
  background: transparent;
}

.settings-picker__model-row--selected {
  background: #f5f6f8;
}

.settings-picker__model-label {
  flex: 1;
  min-width: 0;
  font-size: 32rpx;
  line-height: 44rpx;
  font-weight: 500;
  color: #101828;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-picker__model-check {
  flex-shrink: 0;
  margin-left: 24rpx;
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-picker__model-check-icon {
  font-size: 36rpx;
  line-height: 1;
  font-weight: 600;
  color: #101828;
}

.settings-picker__divider {
  flex-shrink: 0;
  height: 1rpx;
  margin-top: 16rpx;
  background: rgba(0, 0, 0, 0.06);
}

.settings-picker__reasoning-row {
  display: flex;
  flex-direction: row;
  margin-top: 28rpx;
  flex-shrink: 0;
}

.settings-picker__reasoning-btn {
  flex: 1;
  height: 84rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  background: #f3f4f6;
}

.settings-picker__reasoning-btn--spaced {
  margin-left: 16rpx;
}

.settings-picker__reasoning-btn--selected {
  background: #00754a;
}

.settings-picker__reasoning-text {
  font-size: 28rpx;
  line-height: 40rpx;
  font-weight: 500;
  color: #344054;
}

.settings-picker__reasoning-btn--selected .settings-picker__reasoning-text {
  color: #ffffff;
}

.settings-picker__confirm {
  flex-shrink: 0;
  margin-top: 56rpx;
  height: 92rpx;
  border-radius: 999rpx;
  background: #00754a;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-picker__confirm-text {
  font-size: 32rpx;
  line-height: 1;
  font-weight: 600;
  color: #ffffff;
}

.settings-picker__state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-picker__state-text {
  font-size: 28rpx;
  color: rgba(0, 0, 0, 0.55);
}
</style>
