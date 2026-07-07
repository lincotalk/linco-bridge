import { describe, expect, it } from 'vitest'

import { bridgePathBasename, resolveBridgeProjectLabel } from '@/utils/bridge-project-label'

describe('bridgePathBasename', () => {
  it('returns last path segment', () => {
    expect(bridgePathBasename('D:\\project\\bpms-workbench')).toBe('bpms-workbench')
    expect(bridgePathBasename('/workspace/demo/')).toBe('demo')
  })
})

describe('resolveBridgeProjectLabel', () => {
  it('returns project basename for bridge sessions', () => {
    expect(
      resolveBridgeProjectLabel({
        id: '1',
        agentType: 'codex',
        title: 'demo',
        lastMessage: '',
        updatedAt: 0,
        online: true,
        bridgeProjectPath: 'D:\\project\\bpms-workbench',
      }),
    ).toBe('bpms-workbench')
  })

  it('returns 临时会话 when bridge session has no project path', () => {
    expect(
      resolveBridgeProjectLabel({
        id: '1',
        agentType: 'codex',
        title: 'demo',
        lastMessage: '',
        updatedAt: 0,
        online: true,
        isTempSession: true,
      }),
    ).toBe('临时会话')
  })

  it('returns undefined for non-bridge agent types', () => {
    expect(
      resolveBridgeProjectLabel({
        id: '1',
        agentType: 'openclaw',
        title: 'demo',
        lastMessage: '',
        updatedAt: 0,
        online: true,
      }),
    ).toBeUndefined()
  })
})
