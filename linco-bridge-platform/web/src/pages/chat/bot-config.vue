<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'

import AppNavBar from '@/components/AppNavBar.vue'
import { parseAgentBridgeType } from '@/bridge/commands'
import type { AgentBridgeType } from '@/bridge/types'
import { useBotConfig } from '@/composables/useBotConfig'

const agentType = ref<AgentBridgeType>('codex')
const connectionId = ref<string | undefined>()

const {
  loading,
  refreshing,
  savingName,
  deleting,
  detail,
  showSecret,
  error,
  isOnline,
  loadDetail,
  refreshDetail,
  saveDisplayName,
  copySetupCommand,
  deleteRobot,
  toggleSecretVisibility,
  formatLastSeen,
} = useBotConfig()

const secretLabel = computed(() => {
  if (!detail.value?.appSecret) return '加载中'
  return showSecret.value ? detail.value.appSecret : '••••••••••••••••'
})

onLoad((query) => {
  agentType.value = parseAgentBridgeType(String(query?.agentType ?? 'codex')) ?? 'codex'
  connectionId.value = query?.connectionId ? String(query.connectionId) : undefined
})

onShow(() => {
  void loadDetail(agentType.value, connectionId.value)
})

function promptRename() {
  if (!detail.value || savingName.value) return
  uni.showModal({
    title: '编辑名称',
    editable: true,
    placeholderText: detail.value.displayName,
    content: detail.value.displayName,
    confirmText: '保存',
    cancelText: '取消',
    success: (res) => {
      if (!res.confirm) return
      const nextName = String(res.content ?? '').trim()
      if (!nextName || !connectionId.value) return
      void saveDisplayName(agentType.value, connectionId.value, nextName)
    },
  })
}

function confirmDelete() {
  if (!detail.value || deleting.value || !connectionId.value) return
  uni.showModal({
    title: '删除机器人',
    content:
      `确定删除「${detail.value.displayName}」？\n\n删除后机器人将从 Linco 中移除，同时 APP 会向绑定电脑发送同步删除桥接指令。电脑端确认后会删除本地桥接配置并断开连接。`,
    confirmText: '删除',
    confirmColor: '#e5484d',
    cancelText: '取消',
    success: (res) => {
      if (!res.confirm || !connectionId.value) return
      void (async () => {
        const ok = await deleteRobot(agentType.value, connectionId.value!)
        if (!ok) return
        uni.switchTab({ url: '/pages/messages/index' })
      })()
    },
  })
}

function handleRefresh() {
  if (refreshing.value) return
  void refreshDetail(agentType.value, connectionId.value)
}
</script>

<template>
  <view class="page-container bot-config-page">
    <AppNavBar title="机器人配置" show-back />

    <scroll-view class="bot-config-page__body" scroll-y :show-scrollbar="false">
      <view v-if="loading && !detail" class="bot-config-page__loading">
        <text class="bot-config-page__loading-text">加载中…</text>
      </view>

      <view v-else-if="error && !detail" class="bot-config-page__error">
        <text class="bot-config-page__error-text">{{ error }}</text>
      </view>

      <template v-else-if="detail">
        <view class="bot-config-page__hero">
          <image class="bot-config-page__avatar" :src="detail.avatar" mode="aspectFill" />
          <view class="bot-config-page__title-row" @tap="promptRename">
            <text class="bot-config-page__title">{{ detail.displayName }}</text>
            <text class="bot-config-page__edit-icon">✎</text>
          </view>
          <text class="bot-config-page__subtitle">{{ detail.description }}</text>
        </view>

        <view class="bot-config-page__section-head">
          <text class="bot-config-page__section-title">连接配置</text>
          <view class="bot-config-page__status-wrap">
            <view
              class="bot-config-page__refresh"
              :class="{ 'bot-config-page__refresh--spinning': refreshing }"
              @tap="handleRefresh"
            />
            <view
              class="bot-config-page__status-dot"
              :class="{ 'bot-config-page__status-dot--online': isOnline }"
            />
            <text class="bot-config-page__status-text">{{ isOnline ? '在线' : '离线' }}</text>
          </view>
        </view>

        <view class="bot-config-page__card">
          <view class="bot-config-page__row">
            <text class="bot-config-page__label">App ID</text>
            <text class="bot-config-page__value">{{ detail.appId || '加载中' }}</text>
          </view>
          <view class="bot-config-page__divider" />
          <view class="bot-config-page__row">
            <text class="bot-config-page__label">App Secret</text>
            <view class="bot-config-page__secret">
              <text class="bot-config-page__value bot-config-page__value--secret">{{ secretLabel }}</text>
              <text class="bot-config-page__eye" @tap.stop="toggleSecretVisibility">
                {{ showSecret ? '🙈' : '👁' }}
              </text>
            </view>
          </view>
          <view class="bot-config-page__divider" />
          <view class="bot-config-page__row">
            <text class="bot-config-page__label">最近在线</text>
            <text class="bot-config-page__value">{{ formatLastSeen(detail.lastSeenAt) }}</text>
          </view>
          <view class="bot-config-page__divider" />
          <view class="bot-config-page__row">
            <text class="bot-config-page__label">设备</text>
            <text class="bot-config-page__value">{{ detail.deviceName?.trim() || '未绑定设备' }}</text>
          </view>
          <view class="bot-config-page__divider" />
          <view class="bot-config-page__row">
            <text class="bot-config-page__label">插件版本</text>
            <text class="bot-config-page__value">{{ detail.clientVersion?.trim() || '未知' }}</text>
          </view>
        </view>

        <view class="bot-config-page__actions">
          <view class="bot-config-page__primary-btn" @tap="copySetupCommand">
            <text class="bot-config-page__primary-btn-text">一键复制配置命令</text>
          </view>
          <view
            class="bot-config-page__danger-btn"
            :class="{ 'bot-config-page__danger-btn--disabled': deleting }"
            @tap="confirmDelete"
          >
            <text class="bot-config-page__danger-btn-text">
              {{ deleting ? '删除中…' : '删除机器人' }}
            </text>
          </view>
        </view>

        <view v-if="!isOnline" class="bot-config-page__hint">
          <text class="bot-config-page__hint-text">
            提示：若电脑端已关闭，请在电脑终端重新运行 linco-connect start --daemon
          </text>
        </view>
      </template>
    </scroll-view>
  </view>
