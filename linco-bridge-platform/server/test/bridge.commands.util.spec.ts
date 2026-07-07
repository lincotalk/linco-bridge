import {
  buildHistoryReloadCommand,
  buildSessionsCommand,
  formatSlashPayload,
} from '../src/bridge/bridge.commands.util'
describe('buildSessionsCommand', () => {
  it('builds project scoped sessions command', () => {
    expect(buildSessionsCommand('D:\\project\\demo', 10)).toBe(
      '/sessions --project "D:\\project\\demo" 10',
    )
  })
})

describe('buildHistoryReloadCommand', () => {
  it('builds plain history-reload with limit', () => {
    expect(buildHistoryReloadCommand({ limit: 5 })).toBe('/history-reload 5')
  })

  it('builds scoped history-reload with project and session', () => {
    expect(
      buildHistoryReloadCommand({
        limit: 10,
        projectPath: 'D:\\project\\demo',
        agentSessionId: 'session-abc',
      }),
    ).toBe(
      '/history-reload --project "D:\\project\\demo" --session session-abc 10',
    )
  })
})

describe('formatSlashPayload', () => {
  it('formats help items', () => {
    expect(
      formatSlashPayload({
        items: [
          { command: '/status', description: '查看状态' },
          '/history-reload',
        ],
      }),
    ).toBe('/status — 查看状态\n/history-reload')
  })
})
