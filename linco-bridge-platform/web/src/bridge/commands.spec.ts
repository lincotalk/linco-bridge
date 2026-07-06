import { describe, expect, it } from 'vitest'
import {
  BRIDGE_CONNECT_CHANNEL,
  buildInitCommand,
  buildSetupCommands,
  defaultAccountId,
  DEFAULT_BRIDGE_WS_URL,
  getAgentDisplayName,
  getConnectAgentFlag,
  isLocalAgentType,
  parseAgentBridgeType,
} from '@/bridge/commands'

describe('bridge/commands', () => {
  const params = {
    appId: 'app-123',
    appSecret: 'secret-456',
    accountId: 'codex_1',
  }

  const expectedInit = (agent: string, accountId: string) =>
    [
      `linco-connect init --token "app-123:secret-456"`,
      `--agent ${agent}`,
      `--channel ${BRIDGE_CONNECT_CHANNEL}`,
      `--account ${accountId}`,
      `--ws-url ${DEFAULT_BRIDGE_WS_URL}/${agent}`,
      '--allow-insecure-ws',
    ].join(' ')

  it('buildInitCommand uses linco-demo channel for codex', () => {
    expect(buildInitCommand('codex', params)).toBe(expectedInit('codex', 'codex_1'))
  })

  it('buildInitCommand matches openclaw agent flag', () => {
    expect(
      buildInitCommand('openclaw', {
        ...params,
        accountId: 'openclaw_1',
      }),
    ).toBe(expectedInit('openclaw', 'openclaw_1'))
  })

  it('buildSetupCommands preserves command block structure', () => {
    const commands = buildSetupCommands('claude', {
      appId: 'a',
      appSecret: 'b',
      accountId: 'claude_1',
    })

    expect(commands).toBe(
      [
        'npm install -g linco-connect',
        '',
        expectedInit('claude', 'claude_1').replace('app-123:secret-456', 'a:b'),
        '',
        'linco-connect start --daemon',
      ].join('\n'),
    )
  })

  it('defaultAccountId follows Flutter naming', () => {
    expect(defaultAccountId('openclaw')).toBe('openclaw_1')
    expect(defaultAccountId('hermes')).toBe('hermes_1')
  })

  it('getAgentDisplayName returns Flutter labels', () => {
    expect(getAgentDisplayName('claude')).toBe('Claude Code')
    expect(getAgentDisplayName('codex')).toBe('Codex')
  })

  it('getConnectAgentFlag maps bridge types to CLI flags', () => {
    expect(getConnectAgentFlag('openclaw')).toBe('openclaw')
    expect(getConnectAgentFlag('claude')).toBe('claude')
  })

  it('isLocalAgentType excludes openclaw', () => {
    expect(isLocalAgentType('codex')).toBe(true)
    expect(isLocalAgentType('openclaw')).toBe(false)
  })

  it('parseAgentBridgeType normalizes valid values', () => {
    expect(parseAgentBridgeType(' OpenClaw ')).toBe('openclaw')
    expect(parseAgentBridgeType('invalid')).toBeNull()
  })
})
