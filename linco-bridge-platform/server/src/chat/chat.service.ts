import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { DatabaseService, type BridgeConnectionRow } from '../database/database.service'
import { BridgePresenceService } from '../bridge/bridge-presence.service'
import { BridgeRelayService } from '../bridge/bridge-relay.service'
import { BridgeService } from '../bridge/bridge.service'
import { buildHistoryReloadCommand, formatSlashPayload } from '../bridge/bridge.commands.util'
import { createEphemeralMessage, roundsToMessages, type ChatMessageAttachmentDto } from '../bridge/history.util'
import { normalizeSessionPreview } from './session-preview.util'
import { type AgentBridgeType, agentDisplayName, isAgentBridgeType } from '../shared/constants'
import type { ConnectorFileInput, ConnectorSendInput } from '../bridge/bridge-relay.service'

export interface ChatSessionDto {
  id: string
  agentType: string
  title: string
  lastMessage: string
  updatedAt: number
  online: boolean
}

export interface ChatMessageDto {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  attachments?: Array<{ name: string; mimeType?: string; previewUrl?: string }>
}

export interface AgentLandingHeaderDto {
  agentType: AgentBridgeType
  title: string
  avatar: string
  deviceId?: string
  status: 'online' | 'offline'
}

export interface AgentHistoryItemDto {
  id: string
  title: string
  preview: string
  updatedAt: number
  projectPath?: string
}

export interface ChatFileInput {
  name?: string
  mimeType?: string
  base64?: string
  url?: string
}

export interface BridgeCommandResult {
  command: string
  text: string
  payload?: Record<string, unknown>
  file?: { name: string; mimeType?: string; previewUrl?: string; base64?: string }
}

const BRIDGE_AVATAR: Record<AgentBridgeType, string> = {
  codex: '/static/icons/bot/bridge_codex.png',
  claude: '/static/icons/bot/bridge_claude.png',
  hermes: '/static/icons/bot/bridge_hermes.png',
  openclaw: '/static/icons/bot/bridge_claw.png',
}

const DEFAULT_HISTORY_LIMIT = 50

export interface CreateSessionInput {
  agentType: AgentBridgeType
  title?: string
  tempSession?: boolean
  message?: string
}

@Injectable()
export class ChatService {
  constructor(
    private readonly database: DatabaseService,
    private readonly presence: BridgePresenceService,
    private readonly bridgeService: BridgeService,
    private readonly relay: BridgeRelayService,
  ) {}

  listSessions(): ChatSessionDto[] {
    return this.database.listSessions().map((row) => {
      const connection = row.bridge_connection_id
        ? this.database.getConnectionById(row.bridge_connection_id)
        : undefined
      return {
        id: row.id,
        agentType: row.agent_type,
        title: row.title,
        lastMessage: row.last_message,
        updatedAt: row.update_time,
        online: connection ? this.presence.isOnline(connection.id) : false,
      }
    })
  }

  async listMessages(sessionId: string, limit = DEFAULT_HISTORY_LIMIT): Promise<ChatMessageDto[]> {
    const session = this.database.getSession(sessionId)
    if (!session) {
      throw new NotFoundException('会话不存在')
    }

    const connection = session.bridge_connection_id
      ? this.database.getConnectionById(session.bridge_connection_id)
      : undefined

    if (!connection || !this.presence.isOnline(connection.id)) {
      return []
    }

    try {
      const command = buildHistoryReloadCommand({
        limit,
        projectPath: session.bridge_project_path ?? connection.bridge_project_path ?? undefined,
        agentSessionId:
          session.bridge_agent_session_id ??
          connection.bridge_agent_session_id ??
          connection.bound_context_id ??
          undefined,
      })
      const { completed } = this.relay.forwardSlashCommand(
        (payload) => this.presence.sendJson(connection.id, payload),
        {
          sessionId,
          text: command,
          bridgeType: connection.bridge_type,
          accountId: connection.account_id,
          boundContextId: connection.bound_context_id,
          userId: this.database.demoUserId,
        },
        command,
        'history',
      )
      const payload = await completed
      return roundsToMessages(sessionId, payload)
    } catch {
      return []
    }
  }

  async sendMessage(sessionId: string, content: string): Promise<ChatMessageDto> {
    const trimmed = content.trim()
    if (!trimmed) {
      throw new BadRequestException('消息内容不能为空')
    }

    const session = this.database.getSession(sessionId)
    if (!session) {
      throw new NotFoundException('会话不存在')
    }

    const connection = session.bridge_connection_id
      ? this.database.getConnectionById(session.bridge_connection_id)
      : undefined

    let assistantText = ''

    if (connection && this.presence.isOnline(connection.id)) {
      try {
        const { completed } = this.relay.forwardToConnector(
          (payload) => this.presence.sendJson(connection.id, payload),
          {
            sessionId,
            text: trimmed,
            bridgeType: connection.bridge_type,
            accountId: connection.account_id,
            boundContextId: connection.bound_context_id,
            userId: this.database.demoUserId,
          },
        )
        assistantText = await completed
        if (!assistantText.trim()) {
          assistantText = '本机 Agent 暂未返回内容，请稍后重试。'
        }
      } catch {
        assistantText = '本机 Agent 暂未返回实时回复，请确认 connector 正在运行。'
      }
    } else {
      assistantText = '本机 Agent 未连接，请先完成 bridge 配置并保持在线。'
    }

    this.database.touchSession(
      sessionId,
      normalizeSessionPreview(assistantText.trim() || trimmed),
    )

    return createEphemeralMessage(sessionId, 'assistant', assistantText)
  }

