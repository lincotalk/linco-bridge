import {
  isLocalPublicHost,
  resolvePublicHttpOrigin,
  resolvePublicWsBaseUrl,
  shouldEmbedWsUrlInSetupCommands,
} from '../src/shared/public-endpoint.util'

describe('public-endpoint.util', () => {
  const envSnapshot = { ...process.env }

  afterEach(() => {
    process.env = { ...envSnapshot }
  })

  it('treats loopback as local demo', () => {
    process.env.PUBLIC_HOST = '127.0.0.1'
    expect(isLocalPublicHost()).toBe(true)
    expect(shouldEmbedWsUrlInSetupCommands()).toBe(false)
    expect(resolvePublicHttpOrigin()).toBe('http://127.0.0.1:3300')
    expect(resolvePublicWsBaseUrl()).toBe('ws://127.0.0.1:3300/bridge/ws')
  })

  it('builds https/wss origins for hosted demo', () => {
    process.env.PUBLIC_HOST = 'bridge-demo.lincotalk.com'
    delete process.env.PUBLIC_HTTP_SCHEME
    delete process.env.PUBLIC_WS_SCHEME
    expect(isLocalPublicHost()).toBe(false)
    expect(shouldEmbedWsUrlInSetupCommands()).toBe(true)
    expect(resolvePublicHttpOrigin()).toBe('https://bridge-demo.lincotalk.com')
    expect(resolvePublicWsBaseUrl()).toBe('wss://bridge-demo.lincotalk.com/bridge/ws')
  })

  it('respects explicit scheme overrides', () => {
    process.env.PUBLIC_HOST = 'bridge-demo.lincotalk.com'
    process.env.PUBLIC_HTTP_SCHEME = 'http'
    process.env.PUBLIC_WS_SCHEME = 'ws'
    expect(resolvePublicHttpOrigin()).toBe('http://bridge-demo.lincotalk.com')
    expect(resolvePublicWsBaseUrl()).toBe('ws://bridge-demo.lincotalk.com/bridge/ws')
  })
})
