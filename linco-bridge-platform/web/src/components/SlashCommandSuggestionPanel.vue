<script setup lang="ts">
import { computed } from 'vue'
import {
  slashCommandDisplayCommand,
  type SlashCommandItem,
} from '@/bridge/slash-command'

const props = defineProps<{
  commands: SlashCommandItem[]
}>()

const emit = defineEmits<{
  select: [SlashCommandItem]
}>()

const visibleCount = computed(() => Math.min(props.commands.length, 8))
const maxHeight = computed(() => `${visibleCount.value * 68 + 2}rpx`)

function handleSelect(item: SlashCommandItem) {
  emit('select', item)
}
</script>

<template>
  <scroll-view
    v-if="commands.length > 0"
    class="slash-panel"
    scroll-y
    :show-scrollbar="commands.length > 8"
    :style="{ maxHeight }"
  >
    <view
      v-for="item in commands"
      :key="item.command"
      class="slash-panel__row"
      @tap="handleSelect(item)"
    >
      <text class="slash-panel__command">{{ slashCommandDisplayCommand(item) }}</text>
      <text class="slash-panel__description">{{ item.description }}</text>
    </view>
  </scroll-view>
</template>

<style scoped lang="scss">
.slash-panel {
  margin-bottom: 16rpx;
  border: 1rpx solid #e4e6e8;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.08);
}

.slash-panel__row {
  display: flex;
  align-items: center;
  min-height: 68rpx;
  padding: 0 28rpx;
}

.slash-panel__command {
  width: 272rpx;
  flex-shrink: 0;
  font-size: 26rpx;
  line-height: 68rpx;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.87);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slash-panel__description {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  line-height: 68rpx;
  color: rgba(0, 0, 0, 0.56);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
