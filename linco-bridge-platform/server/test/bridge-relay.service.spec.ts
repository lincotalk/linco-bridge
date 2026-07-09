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

    await expect(completed).resolves.toEqual({ text: 'world' })
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

    await expect(completed).resolves.toEqual({ text: 'hello world' })
    expect(chunks).toEqual(['hel'])
  })

  it('keeps progress chunks out of completed final text', async () => {
    const relay = new BridgeRelayService()
    const chunks: Array<{ fullText: string; ephemeral?: boolean; replacePrevious?: boolean }> = []
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
      {
        onChunk: ({ fullText, ephemeral, replacePrevious }) => {
          chunks.push({ fullText, ephemeral, replacePrevious })
        },
      },
    )

    relay.handleConnectorFrame({
      type: 'stream_chunk',
      streamId: capturedStreamId,
      delta: 'I will inspect first.',
      fullText: 'I will inspect first.',
      phase: 'progress',
      ephemeral: true,
    })
    relay.handleConnectorFrame({
      type: 'stream_chunk',
      streamId: capturedStreamId,
      delta: 'Final answer.',
      fullText: 'Final answer.',
      phase: 'final_answer',
      replacePrevious: true,
    })
    relay.handleConnectorFrame({
      type: 'turn_end',
      streamId: capturedStreamId,
    })

    await expect(completed).resolves.toEqual({ text: 'Final answer.' })
    expect(chunks).toEqual([
      { fullText: 'I will inspect first.', ephemeral: true, replacePrevious: false },
      { fullText: 'Final answer.', ephemeral: false, replacePrevious: true },
    ])
  })

  it('forwards thinking frames to onReasoning callback', async () => {
    const relay = new BridgeRelayService()
    const reasoning: string[] = []
    const { streamId } = relay.forwardToConnector(
      () => true,
      {
        sessionId: 'session-1',
        text: 'hello',
        bridgeType: 'codex',
        accountId: 'codex_1',
        boundContextId: null,
        userId: 'demo',
      },
      {
        onReasoning: ({ fullText }) => {
          reasoning.push(fullText)
        },
      },
    )

    relay.handleConnectorFrame({
      type: 'thinking',
      streamId,
      mode: 'summary',
      delta: '分析天气',
      fullText: '分析天气',
    })

    expect(reasoning).toEqual(['分析天气'])
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
    await expect(completed).resolves.toEqual({ text: 'partial' })
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

  it('accepts history-reload command name for history pending', async () => {
    const relay = new BridgeRelayService()
    let capturedStreamId = ''
    const { completed } = relay.forwardSlashCommand(
      (payload) => {
        capturedStreamId = String(payload.streamId)
        return true
      },
      {
        sessionId: 'session-1',
        text: '/history --chat chat-1 5',
        bridgeType: 'codex',
        accountId: 'codex_1',
        boundContextId: null,
        userId: 'demo',
      },
      '/history --chat chat-1 5',
    )

    relay.handleConnectorFrame({
      type: 'slash_command_result',
      streamId: capturedStreamId,
      command: 'history-reload',
      data: { rounds: [] },
    })

    await expect(completed).resolves.toEqual({ rounds: [] })
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

  it('ignores connector session bootstrap banner until turn_end', async () => {
    const relay = new BridgeRelayService()
    let capturedStreamId = ''
    const { completed } = relay.forwardToConnector(
      (payload) => {
        capturedStreamId = String(payload.streamId)
        return true
      },
      {
        sessionId: 'temp-session-1',
        text: '我是谁',
        bridgeType: 'codex',
        accountId: 'codex_1',
        boundContextId: null,
        userId: 'demo',
      },
    )

    relay.handleConnectorFrame({
      type: 'outbound_message',
      streamId: capturedStreamId,
      text: `已连接到 codex Agent
工作目录: C:\\Users\\test\\.linco\\codex\\sessions\\sid_test\\workspace
输入 /help 查看可用命令`,
    })

    relay.handleConnectorFrame({
      type: 'stream_chunk',
      streamId: capturedStreamId,
      delta: '你是',
      fullText: '你是开发者',
    })

    relay.handleConnectorFrame({
      type: 'turn_end',
      streamId: capturedStreamId,
      fullText: '你是开发者',
    })

    await expect(completed).resolves.toEqual({ text: '你是开发者' })
  })

  it('emits agent_trace snapshots for agent_action frames', async () => {
    const relay = new BridgeRelayService()
    const traces: Array<{ actions: Array<{ id: string }> }> = []
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
      {
        onAgentTrace: (trace) => {
          traces.push(trace)
        },
      },
    )

    relay.handleConnectorFrame({
      type: 'agent_action',
      streamId: capturedStreamId,
      event: 'started',
      action: {
        id: 'tool-read',
        type: 'read',
        status: 'running',
        label: '读取 README.md',
        detail: '/workspace/README.md',
      },
    })

    relay.handleConnectorFrame({
      type: 'turn_end',
      streamId: capturedStreamId,
      text: 'done',
    })

    await expect(completed).resolves.toEqual({ text: 'done' })
    expect(traces.at(-1)?.actions.map((item) => item.id)).toEqual(['tool-read'])
  })

  it('streams displayable outbound_message before turn_end for connector turns', async () => {
    const relay = new BridgeRelayService()
    const chunks: Array<{ fullText: string }> = []
    let capturedStreamId = ''
    const { completed } = relay.forwardToConnector(
      (payload) => {
        capturedStreamId = String(payload.streamId)
        return true
      },
      {
        sessionId: 'session-1',
        text: 'run tool',
        bridgeType: 'codex',
        accountId: 'codex_1',
        boundContextId: null,
        userId: 'demo',
      },
      {
        onChunk: (chunk) => {
          chunks.push({ fullText: chunk.fullText })
        },
      },
    )

    relay.handleConnectorFrame({
      type: 'outbound_message',
      streamId: capturedStreamId,
      text: '已批准工具使用',
    })
    relay.handleConnectorFrame({
      type: 'stream_chunk',
      streamId: capturedStreamId,
      delta: '## 结果',
      fullText: '## 结果',
    })
    relay.handleConnectorFrame({
      type: 'turn_end',
      streamId: capturedStreamId,
      fullText: '已批准工具使用\n\n## 结果',
    })

    await expect(completed).resolves.toEqual({ text: '已批准工具使用\n\n## 结果' })
    expect(chunks.map((item) => item.fullText)).toEqual([
      '已批准工具使用',
      '已批准工具使用\n\n## 结果',
    ])
  })

  it('clears reasoning on thinking_clear', async () => {
    const relay = new BridgeRelayService()
    const reasoningStates: string[] = []
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
      {
        onReasoning: ({ fullText }) => {
          reasoningStates.push(fullText)
        },
        onReasoningClear: () => {
          reasoningStates.push('__cleared__')
        },
      },
    )

    relay.handleConnectorFrame({
      type: 'thinking',
      streamId: capturedStreamId,
      delta: 'plan',
      fullText: 'plan',
    })
    relay.handleConnectorFrame({
      type: 'thinking_clear',
      streamId: capturedStreamId,
    })
    relay.handleConnectorFrame({
      type: 'turn_end',
      streamId: capturedStreamId,
      text: 'done',
    })

    await expect(completed).resolves.toEqual({ text: 'done' })
    expect(reasoningStates).toEqual(['plan', '__cleared__'])
  })

  it('captures outbound_message file for connector turns', async () => {
    const relay = new BridgeRelayService()
    const attachments: Array<{ name?: string; mimeType?: string; base64?: string }> = []
    let capturedStreamId = ''
    const { completed } = relay.forwardToConnector(
      (payload) => {
        capturedStreamId = String(payload.streamId)
        return true
      },
      {
        sessionId: 'session-1',
        text: '给我一张小猫图片',
        bridgeType: 'codex',
        accountId: 'codex_1',
        boundContextId: null,
        userId: 'demo',
      },
      {
        onAttachment: (file) => {
          attachments.push(file)
        },
      },
    )

    relay.handleConnectorFrame({
      type: 'outbound_message',
      streamId: capturedStreamId,
      text: '图片已生成',
      mediaName: 'kitten.png',
      mediaType: 'image/png',
      mediaBase64: 'abc123',
    })

    relay.handleConnectorFrame({
      type: 'turn_end',
      streamId: capturedStreamId,
      text: '图片已生成',
    })

    await expect(completed).resolves.toEqual({
      text: '图片已生成',
      file: {
        name: 'kitten.png',
        mimeType: 'image/png',
        base64: 'abc123',
      },
    })
    expect(attachments).toEqual([
      {
        name: 'kitten.png',
        mimeType: 'image/png',
        base64: 'abc123',
      },
    ])
  })
})
