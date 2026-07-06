<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import BridgeConnectPanel from '@/components/BridgeConnectPanel.vue'
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
  refreshSetup,
  checkConnection,
  completeConnection,
  navigateAfterConnect,
  markCopied,
} = useBridgeConnection(agentType)

onLoad(() => {
  agentType.value = 'openclaw'
  void loadSetup()
})

async function handleContinue() {
  const result = await completeConnection()
  if (!result) return
  navigateAfterConnect(result)
}

function handleRefresh() {
  if (loading.value || refreshing.value) {
    void loadSetup()
    return
  }
  void refreshSetup()
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
      tip-desc="连接成功后选择要绑定的 OpenClaw Agent。"
      context-title="选择绑定 Agent"
      @copied="markCopied"
      @refresh="handleRefresh"
      @check="checkConnection"
      @continue="handleContinue"
      @select-context="(id) => (selectedContextId = id)"
    />
  </view>
</template>
