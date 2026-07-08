<script setup lang="ts">
import AgentSidePanel from '@/components/AgentSidePanel.vue'
import BridgeContextPickerSheet from '@/components/BridgeContextPickerSheet.vue'
import BridgeWorkspacePickerSheet from '@/components/BridgeWorkspacePickerSheet.vue'
import IosActionSheetHost from '@/components/IosActionSheetHost.vue'
</script>

<template>
  <IosActionSheetHost />
  <BridgeWorkspacePickerSheet />
  <BridgeContextPickerSheet />
  <AgentSidePanel />
</template>
