<script setup lang="ts">
import { computed } from 'vue'
import {
  CHAT_ICON,
  CHAT_INPUT_ICON_SIZE_RPX,
  CHAT_INPUT_SEND_SIZE_RPX,
} from '@/constants/chat-icons'

const props = withDefaults(
  defineProps<{
    canSend?: boolean
    isSendDisabled?: boolean
    isSending?: boolean
    voiceIconSizeRpx?: number
  }>(),
  {
    canSend: false,
    isSendDisabled: false,
    isSending: false,
    voiceIconSizeRpx: CHAT_INPUT_ICON_SIZE_RPX,
  },
)

const emit = defineEmits<{
  send: []
  stop: []
  voice: []
}>()

const canSubmit = computed(() => props.canSend && !props.isSendDisabled && !props.isSending)

const sendIconSrc = computed(() => (props.isSendDisabled ? CHAT_ICON.sendDisabled : CHAT_ICON.send))

function handleTap() {
  if (props.isSending) {
    emit('stop')
    return
  }
  if (props.canSend && props.isSendDisabled) return
  if (canSubmit.value) {
    emit('send')
    return
  }
  emit('voice')
}
</script>

<template>
  <view
    class="chat-action-btn"
    :class="{
      'chat-action-btn--stop': isSending,
      'chat-action-btn--asset': !isSending,
    }"
    :style="{
      width: `${CHAT_INPUT_SEND_SIZE_RPX}rpx`,
      height: `${CHAT_INPUT_SEND_SIZE_RPX}rpx`,
    }"
    @tap="handleTap"
  >
    <text v-if="isSending" class="chat-action-btn__stop">■</text>
    <image v-else-if="canSend" class="chat-action-btn__send" :src="sendIconSrc" mode="aspectFit" />
    <image
      v-else
      class="chat-action-btn__voice"
      :style="{
        width: `${voiceIconSizeRpx}rpx`,
        height: `${voiceIconSizeRpx}rpx`,
      }"
      :src="CHAT_ICON.voice"
      mode="aspectFit"
    />
  </view>
</template>

<style scoped lang="scss">
.chat-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.chat-action-btn--asset {
  background: transparent;
}

.chat-action-btn--stop {
  border-radius: 50%;
  background: #b53333;
  box-shadow: 0 4rpx 16rpx rgba(196, 74, 74, 0.25);
}

.chat-action-btn__send {
  width: 100%;
  height: 100%;
  display: block;
}

.chat-action-btn__stop {
  font-size: 28rpx;
  line-height: 1;
  color: #ffffff;
}

.chat-action-btn__voice {
  display: block;
}
</style>
