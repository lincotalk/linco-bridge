import { Injectable } from '@nestjs/common'

import { randomUUID } from 'node:crypto'

import { AgentTraceReducer } from './agent-trace.reducer'
import type { AgentTrace } from './agent-trace.types'
import { parseHistoryReloadPayload, type HistoryReloadPayload } from './history.util'
import { isBridgeSessionStatusMessage } from './bridge-status-message.util'
import { BRIDGE_CONNECT_CHANNEL } from './bridge.commands'
import {
  appendStreamingContent,
  separateAfterOutbound,
} from '../chat/stream-content.util'

export type SlashCommandPayload = Record<string, unknown>

export interface StreamChunkPayload {
  delta: string
  fullText: string
  phase?: string
  ephemeral?: boolean
  replacePrevious?: boolean
}

export interface StreamReasoningPayload {
  delta: string
  fullText: string
}

export interface ForwardTurnOptions {
  onChunk?: (chunk: StreamChunkPayload) => void
  onReasoning?: (payload: StreamReasoningPayload) => void
  onReasoningClear?: () => void
  onAgentTrace?: (trace: AgentTrace) => void
  onAttachment?: (file: ConnectorFileInput) => void
}

export interface ConnectorTurnResult {
  text: string
  file?: ConnectorFileInput
}

export interface ForwardTurnHandle {
  streamId: string
  completed: Promise<ConnectorTurnResult>
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
  accumulatedProgressText: string
  accumulatedReasoning: string
  systemTexts: string[]
  collectSystem: boolean
  onChunk?: (chunk: StreamChunkPayload) => void
  onReasoning?: (payload: StreamReasoningPayload) => void
  onReasoningClear?: () => void
  onAgentTrace?: (trace: AgentTrace) => void
  onAttachment?: (file: ConnectorFileInput) => void
  agentTraceReducer: AgentTraceReducer
  cancelled: boolean
  allowEmptyTurnEnd: boolean
  pendingOutboundBoundary: boolean
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

    if (frame.type === 'slash_command_result') {
      this.handleSlashCommandResult(streamId, frame)
      return
    }

    if (!streamId) return

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

    if (frame.type === 'thinking') {
      const delta = typeof frame.delta === 'string' ? frame.delta : ''
      const fullTextFromFrame = typeof frame.fullText === 'string' ? frame.fullText : ''
      const text = typeof frame.text === 'string' ? frame.text : ''
      const mode = typeof frame.mode === 'string' ? frame.mode : ''

      if (fullTextFromFrame.trim()) {
        pending.accumulatedReasoning = fullTextFromFrame
      } else if (mode === 'progress' && (delta || text)) {
        pending.accumulatedReasoning = delta || text
      } else if (delta || text) {
        pending.accumulatedReasoning = pending.accumulatedReasoning
          ? `${pending.accumulatedReasoning}${delta || text}`
          : delta || text
      }

      const traceDetail = pending.agentTraceReducer.handleThinking(frame)
      this.emitAgentTrace(pending)

      if (pending.accumulatedReasoning.trim()) {
        pending.onReasoning?.({
          delta: delta || text,
          fullText: pending.accumulatedReasoning,
        })
      } else if (traceDetail.trim()) {
        pending.accumulatedReasoning = traceDetail
        pending.onReasoning?.({
          delta: traceDetail,
          fullText: traceDetail,
        })
      }
      return
    }

    if (frame.type === 'thinking_clear') {
      pending.accumulatedReasoning = ''
      pending.agentTraceReducer.handleThinkingClear()
      this.emitAgentTrace(pending)
      pending.onReasoningClear?.()
      return
    }

    if (frame.type === 'agent_task') {
      pending.agentTraceReducer.handleAgentTask(frame)
      this.emitAgentTrace(pending)
      return
    }

    if (frame.type === 'agent_action') {
      pending.agentTraceReducer.handleAgentAction(frame)
      this.emitAgentTrace(pending)
      return
    }

    if (frame.type === 'tool_call') {
      pending.agentTraceReducer.handleToolCall(frame)
      this.emitAgentTrace(pending)
      return
    }

    if (frame.type === 'tool_result') {
      pending.agentTraceReducer.handleToolResult(frame)
      this.emitAgentTrace(pending)
      return
    }

