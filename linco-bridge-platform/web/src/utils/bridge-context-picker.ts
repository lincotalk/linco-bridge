import { reactive } from 'vue'

import type { AgentBridgeType } from '@/bridge/types'

export interface BridgeContextPickerOpenOptions {
  agentType: AgentBridgeType
  connectionId: string
  selectedContextId?: string
}

export interface BridgeContextPickerState {
  visible: boolean
  options: BridgeContextPickerOpenOptions | null
  resolve: ((value: string | null) => void) | null
}

export const bridgeContextPickerState = reactive<BridgeContextPickerState>({
  visible: false,
  options: null,
  resolve: null,
})

export function showBridgeContextPicker(
  options: BridgeContextPickerOpenOptions,
): Promise<string | null> {
  return new Promise((resolve) => {
    bridgeContextPickerState.options = { ...options }
    bridgeContextPickerState.resolve = resolve
    bridgeContextPickerState.visible = true
  })
}

export function resolveBridgeContextPicker(contextId: string | null) {
  const pending = bridgeContextPickerState.resolve
  bridgeContextPickerState.visible = false
  bridgeContextPickerState.options = null
  bridgeContextPickerState.resolve = null
  pending?.(contextId)
}
