import { buildInitCommand, buildSetupCommands } from '../src/bridge/bridge.commands'

describe('bridge.commands', () => {
  it('builds Flutter-compatible init command', () => {
    expect(
      buildInitCommand('codex', {
        appId: 'app-1',
        appSecret: 'secret-1',
        accountId: 'codex_1',
      }),
    ).toBe('linco-connect init --token "app-1:secret-1" --agent codex --account codex_1')
  })

  it('builds full setup command block', () => {
    const commands = buildSetupCommands('openclaw', {
      appId: 'a',
      appSecret: 'b',
      accountId: 'openclaw_1',
    })
    expect(commands).toContain('npm install -g linco-connect')
    expect(commands).toContain('--agent openclaw')
    expect(commands).toContain('linco-connect start --daemon')
  })
})
