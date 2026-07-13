<script setup lang="ts">
import { computed } from 'vue'

import AgentHistoryRow from '@/components/AgentHistoryRow.vue'
import { buildLandingSubtitle } from '@/utils/chat-header'
import { agentSidePanelState, closeAgentSidePanel } from '@/utils/agent-side-panel'
import { openBotConfig } from '@/utils/open-agent-landing'

const VISIBLE_PANEL_HISTORY_COUNT = 4

const options = computed(() => agentSidePanelState.options)
const visible = computed(() => agentSidePanelState.visible)
const header = computed(() => options.value?.header ?? null)
const subtitle = computed(() => (header.value ? buildLandingSubtitle(header.value) : ''))
const panelHistory = computed(() => options.value?.history ?? [])
const visibleHistory = computed(() => panelHistory.value.slice(0, VISIBLE_PANEL_HISTORY_COUNT))
const hasMoreHistory = computed(() => panelHistory.value.length > VISIBLE_PANEL_HISTORY_COUNT)

function handleClose() {
  closeAgentSidePanel()
}

function handleNewConversation() {
  options.value?.onNewConversation?.()
  closeAgentSidePanel()
}

function handleOpenHistory(item: (typeof panelHistory.value)[number]) {
  options.value?.onOpenHistoryItem?.(item)
  closeAgentSidePanel()
}

function handleOpenHistorySearch() {
  options.value?.onViewAllHistory?.()
  closeAgentSidePanel()
}

function handleOpenBotConfig() {
  const current = options.value
  if (!current) return
  closeAgentSidePanel()
  openBotConfig({
    agentType: current.agentType,
    connectionId: current.connectionId,
  })
}
</script>

<template>
  <view
    v-if="visible && options && header"
    class="agent-side-panel"
    @touchmove.stop.prevent
  >
    <view class="agent-side-panel__mask" @tap="handleClose" />

    <view class="agent-side-panel__sheet">
      <scroll-view class="agent-side-panel__body" scroll-y :show-scrollbar="false">
        <view class="agent-side-panel__hero">
          <image class="agent-side-panel__avatar" :src="header.avatar" mode="aspectFill" />
          <view class="agent-side-panel__title-entry" @tap="handleOpenBotConfig">
            <text class="agent-side-panel__title">{{ header.title }}</text>
            <text class="agent-side-panel__chevron">›</text>
          </view>
          <text v-if="subtitle" class="agent-side-panel__subtitle">{{ subtitle }}</text>
        </view>

        <view class="agent-side-panel__new-chat" @tap="handleNewConversation">
          <text class="agent-side-panel__new-chat-text">新建对话</text>
        </view>

        <view class="agent-side-panel__section-head">
          <text class="agent-side-panel__section-title">历史会话</text>
          <view class="agent-side-panel__search-btn" @tap="handleOpenHistorySearch">
            <view class="agent-side-panel__search-icon" aria-label="搜索历史会话" />
          </view>
        </view>

        <view v-if="visibleHistory.length === 0" class="agent-side-panel__empty">
          <text class="agent-side-panel__empty-text">暂无历史会话</text>
        </view>

        <view v-else class="agent-side-panel__history">
          <view
            v-for="(item, index) in visibleHistory"
            :key="item.id"
            class="agent-side-panel__history-item"
            :class="{ 'agent-side-panel__history-item--gap': index < visibleHistory.length - 1 }"
          >
            <AgentHistoryRow :item="item" @tap="handleOpenHistory(item)" />
          </view>
          <view
            v-if="hasMoreHistory"
            class="agent-side-panel__view-all"
            @tap="handleOpenHistorySearch"
          >
            <text class="agent-side-panel__view-all-text">查看历史对话</text>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.agent-side-panel {
  position: fixed;
  inset: 0;
  z-index: 99998;
  pointer-events: auto;
}

.agent-side-panel__mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.2);
}

.agent-side-panel__sheet {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 70%;
  max-width: 560rpx;
  background: #ffffff;
  border-radius: 30rpx 0 0 30rpx;
  box-shadow: -8rpx 0 32rpx rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.agent-side-panel__body {
  height: 100%;
  padding: calc(24rpx + env(safe-area-inset-top)) 32rpx calc(24rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.agent-side-panel__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 16rpx 8rpx;
}

.agent-side-panel__avatar {
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  background: #f5f5f5;
}

.agent-side-panel__title {
  font-size: 34rpx;
  font-weight: 600;
  line-height: 1.25;
  color: #1a1a1a;
  text-align: center;
}

.agent-side-panel__title-entry {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  margin-top: 24rpx;
  padding: 4rpx 8rpx;
}

.agent-side-panel__chevron {
  margin-left: 8rpx;
  font-size: 34rpx;
  line-height: 1;
  color: rgba(0, 0, 0, 0.34);
}

.agent-side-panel__subtitle {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.35;
  color: rgba(0, 0, 0, 0.45);
  text-align: center;
}

.agent-side-panel__new-chat {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 78rpx;
  margin: 28rpx 0 36rpx;
  border-radius: 16rpx;
  background: #00754a;
}

.agent-side-panel__new-chat-text {
  font-size: 28rpx;
  font-weight: 500;
  color: #ffffff;
}

.agent-side-panel__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.agent-side-panel__section-title {
  font-size: 28rpx;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.85);
}

.agent-side-panel__search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  flex-shrink: 0;
}

.agent-side-panel__search-icon {
  position: relative;
  width: 32rpx;
  height: 32rpx;
  border: 3rpx solid rgba(0, 0, 0, 0.58);
  border-radius: 50%;
  box-sizing: border-box;
}

.agent-side-panel__search-icon::after {
  content: '';
  position: absolute;
  right: -10rpx;
  bottom: -4rpx;
  width: 14rpx;
  height: 3rpx;
  border-radius: 2rpx;
  background: rgba(0, 0, 0, 0.58);
  transform: rotate(45deg);
}

.agent-side-panel__empty {
  padding: 32rpx 0 40rpx;
}

.agent-side-panel__empty-text {
  font-size: 26rpx;
  color: rgba(0, 0, 0, 0.45);
}

.agent-side-panel__history {
  margin-bottom: 32rpx;
}

.agent-side-panel__history-item {
  width: 100%;
}

.agent-side-panel__history-item--gap {
  margin-bottom: 36rpx;
}

.agent-side-panel__view-all {
  display: flex;
  justify-content: center;
  margin-top: 28rpx;
}

.agent-side-panel__view-all-text {
  font-size: 24rpx;
  color: #3d3d3a;
}
</style>