  async sendMessageStream(
    sessionId: string,
    content: string,
    emit: (event: string, data: Record<string, unknown>) => void,
    files: ChatFileInput[] = [],
  ): Promise<ChatMessageDto> {
    const trimmed = content.trim()
    const normalizedFiles = this.normalizeFiles(files)
    if (!trimmed && normalizedFiles.length === 0) {
      throw new BadRequestException('消息内容不能为空')
    }

    const session = this.database.getSession(sessionId)
    if (!session) {
      throw new NotFoundException('会话不存在')
    }

    const userAttachments = this.filesToAttachments(normalizedFiles)
    const userDto = createEphemeralMessage(
      sessionId,
      'user',
      trimmed || (userAttachments.length > 0 ? `[${userAttachments.length} 个附件]` : ''),
      userAttachments,
    )
    emit('user', { message: userDto })

    const connection = session.bridge_connection_id
      ? this.database.getConnectionById(session.bridge_connection_id)
      : undefined

    let assistantText = ''
    let streamId = ''

    if (connection && this.presence.isOnline(connection.id)) {
      try {
        const turn = this.relay.forwardToConnector(
          (payload) => this.presence.sendJson(connection.id, payload),
          {
            sessionId,
            text: trimmed,
            bridgeType: connection.bridge_type,
            accountId: connection.account_id,
            boundContextId: connection.bound_context_id,
            userId: this.database.demoUserId,
            files: normalizedFiles,
          },
          {
            onChunk: ({ delta, fullText }) => {
              emit('chunk', { delta, fullText })
            },
          },
        )
        streamId = turn.streamId
        emit('start', { streamId })
        assistantText = await turn.completed
        if (!assistantText.trim()) {
          assistantText = '本机 Agent 暂未返回内容，请稍后重试。'
        }
      } catch {
        assistantText = '本机 Agent 暂未返回实时回复，请确认 connector 正在运行。'
        emit('chunk', { delta: assistantText, fullText: assistantText })
      }
    } else {
      emit('start', { streamId: '' })
      assistantText = '本机 Agent 未连接，请先完成 bridge 配置并保持在线。'
      emit('chunk', { delta: assistantText, fullText: assistantText })
    }

    this.database.touchSession(
      sessionId,
      normalizeSessionPreview(assistantText.trim() || trimmed),
    )

    const assistantDto = createEphemeralMessage(sessionId, 'assistant', assistantText)
    emit('done', { message: assistantDto, streamId })
    return assistantDto
  }

  cancelStreamTurn(streamId: string, sessionId: string): ChatMessageDto | null {
    const trimmedStreamId = streamId.trim()
    if (!trimmedStreamId) return null

    const session = this.database.getSession(sessionId)
    if (!session) {
      throw new NotFoundException('会话不存在')
    }

    const { cancelled, partialText } = this.relay.cancelTurn(trimmedStreamId)
    if (!cancelled) return null

    const connection = session.bridge_connection_id
      ? this.database.getConnectionById(session.bridge_connection_id)
      : undefined
    if (connection && this.presence.isOnline(connection.id)) {
      this.presence.sendJson(connection.id, {
        type: 'stop_turn',
        streamId: trimmedStreamId,
        sessionKey: sessionId,
      })
    }

    const content =
      partialText.trim() ||
      '回复已中断，可重新发送消息继续。'

    this.database.touchSession(sessionId, normalizeSessionPreview(content))

    return createEphemeralMessage(sessionId, 'assistant', content)
  }

  getDemoConfig() {
    const host = process.env.PUBLIC_HOST ?? '127.0.0.1'
    const port = process.env.PORT ?? '3300'
    return {
      apiBaseUrl: `http://${host}:${port}`,
      wsBaseUrl: this.bridgeService.getWsUrl(),
      demoUserId: this.database.demoUserId,
    }
  }

