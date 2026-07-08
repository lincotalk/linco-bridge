<script setup lang="ts">
import AgentSidePanel from '@/components/AgentSidePanel.vue'
import BridgeContextPickerSheet from '@/components/BridgeContextPickerSheet.vue'
import BridgeSettingsPickerSheet from '@/components/BridgeSettingsPickerSheet.vue'
import BridgeWorkspacePickerSheet from '@/components/BridgeWorkspacePickerSheet.vue'
import IosActionSheetHost from '@/components/IosActionSheetHost.vue'
</script>

<template>
  <IosActionSheetHost />
  <BridgeWorkspacePickerSheet />
  <BridgeSettingsPickerSheet />
  <BridgeContextPickerSheet />
  <AgentSidePanel />
</template>