</template>

<style scoped lang="scss">
.bot-config-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  background: #f5f5f5;
}

.bot-config-page__body {
  flex: 1;
  min-height: 0;
  padding: 24rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.bot-config-page__loading,
.bot-config-page__error {
  padding: 120rpx 0;
  text-align: center;
}

.bot-config-page__loading-text,
.bot-config-page__error-text {
  font-size: 28rpx;
  color: rgba(0, 0, 0, 0.45);
}

.bot-config-page__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32rpx 16rpx 40rpx;
}

.bot-config-page__avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: #ffffff;
}

.bot-config-page__title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 24rpx;
  max-width: 100%;
}

.bot-config-page__title {
  font-size: 36rpx;
  font-weight: 600;
  color: #1a1a1a;
  text-align: center;
}

.bot-config-page__edit-icon {
  margin-left: 12rpx;
  font-size: 28rpx;
  color: rgba(0, 0, 0, 0.45);
}

.bot-config-page__subtitle {
  margin-top: 12rpx;
  font-size: 26rpx;
  color: rgba(0, 0, 0, 0.45);
}

.bot-config-page__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8rpx 8rpx 16rpx;
}

.bot-config-page__section-title {
  font-size: 26rpx;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.55);
}

.bot-config-page__status-wrap {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.bot-config-page__refresh {
  width: 28rpx;
  height: 28rpx;
  border: 3rpx solid rgba(0, 0, 0, 0.28);
  border-top-color: rgba(0, 0, 0, 0.65);
  border-radius: 50%;
  box-sizing: border-box;
}

.bot-config-page__refresh--spinning {
  animation: bot-config-spin 0.8s linear infinite;
}

@keyframes bot-config-spin {
  to {
    transform: rotate(360deg);
  }
}

.bot-config-page__status-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #c4c4c4;
}

.bot-config-page__status-dot--online {
  background: #00754a;
}

.bot-config-page__status-text {
  font-size: 24rpx;
  color: rgba(0, 0, 0, 0.55);
}

.bot-config-page__card {
  background: #ffffff;
  border: 1rpx solid #ececec;
  border-radius: 24rpx;
  overflow: hidden;
}

.bot-config-page__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  padding: 28rpx 24rpx;
}

.bot-config-page__label {
  flex-shrink: 0;
  font-size: 28rpx;
  color: rgba(0, 0, 0, 0.55);
}

.bot-config-page__value {
  flex: 1;
  font-size: 28rpx;
  color: #1a1a1a;
  text-align: right;
  word-break: break-all;
}

.bot-config-page__value--secret {
  font-family: monospace;
}

.bot-config-page__secret {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16rpx;
  flex: 1;
}

.bot-config-page__eye {
  font-size: 28rpx;
  line-height: 1;
}

.bot-config-page__divider {
  height: 1rpx;
  background: #ececec;
  margin: 0 24rpx;
}

.bot-config-page__actions {
  margin-top: 48rpx;
  padding: 0 8rpx;
}

.bot-config-page__primary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  border-radius: 16rpx;
  background: #00754a;
}

.bot-config-page__primary-btn-text {
  font-size: 28rpx;
  font-weight: 500;
  color: #ffffff;
}

.bot-config-page__danger-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  margin-top: 24rpx;
  border-radius: 16rpx;
  border: 1rpx solid #e5484d;
  background: #ffffff;
}

.bot-config-page__danger-btn--disabled {
  opacity: 0.6;
}

.bot-config-page__danger-btn-text {
  font-size: 28rpx;
  font-weight: 500;
  color: #e5484d;
}

.bot-config-page__hint {
  margin-top: 24rpx;
  padding: 0 16rpx;
}

.bot-config-page__hint-text {
  font-size: 24rpx;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.45);
  text-align: center;
}
</style>
