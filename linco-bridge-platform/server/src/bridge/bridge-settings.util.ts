import { quoteBridgeCommandArg } from './bridge.commands.util'

export interface BridgeReasoningOptionDto {
  id: string
  label: string
  description?: string
}

export interface BridgeReasoningStateDto {
  currentId: string
  defaultId: string
  model: string
  options: BridgeReasoningOptionDto[]
}

export interface BridgeSettingsModelOptionDto {
  id: string
  label: string
  description?: string
}

export interface BridgeSettingsOptionsDto {
  reasoning: BridgeReasoningStateDto
  model: { items: BridgeSettingsModelOptionDto[] }
}

export interface BridgeSessionSettingsDto {
  reasoningEffort?: string
  modelId?: string
  modelName?: string
  updatedAt?: number
}

function firstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function listFromPayload(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    for (const key of keys) {
      const value = record[key]
      if (Array.isArray(value)) return value
    }
  }
  return []
}

function objectToMap(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function parseBridgeReasoningOption(raw: Record<string, unknown>): BridgeReasoningOptionDto | null {
  const id = firstString(raw, ['id'])
  if (!id) return null
  const label = firstString(raw, ['label', 'name']) || id
  const description = firstString(raw, ['description', 'desc'])
  return { id, label, ...(description ? { description } : {}) }
}

export function parseBridgeReasoningState(payload: unknown): BridgeReasoningStateDto {
  const map = objectToMap(payload) ?? {}
  const options = listFromPayload(map, ['options', 'items', 'data'])
    .map((item) => objectToMap(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map(parseBridgeReasoningOption)
    .filter((item): item is BridgeReasoningOptionDto => item !== null)

  return {
    currentId: firstString(map, ['current', 'currentId', 'current_id']),
    defaultId: firstString(map, ['defaultEffort', 'default_effort', 'defaultId', 'default_id']),
    model: firstString(map, ['model', 'currentModel', 'current_model']),
    options,
  }
}

export function parseBridgeSettingsModelOptions(payload: unknown): { items: BridgeSettingsModelOptionDto[] } {
  const map = objectToMap(payload) ?? {}
  const items = listFromPayload(map, ['items', 'options', 'models', 'data'])
    .map((item) => objectToMap(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((raw) => {
      const id = firstString(raw, ['id', 'modelId', 'model_id'])
      if (!id) return null
      const label = firstString(raw, ['label', 'name', 'modelName', 'model_name']) || id
      const description = firstString(raw, ['description', 'desc'])
      return { id, label, ...(description ? { description } : {}) }
    })
    .filter((item): item is BridgeSettingsModelOptionDto => item !== null)

  return { items }
}

export function parseBridgeSettingsOptionsPayload(payload: unknown): BridgeSettingsOptionsDto {
  const map = objectToMap(payload) ?? {}
  const reasoningRaw = map.reasoning ?? map.reasoning_options ?? map.reasoningOptions
  const modelRaw = map.model ?? map.models ?? map.model_options ?? map.modelOptions
  return {
    reasoning: parseBridgeReasoningState(reasoningRaw),
    model: parseBridgeSettingsModelOptions(modelRaw),
  }
}

export function parseBridgeSessionSettings(raw: unknown): BridgeSessionSettingsDto | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    try {
      return parseBridgeSessionSettings(JSON.parse(trimmed) as unknown)
    } catch {
      return null
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  const map = raw as Record<string, unknown>
  const reasoningEffort = firstString(map, ['reasoningEffort', 'reasoning_effort'])
  const modelId = firstString(map, ['modelId', 'model_id'])
  const modelName = firstString(map, ['modelName', 'model_name'])
  const updatedAtRaw = map.updatedAt ?? map.updated_at
  const updatedAt =
    typeof updatedAtRaw === 'number' && Number.isFinite(updatedAtRaw) ? updatedAtRaw : undefined
  if (!reasoningEffort && !modelId) return null
  return {
    ...(reasoningEffort ? { reasoningEffort } : {}),
    ...(modelId ? { modelId } : {}),
    ...(modelName ? { modelName } : {}),
    ...(updatedAt != null ? { updatedAt } : {}),
  }
}

export function bridgeSessionSettingsHasDisplayData(
  settings: BridgeSessionSettingsDto | null | undefined,
): boolean {
  return Boolean(settings?.reasoningEffort?.trim() || settings?.modelId?.trim())
}

export function buildBridgeSettingsApplyCommand(input: {
  reasoningEffort?: string
  modelId?: string
}): string {
  const reasoning = input.reasoningEffort?.trim() ?? ''
  const model = input.modelId?.trim() ?? ''
  const parts: string[] = []
  if (reasoning) parts.push(`--reasoning ${quoteBridgeCommandArg(reasoning)}`)
  if (model) parts.push(`--model ${quoteBridgeCommandArg(model)}`)
  if (parts.length === 0) {
    throw new Error('至少需要更新一项 Bridge 设置')
  }
  return `/settings apply ${parts.join(' ')}`
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
  settings: BridgeSessionSettingsDto | null | undefined,
  options?: BridgeSettingsOptionsDto | null,
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
  let reasoningLabel = reasoningId ? reasoningStrengthLabel(reasoningId) : ''
  if (reasoningId && options?.reasoning.options.length) {
    const matched = options.reasoning.options.find((item) => item.id === reasoningId)
    if (matched?.label.trim()) {
      reasoningLabel = reasoningStrengthLabel(matched.id)
    }
  }

  if (modelLabel && reasoningLabel) return `${modelLabel} · ${reasoningLabel}`
  if (modelLabel) return modelLabel
  if (reasoningLabel) return reasoningLabel
  return '默认'
}

export const DEMO_BRIDGE_SETTINGS_OPTIONS: BridgeSettingsOptionsDto = {
  reasoning: {
    currentId: 'medium',
    defaultId: 'medium',
    model: 'gpt-5.4',
    options: [
      { id: 'low', label: 'Low' },
      { id: 'medium', label: 'Medium' },
      { id: 'high', label: 'High' },
      { id: 'xhigh', label: 'Extra High' },
    ],
  },
  model: {
    items: [
      { id: 'gpt-5.4', label: 'GPT-5.4' },
      { id: 'gpt-5.5', label: 'GPT-5.5' },
    ],
  },
}
