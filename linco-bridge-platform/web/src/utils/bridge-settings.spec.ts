import { describe, expect, it } from 'vitest'

import type { BridgeSessionSettings, BridgeSettingsOptions } from '@/bridge/types'
import {
  bridgeSessionSettingsHasDisplayData,
  buildBridgeSettingsToolbarLabel,
  reasoningStrengthLabel,
  resolveInitialModelId,
  resolveInitialReasoningId,
} from '@/utils/bridge-settings'

const demoOptions: BridgeSettingsOptions = {
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

describe('bridgeSessionSettingsHasDisplayData', () => {
  it('returns false when settings are empty', () => {
    expect(bridgeSessionSettingsHasDisplayData(null)).toBe(false)
    expect(bridgeSessionSettingsHasDisplayData({})).toBe(false)
  })

  it('returns true when reasoning or model is set', () => {
    expect(bridgeSessionSettingsHasDisplayData({ reasoningEffort: 'high' })).toBe(true)
    expect(bridgeSessionSettingsHasDisplayData({ modelId: 'gpt-5.4' })).toBe(true)
  })
})

describe('reasoningStrengthLabel', () => {
  it('maps known reasoning ids to Chinese labels', () => {
    expect(reasoningStrengthLabel('low')).toBe('低')
    expect(reasoningStrengthLabel('medium')).toBe('中')
    expect(reasoningStrengthLabel('high')).toBe('高')
    expect(reasoningStrengthLabel('xhigh')).toBe('超高')
  })
})

describe('buildBridgeSettingsToolbarLabel', () => {
  it('returns 默认 when no pending settings', () => {
    expect(buildBridgeSettingsToolbarLabel(null, demoOptions)).toBe('默认')
  })

  it('combines model and reasoning labels', () => {
    const settings: BridgeSessionSettings = {
      modelId: 'gpt-5.4',
      reasoningEffort: 'high',
    }
    expect(buildBridgeSettingsToolbarLabel(settings, demoOptions)).toBe('GPT-5.4 · 高')
  })

  it('uses modelName when provided', () => {
    const settings: BridgeSessionSettings = {
      modelName: 'Custom Model',
      reasoningEffort: 'low',
    }
    expect(buildBridgeSettingsToolbarLabel(settings, demoOptions)).toBe('Custom Model · 低')
  })
})

describe('resolveInitialReasoningId', () => {
  it('prefers pending settings over connector defaults', () => {
    expect(
      resolveInitialReasoningId(demoOptions, { reasoningEffort: 'high' }),
    ).toBe('high')
  })

  it('falls back to current and default ids', () => {
    expect(resolveInitialReasoningId(demoOptions)).toBe('medium')
  })
})

describe('resolveInitialModelId', () => {
  it('prefers pending model id', () => {
    expect(resolveInitialModelId(demoOptions, { modelId: 'gpt-5.5' })).toBe('gpt-5.5')
  })

  it('uses reasoning model when no pending selection', () => {
    expect(resolveInitialModelId(demoOptions)).toBe('gpt-5.4')
  })
})
