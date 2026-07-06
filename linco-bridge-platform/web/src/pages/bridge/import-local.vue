<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import AppNavBar from '@/components/AppNavBar.vue'
import CommandBlock from '@/components/CommandBlock.vue'
import { parseAgentBridgeType } from '@/bridge/commands'
import type { AgentBridgeType } from '@/bridge/types'
import { useBridgeConnection } from '@/composables/useBridgeConnection'

const agentType = ref<AgentBridgeType>('codex')

const {
  loading,
  checking,
  binding,
  error,
  connected,
  contexts,
  selectedContextId,
  hasCopied,
  agentName,
  needsContextBinding,
  commandText,
  loadSetup,
  checkConnection,
  bindSelectedContext,
  markCopied,
} = useBridgeConnection(agentType)

onLoad((query) => {
  agentType.value = parseAgentBridgeType(String(query?.type ?? 'codex')) ?? 'codex'
  void loadSetup()
})

async function handleContinue() {
  if (!hasCopied.value) {
    uni.showToast({ title: '请先复制连接命令', icon: 'none' })
    return
  }
  const ok = await checkConnection()
  if (!ok) return

  if (needsContextBinding.value) {
    const bound = await bindSelectedContext()
    if (!bound) return
  }

  uni.showToast({ title: `${agentName.value} 已连接`, icon: 'success' })
}
</script>

<template>
  <view class="page-container import-page">
    <AppNavBar show-back />
    <view class="import-page__body">
      <view v-if="loading" class="import-page__hint">正在获取连接配置…</view>
      <view v-else-if="error" class="import-page__error">{{ error }}</view>
      <template v-else>
        <view class="import-page__tip card">
          <text class="import-page__tip-title">在电脑上执行以下命令</text>
          <text class="import-page__tip-desc">
            命令格式与 Flutter 客户端保持一致，后续将通过 SDK 统一对接后端。
          </text>
        </view>

        <CommandBlock :commands="commandText" @copied="markCopied" />

        <view v-if="needsContextBinding && connected && contexts.length" class="context card">
          <text class="context__title">选择绑定上下文</text>
          <view
            v-for="item in contexts"
            :key="item.id"
            class="context__item"
            :class="{ 'context__item--active': selectedContextId === item.id }"
            @tap="selectedContextId = item.id"
          >
            <text class="context__label">{{ item.label }}</text>
            <text v-if="item.description" class="context__desc">{{ item.description }}</text>
          </view>
        </view>

        <view class="import-page__actions">
          <view class="btn btn--ghost" @tap="checkConnection">
            {{ checking ? '检测中…' : '检测连接' }}
          </view>
          <view class="btn btn--primary" @tap="handleContinue">
            {{ binding ? '绑定中…' : '继续' }}
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<style scoped lang="scss">
.import-page__body {
  padding: 24rpx 30rpx 48rpx;
}

.import-page__hint,
.import-page__error {
  padding: 48rpx 0;
  text-align: center;
  font-size: 28rpx;
}

.import-page__error {
  color: #ff4d4f;
}

.import-page__tip {
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.import-page__tip-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
}

.import-page__tip-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #8c8c8c;
  line-height: 1.5;
}

.context {
  padding: 24rpx;
  margin-top: 24rpx;
}

.context__title {
  display: block;
  margin-bottom: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.context__item {
  padding: 20rpx;
  margin-bottom: 12rpx;
  border-radius: 12rpx;
  background: #fafafa;
}

.context__item--active {
  background: #e6f4ff;
  border: 2rpx solid #1677ff;
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

.import-page__actions {
  display: flex;
  gap: 20rpx;
  margin-top: 32rpx;
}

.btn {
  flex: 1;
  padding: 22rpx 0;
  border-radius: 16rpx;
  text-align: center;
  font-size: 28rpx;
}

.btn--ghost {
  background: #ffffff;
  color: #1a1a1a;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.btn--primary {
  background: #1677ff;
  color: #ffffff;
}
</style>
