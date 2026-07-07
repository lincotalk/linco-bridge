<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import BridgeConnectPanel from '@/components/BridgeConnectPanel.vue'
import { parseAgentBridgeType } from '@/bridge/commands'
import type { AgentBridgeType } from '@/bridge/types'
import { useBridgeConnection } from '@/composables/useBridgeConnection'

const agentType = ref<AgentBridgeType>('codex')

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

const isHermes = computed(() => agentType.value === 'hermes')

onLoad((query) => {
  agentType.value = parseAgentBridgeType(String(query?.type ?? 'codex')) ?? 'codex'
  void loadSetup()
})

async function handleContinue() {
  const result = await completeConnection()
  if (!result) return
  navigateAfterConnect(result)
}

async function handleBind() {
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
      :context-title="isHermes ? '电脑端检测到的 Profile' : undefined"
      :context-subtitle="isHermes ? '请选择一个 Profile 绑定到当前 APP 助手。' : undefined"
      :context-note="isHermes ? '绑定后，只展示该 Profile 的会话。' : undefined"
      :bind-button-text="isHermes ? '绑定选中的 Profile' : undefined"
      :context-empty-text="isHermes ? '未检测到可绑定的 Profile' : undefined"
      @copied="markCopied"
      @refresh="handleRefresh"
      @check="checkConnection"
      @continue="handleContinue"
      @bind="handleBind"
      @select-context="(id) => (selectedContextId = id)"
    />
  </view>
</template>
