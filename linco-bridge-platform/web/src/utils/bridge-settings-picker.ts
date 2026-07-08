import { reactive } from 'vue'

import type {
  AgentBridgeType,
  BridgeSessionSettings,
  BridgeSettingsOptions,
  BridgeSettingsPickerResult,
} from '@/bridge/types'

export interface BridgeSettingsPickerOpenOptions {
  agentType: AgentBridgeType
  connectionId?: string
  sessionId?: string
  initialSettings?: BridgeSessionSettings | null
  options?: BridgeSettingsOptions | null
}

export interface BridgeSettingsPickerState {
  visible: boolean
  options: BridgeSettingsPickerOpenOptions | null
  resolve: ((value: BridgeSettingsPickerResult | null) => void) | null
}

export const bridgeSettingsPickerState = reactive<BridgeSettingsPickerState>({
  visible: false,
  options: null,
  resolve: null,
})

export function showBridgeSettingsPicker(
  options: BridgeSettingsPickerOpenOptions,
): Promise<BridgeSettingsPickerResult | null> {
  return new Promise((resolve) => {
    bridgeSettingsPickerState.options = { ...options }
    bridgeSettingsPickerState.resolve = resolve
    bridgeSettingsPickerState.visible = true
  })
}

export function resolveBridgeSettingsPicker(result: BridgeSettingsPickerResult | null) {
  const pending = bridgeSettingsPickerState.resolve
  bridgeSettingsPickerState.visible = false
  bridgeSettingsPickerState.options = null
  bridgeSettingsPickerState.resolve = null
  pending?.(result)
}
