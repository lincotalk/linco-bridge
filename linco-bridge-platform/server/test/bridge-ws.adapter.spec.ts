import {
  BRIDGE_WS_GATEWAY_PATH,
  matchesBridgeWsPath,
} from '../src/bridge/bridge-ws.adapter'

describe('BridgeWsAdapter', () => {
  it('accepts base bridge ws path', () => {
    expect(matchesBridgeWsPath('/bridge/ws', BRIDGE_WS_GATEWAY_PATH)).toBe(true)
  })

  it('accepts per-agent bridge ws paths used by linco-demo preset', () => {
    expect(matchesBridgeWsPath('/bridge/ws/claude', BRIDGE_WS_GATEWAY_PATH)).toBe(true)
  })

  it('rejects unrelated ws paths', () => {
    expect(matchesBridgeWsPath('/socket/ai/claude', BRIDGE_WS_GATEWAY_PATH)).toBe(false)
  })
})