    if (frame.type === 'stream_chunk') {
      let delta = typeof frame.delta === 'string' ? frame.delta : ''
      let fullText = typeof frame.fullText === 'string' ? frame.fullText : ''
      const phase = typeof frame.phase === 'string' ? frame.phase : ''
      const ephemeral = frame.ephemeral === true || phase === 'progress'
      const replacePrevious = frame.replacePrevious === true

      if (pending.pendingOutboundBoundary && (delta || fullText.trim())) {
        pending.pendingOutboundBoundary = false
        const incoming = fullText.trim() || delta
        const base = ephemeral ? pending.accumulatedProgressText : pending.accumulatedText
        const separated = separateAfterOutbound(base, incoming)
        if (fullText.trim()) {
          fullText = separated
          delta = ''
        } else {
          delta = separated
        }
      }

      if (ephemeral) {
        if (fullText.trim()) {
          pending.accumulatedProgressText = fullText
        } else if (delta) {
          pending.accumulatedProgressText = appendStreamingContent(
            pending.accumulatedProgressText,
            delta,
          )
        }
      } else if (fullText.trim()) {
        pending.accumulatedText = appendStreamingContent(pending.accumulatedText, fullText)
      } else if (delta) {
        pending.accumulatedText = appendStreamingContent(pending.accumulatedText, delta)
      }
      pending.onChunk?.({
        delta,
        fullText: ephemeral ? pending.accumulatedProgressText : pending.accumulatedText,
        phase,
        ephemeral,
        replacePrevious,
      })
      return
    }

    if (frame.type === 'outbound_message' && !pending.allowEmptyTurnEnd) {
      this.captureOutboundFile(streamId, frame, pending)

      const text =
        typeof frame.text === 'string'
          ? frame.text.trim()
          : typeof frame.fullText === 'string'
            ? frame.fullText.trim()
            : ''
      if (text && isBridgeSessionStatusMessage(text)) {
        return
      }
      if (text) {
        pending.accumulatedText = appendStreamingContent(pending.accumulatedText, text)
        pending.pendingOutboundBoundary = true
        pending.onChunk?.({
          delta: text,
          fullText: pending.accumulatedText,
        })
      }
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
        text = pending.accumulatedText || pending.accumulatedProgressText
      }

      if (
        frame.type === 'outbound_message' &&
        !pending.allowEmptyTurnEnd &&
        isBridgeSessionStatusMessage(text)
      ) {
        return
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

  private emitAgentTrace(pending: PendingTurn): void {
    pending.onAgentTrace?.(pending.agentTraceReducer.snapshot())
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
    pending.onAttachment?.(pending.outboundFile)
  }

  forwardToConnector(
    send: (payload: Record<string, unknown>) => boolean,
    input: ConnectorSendInput,
    options?: ForwardTurnOptions,
  ): ForwardTurnHandle {
    const turn = this.createTurn(send, input, input.text, {
      onChunk: options?.onChunk,
      onReasoning: options?.onReasoning,
      onReasoningClear: options?.onReasoningClear,
      onAgentTrace: options?.onAgentTrace,
      onAttachment: options?.onAttachment,
      allowEmptyTurnEnd: false,
      timeoutMs: 120_000,
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
      || pending.accumulatedProgressText.trim()
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
      onReasoning?: (payload: StreamReasoningPayload) => void
      onReasoningClear?: () => void
      onAgentTrace?: (trace: AgentTrace) => void
      onAttachment?: (file: ConnectorFileInput) => void
      allowEmptyTurnEnd: boolean
      timeoutMs: number
      collectSystem?: boolean
    },
  ): { streamId: string; completed: Promise<string> } {
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
        accumulatedProgressText: '',
        accumulatedReasoning: '',
        systemTexts: [],
        collectSystem: options.collectSystem ?? false,
        onChunk: options.onChunk,
        onReasoning: options.onReasoning,
        onReasoningClear: options.onReasoningClear,
        onAgentTrace: options.onAgentTrace,
        onAttachment: options.onAttachment,
        agentTraceReducer: new AgentTraceReducer(),
        cancelled: false,
        allowEmptyTurnEnd: options.allowEmptyTurnEnd,
        pendingOutboundBoundary: false,
      })
    })

    return { streamId, completed }
  }

  private handleSlashCommandResult(streamId: string, frame: Record<string, unknown>): void {
    const command = typeof frame.command === 'string' ? frame.command.trim() : ''
    let pending = this.pendingSlashCommands.get(streamId)
    let pendingKey = streamId

    if (!pending && command) {
      const matches = [...this.pendingSlashCommands.entries()].filter(([, item]) =>
        this.matchesExpectedSlashCommand(command, item.expectedCommand),
      )
      if (matches.length === 1) {
        pendingKey = matches[0][0]
        pending = matches[0][1]
      }
    }

    if (!pending) return
    if (command && !this.matchesExpectedSlashCommand(command, pending.expectedCommand)) return

    clearTimeout(pending.timeout)
    this.pendingSlashCommands.delete(pendingKey)

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

  private matchesExpectedSlashCommand(received: string, expected: string): boolean {
    if (received === expected) return true
    if (expected === 'history' && received === 'history-reload') return true
    return false
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
