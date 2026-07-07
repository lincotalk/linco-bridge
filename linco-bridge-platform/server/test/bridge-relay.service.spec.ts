import { BridgeRelayService } from '../src/bridge/bridge-relay.service'

describe('BridgeRelayService', () => {
  it('resolves pending turn on turn_end', async () => {
    const relay = new BridgeRelayService()
    let capturedStreamId = ''
    const { completed } = relay.forwardToConnector(
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

    await expect(completed).resolves.toBe('world')
  })

  it('accumulates stream_chunk before turn_end', async () => {
    const relay = new BridgeRelayService()
    const chunks: string[] = []
    let capturedStreamId = ''
    const { completed } = relay.forwardToConnector(
      (payload) => {
        capturedStreamId = String(payload.streamId)
        expect(payload.to).toBe('agent')
        expect(payload.sessionKey).toBe('session-1')
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
      {
        onChunk: ({ fullText }) => {
          chunks.push(fullText)
        },
      },
    )

    relay.handleConnectorFrame({
      type: 'stream_chunk',
      streamId: capturedStreamId,
      delta: 'hel',
    })
    relay.handleConnectorFrame({
      type: 'turn_end',
      streamId: capturedStreamId,
      fullText: 'hello world',
    })

    await expect(completed).resolves.toBe('hello world')
    expect(chunks).toEqual(['hel'])
  })

  it('cancelTurn resolves with partial text', async () => {
    const relay = new BridgeRelayService()
    let capturedStreamId = ''
    const { completed, streamId } = relay.forwardToConnector(
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

    expect(streamId).toBe(capturedStreamId)

    relay.handleConnectorFrame({
      type: 'stream_chunk',
      streamId: capturedStreamId,
      delta: 'partial',
    })

    const cancelled = relay.cancelTurn(capturedStreamId)
    expect(cancelled.cancelled).toBe(true)
    expect(cancelled.partialText).toBe('partial')
    await expect(completed).resolves.toBe('partial')
  })

  it('resolves slash_command_result for history-reload', async () => {
    const relay = new BridgeRelayService()
    let capturedStreamId = ''
    const { completed } = relay.forwardSlashCommand(
      (payload) => {
        capturedStreamId = String(payload.streamId)
        expect(payload.text).toBe('/history-reload 5')
        return true
      },
      {
        sessionId: 'session-1',
        text: '/history-reload 5',
        bridgeType: 'codex',
        accountId: 'codex_1',
        boundContextId: null,
        userId: 'demo',
      },
      '/history-reload 5',
    )

    relay.handleConnectorFrame({
      type: 'slash_command_result',
      streamId: capturedStreamId,
      command: 'history',
      data: {
        version: 1,
        returnedRounds: 1,
        rounds: [
          {
            index: 1,
            user: { text: 'hello' },
            assistant: { text: 'world' },
          },
        ],
      },
    })

    await expect(completed).resolves.toMatchObject({
      returnedRounds: 1,
      rounds: expect.arrayContaining([
        expect.objectContaining({
          user: { text: 'hello' },
        }),
      ]),
    })
  })

  it('resolves forwardLocalCommand on empty turn_end', async () => {
    const relay = new BridgeRelayService()
    let capturedStreamId = ''
    const { completed } = relay.forwardLocalCommand(
      (payload) => {
        capturedStreamId = String(payload.streamId)
        expect(payload.text).toBe('/bind session-1')
        return true
      },
      {
        sessionId: 'session-1',
        text: '/bind session-1',
        bridgeType: 'codex',
        accountId: 'codex_1',
        boundContextId: null,
        userId: 'demo',
      },
      '/bind session-1',
    )

    relay.handleConnectorFrame({
      type: 'turn_end',
      streamId: capturedStreamId,
      reason: 'completed',
    })

    await expect(completed).resolves.toEqual({ text: '' })
  })

  it('collects system frames for local commands', async () => {
    const relay = new BridgeRelayService()
    let capturedStreamId = ''
    const { completed } = relay.forwardLocalCommand(
      (payload) => {
        capturedStreamId = String(payload.streamId)
        return true
      },
      {
        sessionId: 'session-1',
        text: '/status',
        bridgeType: 'codex',
        accountId: 'codex_1',
        boundContextId: null,
        userId: 'demo',
      },
      '/status',
      30_000,
      { collectSystem: true },
    )

    relay.handleConnectorFrame({
      type: 'system',
      streamId: capturedStreamId,
      text: 'Agent online',
    })
    relay.handleConnectorFrame({
      type: 'turn_end',
      streamId: capturedStreamId,
      reason: 'completed',
    })

    await expect(completed).resolves.toEqual({ text: 'Agent online' })
  })

  it('captures outbound_message file for local commands', async () => {
    const relay = new BridgeRelayService()
    let capturedStreamId = ''
    const { completed } = relay.forwardLocalCommand(
      (payload) => {
        capturedStreamId = String(payload.streamId)
        return true
      },
      {
        sessionId: 'session-1',
        text: '/get report.pdf',
        bridgeType: 'codex',
        accountId: 'codex_1',
        boundContextId: null,
        userId: 'demo',
      },
      '/get report.pdf',
    )

    relay.handleConnectorFrame({
      type: 'outbound_message',
      streamId: capturedStreamId,
      text: '文件：report.pdf',
      mediaName: 'report.pdf',
      mediaType: 'application/pdf',
      mediaBase64: 'abc',
    })

    await expect(completed).resolves.toEqual({
      text: '文件：report.pdf',
      file: {
        name: 'report.pdf',
        mimeType: 'application/pdf',
        base64: 'abc',
      },
    })
  })

  it('forwards files in inbound payload', () => {
    const relay = new BridgeRelayService()
    relay.forwardToConnector(
      (payload) => {
        expect(payload.files).toEqual([
          { name: 'a.txt', mimeType: 'text/plain', base64: 'abc' },
        ])
        return true
      },
      {
        sessionId: 'session-1',
        text: 'see attachment',
        bridgeType: 'codex',
        accountId: 'codex_1',
        boundContextId: null,
        userId: 'demo',
        files: [{ name: 'a.txt', mimeType: 'text/plain', base64: 'abc' }],
      },
    )
  })
})
