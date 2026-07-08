import type {
  BridgeSessionSettings,
  BridgeSettingsOptions,
} from '@/bridge/types'

export function bridgeSessionSettingsHasDisplayData(
  settings: BridgeSessionSettings | null | undefined,
): boolean {
  return Boolean(settings?.reasoningEffort?.trim() || settings?.modelId?.trim())
}

export function reasoningStrengthLabel(id: string): string {
  switch (id.trim().toLowerCase().replace(/-/g, '_')) {
    case 'low':
      return '低'
    case 'medium':
      return '中'
    case 'high':
      return '高'
    case 'xhigh':
    case 'extra_high':
    case 'extra':
      return '超高'
    default:
      return id.trim()
  }
}

export function buildBridgeSettingsToolbarLabel(
  settings: BridgeSessionSettings | null | undefined,
  options?: BridgeSettingsOptions | null,
): string {
  if (!bridgeSessionSettingsHasDisplayData(settings) || !settings) return '默认'

  const modelId = settings.modelId?.trim() ?? ''
  let modelLabel = settings.modelName?.trim() ?? ''
  if (!modelLabel && modelId && options?.model.items.length) {
    modelLabel = options.model.items.find((item) => item.id === modelId)?.label ?? modelId
  } else if (!modelLabel && modelId) {
    modelLabel = modelId
  }

  const reasoningId = settings.reasoningEffort?.trim() ?? ''
  const reasoningLabel = reasoningId ? reasoningStrengthLabel(reasoningId) : ''

  if (modelLabel && reasoningLabel) return `${modelLabel} · ${reasoningLabel}`
  if (modelLabel) return modelLabel
  if (reasoningLabel) return reasoningLabel
  return '默认'
}

export function resolveInitialReasoningId(
  options: BridgeSettingsOptions,
  settings?: BridgeSessionSettings | null,
): string {
  const pending = settings?.reasoningEffort?.trim() ?? ''
  if (pending) return pending
  const current = options.reasoning.currentId.trim()
  if (current) return current
  return options.reasoning.defaultId.trim()
}

export function resolveInitialModelId(
  options: BridgeSettingsOptions,
  settings?: BridgeSessionSettings | null,
): string {
  const pending = settings?.modelId?.trim() ?? ''
  if (pending) return pending
  const reasoningModel = options.reasoning.model.trim()
  if (reasoningModel) return reasoningModel
  if (options.model.items.length === 1) return options.model.items[0]!.id
  return ''
}
