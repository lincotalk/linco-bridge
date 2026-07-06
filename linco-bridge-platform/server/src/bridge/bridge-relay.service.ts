import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'

@Injectable()
export class BridgeRelayService {
  private readonly pendingTurns = new Map<
    string,
    {
      resolve: (text: string) => void
      reject: (error: Error) => void
      timeout: NodeJS.Timeout
    }
  >()

  handleConnectorFrame(frame: Record<string, unknown>): void {
    const streamId = typeof frame.streamId === 'string' ? frame.streamId : ''
    if (!streamId) return

    if (frame.type === 'turn_end' || frame.type === 'outbound_message') {
      const text =
        typeof frame.text === 'string'
          ? frame.text
          : typeof frame.fullText === 'string'
            ? frame.fullText
            : ''
      const pending = this.pendingTurns.get(streamId)
      if (pending && text.trim()) {
        clearTimeout(pending.timeout)
        this.pendingTurns.delete(streamId)
        pending.resolve(text.trim())
      }
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
    const streamId = `stream-${requestId}`
    const sessionKey = `session:${input.sessionId}`

    const payload = {
      type: 'inbound_message',
      to: input.bridgeType,
      accountId: input.accountId,
      agentId: input.boundContextId ?? '',
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
      }, 30_000)
      timeout.unref?.()
      this.pendingTurns.set(streamId, { resolve, reject, timeout })
    })
  }
}
