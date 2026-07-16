<script setup lang="ts">
import { computed } from 'vue'
import type { OutboundChatFile } from '@/api/session-api'
import { isImageAttachment } from '@/utils/chat-attachments'
import { mapOutboundFilesToAttachments } from '@/utils/chat-attachments'

const props = defineProps<{
  files: OutboundChatFile[]
}>()

const emit = defineEmits<{
  remove: [number]
}>()

const items = computed(() => mapOutboundFilesToAttachments(props.files))
</script>

<template>
  <view v-if="files.length > 0" class="pending-attachments">
    <view
      v-for="(item, index) in items"
      :key="`${item.name}-${index}`"
      class="pending-attachments__item"
    >
      <image
        v-if="isImageAttachment(item) && item.previewUrl"
        class="pending-attachments__image"
        :src="item.previewUrl"
        mode="aspectFill"
      />
      <view v-else class="pending-attachments__file">
        <text class="pending-attachments__file-name text-ellipsis">{{ item.name }}</text>
      </view>
      <view class="pending-attachments__remove" @tap="emit('remove', index)">×</view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.pending-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.pending-attachments__item {
  position: relative;
}

.pending-attachments__image {
  width: 120rpx;
  height: 120rpx;
  border-radius: 12rpx;
}

.pending-attachments__file {
  max-width: 240rpx;
  padding: 12rpx 16rpx;
  border-radius: 12rpx;
  background: #f5f5f5;
}

.pending-attachments__file-name {
  font-size: 22rpx;
  color: rgba(0, 0, 0, 0.65);
}

.pending-attachments__remove {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  width: 32rpx;
  height: 32rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #ffffff;
  font-size: 24rpx;
  line-height: 32rpx;
  text-align: center;
}
</style>
