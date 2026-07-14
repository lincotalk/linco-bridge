<script setup lang="ts">
defineProps<{
  label: string
  canPreview?: boolean
  showPreview?: boolean
}>()

const emit = defineEmits<{
  copy: []
  togglePreview: [showPreview: boolean]
}>()
</script>

<template>
  <view class="artifact-block-header">
    <text class="artifact-block-header__label">{{ label }}</text>
    <view class="artifact-block-header__actions">
      <view
        v-if="canPreview"
        class="artifact-block-header__mode"
      >
        <view
          class="artifact-block-header__mode-btn"
          :class="{ 'artifact-block-header__mode-btn--active': !showPreview }"
          @tap="emit('togglePreview', false)"
        >
          <text class="artifact-block-header__mode-text">代码</text>
        </view>
        <view
          class="artifact-block-header__mode-btn"
          :class="{ 'artifact-block-header__mode-btn--active': showPreview }"
          @tap="emit('togglePreview', true)"
        >
          <text class="artifact-block-header__mode-text">预览</text>
        </view>
      </view>
      <view class="artifact-block-header__copy" @tap="emit('copy')">
        <text class="artifact-block-header__copy-text">复制</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.artifact-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 68rpx;
  padding: 0 16rpx;
  background: #f5f5f5;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.artifact-block-header__label {
  font-size: 22rpx;
  color: rgba(0, 0, 0, 0.55);
  text-transform: lowercase;
}

.artifact-block-header__actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.artifact-block-header__mode {
  display: flex;
  align-items: center;
  padding: 4rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.05);
}

.artifact-block-header__mode-btn {
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
}

.artifact-block-header__mode-btn--active {
  background: #ffffff;
}

.artifact-block-header__mode-text {
  font-size: 22rpx;
  color: rgba(0, 0, 0, 0.55);
}

.artifact-block-header__mode-btn--active .artifact-block-header__mode-text {
  color: rgba(0, 0, 0, 0.85);
}

.artifact-block-header__copy {
  padding: 6rpx 12rpx;
}

.artifact-block-header__copy-text {
  font-size: 22rpx;
  color: #00754a;
}
</style>
