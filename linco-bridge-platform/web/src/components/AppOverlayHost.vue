<script setup lang="ts">
import AgentSidePanel from '@/components/AgentSidePanel.vue'
import BridgeWorkspacePickerSheet from '@/components/BridgeWorkspacePickerSheet.vue'
import IosActionSheetHost from '@/components/IosActionSheetHost.vue'
</script>

<template>
  <IosActionSheetHost />
  <BridgeWorkspacePickerSheet />
  <AgentSidePanel />
</template>
