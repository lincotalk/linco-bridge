import { reactive } from 'vue'

import type { AgentBridgeType, BridgeWorkspaceSelection } from '@/bridge/types'

export interface BridgeWorkspacePickerOpenOptions {
  agentType: AgentBridgeType
  connectionId: string
  platformSessionId?: string
  supportsChats?: boolean
}

export interface BridgeWorkspacePickerState {
  visible: boolean
  options: BridgeWorkspacePickerOpenOptions | null
  resolve: ((value: BridgeWorkspaceSelection | null) => void) | null
}

export const bridgeWorkspacePickerState = reactive<BridgeWorkspacePickerState>({
  visible: false,
  options: null,
  resolve: null,
})

export function showBridgeWorkspacePicker(
  options: BridgeWorkspacePickerOpenOptions,
): Promise<BridgeWorkspaceSelection | null> {
  return new Promise((resolve) => {
    bridgeWorkspacePickerState.options = { ...options }
    bridgeWorkspacePickerState.resolve = resolve
    bridgeWorkspacePickerState.visible = true
  })
}

export function resolveBridgeWorkspacePicker(result: BridgeWorkspaceSelection | null) {
  const pending = bridgeWorkspacePickerState.resolve
  bridgeWorkspacePickerState.visible = false
  bridgeWorkspacePickerState.options = null
  bridgeWorkspacePickerState.resolve = null
  pending?.(result)
}
