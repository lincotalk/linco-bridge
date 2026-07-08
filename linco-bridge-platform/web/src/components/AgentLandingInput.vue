<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ChatInputActionButton from '@/components/ChatInputActionButton.vue'
import PendingAttachmentList from '@/components/PendingAttachmentList.vue'
import type { OutboundChatFile } from '@/api/session-api'
import { useChatTextareaSubmit } from '@/composables/useChatTextareaSubmit'
import { CHAT_ICON } from '@/constants/chat-icons'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    disabled?: boolean
    starting?: boolean
    pendingFiles?: OutboundChatFile[]
    useBridgeCompactToolbar?: boolean
    bridgeSettingsLabel?: string
  }>(),
  {
    modelValue: '',
    placeholder: '今天想做什么？',
    disabled: false,
    starting: false,
    pendingFiles: () => [],
    useBridgeCompactToolbar: false,
    bridgeSettingsLabel: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [string]
  send: []
  add: []
  voice: []
  'remove-file': [number]
  'pick-settings': []
}>()

const draft = ref(props.modelValue)
const canSend = computed(
  () => draft.value.trim().length > 0 || (props.pendingFiles?.length ?? 0) > 0,
)
const canSubmit = computed(() => canSend.value && !props.disabled && !props.starting)
const addEnabled = computed(() => !props.disabled && !props.starting)
const bridgeSettingsText = computed(() => props.bridgeSettingsLabel?.trim() || '默认')

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
  if (!canSubmit.value) return
  emit('send')
}

function handleAdd() {
  if (!addEnabled.value) return
  emit('add')
}

function handleVoice() {
  if (props.disabled || props.starting) return
  emit('voice')
}

const { onCompositionStart, onCompositionEnd, onKeydown } = useChatTextareaSubmit(
  () => canSubmit.value,
  handleSend,
)
</script>

<template>
  <view class="landing-input">
    <view class="landing-input__card">
      <PendingAttachmentList
        v-if="pendingFiles.length > 0"
        :files="pendingFiles"
        @remove="(index) => emit('remove-file', index)"
      />
      <textarea
        class="landing-input__field"
        :value="draft"
        :placeholder="placeholder"
        :disabled="disabled || starting"
        placeholder-class="landing-input__placeholder"
        auto-height
        :maxlength="-1"
        @input="onInput"
        @confirm="handleSend"
        @keydown="onKeydown"
        @compositionstart="onCompositionStart"
        @compositionend="onCompositionEnd"
      />
      <view class="landing-input__toolbar">
        <view
          class="landing-input__tool"
          :class="{ 'landing-input__tool--disabled': !addEnabled }"
          @tap="handleAdd"
        >
          <image class="landing-input__icon" :src="CHAT_ICON.add" mode="aspectFit" />
        </view>

        <view v-if="useBridgeCompactToolbar" class="landing-input__bridge-compact">
          <text class="landing-input__bridge-project-text">临时会话</text>
          <view class="landing-input__bridge-divider" />
          <view class="landing-input__bridge-settings" @tap="emit('pick-settings')">
            <text class="landing-input__bridge-settings-text">{{ bridgeSettingsText }}</text>
            <view class="landing-input__bridge-settings-chevron" />
          </view>
        </view>

        <view v-else class="landing-input__chip">
          <text class="landing-input__chip-text">临时会话</text>
        </view>

        <view class="landing-input__toolbar-spacer" />

        <view v-if="canSend && !starting" class="landing-input__actions">
          <view class="landing-input__tool" @tap="handleVoice">
            <image class="landing-input__icon" :src="CHAT_ICON.voice" mode="aspectFit" />
          </view>
          <ChatInputActionButton :can-send="canSend" :is-send-disabled="disabled" @send="handleSend" />
        </view>
        <view v-else class="landing-input__tool landing-input__tool--right" @tap="handleVoice">
          <image class="landing-input__icon" :src="CHAT_ICON.voice" mode="aspectFit" />
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.landing-input {
  flex-shrink: 0;
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

.landing-input__tool--disabled {
  opacity: 0.45;
}

.landing-input__tool--right {
  margin-left: auto;
}

.landing-input__icon {
  width: 40rpx;
  height: 40rpx;
}

.landing-input__chip {
  display: flex;
  align-items: center;
  max-width: 304rpx;
  height: 56rpx;
  margin-left: 8rpx;
  padding: 0 16rpx;
  border: 1rpx solid #e4e6e8;
  border-radius: 8rpx;
  background: #f4f5f6;
}

.landing-input__chip-text {
  font-size: 26rpx;
  line-height: 1.2;
  color: rgba(0, 0, 0, 0.87);
}

.landing-input__bridge-compact {
  display: flex;
  align-items: center;
  min-width: 0;
  margin-left: 8rpx;
  flex-shrink: 1;
}

.landing-input__bridge-project-text {
  font-size: 24rpx;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.56);
}

.landing-input__bridge-divider {
  width: 1rpx;
  height: 24rpx;
  margin: 0 16rpx;
  background: #e5e7eb;
  flex-shrink: 0;
}

.landing-input__bridge-settings {
  display: flex;
  align-items: center;
  height: 36rpx;
  min-width: 0;
}

.landing-input__bridge-settings-text {
  max-width: 240rpx;
  font-size: 24rpx;
  line-height: 36rpx;
  font-weight: 500;
  color: #364153;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.landing-input__bridge-settings-chevron {
  flex-shrink: 0;
  width: 0;
  height: 0;
  margin-left: 6rpx;
  border-top: 9rpx solid rgba(0, 0, 0, 0.87);
  border-right: 7rpx solid transparent;
  border-left: 7rpx solid transparent;
}

.landing-input__toolbar-spacer {
  flex: 1;
  min-width: 0;
}

.landing-input__actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-left: auto;
}
</style>
