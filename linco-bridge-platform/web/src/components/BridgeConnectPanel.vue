<script setup lang="ts">
import AppNavBar from '@/components/AppNavBar.vue'
import CommandBlock from '@/components/CommandBlock.vue'
import type { AgentBridgeBindableContext } from '@/bridge/types'

defineProps<{
  agentName: string
  loading: boolean
  refreshing: boolean
  checking: boolean
  binding: boolean
  completing: boolean
  error: string | null
  commandText: string
  connected: boolean | null
  hasCopied: boolean
  needsContextBinding: boolean
  contexts: AgentBridgeBindableContext[]
  selectedContextId: string | null
  tipTitle?: string
  tipDesc?: string
  contextTitle?: string
  contextSubtitle?: string
  contextNote?: string
  bindButtonText?: string
  refreshNote?: string
  refreshButtonText?: string
  contextEmptyText?: string
}>()

const emit = defineEmits<{
  copied: []
  refresh: []
  check: []
  continue: []
  bind: []
  'select-context': [string]
}>()
</script>

<template>
  <view class="connect-page">
    <AppNavBar show-back :title="`连接 ${agentName}`" />

    <view class="connect-page__body">
      <view v-if="loading" class="connect-page__hint">正在获取连接配置…</view>
      <view v-else-if="error" class="connect-page__error">
        <text>{{ error }}</text>
        <view class="connect-page__retry" @tap="emit('refresh')">重试</view>
      </view>

      <template v-else>
        <view class="connect-page__tip card">
          <view class="connect-page__tip-head">
            <text class="connect-page__tip-title">{{ tipTitle ?? '复制本机连接配置' }}</text>
            <view
              v-if="!loading"
              class="connect-page__refresh"
              :class="{ 'connect-page__refresh--disabled': refreshing }"
              @tap="emit('refresh')"
            >
              {{ refreshing ? '新增中…' : refreshButtonText ?? '新增连接' }}
            </view>
          </view>
          <text class="connect-page__tip-desc">
            {{
              tipDesc ??
                `完成本机配置并连接成功后，${agentName} 会自动出现在 Agent 列表。`
            }}
          </text>
          <text v-if="refreshNote" class="connect-page__refresh-note">{{ refreshNote }}</text>
        </view>

        <CommandBlock :commands="commandText" @copied="emit('copied')" />

        <view
          v-if="needsContextBinding && connected && contexts.length"
          class="context card"
        >
          <text class="context__title">{{ contextTitle ?? '选择绑定上下文' }}</text>
          <text v-if="contextSubtitle" class="context__subtitle">{{ contextSubtitle }}</text>
          <text v-if="contextNote" class="context__note">{{ contextNote }}</text>
          <view
            v-for="item in contexts"
            :key="item.id"
            class="context__item"
            :class="{ 'context__item--active': selectedContextId === item.id }"
            @tap="emit('select-context', item.id)"
          >
            <text class="context__label">{{ item.label }}</text>
            <text v-if="item.description" class="context__desc">{{ item.description }}</text>
          </view>
          <view
            class="btn btn--primary context__bind"
            :class="{ 'btn--disabled': binding || completing || !selectedContextId }"
            @tap="emit('bind')"
          >
            {{ binding || completing ? '处理中…' : bindButtonText ?? '绑定选中的上下文' }}
          </view>
        </view>

        <view
          v-else-if="needsContextBinding && connected && !contexts.length"
          class="context card"
        >
          <text class="context__empty">
            {{ contextEmptyText ?? '未检测到可绑定的上下文，请先在电脑端完成配置' }}
          </text>
        </view>

        <view v-if="hasCopied" class="connect-page__actions">
          <view
            v-if="!needsContextBinding || connected !== true"
            class="btn btn--primary btn--full"
            :class="{ 'btn--disabled': checking }"
            @tap="emit('check')"
          >
            {{
              checking
                ? '检测中…'
                : connected === true
                  ? `已连接 ${agentName}`
                  : '我已复制，获取连接状态'
            }}
          </view>

          <view
            v-if="!needsContextBinding && connected === true"
            class="btn btn--primary btn--full"
            :class="{ 'btn--disabled': completing }"
            @tap="emit('continue')"
          >
            {{ completing ? '处理中…' : `进入 ${agentName}` }}
          </view>
        </view>

        <text
          v-if="hasCopied && connected === false"
          class="connect-page__status-hint"
        >
          未检测到 {{ agentName }} 在线，请确认已在电脑终端执行命令并重试
        </text>
      </template>
    </view>
  </view>
</template>

<style scoped lang="scss">
.connect-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.connect-page__body {
  padding: 24rpx 30rpx calc(48rpx + env(safe-area-inset-bottom));
}

.connect-page__hint,
.connect-page__error {
  padding: 48rpx 0;
  text-align: center;
  font-size: 28rpx;
}

.connect-page__error {
  color: #ff4d4f;
}

.connect-page__retry {
  margin-top: 24rpx;
  font-size: 28rpx;
  color: #00754a;
}

.connect-page__tip {
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.connect-page__tip-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.connect-page__tip-title {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.4;
}

.connect-page__refresh {
  flex-shrink: 0;
  font-size: 24rpx;
  color: #00754a;
}

.connect-page__refresh--disabled {
  color: #8c8c8c;
}

.connect-page__tip-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #8c8c8c;
  line-height: 1.5;
}

.connect-page__refresh-note {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #bfbfbf;
  line-height: 1.5;
}

.context {
  padding: 24rpx;
  margin-top: 24rpx;
}

.context__title {
  display: block;
  margin-bottom: 8rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.context__subtitle,
.context__note {
  display: block;
  margin-bottom: 8rpx;
  font-size: 26rpx;
  color: #8c8c8c;
  line-height: 1.5;
}

.context__empty {
  display: block;
  font-size: 26rpx;
  color: #8c8c8c;
  line-height: 1.5;
}

.context__item {
  padding: 20rpx;
  margin-bottom: 12rpx;
  border-radius: 12rpx;
  background: #fafafa;
  border: 2rpx solid transparent;
}

.context__item--active {
  background: rgba(0, 117, 74, 0.12);
  border-color: #00754a;
}

.context__label {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
}

.context__desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #8c8c8c;
}

.context__bind {
  margin-top: 16rpx;
}

.connect-page__status-hint {
  display: block;
  margin-top: 16rpx;
  text-align: center;
  font-size: 24rpx;
  line-height: 1.5;
  color: #ff4d4f;
}

.connect-page__actions {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 32rpx;
}

.btn {
  padding: 22rpx 0;
  border-radius: 999rpx;
  text-align: center;
  font-size: 28rpx;
}

.btn--full {
  width: 100%;
}

.btn--primary {
  background: #00754a;
  color: #ffffff;
}

.btn--disabled {
  opacity: 0.65;
}
</style>
