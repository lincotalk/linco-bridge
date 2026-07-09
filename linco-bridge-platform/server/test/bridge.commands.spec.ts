import {

  BRIDGE_CONNECT_CHANNEL,

  buildInitCommand,

  buildSetupCommands,

  DEFAULT_BRIDGE_WS_URL,

} from '../src/bridge/bridge.commands'



describe('bridge.commands', () => {

  it('builds init command with linco-demo channel and no ws-url by default', () => {

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

        '--allow-insecure-ws',

      ].join(' '),

    )

  })



  it('builds init command with optional ws-url override', () => {

    expect(

      buildInitCommand('codex', {

        appId: 'app-1',

        appSecret: 'secret-1',

        accountId: 'codex_1',

        wsUrl: `${DEFAULT_BRIDGE_WS_URL}/codex`,

      }),

    ).toContain(`--ws-url ${DEFAULT_BRIDGE_WS_URL}/codex`)
  })

  it('omits allow-insecure-ws for wss override', () => {
    const command = buildInitCommand('codex', {
      appId: 'app-1',
      appSecret: 'secret-1',
      accountId: 'codex_1',
      wsUrl: 'wss://demo.lincotalk.com/bridge/ws/codex',
    })
    expect(command).toContain('--ws-url wss://demo.lincotalk.com/bridge/ws/codex')
    expect(command).not.toContain('--allow-insecure-ws')
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

    expect(commands).not.toContain('--ws-url')

    expect(commands).toContain('--agent openclaw')

    expect(commands).toContain('linco-connect start --daemon')

  })

})


