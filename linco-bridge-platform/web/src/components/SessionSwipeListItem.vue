<script setup lang="ts">
import { ref } from 'vue'
import SessionListItem from '@/components/SessionListItem.vue'
import SwipeActionItem from '@/components/SwipeActionItem.vue'
import type { ChatSessionItem } from '@/bridge/types'

const props = defineProps<{
  item: ChatSessionItem
  open?: boolean
}>()

const emit = defineEmits<{
  open: []
  close: []
  tap: [ChatSessionItem]
  delete: [ChatSessionItem]
}>()

const swipeRef = ref<InstanceType<typeof SwipeActionItem> | null>(null)
let lastTapAt = 0

function handleTap() {
  const now = Date.now()
  if (now - lastTapAt < 300) return
  lastTapAt = now
  emit('tap', props.item)
}

function handleDelete() {
  emit('delete', props.item)
}

defineExpose({
  close: () => swipeRef.value?.close(),
})
</script>

<template>
  <SwipeActionItem
    ref="swipeRef"
    :open="open"
    @open="emit('open')"
    @close="emit('close')"
    @action="handleDelete"
    @tap="handleTap"
  >
    <SessionListItem :item="item" @select="handleTap" />
  </SwipeActionItem>
</template>
