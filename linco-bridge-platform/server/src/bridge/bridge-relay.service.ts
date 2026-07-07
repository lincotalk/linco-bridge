import { Injectable } from '@nestjs/common'

import { randomUUID } from 'node:crypto'

import { parseHistoryReloadPayload, type HistoryReloadPayload } from './history.util'
import { BRIDGE_CONNECT_CHANNEL } from './bridge.commands'

export type SlashCommandPayload = Record<string, unknown>

export interface StreamChunkPayload {
  delta: string
  fullText: string
}

export interface ForwardTurnOptions {
  onChunk?: (chunk: StreamChunkPayload) => void
}

export interface ForwardTurnHandle {
  streamId: string
  completed: Promise<string>
}

export interface LocalCommandResult {
  text: string
  file?: ConnectorFileInput
}

export interface ForwardLocalCommandHandle {
  streamId: string
  completed: Promise<LocalCommandResult>
}

export interface ForwardSlashCommandHandle {
  streamId: string
  completed: Promise<SlashCommandPayload>
}

interface PendingTurn {
  resolve: (text: string) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
  accumulatedText: string
  systemTexts: string[]
  collectSystem: boolean
  onChunk?: (chunk: StreamChunkPayload) => void
  cancelled: boolean
  allowEmptyTurnEnd: boolean
  outboundFile?: ConnectorFileInput
}

interface PendingSlashCommand {
  resolve: (payload: SlashCommandPayload) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
  expectedCommand: string
}

export interface ConnectorFileInput {
  name?: string
  mimeType?: string
  base64?: string
  url?: string
}

export interface ConnectorSendInput {
  sessionId: string
  text: string
  bridgeType: string
  accountId: string
  boundContextId: string | null
  userId: string
  files?: ConnectorFileInput[]
}

@Injectable()
export class BridgeRelayService {
  private readonly pendingTurns = new Map<string, PendingTurn>()
  private readonly pendingSlashCommands = new Map<string, PendingSlashCommand>()
  private readonly localCommandFiles = new Map<string, ConnectorFileInput>()

  handleConnectorFrame(frame: Record<string, unknown>): void {
    const streamId = typeof frame.streamId === 'string' ? frame.streamId : ''
    if (!streamId) return

    if (frame.type === 'slash_command_result') {
      this.handleSlashCommandResult(streamId, frame)
      return
    }

    if (frame.type === 'system') {
      const pending = this.pendingTurns.get(streamId)
      if (pending?.collectSystem) {
        const text = typeof frame.text === 'string' ? frame.text.trim() : ''
        if (text) pending.systemTexts.push(text)
      }
      return
    }

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
      pending.onChunk?.({
        delta,
        fullText: pending.accumulatedText,
      })
      return
    }

