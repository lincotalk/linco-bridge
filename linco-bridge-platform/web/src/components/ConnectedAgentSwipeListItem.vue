<script setup lang="ts">
import { computed, ref } from 'vue'

import BridgeSourceCard from '@/components/BridgeSourceCard.vue'
import SwipeActionItem from '@/components/SwipeActionItem.vue'
import type { ConnectedAgentItem } from '@/utils/connected-accounts'
import { connectedAgentToBridgeCard } from '@/utils/connected-accounts'

const props = defineProps<{
  item: ConnectedAgentItem
  open?: boolean
}>()

const cardItem = computed(() => connectedAgentToBridgeCard(props.item))

const emit = defineEmits<{
  open: []
  close: []
  tap: [ConnectedAgentItem]
  delete: [ConnectedAgentItem]
}>()

const swipeRef = ref<InstanceType<typeof SwipeActionItem> | null>(null)

function handleTap() {
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
    class="connected-agent-swipe-item"
    :open="open"
    @open="emit('open')"
    @close="emit('close')"
    @action="handleDelete"
  >
    <BridgeSourceCard embedded :item="cardItem" @select="handleTap" />
  </SwipeActionItem>
</template>

<style scoped lang="scss">
.connected-agent-swipe-item {
  margin-bottom: 24rpx;
  border-radius: 16rpx;
  overflow: hidden;
}
</style>
