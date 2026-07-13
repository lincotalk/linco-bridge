<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ChatInputActionButton from '@/components/ChatInputActionButton.vue'
import PendingAttachmentList from '@/components/PendingAttachmentList.vue'
import SlashCommandSuggestionPanel from '@/components/SlashCommandSuggestionPanel.vue'
import type { OutboundChatFile } from '@/api/session-api'
import type { SlashCommandItem } from '@/bridge/slash-command'
import { useChatTextareaSubmit } from '@/composables/useChatTextareaSubmit'
import {
  extractTextareaInputMeta,
  useSlashCommandInput,
} from '@/composables/useSlashCommandInput'
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
    bridgeProjectName?: string
    useBridgeCompactToolbar?: boolean
    bridgeSettingsLabel?: string
    slashCommands?: SlashCommandItem[]
  }>(),
  {
    modelValue: '',
    placeholder: '输入消息…',
    disabled: false,
    sending: false,
    isSendDisabled: false,
    isUploading: false,
    pendingFiles: () => [],
    useBridgeCompactToolbar: false,
    bridgeSettingsLabel: '',
    slashCommands: () => [],
  },
)

const emit = defineEmits<{
  'update:modelValue': [string]
  send: []
  stop: []
  add: []
  voice: []
  'remove-file': [number]
  'pick-settings': []
}>()

const draft = ref(props.modelValue)
const slashCommandsRef = computed(() => props.slashCommands ?? [])
const { suggestions, updateSlashQuery, applyCommand } = useSlashCommandInput(
  draft,
  slashCommandsRef,
)

const canSend = computed(
  () => draft.value.trim().length > 0 || (props.pendingFiles?.length ?? 0) > 0,
)
const canSubmit = computed(
  () => canSend.value && !props.isSendDisabled && !props.disabled && !props.sending,
)
const addEnabled = computed(() => !props.disabled && !props.isUploading && !props.sending)
const bridgeProjectLabel = computed(() => props.bridgeProjectName?.trim() ?? '')
const bridgeSettingsText = computed(() => props.bridgeSettingsLabel?.trim() || '默认')
const showCompactBridgeToolbar = computed(() => props.useBridgeCompactToolbar)

watch(
  () => props.modelValue,
  (value) => {
    draft.value = value
    updateSlashQuery(value, value.length)
  },
)

function onInput(event: InputEvent) {
  const { value, cursor } = extractTextareaInputMeta(event)
  draft.value = value
  updateSlashQuery(value, cursor)
  emit('update:modelValue', value)
}

function handleSlashSelect(item: SlashCommandItem) {
  const value = applyCommand(item)
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

function handlePickSettings() {
  emit('pick-settings')
}

const { onCompositionStart, onCompositionEnd, onKeydown } = useChatTextareaSubmit(
  () => canSubmit.value,
  handleSend,
)
</script>

<template>
  <view class="chat-input">
    <SlashCommandSuggestionPanel
      v-if="suggestions.length > 0"
      :commands="suggestions"
      @select="handleSlashSelect"
    />
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
        @keydown="onKeydown"
        @compositionstart="onCompositionStart"
        @compositionend="onCompositionEnd"
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

        <view v-if="showCompactBridgeToolbar" class="chat-input__bridge-compact">
          <text class="chat-input__bridge-project-text">
            {{ bridgeProjectLabel || '临时会话' }}
          </text>
          <view class="chat-input__bridge-divider" />
          <view class="chat-input__bridge-settings" @tap.stop="handlePickSettings">
            <text class="chat-input__bridge-settings-text">{{ bridgeSettingsText }}</text>
            <view class="chat-input__bridge-settings-chevron" />
          </view>
        </view>

        <view v-else-if="bridgeProjectLabel" class="chat-input__project-chip">
          <text class="chat-input__project-chip-text">{{ bridgeProjectLabel }}</text>
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

.chat-input__project-chip {
  max-width: 304rpx;
  height: 56rpx;
  margin-left: 16rpx;
  padding: 0 16rpx;
  display: flex;
  align-items: center;
  border-radius: 8rpx;
  background: #f4f5f6;
  border: 1rpx solid #e4e6e8;
  box-sizing: border-box;
  flex-shrink: 1;
  min-width: 0;
}

.chat-input__project-chip-text {
  font-size: 26rpx;
  line-height: 1.2;
  color: rgba(0, 0, 0, 0.87);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-input__bridge-compact {
  display: flex;
  align-items: center;
  min-width: 0;
  margin-left: 16rpx;
  flex-shrink: 1;
}

.chat-input__bridge-project-text {
  max-width: 220rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.56);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-input__bridge-divider {
  width: 1rpx;
  height: 24rpx;
  margin: 0 16rpx;
  background: #e5e7eb;
  flex-shrink: 0;
}

.chat-input__bridge-settings {
  display: flex;
  align-items: center;
  min-height: 64rpx;
  min-width: 96rpx;
  padding: 0 8rpx;
  box-sizing: border-box;
  flex-shrink: 1;
}

.chat-input__bridge-settings-text {
  max-width: 240rpx;
  font-size: 24rpx;
  line-height: 36rpx;
  font-weight: 500;
  color: #364153;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-input__bridge-settings-chevron {
  flex-shrink: 0;
  width: 0;
  height: 0;
  margin-left: 6rpx;
  border-top: 9rpx solid rgba(0, 0, 0, 0.87);
  border-right: 7rpx solid transparent;
  border-left: 7rpx solid transparent;
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