    if (frame.type === 'turn_end' || frame.type === 'outbound_message') {
      this.captureOutboundFile(streamId, frame, pending)

      let text =
        typeof frame.text === 'string'
          ? frame.text
          : typeof frame.fullText === 'string'
            ? frame.fullText
            : pending.accumulatedText
      if (!text.trim()) {
        text = pending.accumulatedText
      }
      if (!text.trim() && !pending.allowEmptyTurnEnd) return

      clearTimeout(pending.timeout)
      const outboundFile = pending.outboundFile
      this.pendingTurns.delete(streamId)
      if (outboundFile) {
        this.localCommandFiles.set(streamId, outboundFile)
      }
      const trimmed = text.trim()
      const systemPart = pending.systemTexts.join('\n\n').trim()
      pending.resolve([systemPart, trimmed].filter(Boolean).join('\n\n'))
    }
  }

  private captureOutboundFile(
    streamId: string,
    frame: Record<string, unknown>,
    pending: PendingTurn,
  ): void {
    if (frame.type !== 'outbound_message') return

    const mediaBase64 =
      typeof frame.mediaBase64 === 'string'
        ? frame.mediaBase64.trim()
        : typeof frame.media_base64 === 'string'
          ? frame.media_base64.trim()
          : ''
    if (!mediaBase64) return

    const name =
      (typeof frame.mediaName === 'string' && frame.mediaName.trim()) ||
      (typeof frame.media_name === 'string' && frame.media_name.trim()) ||
      'attachment'
    const mimeType =
      (typeof frame.mediaType === 'string' && frame.mediaType.trim()) ||
      (typeof frame.media_type === 'string' && frame.media_type.trim()) ||
      'application/octet-stream'

    pending.outboundFile = { name, mimeType, base64: mediaBase64 }
    this.localCommandFiles.set(streamId, pending.outboundFile)
  }

  forwardToConnector(
    send: (payload: Record<string, unknown>) => boolean,
    input: ConnectorSendInput,
    options?: ForwardTurnOptions,
  ): ForwardTurnHandle {
    return this.createTurn(send, input, input.text, {
      onChunk: options?.onChunk,
      allowEmptyTurnEnd: false,
      timeoutMs: 120_000,
    })
  }

  forwardLocalCommand(
    send: (payload: Record<string, unknown>) => boolean,
    input: ConnectorSendInput,
    command: string,
    timeoutMs = 30_000,
    options?: { collectSystem?: boolean },
  ): ForwardLocalCommandHandle {
    const turn = this.createTurn(send, input, command.trim(), {
      allowEmptyTurnEnd: true,
      timeoutMs,
      collectSystem: options?.collectSystem ?? false,
    })

    return {
      streamId: turn.streamId,
      completed: turn.completed.then((text) => {
        const file = this.localCommandFiles.get(turn.streamId)
        this.localCommandFiles.delete(turn.streamId)
        return { text, file }
      }),
    }
  }

  forwardSlashCommand(
    send: (payload: Record<string, unknown>) => boolean,
    input: ConnectorSendInput,
    command: string,
    expectedCommand = 'history',
    timeoutMs = 60_000,
  ): ForwardSlashCommandHandle {
    const requestId = randomUUID()
    const streamId = `linco-cmd-${requestId}`
    const payload = this.buildInboundPayload(input, requestId, streamId, command.trim())

    const sent = send(payload)
    if (!sent) {
      return {
        streamId,
        completed: Promise.reject(new Error('connector offline')),
      }
    }

    const completed = new Promise<SlashCommandPayload>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingSlashCommands.delete(streamId)
        reject(new Error('bridge slash command timeout'))
      }, timeoutMs)
      timeout.unref?.()
      this.pendingSlashCommands.set(streamId, {
        resolve,
        reject,
        timeout,
        expectedCommand,
      })
    })

    return { streamId, completed }
  }

  cancelTurn(streamId: string): { cancelled: boolean; partialText: string } {
    const pending = this.pendingTurns.get(streamId)
    if (!pending) {
      return { cancelled: false, partialText: '' }
    }

    pending.cancelled = true
    clearTimeout(pending.timeout)
    this.pendingTurns.delete(streamId)
    const partialText = pending.accumulatedText.trim()
    pending.resolve(partialText)
    return { cancelled: true, partialText }
  }

  isTurnActive(streamId: string): boolean {
    return this.pendingTurns.has(streamId)
  }

  private createTurn(
    send: (payload: Record<string, unknown>) => boolean,
    input: ConnectorSendInput,
    text: string,
    options: {
      onChunk?: (chunk: StreamChunkPayload) => void
      allowEmptyTurnEnd: boolean
      timeoutMs: number
      collectSystem?: boolean
    },
  ): ForwardTurnHandle {
    const requestId = randomUUID()
    const streamId = `linco-stream-${requestId}`
    const payload = this.buildInboundPayload(input, requestId, streamId, text)

    const sent = send(payload)
    if (!sent) {
      return {
        streamId,
        completed: Promise.reject(new Error('connector offline')),
      }
    }

    const completed = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingTurns.delete(streamId)
        reject(new Error('bridge turn timeout'))
      }, options.timeoutMs)
      timeout.unref?.()
      this.pendingTurns.set(streamId, {
        resolve,
        reject,
        timeout,
        accumulatedText: '',
        systemTexts: [],
        collectSystem: options.collectSystem ?? false,
        onChunk: options.onChunk,
        cancelled: false,
        allowEmptyTurnEnd: options.allowEmptyTurnEnd,
      })
    })

    return { streamId, completed }
  }

  private handleSlashCommandResult(streamId: string, frame: Record<string, unknown>): void {
    const pending = this.pendingSlashCommands.get(streamId)
    if (!pending) return

    const command = typeof frame.command === 'string' ? frame.command.trim() : ''
    if (command && command !== pending.expectedCommand) return

    clearTimeout(pending.timeout)
    this.pendingSlashCommands.delete(streamId)

    const rawData = frame.data
    if (pending.expectedCommand === 'history') {
      pending.resolve((parseHistoryReloadPayload(rawData) ?? { rounds: [] }) as SlashCommandPayload)
      return
    }

    if (rawData && typeof rawData === 'object') {
      pending.resolve(rawData as SlashCommandPayload)
      return
    }

    pending.resolve({})
  }

  private buildInboundPayload(
    input: ConnectorSendInput,
    requestId: string,
    streamId: string,
    text: string,
  ): Record<string, unknown> {
    return {
      type: 'inbound_message',
      to: 'agent',
      accountId: input.accountId,
      agentId: input.boundContextId ?? 'main',
      channel: BRIDGE_CONNECT_CHANNEL,
      chatType: 'direct',
      userId: input.userId,
      messageId: requestId,
      requestId,
      streamId,
      sessionKey: input.sessionId,
      text,
      files: input.files ?? [],
    }
  }
}

export type { HistoryReloadPayload }
