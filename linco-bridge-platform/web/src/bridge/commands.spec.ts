import { describe, expect, it } from 'vitest'
import {
  buildInitCommand,
  buildSetupCommands,
  defaultAccountId,
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

  it('buildInitCommand matches Flutter LocalAgentBridgeSpec for codex', () => {
    expect(buildInitCommand('codex', params)).toBe(
      'linco-connect init --token "app-123:secret-456" --agent codex --account codex_1',
    )
  })

  it('buildInitCommand matches Flutter OpenClawBridgeCommands for openclaw', () => {
    expect(
      buildInitCommand('openclaw', {
        ...params,
        accountId: 'openclaw_1',
      }),
    ).toBe('linco-connect init --token "app-123:secret-456" --agent openclaw --account openclaw_1')
  })

  it('buildSetupCommands preserves Flutter command block structure', () => {
    const commands = buildSetupCommands('claude', {
      appId: 'a',
      appSecret: 'b',
      accountId: 'claude_1',
    })

    expect(commands).toBe(
      [
        'npm install -g linco-connect',
        '',
        'linco-connect init --token "a:b" --agent claude --account claude_1',
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
