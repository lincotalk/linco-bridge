<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ChatInputActionButton from '@/components/ChatInputActionButton.vue'
import PendingAttachmentList from '@/components/PendingAttachmentList.vue'
import type { OutboundChatFile } from '@/api/session-api'
import { CHAT_ICON } from '@/constants/chat-icons'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    disabled?: boolean
    sending?: boolean
    isSendDisabled?: boolean
    isUploading?: boolean
    pendingFiles?: OutboundChatFile[]
  }>(),
  {
    modelValue: '',
    placeholder: '输入消息…',
    disabled: false,
    sending: false,
    isSendDisabled: false,
    isUploading: false,
    pendingFiles: () => [],
  },
)

const emit = defineEmits<{
  'update:modelValue': [string]
  send: []
  stop: []
  add: []
  voice: []
  'remove-file': [number]
}>()

const draft = ref(props.modelValue)

const canSend = computed(
  () => draft.value.trim().length > 0 || (props.pendingFiles?.length ?? 0) > 0,
)
const canSubmit = computed(
  () => canSend.value && !props.isSendDisabled && !props.disabled && !props.sending,
)
const addEnabled = computed(() => !props.disabled && !props.isUploading && !props.sending)

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
  if (props.disabled || props.sending) return
  emit('voice')
}
</script>

<template>
  <view class="chat-input">
    <view class="chat-input__shell">
      <PendingAttachmentList
        v-if="pendingFiles.length > 0"
        :files="pendingFiles"
        @remove="(index) => emit('remove-file', index)"
      />
      <textarea
        class="chat-input__field"
        :value="draft"
        :placeholder="placeholder"
        :disabled="disabled || sending"
        placeholder-class="chat-input__placeholder"
        auto-height
        :maxlength="-1"
        @input="onInput"
        @confirm="handleSend"
      />
      <view class="chat-input__toolbar">
        <view
          class="chat-input__tool"
          :class="{ 'chat-input__tool--disabled': !addEnabled }"
          @tap="handleAdd"
        >
          <image
            class="chat-input__icon"
            :src="CHAT_ICON.add"
            mode="aspectFit"
          />
        </view>

        <view class="chat-input__toolbar-spacer" />

        <view v-if="canSend && !sending" class="chat-input__actions">
          <view class="chat-input__tool" @tap="handleVoice">
            <image class="chat-input__icon" :src="CHAT_ICON.voice" mode="aspectFit" />
          </view>
          <ChatInputActionButton
            :can-send="canSend"
            :is-send-disabled="isSendDisabled || disabled"
            :is-sending="sending"
            @send="handleSend"
            @voice="handleVoice"
          />
        </view>

        <ChatInputActionButton
          v-else
          :can-send="canSend"
          :is-send-disabled="isSendDisabled || disabled"
          :is-sending="sending"
          @send="handleSend"
          @stop="emit('stop')"
          @voice="handleVoice"
        />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.chat-input {
  padding: 20rpx 48rpx calc(20rpx + env(safe-area-inset-bottom));
  background: #ffffff;
}

.chat-input__shell {
  width: 100%;
  max-width: 654rpx;
  margin: 0 auto;
  padding: 24rpx 24rpx 12rpx;
  border-radius: 40rpx;
  background: #ffffff;
  box-shadow: 0 28rpx 112rpx rgba(0, 0, 0, 0.12);
  box-sizing: border-box;
}

.chat-input__field {
  width: 100%;
  min-height: 120rpx;
  max-height: 320rpx;
  font-size: 30rpx;
  line-height: 1.45;
  color: #1a1a1a;
}

.chat-input__placeholder {
  color: rgba(0, 0, 0, 0.35);
}

.chat-input__toolbar {
  display: flex;
  align-items: center;
  height: 64rpx;
  margin-top: 8rpx;
}

.chat-input__toolbar-spacer {
  flex: 1;
  min-width: 0;
}

.chat-input__tool {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  flex-shrink: 0;
}

.chat-input__tool--disabled {
  opacity: 0.35;
}

.chat-input__actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
}

.chat-input__icon {
  width: 40rpx;
  height: 40rpx;
}
</style>
