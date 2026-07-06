import { BridgeRelayService } from '../src/bridge/bridge-relay.service'

describe('BridgeRelayService', () => {
  it('resolves pending turn on turn_end', async () => {
    const relay = new BridgeRelayService()
    let capturedStreamId = ''
    const promise = relay.forwardToConnector(
      (payload) => {
        capturedStreamId = String(payload.streamId)
        return true
      },
      {
        sessionId: 'session-1',
        text: 'hello',
        bridgeType: 'codex',
        accountId: 'codex_1',
        boundContextId: null,
        userId: 'demo',
      },
    )

    relay.handleConnectorFrame({
      type: 'turn_end',
      streamId: capturedStreamId,
      text: 'world',
    })

    await expect(promise).resolves.toBe('world')
  })
})
