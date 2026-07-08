import { describe, expect, it } from 'vitest'

import {
  requiresContextBinding,
  supportsBridgeContextSelector,
  supportsBridgeSettingsSelector,
  supportsBridgeSlashCommands,
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
  it('disables in-chat profile switching for all agents', () => {
    expect(supportsBridgeContextSelector('hermes')).toBe(false)
    expect(supportsBridgeContextSelector('openclaw')).toBe(false)
    expect(supportsBridgeContextSelector('codex')).toBe(false)
    expect(supportsBridgeContextSelector('claude')).toBe(false)
  })
})

describe('requiresContextBinding', () => {
  it('requires one-time bind at import for hermes and openclaw', () => {
    expect(requiresContextBinding('hermes')).toBe(true)
    expect(requiresContextBinding('openclaw')).toBe(true)
    expect(requiresContextBinding('codex')).toBe(false)
    expect(requiresContextBinding('claude')).toBe(false)
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

describe('supportsBridgeSlashCommands', () => {
  it('enables slash command autocomplete for codex and claude only', () => {
    expect(supportsBridgeSlashCommands('codex')).toBe(true)
    expect(supportsBridgeSlashCommands('claude')).toBe(true)
    expect(supportsBridgeSlashCommands('hermes')).toBe(false)
    expect(supportsBridgeSlashCommands('openclaw')).toBe(false)
  })
})