  getLandingHeader(agentType: string): AgentLandingHeaderDto {
    if (!isAgentBridgeType(agentType)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const connection = this.database.getConnectionByType(agentType)
    const online = connection ? this.presence.isOnline(connection.id) : false
    const device = connection ? this.presence.getDeviceInfo(connection.id) : undefined

    return {
      agentType,
      title: agentDisplayName(agentType),
      avatar: BRIDGE_AVATAR[agentType],
      deviceId: device?.id ?? device?.name,
      status: online ? 'online' : 'offline',
    }
  }

  listAgentHistory(agentType: string, limit = 50, offset = 0): AgentHistoryItemDto[] {
    if (!isAgentBridgeType(agentType)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    return this.database
      .listSessions()
      .filter((row) => row.agent_type === agentType)
      .slice(offset, offset + limit)
      .map((row) => {
        const connection = row.bridge_connection_id
          ? this.database.getConnectionById(row.bridge_connection_id)
          : undefined
        return {
          id: row.id,
          title: row.title,
          preview: row.last_message || '暂无消息',
          updatedAt: row.update_time,
          projectPath: connection?.bridge_project_path ?? undefined,
        }
      })
  }

  async createConversation(input: CreateSessionInput): Promise<{ sessionId: string }> {
    if (!isAgentBridgeType(input.agentType)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }

    const connection = this.database.getConnectionByType(input.agentType)
    const title =
      input.title?.trim() ||
      (input.tempSession ? '临时会话' : `与 ${agentDisplayName(input.agentType)} 的对话`)

    const session = this.database.createSession({
      agentType: input.agentType,
      title,
      bridgeConnectionId: connection?.id ?? null,
      lastMessage: '',
    })

    if (connection && !input.tempSession) {
      this.database.linkConnectionSession(connection.id, session.id)
    }

    return { sessionId: session.id }
  }

  async runBridgeCommand(sessionId: string, command: string): Promise<BridgeCommandResult> {
    const session = this.database.getSession(sessionId)
    if (!session) {
      throw new NotFoundException('会话不存在')
    }

    const connection = session.bridge_connection_id
      ? this.database.getConnectionById(session.bridge_connection_id)
      : undefined

    if (!connection || !this.presence.isOnline(connection.id)) {
      throw new BadRequestException('本机 Agent 未连接')
    }

    return this.executeBridgeCommand(connection, sessionId, command)
  }

  async runBridgeCommandByAgent(
    agentType: string,
    command: string,
  ): Promise<BridgeCommandResult> {
    if (!isAgentBridgeType(agentType)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }

    const connection = this.database.getConnectionByType(agentType)
    if (!connection || !this.presence.isOnline(connection.id)) {
      throw new BadRequestException('本机 Agent 未连接')
    }

    const sessionKey = connection.session_id ?? `landing-${agentType}`
    return this.executeBridgeCommand(connection, sessionKey, command)
  }

  private async executeBridgeCommand(
    connection: BridgeConnectionRow,
    sessionKey: string,
    command: string,
  ): Promise<BridgeCommandResult> {
    const trimmed = command.trim()
    if (!trimmed.startsWith('/')) {
      throw new BadRequestException('仅支持 slash 命令')
    }

    const input: ConnectorSendInput = {
      sessionId: sessionKey,
      text: trimmed,
      bridgeType: connection.bridge_type,
      accountId: connection.account_id,
      boundContextId: connection.bound_context_id,
      userId: this.database.demoUserId,
    }
    const send = (payload: Record<string, unknown>) => this.presence.sendJson(connection.id, payload)
    const normalized = trimmed.toLowerCase()

    if (normalized === '/help' || normalized.startsWith('/help ')) {
      const { completed } = this.relay.forwardSlashCommand(send, input, '/help', 'help', 30_000)
      const payload = await completed
      return {
        command: trimmed,
        text: formatSlashPayload(payload),
        payload,
      }
    }

    const { completed } = this.relay.forwardLocalCommand(send, input, trimmed, 30_000, {
      collectSystem: true,
    })
    const result = await completed
    return {
      command: trimmed,
      text: result.text.trim() || '命令已执行',
      file: result.file ? this.connectorFileToAttachment(result.file) : undefined,
    }
  }

  private connectorFileToAttachment(file: ConnectorFileInput): ChatMessageAttachmentDto & { base64?: string } {
    const name = file.name?.trim() || 'attachment'
    const mimeType = file.mimeType?.trim() || 'application/octet-stream'
    const previewUrl =
      file.base64 && mimeType.startsWith('image/')
        ? `data:${mimeType};base64,${file.base64}`
        : file.url
    return { name, mimeType, previewUrl, base64: file.base64 }
  }

  private normalizeFiles(files: ChatFileInput[]): ConnectorFileInput[] {
    return files
      .map((file) => ({
        name: file.name?.trim() || undefined,
        mimeType: file.mimeType?.trim() || undefined,
        base64: file.base64?.trim() || undefined,
        url: file.url?.trim() || undefined,
      }))
      .filter((file) => file.base64 || file.url)
  }

  private filesToAttachments(files: ConnectorFileInput[]): ChatMessageAttachmentDto[] {
    return files.map((file) => {
      const name = file.name?.trim() || 'attachment'
      const mimeType = file.mimeType?.trim() || 'application/octet-stream'
      const previewUrl =
        file.base64 && mimeType.startsWith('image/')
          ? `data:${mimeType};base64,${file.base64}`
          : file.url
      return {
        name,
        mimeType,
        previewUrl,
      }
    })
  }
}