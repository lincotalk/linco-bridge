<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import BridgeConnectPanel from '@/components/BridgeConnectPanel.vue'
import AppOverlayHost from '@/components/AppOverlayHost.vue'
import type { AgentBridgeType } from '@/bridge/types'
import { useBridgeConnection } from '@/composables/useBridgeConnection'

const agentType = ref<AgentBridgeType>('openclaw')

const {
  agentName,
  loading,
  refreshing,
  checking,
  binding,
  completing,
  error,
  commandText,
  connected,
  hasCopied,
  needsContextBinding,
  contexts,
  selectedContextId,
  loadSetup,
  requestRefreshSetup,
  checkConnection,
  completeConnection,
  navigateAfterConnect,
  markCopied,
} = useBridgeConnection(agentType)

onLoad(() => {
  agentType.value = 'openclaw'
  void loadSetup()
})

async function handleBind() {
  const result = await completeConnection()
  if (!result) return
  navigateAfterConnect(result)
}

function handleRefresh() {
  requestRefreshSetup()
}
</script>

<template>
  <view class="page-container">
    <BridgeConnectPanel
      :agent-name="agentName"
      :loading="loading"
      :refreshing="refreshing"
      :checking="checking"
      :binding="binding"
      :completing="completing"
      :error="error"
      :command-text="commandText"
      :connected="connected"
      :has-copied="hasCopied"
      :needs-context-binding="needsContextBinding"
      :contexts="contexts"
      :selected-context-id="selectedContextId"
      context-title="电脑端检测到的小龙虾"
      context-subtitle="请选择一个小龙虾绑定到当前 APP 助手。"
      context-note="绑定后，只展示该小龙虾的 sessions。"
      bind-button-text="绑定选中的小龙虾"
      context-empty-text="未检测到可绑定的小龙虾，请先在电脑端创建 OpenClaw Agent"
      refresh-note="新增连接会生成新的 --account 与 token；已有连接保持在线，本机 linco-connect 会新增一条账号配置。"
      @copied="markCopied"
      @refresh="handleRefresh"
      @check="checkConnection"
      @bind="handleBind"
      @select-context="(id) => (selectedContextId = id)"
    />
    <!-- #ifndef H5 -->
    <AppOverlayHost />
    <!-- #endif -->
  </view>
</template>
