import {
  buildBridgeSettingsApplyCommand,
  buildBridgeSettingsToolbarLabel,
  parseBridgeSessionSettings,
  parseBridgeSettingsOptionsPayload,
  reasoningStrengthLabel,
} from '../src/bridge/bridge-settings.util'

describe('parseBridgeSettingsOptionsPayload', () => {
  it('parses reasoning and model options from connector payload', () => {
    const parsed = parseBridgeSettingsOptionsPayload({
      reasoning: {
        current: 'medium',
        defaultEffort: 'medium',
        model: 'gpt-5.4',
        options: [{ id: 'high', label: 'High' }],
      },
      model: {
        items: [{ id: 'gpt-5.4', label: 'GPT-5.4' }],
      },
    })

    expect(parsed.reasoning.currentId).toBe('medium')
    expect(parsed.reasoning.defaultId).toBe('medium')
    expect(parsed.reasoning.model).toBe('gpt-5.4')
    expect(parsed.reasoning.options).toEqual([{ id: 'high', label: 'High' }])
    expect(parsed.model.items).toEqual([{ id: 'gpt-5.4', label: 'GPT-5.4' }])
  })
})

describe('parseBridgeSessionSettings', () => {
  it('parses persisted session settings json', () => {
    expect(
      parseBridgeSessionSettings({
        reasoningEffort: 'high',
        modelId: 'gpt-5.4',
        modelName: 'GPT-5.4',
        updatedAt: 123,
      }),
    ).toEqual({
      reasoningEffort: 'high',
      modelId: 'gpt-5.4',
      modelName: 'GPT-5.4',
      updatedAt: 123,
    })
  })

  it('returns null when no display fields exist', () => {
    expect(parseBridgeSessionSettings({ modelName: 'ignored' })).toBeNull()
  })
})

describe('buildBridgeSettingsApplyCommand', () => {
  it('builds settings apply command with quoted args', () => {
    expect(
      buildBridgeSettingsApplyCommand({
        reasoningEffort: 'high',
        modelId: 'gpt-5.4',
      }),
    ).toBe('/settings apply --reasoning high --model gpt-5.4')
  })

  it('throws when no fields are provided', () => {
    expect(() => buildBridgeSettingsApplyCommand({})).toThrow('至少需要更新一项 Bridge 设置')
  })
})

describe('buildBridgeSettingsToolbarLabel', () => {
  it('returns 默认 for empty settings', () => {
    expect(buildBridgeSettingsToolbarLabel(null)).toBe('默认')
  })

  it('maps reasoning strength to Chinese labels', () => {
    expect(reasoningStrengthLabel('xhigh')).toBe('超高')
    expect(
      buildBridgeSettingsToolbarLabel(
        { modelId: 'gpt-5.4', reasoningEffort: 'high' },
        {
          reasoning: {
            currentId: 'high',
            defaultId: 'medium',
            model: 'gpt-5.4',
            options: [{ id: 'high', label: 'High' }],
          },
          model: { items: [{ id: 'gpt-5.4', label: 'GPT-5.4' }] },
        },
      ),
    ).toBe('GPT-5.4 · 高')
  })
})
