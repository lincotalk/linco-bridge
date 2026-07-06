import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'

interface PendingTurn {
  resolve: (text: string) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
  accumulatedText: string
}

@Injectable()
export class BridgeRelayService {
  private readonly pendingTurns = new Map<string, PendingTurn>()

  handleConnectorFrame(frame: Record<string, unknown>): void {
    const streamId = typeof frame.streamId === 'string' ? frame.streamId : ''
    if (!streamId) return

    const pending = this.pendingTurns.get(streamId)
    if (!pending) return

    if (frame.type === 'stream_chunk') {
      const delta = typeof frame.delta === 'string' ? frame.delta : ''
      const fullText = typeof frame.fullText === 'string' ? frame.fullText : ''
      if (fullText.trim()) {
        pending.accumulatedText = fullText
      } else if (delta) {
        pending.accumulatedText += delta
      }
      return
    }

    if (frame.type === 'turn_end' || frame.type === 'outbound_message') {
      const text =
        typeof frame.text === 'string'
          ? frame.text
          : typeof frame.fullText === 'string'
            ? frame.fullText
            : pending.accumulatedText
      if (!text.trim()) return

      clearTimeout(pending.timeout)
      this.pendingTurns.delete(streamId)
      pending.resolve(text.trim())
    }
  }

  forwardToConnector(
    send: (payload: Record<string, unknown>) => boolean,
    input: {
      sessionId: string
      text: string
      bridgeType: string
      accountId: string
      boundContextId: string | null
      userId: string
    },
  ): Promise<string> {
    const requestId = randomUUID()
    const streamId = `linco-stream-${requestId}`
    const sessionKey = input.sessionId

    const payload = {
      type: 'inbound_message',
      to: 'agent',
      accountId: input.accountId,
      agentId: input.boundContextId ?? 'main',
      channel: 'linco',
      chatType: 'direct',
      userId: input.userId,
      messageId: requestId,
      requestId,
      streamId,
      sessionKey,
      text: input.text,
      files: [] as unknown[],
    }

    const sent = send(payload)
    if (!sent) {
      return Promise.reject(new Error('connector offline'))
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingTurns.delete(streamId)
        reject(new Error('bridge turn timeout'))
      }, 120_000)
      timeout.unref?.()
      this.pendingTurns.set(streamId, {
        resolve,
        reject,
        timeout,
        accumulatedText: '',
      })
    })
  }
}
