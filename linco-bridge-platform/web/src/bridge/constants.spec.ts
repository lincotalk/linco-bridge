import { describe, expect, it } from 'vitest'

import {
  requiresContextBinding,
  supportsBridgeContextSelector,
  supportsBridgeSettingsSelector,
  supportsBridgeWorkspaceSelector,
} from '@/bridge/constants'

describe('supportsBridgeWorkspaceSelector', () => {
  it('enables workspace entry for codex and claude only', () => {
    expect(supportsBridgeWorkspaceSelector('codex')).toBe(true)
    expect(supportsBridgeWorkspaceSelector('claude')).toBe(true)
    expect(supportsBridgeWorkspaceSelector('hermes')).toBe(false)
    expect(supportsBridgeWorkspaceSelector('openclaw')).toBe(false)
  })
})

describe('supportsBridgeContextSelector', () => {
  it('enables profile entry for hermes only', () => {
    expect(supportsBridgeContextSelector('hermes')).toBe(true)
    expect(supportsBridgeContextSelector('openclaw')).toBe(false)
    expect(supportsBridgeContextSelector('codex')).toBe(false)
    expect(supportsBridgeContextSelector('claude')).toBe(false)
    expect(requiresContextBinding('openclaw')).toBe(true)
  })
})

describe('supportsBridgeSettingsSelector', () => {
  it('enables model/reasoning settings for codex and claude only', () => {
    expect(supportsBridgeSettingsSelector('codex')).toBe(true)
    expect(supportsBridgeSettingsSelector('claude')).toBe(true)
    expect(supportsBridgeSettingsSelector('hermes')).toBe(false)
    expect(supportsBridgeSettingsSelector('openclaw')).toBe(false)
  })
})
