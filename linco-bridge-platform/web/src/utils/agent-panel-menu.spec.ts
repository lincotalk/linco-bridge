import { describe, expect, it, vi } from 'vitest'

import { handleAgentPanelMenuIndex } from './agent-panel-menu'

vi.mock('@/api/session-api', () => ({
  runSessionBridgeCommand: vi.fn(async () => ({
    command: '/status',
    text: 'ok',
  })),
  runAgentBridgeCommand: vi.fn(async () => ({
    command: '/status',
    text: 'agent ok',
  })),
}))

describe('agent-panel-menu', () => {
  it('runs /status for Agent 状态', async () => {
    const { runAgentBridgeCommand } = await import('@/api/session-api')
    await handleAgentPanelMenuIndex(
      {
        agentType: { value: 'codex' },
        connectionId: { value: 'conn-1' },
      },
      0,
    )
    expect(runAgentBridgeCommand).toHaveBeenCalledWith('codex', '/status', 'conn-1')
  })

  it('calls onReloadHistory for 刷新历史', async () => {
    const onReloadHistory = vi.fn(async () => undefined)
    await handleAgentPanelMenuIndex(
      {
        agentType: { value: 'codex' },
        onReloadHistory,
      },
      2,
    )
    expect(onReloadHistory).toHaveBeenCalledTimes(1)
  })
})
