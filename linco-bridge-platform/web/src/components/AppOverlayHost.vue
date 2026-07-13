<script setup lang="ts">
import AgentSidePanel from '@/components/AgentSidePanel.vue'
import BridgeContextPickerSheet from '@/components/BridgeContextPickerSheet.vue'
import BridgeSettingsPickerSheet from '@/components/BridgeSettingsPickerSheet.vue'
import BridgeWorkspacePickerSheet from '@/components/BridgeWorkspacePickerSheet.vue'
import IosActionSheetHost from '@/components/IosActionSheetHost.vue'
</script>

<template>
  <view class="app-overlay-host">
    <IosActionSheetHost />
    <BridgeWorkspacePickerSheet />
    <BridgeSettingsPickerSheet />
    <BridgeContextPickerSheet />
    <AgentSidePanel />
  </view>
</template>

<style scoped lang="scss">
.app-overlay-host {
  position: fixed;
  inset: 0;
  z-index: 99998;
  pointer-events: none;
}
</style>
