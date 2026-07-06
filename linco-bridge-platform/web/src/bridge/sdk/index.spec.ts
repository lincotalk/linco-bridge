import { describe, expect, it } from 'vitest'
import {
  BRIDGE_SOURCE_CARDS,
  getBridgeSourceCard,
  requiresContextBinding,
} from '@/bridge/constants'
import { createMockBridgeSdk } from '@/bridge/sdk'

describe('bridge/constants', () => {
  it('exposes exactly four bridge source cards', () => {
    expect(BRIDGE_SOURCE_CARDS).toHaveLength(4)
    expect(BRIDGE_SOURCE_CARDS.map((item) => item.type)).toEqual([
      'codex',
      'claude',
      'hermes',
      'openclaw',
    ])
  })

  it('maps openclaw card to dedicated import page', () => {
    const card = getBridgeSourceCard('openclaw')
    expect(card?.route).toBe('/pages/bridge/import-openclaw')
  })

  it('requires context binding for openclaw and hermes only', () => {
    expect(requiresContextBinding('openclaw')).toBe(true)
    expect(requiresContextBinding('hermes')).toBe(true)
    expect(requiresContextBinding('codex')).toBe(false)
    expect(requiresContextBinding('claude')).toBe(false)
  })
})

describe('createMockBridgeSdk', () => {
  it('returns setup with Flutter-compatible commands', async () => {
    const sdk = createMockBridgeSdk()
    const setup = await sdk.getSetup('codex')

    expect(setup.appId).toContain('demo-codex-app')
    expect(setup.setupCommands).toContain('npm install -g linco-connect')
    expect(setup.setupCommands).toContain('--channel linco-demo')
    expect(setup.setupCommands).toContain('--agent codex')
    expect(setup.setupCommands).toContain('linco-connect start --daemon')
  })

  it('reports offline before connector attaches', async () => {
    const sdk = createMockBridgeSdk({ autoConnectOnCheck: false })
    const status = await sdk.checkStatus('claude')
    expect(status.connected).toBe(false)
    expect(status.bridgeType).toBe('claude')
  })

  it('bindContext returns sessionId and marks connector online', async () => {
    const sdk = createMockBridgeSdk({ autoConnectOnCheck: false })

    const before = await sdk.checkStatus('hermes')
    expect(before.connected).toBe(false)

    const bound = await sdk.bindContext('hermes', 'profile-default')
    expect(bound.sessionId).toContain('mock-session-hermes')

    const after = await sdk.checkStatus('hermes')
    expect(after.connected).toBe(true)
  })

  it('syncAgent returns session for codex path', async () => {
    const sdk = createMockBridgeSdk({ autoConnectOnCheck: false })
    const synced = await sdk.syncAgent('codex')
    expect(synced.sessionId).toContain('mock-session-codex')
    expect(synced.agentName).toBe('Codex')
  })

  it('refreshSetup rotates secret while preserving command shape', async () => {
    const sdk = createMockBridgeSdk()
    const before = await sdk.getSetup('claude')
    const after = await sdk.refreshSetup('claude', before.connectionId)

    expect(after.appSecret).not.toBe(before.appSecret)
    expect(after.setupCommands).toContain(after.appSecret)
  })
})
