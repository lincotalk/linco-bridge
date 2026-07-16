<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ChatMessageAttachment } from '@/bridge/types'
import { isImageAttachment } from '@/utils/chat-attachments'
import { openChatAttachment } from '@/utils/attachment-open'
import { resolveDisplayImageSrc, resolveDisplayImageSrcList } from '@/utils/resolve-image-src'

const props = defineProps<{
  attachments: ChatMessageAttachment[]
  variant?: 'user' | 'assistant'
}>()

const emit = defineEmits<{
  previewLoad: []
}>()

const displaySrcByIndex = ref<Record<number, string>>({})

watch(
  () => props.attachments,
  (list) => {
    void (async () => {
      const next: Record<number, string> = {}
      await Promise.all(
        list.map(async (item, index) => {
          if (!isImageAttachment(item) || !item.previewUrl) return
          const src = await resolveDisplayImageSrc(item.previewUrl)
          if (src) next[index] = src
        }),
      )
      displaySrcByIndex.value = next
    })()
  },
  { immediate: true, deep: true },
)

async function handleAttachmentTap(item: ChatMessageAttachment, index: number) {
  const displaySrc = displaySrcByIndex.value[index] || item.previewUrl
  if (isImageAttachment(item) && displaySrc) {
    const urls = await resolveDisplayImageSrcList(
      props.attachments
        .filter((entry) => isImageAttachment(entry) && entry.previewUrl)
        .map((entry) => entry.previewUrl),
    )
    uni.previewImage({
      current: displaySrc,
      urls: urls.length > 0 ? urls : [displaySrc],
    })
    return
  }

  await openChatAttachment(item)
}
</script>

<template>
  <view v-if="attachments.length > 0" class="attachment-list">
    <view
      v-for="(item, index) in attachments"
      :key="`${item.name}-${index}`"
      class="attachment-list__item"
      :class="`attachment-list__item--${variant ?? 'assistant'}`"
      @tap="handleAttachmentTap(item, index)"
    >
      <image
        v-if="isImageAttachment(item) && displaySrcByIndex[index]"
        class="attachment-list__image"
        :src="displaySrcByIndex[index]"
        mode="aspectFill"
        @load="emit('previewLoad')"
      />
      <view v-else class="attachment-list__file">
        <text class="attachment-list__file-icon">📎</text>
        <text class="attachment-list__file-name text-ellipsis">{{ item.name }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.attachment-list__item {
  overflow: hidden;
  border-radius: 16rpx;
}

.attachment-list__item--user {
  background: rgba(255, 255, 255, 0.16);
}

.attachment-list__item--assistant {
  background: #f5f5f5;
}

.attachment-list__image {
  width: 200rpx;
  height: 200rpx;
  display: block;
}

.attachment-list__file {
  display: flex;
  align-items: center;
  gap: 8rpx;
  max-width: 360rpx;
  padding: 16rpx 20rpx;
}

.attachment-list__file-icon {
  flex-shrink: 0;
  font-size: 28rpx;
}

.attachment-list__file-name {
  font-size: 24rpx;
  color: inherit;
}

.attachment-list__item--assistant .attachment-list__file-name {
  color: rgba(0, 0, 0, 0.65);
}

.attachment-list__item--user .attachment-list__file-name {
  color: #ffffff;
}
</style>
