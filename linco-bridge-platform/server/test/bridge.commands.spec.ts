import {
  BRIDGE_CONNECT_CHANNEL,
  buildInitCommand,
  buildSetupCommands,
} from '../src/bridge/bridge.commands'

describe('bridge.commands', () => {
  it('builds init command with linco-demo channel', () => {
    expect(
      buildInitCommand('codex', {
        appId: 'app-1',
        appSecret: 'secret-1',
        accountId: 'codex_1',
      }),
    ).toBe(
      [
        'linco-connect init --token "app-1:secret-1"',
        '--agent codex',
        `--channel ${BRIDGE_CONNECT_CHANNEL}`,
        '--account codex_1',
        `--ws-url ${DEFAULT_BRIDGE_WS_URL}/codex`,
        '--allow-insecure-ws',
      ].join(' '),
    )
  })

  it('builds full setup command block', () => {
    const commands = buildSetupCommands('openclaw', {
      appId: 'a',
      appSecret: 'b',
      accountId: 'openclaw_1',
    })
    expect(commands).toContain('npm install -g linco-connect')
    expect(commands).toContain('--channel linco-demo')
    expect(commands).toContain('--allow-insecure-ws')
    expect(commands).toContain('--ws-url ws://127.0.0.1:3300/bridge/ws/openclaw')
    expect(commands).toContain('--agent openclaw')
    expect(commands).toContain('linco-connect start --daemon')
  })
})
