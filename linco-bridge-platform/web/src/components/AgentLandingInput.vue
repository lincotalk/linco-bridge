<script setup lang="ts">
import { ref, watch } from 'vue'
import { CHAT_ICON } from '@/constants/chat-icons'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    disabled?: boolean
    tempSession?: boolean
  }>(),
  {
    modelValue: '',
    placeholder: '今天想做什么？',
    disabled: false,
    tempSession: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [string]
  send: []
  add: []
  voice: []
  'toggle-temp': []
}>()

const draft = ref(props.modelValue)

watch(
  () => props.modelValue,
  (value) => {
    draft.value = value
  },
)

function onInput(event: InputEvent) {
  const detail = (event as unknown as { detail?: { value?: string } }).detail
  const value = detail?.value ?? ''
  draft.value = value
  emit('update:modelValue', value)
}

function handleSend() {
  if (props.disabled || !draft.value.trim()) return
  emit('send')
}
</script>

<template>
  <view class="landing-input">
    <view class="landing-input__card">
      <textarea
        class="landing-input__field"
        :value="draft"
        :placeholder="placeholder"
        :disabled="disabled"
        placeholder-class="landing-input__placeholder"
        auto-height
        :maxlength="-1"
        @input="onInput"
        @confirm="handleSend"
      />
      <view class="landing-input__toolbar">
        <view class="landing-input__tool" @tap="emit('add')">
          <image class="landing-input__icon" :src="CHAT_ICON.add" mode="aspectFit" />
        </view>
        <view
          class="landing-input__pill"
          :class="{ 'landing-input__pill--active': tempSession }"
          @tap="emit('toggle-temp')"
        >
          <text class="landing-input__pill-text">临时会话</text>
        </view>
        <view class="landing-input__tool landing-input__tool--right" @tap="emit('voice')">
          <image class="landing-input__icon" :src="CHAT_ICON.voice" mode="aspectFit" />
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.landing-input {
  padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  background: #ffffff;
}

.landing-input__card {
  padding: 24rpx 24rpx 12rpx;
  border-radius: 40rpx;
  background: #ffffff;
  box-shadow: 0 8rpx 40rpx rgba(0, 0, 0, 0.06);
}

.landing-input__field {
  width: 100%;
  min-height: 120rpx;
  font-size: 30rpx;
  line-height: 1.45;
  color: #1a1a1a;
}

.landing-input__placeholder {
  color: rgba(0, 0, 0, 0.35);
}

.landing-input__toolbar {
  display: flex;
  align-items: center;
  margin-top: 8rpx;
}

.landing-input__tool {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
}

.landing-input__tool--right {
  margin-left: auto;
}

.landing-input__icon {
  width: 40rpx;
  height: 40rpx;
}

.landing-input__pill {
  margin-left: 8rpx;
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  background: #f5f5f5;
}

.landing-input__pill--active {
  background: rgba(0, 117, 74, 0.12);
}

.landing-input__pill-text {
  font-size: 24rpx;
  color: rgba(0, 0, 0, 0.65);
}

.landing-input__pill--active .landing-input__pill-text {
  color: #00754a;
}
</style>
