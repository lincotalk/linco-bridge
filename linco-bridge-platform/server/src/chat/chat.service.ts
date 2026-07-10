import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common'
import {
  DatabaseService,
  type BridgeConnectionRow,
  type ChatMessageRow,
  type ChatSessionRow,
} from '../database/database.service'
import { BridgePresenceService } from '../bridge/bridge-presence.service'
import { BridgeRelayService } from '../bridge/bridge-relay.service'
import { BridgeService } from '../bridge/bridge.service'
import { assertAllowedBridgeCommand } from '../bridge/bridge-command-policy'
import { parseBridgeSessionSettings } from '../bridge/bridge-settings.util'
import { resolvePublicHttpOrigin } from '../shared/public-endpoint.util'
import {
  buildHistoryReloadCommand,
  buildHistoryCommand,
  formatSlashPayload,
  quoteBridgeCommandArg,
} from '../bridge/bridge.commands.util'
import { createEphemeralMessage, roundsToMessages, type ChatMessageAttachmentDto, type HistoryReloadPayload } from '../bridge/history.util'
import { normalizeSessionPreview } from './session-preview.util'
import { importBridgeHistoryRounds } from './bridge-history-import.util'
import { shouldPersistSessionMessages } from './session-message-storage.util'
import {
  buildTempSessionTitle,
  isTempSessionPlaceholderTitle,
  resolveTempSessionTitle,
} from './temp-session-title.util'
import { shouldShowSessionInList } from './session-list-filter.util'
import {
  deduplicateBridgeHistorySessions,
  resolveAgentHistoryPreview,
  resolveAgentHistoryTitle,
  shouldShowSessionInAgentHistory,
} from './agent-history-list.util'
import {
  resolveConnectionDeviceName,
  resolveSessionDeviceName,
} from './session-list-title.util'
import { groupSessionsForMessageList } from './session-list-group.util'
import { type AgentBridgeType, agentDisplayName, isAgentBridgeType, resolveConnectionDisplayName } from '../shared/constants'
import { ResourceAccessService } from '../shared/resource-access.service'
import type { ConnectorFileInput, ConnectorSendInput } from '../bridge/bridge-relay.service'

export interface ChatSessionDto {
  id: string
  agentType: string
  connectionId?: string
  /** Message tab row title: agent display name. */
  title: string
  /** Conversation title for chat page header. */
  conversationTitle?: string
  lastMessage: string
  updatedAt: number
  online: boolean
  bridgeProjectPath?: string
  isTempSession?: boolean
  deviceName?: string
  boundContextName?: string
  boundContextId?: string
  bridgeSettings?: {
    reasoningEffort?: string
    modelId?: string
    modelName?: string
    updatedAt?: number
  }
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
  boundContextName?: string
  status: 'online' | 'offline'
}

export interface AgentHistoryItemDto {
  id: string
  title: string
  preview: string
  updatedAt: number
  projectPath?: string
  agentSessionId?: string
}

export interface ResumeSessionResultDto {
  sessionId: string
  title: string
  projectPath?: string
  agentSessionId?: string
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
export const BRIDGE_HISTORY_SYNC_LIMIT = 5
const BRIDGE_HISTORY_TIMEOUT_MS = 20_000

export interface CreateSessionInput {
  agentType: AgentBridgeType
  title?: string
  tempSession?: boolean
  message?: string
  connectionId?: string
  bridgeSettings?: {
    reasoningEffort?: string
    modelId?: string
    modelName?: string
  }
}

@Injectable()
export class ChatService {
  constructor(
    private readonly database: DatabaseService,
    private readonly presence: BridgePresenceService,
    private readonly bridgeService: BridgeService,
    private readonly relay: BridgeRelayService,
    private readonly resourceAccess: ResourceAccessService,
  ) {}

  private ownerId(): string {
    return this.resourceAccess.getOwnerId()
  }

  listSessions(): ChatSessionDto[] {
    const items = this.database
      .listSessions(this.ownerId())
      .filter((row) => {
        const connection = row.bridge_connection_id
          ? this.database.getConnectionById(row.bridge_connection_id)
          : undefined
        return shouldShowSessionInList(row, connection)
      })
      .map((row) => {
      const connection = row.bridge_connection_id
        ? this.database.getConnectionById(row.bridge_connection_id)
        : undefined
      const deviceName = resolveSessionDeviceName(
        row.bridge_device_name,
        connection,
        this.presence,
      )
      const agentName = connection
        ? resolveConnectionDisplayName(connection)
        : agentDisplayName(row.agent_type)
      const lastAssistant = this.database.getLastAssistantMessage(row.id)
      const preview = resolveAgentHistoryPreview(row, lastAssistant?.content)
      const bridgeSettings = parseBridgeSessionSettings(row.bridge_settings_json ?? null) ?? undefined
      return {
        id: row.id,
        agentType: row.agent_type,
        connectionId: connection?.id,
        title: agentName,
        conversationTitle: row.title.trim() || agentName,
        lastMessage: preview === '暂无消息' ? row.last_message : preview,
        updatedAt: row.update_time,
        online: connection ? this.presence.isOnline(connection.id) : false,
        bridgeProjectPath: row.bridge_project_path?.trim() || undefined,
        isTempSession: Number(row.is_temp_session ?? 0) === 1,
        deviceName: deviceName || undefined,
        boundContextName: connection?.bound_context_name?.trim() || undefined,
        boundContextId: connection?.bound_context_id?.trim() || undefined,
        bridgeSettings,
      }
    })

    return groupSessionsForMessageList(items)
  }

  deleteSessionsFromList(sessionIds: string[]): { deletedCount: number } {
    const expanded = new Set<string>()

    for (const rawId of sessionIds) {
      const id = rawId.trim()
      if (!id) continue

      const session = this.database.getSession(id)
      if (!session || session.owner_id !== this.ownerId()) continue

      expanded.add(id)

      const connectionId = session.bridge_connection_id?.trim()
      if (connectionId) {
        for (const siblingId of this.database.listSessionIdsByBridgeConnectionId(connectionId)) {
          expanded.add(siblingId)
        }
      }
    }

    const deleted = this.database.deleteSessionsPermanently([...expanded])
    return { deletedCount: deleted.length }
  }

  async listMessages(
    sessionId: string,
    limit = DEFAULT_HISTORY_LIMIT,
    options?: { reload?: boolean },
  ): Promise<ChatMessageDto[]> {
    const session = this.resourceAccess.requireSession(sessionId)
    const forceReload = options?.reload === true
    const effectiveLimit =
      forceReload && limit === DEFAULT_HISTORY_LIMIT ? BRIDGE_HISTORY_SYNC_LIMIT : limit

    if (shouldPersistSessionMessages(session)) {
      if (forceReload) {
        this.database.clearSessionMessages(sessionId)
      } else {
        const stored = this.database
          .listMessages(sessionId, effectiveLimit)
          .map((row) => this.mapStoredMessage(row))
        if (stored.length > 0) {
          return stored
        }
      }

      await this.maybeImportBridgeHistory(session, effectiveLimit)
      return this.database
        .listMessages(sessionId, effectiveLimit)
        .map((row) => this.mapStoredMessage(row))
    }

    const connection = session.bridge_connection_id
      ? this.database.getConnectionById(session.bridge_connection_id)
      : undefined

    if (!connection || !this.presence.isOnline(connection.id)) {
      return []
    }

    const agentSessionId = session.bridge_agent_session_id?.trim() ?? ''
    if (!agentSessionId) {
      return []
    }

    try {
      const payload = await this.fetchBridgeHistoryPayload(session, connection, effectiveLimit)
      if (!payload) return []
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

    const session = this.resourceAccess.requireSession(sessionId)

    const connection = session.bridge_connection_id
      ? this.database.getConnectionById(session.bridge_connection_id)
      : undefined

    if (this.isTempSession(session)) {
      this.maybeApplyTempSessionTitle(session, trimmed)
    }
    if (shouldPersistSessionMessages(session)) {
      this.database.insertMessage({ sessionId, role: 'user', content: trimmed })
    }

    let assistantText = ''
    let assistantAttachments: ChatMessageAttachmentDto[] = []

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
            userId: this.ownerId(),
          },
        )
        const result = await completed
        assistantText = result.text
        if (result.file) {
          assistantAttachments = [this.connectorFileToStreamAttachment(result.file)]
        }
        if (!assistantText.trim()) {
          assistantText = '本机 Agent 暂未返回内容，请稍后重试。'
        }
      } catch {
        assistantText = '本机 Agent 暂未返回实时回复，请确认 connector 正在运行。'
      }
    } else {
      assistantText = '本机 Agent 未连接，请先完成 bridge 配置并保持在线。'
    }

    if (shouldPersistSessionMessages(session)) {
      return this.mapStoredMessage(
        this.database.insertMessage({
          sessionId,
          role: 'assistant',
          content: assistantText,
          attachments: assistantAttachments,
        }),
      )
    }

    this.database.touchSession(
      sessionId,
      normalizeSessionPreview(assistantText.trim() || trimmed),
    )

    return createEphemeralMessage(sessionId, 'assistant', assistantText, assistantAttachments)
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

    const session = this.resourceAccess.requireSession(sessionId)

    const userAttachments = this.filesToAttachments(normalizedFiles)
    const userContent =
      trimmed || (userAttachments.length > 0 ? `[${userAttachments.length} 个附件]` : '')
    if (this.isTempSession(session)) {
      this.maybeApplyTempSessionTitle(session, userContent)
    }
    const userDto = shouldPersistSessionMessages(session)
      ? this.mapStoredMessage(
          this.database.insertMessage({
            sessionId,
            role: 'user',
            content: userContent,
            attachments: userAttachments,
          }),
        )
      : createEphemeralMessage(sessionId, 'user', userContent, userAttachments)
    emit('user', { message: userDto })

    const connection = session.bridge_connection_id
      ? this.database.getConnectionById(session.bridge_connection_id)
      : undefined

    let assistantText = ''
    let assistantAttachments: ChatMessageAttachmentDto[] = []
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
            userId: this.ownerId(),
            files: normalizedFiles,
          },
          {
            onChunk: ({ delta, fullText, phase, ephemeral, replacePrevious }) => {
              emit('chunk', { delta, fullText, phase, ephemeral, replacePrevious })
            },
            onReasoning: ({ delta, fullText }) => {
              emit('reasoning', { delta, fullText })
            },
            onReasoningClear: () => {
              emit('reasoning_clear', {})
            },
            onAgentTrace: (trace) => {
              emit('agent_trace', { trace })
            },
            onAttachment: (file) => {
              const attachment = this.connectorFileToStreamAttachment(file)
              assistantAttachments = [attachment]
              emit('attachment', { attachment })
            },
          },
        )
        streamId = turn.streamId
        emit('start', { streamId })
        const result = await turn.completed
        assistantText = result.text
        if (result.file) {
          const attachment = this.connectorFileToStreamAttachment(result.file)
          assistantAttachments = [attachment]
        }
        emit('reasoning_end', {})
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

    const assistantDto = shouldPersistSessionMessages(session)
      ? this.mapStoredMessage(
          this.database.insertMessage({
            sessionId,
            role: 'assistant',
            content: assistantText,
            attachments: assistantAttachments,
          }),
        )
      : (() => {
          this.database.touchSession(
            sessionId,
            normalizeSessionPreview(assistantText.trim() || trimmed),
          )
          return createEphemeralMessage(
            sessionId,
            'assistant',
            assistantText,
            assistantAttachments,
          )
        })()
    emit('done', { message: assistantDto, streamId })
    return assistantDto
  }

  cancelStreamTurn(streamId: string, sessionId: string): ChatMessageDto | null {
    const trimmedStreamId = streamId.trim()
    if (!trimmedStreamId) return null

    const session = this.resourceAccess.requireSession(sessionId)

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

    if (shouldPersistSessionMessages(session)) {
      return this.mapStoredMessage(
        this.database.insertMessage({ sessionId, role: 'assistant', content }),
      )
    }

    this.database.touchSession(sessionId, normalizeSessionPreview(content))

    return createEphemeralMessage(sessionId, 'assistant', content)
  }

  getDemoConfig() {
    return {
      apiBaseUrl: resolvePublicHttpOrigin(),
      wsBaseUrl: this.bridgeService.getWsUrl(),
      dataRetentionNotice:
        'Demo 数据绑定当前浏览器会话 Cookie，刷新页面仍会保留；清除 Cookie/缓存、换设备或使用无痕模式可能丢失。',
    }
  }

  resetDemoData(resetToken: string | undefined): {
    deletedConnections: number
    deletedSessions: number
    deletedMessages: number
  } {
    const expected = process.env.DEMO_RESET_TOKEN?.trim()
    if (!expected) {
      throw new NotFoundException('reset disabled')
    }
    if (!resetToken?.trim() || resetToken.trim() !== expected) {
      throw new UnauthorizedException('invalid reset token')
    }
    return this.database.resetDemoDatabase()
  }

  getLandingHeader(agentType: string, connectionId?: string): AgentLandingHeaderDto {
    if (!isAgentBridgeType(agentType)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const connection = connectionId?.trim()
      ? this.resourceAccess.requireConnection(connectionId.trim())
      : this.resourceAccess.resolvePrimaryConnection(agentType)
    if (connectionId?.trim() && (!connection || connection.bridge_type !== agentType)) {
      throw new NotFoundException('连接不存在')
    }
    const online = connection ? this.presence.isOnline(connection.id) : false
    const deviceName = connection
      ? resolveConnectionDeviceName(connection.id, this.presence, connection)
      : ''

    return {
      agentType,
      title: connection ? resolveConnectionDisplayName(connection) : agentDisplayName(agentType),
      avatar: BRIDGE_AVATAR[agentType],
      deviceId: deviceName || undefined,
      boundContextName: connection?.bound_context_name?.trim() || undefined,
      status: online ? 'online' : 'offline',
    }
  }

  listAgentHistory(
    agentType: string,
    limit = 50,
    offset = 0,
    connectionId?: string,
  ): AgentHistoryItemDto[] {
    if (!isAgentBridgeType(agentType)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const normalizedConnectionId = connectionId?.trim() ?? ''
    if (normalizedConnectionId) {
      const connection = this.resourceAccess.requireConnection(normalizedConnectionId)
      if (connection.bridge_type !== agentType) {
        throw new NotFoundException('连接不存在')
      }
    }
    const filtered = this.database
      .listSessions(this.ownerId())
      .filter((row) => row.agent_type === agentType)
      .filter(
        (row) =>
          !normalizedConnectionId || row.bridge_connection_id === normalizedConnectionId,
      )
      .filter((row) => {
        const connection = row.bridge_connection_id
          ? this.database.getConnectionById(row.bridge_connection_id)
          : undefined
        return shouldShowSessionInAgentHistory(row, connection)
      })
      .sort((a, b) => b.update_time - a.update_time)
    const deduped = deduplicateBridgeHistorySessions(filtered)
    return deduped
      .slice(offset, offset + limit)
      .map((row) => {
        const connection = row.bridge_connection_id
          ? this.database.getConnectionById(row.bridge_connection_id)
          : undefined
        const deviceName = resolveSessionDeviceName(
          row.bridge_device_name,
          connection,
          this.presence,
        )
        const firstUser = this.database.getFirstUserMessage(row.id)
        const lastAssistant = this.database.getLastAssistantMessage(row.id)
        return {
          id: row.id,
          title: resolveAgentHistoryTitle(row, deviceName, firstUser?.content),
          preview: resolveAgentHistoryPreview(row, lastAssistant?.content),
          updatedAt: row.update_time,
          projectPath: row.bridge_project_path?.trim() || undefined,
          agentSessionId: row.bridge_agent_session_id?.trim() || undefined,
        }
      })
  }

  hideAgentHistorySessions(agentType: string, sessionIds: string[]): { hiddenCount: number } {
    if (!isAgentBridgeType(agentType)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const validIds = sessionIds
      .map((id) => id.trim())
      .filter(Boolean)
      .filter((id) => {
        const row = this.database.getSession(id)
        return row?.owner_id === this.ownerId() && row.agent_type === agentType
      })
    const hidden = this.database.hideSessionsFromHistory(validIds)
    return { hiddenCount: hidden.length }
  }

  async resumeSession(sessionId: string): Promise<ResumeSessionResultDto> {
    const normalizedSessionId = sessionId.trim()
    if (!normalizedSessionId) {
      throw new BadRequestException('sessionId 不能为空')
    }

    const session = this.resourceAccess.requireSession(normalizedSessionId)

    const connection = session.bridge_connection_id
      ? this.database.getConnectionById(session.bridge_connection_id)
      : undefined

    const projectPath = session.bridge_project_path?.trim() ?? ''
    const agentSessionId = session.bridge_agent_session_id?.trim() ?? ''
    const title = session.title.trim()

    if (!connection) {
      return {
        sessionId: session.id,
        title,
        projectPath: projectPath || undefined,
        agentSessionId: agentSessionId || undefined,
      }
    }

    if (agentSessionId && this.presence.isOnline(connection.id)) {
      const bindCommand = projectPath
        ? `/bind --project ${quoteBridgeCommandArg(projectPath)} ${quoteBridgeCommandArg(agentSessionId)}`
        : `/bind --chat ${quoteBridgeCommandArg(agentSessionId)}`

      return this.bridgeService.applyWorkspaceSelection(connection.bridge_type, connection.id, {
        platformSessionId: session.id,
        projectPath,
        projectName: projectPath || title,
        agentSessionId,
        sessionTitle: title,
        bindCommand,
      })
    }

    this.database.linkConnectionSession(connection.id, session.id)
    return {
      sessionId: session.id,
      title,
      projectPath: projectPath || undefined,
      agentSessionId: agentSessionId || undefined,
    }
  }

  async createConversation(input: CreateSessionInput): Promise<{ sessionId: string }> {
    if (!isAgentBridgeType(input.agentType)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }

    const normalizedConnectionId = input.connectionId?.trim() ?? ''
    const connection = normalizedConnectionId
      ? this.resourceAccess.requireConnection(normalizedConnectionId)
      : this.resourceAccess.resolvePrimaryConnection(input.agentType)
    if (
      normalizedConnectionId &&
      (!connection || connection.bridge_type !== input.agentType)
    ) {
      throw new NotFoundException('连接不存在')
    }

    const title = input.tempSession
      ? resolveTempSessionTitle({
          message: input.message,
          title: input.title,
          agentType: input.agentType,
        })
      : input.title?.trim() || `与 ${agentDisplayName(input.agentType)} 的对话`

    const pendingSettings = input.bridgeSettings
    const bridgeSettingsJson =
      pendingSettings &&
      (pendingSettings.reasoningEffort?.trim() || pendingSettings.modelId?.trim())
        ? JSON.stringify({
            ...(pendingSettings.reasoningEffort?.trim()
              ? { reasoningEffort: pendingSettings.reasoningEffort.trim() }
              : {}),
            ...(pendingSettings.modelId?.trim()
              ? {
                  modelId: pendingSettings.modelId.trim(),
                  modelName:
                    pendingSettings.modelName?.trim() || pendingSettings.modelId.trim(),
                }
              : {}),
            updatedAt: Date.now(),
          })
        : null

    const session = this.database.createSession({
      ownerId: this.ownerId(),
      agentType: input.agentType,
      title,
      bridgeConnectionId: connection?.id ?? null,
      lastMessage: '',
      isTempSession: input.tempSession ?? false,
      bridgeSettingsJson,
    })

    if (connection) {
      if (!input.tempSession) {
        this.database.linkConnectionSession(connection.id, session.id)
      }
      this.database.updateSessionBridgeBinding(session.id, {
        deviceName: resolveConnectionDeviceName(connection.id, this.presence, connection),
      })
      if (
        bridgeSettingsJson &&
        (input.agentType === 'codex' || input.agentType === 'claude') &&
        this.presence.isOnline(connection.id)
      ) {
        await this.bridgeService
          .updateBridgeSettings(input.agentType, connection.id, session.id, {
            reasoningEffort: pendingSettings?.reasoningEffort,
            modelId: pendingSettings?.modelId,
            modelName: pendingSettings?.modelName,
          })
          .catch(() => undefined)
      }
    }

    return { sessionId: session.id }
  }

  async runGlobalBridgeCommand(command: string): Promise<BridgeCommandResult> {
    const trimmed = command.trim()
    if (!trimmed) {
      throw new BadRequestException('command required')
    }

    if (trimmed.toLowerCase() === 'accounts') {
      const accounts = await this.bridgeService.loadAccounts({ onlineOnly: true })
      return {
        command: 'accounts',
        text: accounts.items.length > 0 ? `${accounts.items.length} 个在线助手` : '暂无在线助手',
        payload: {
          channel: accounts.channel,
          accountIds: accounts.accountIds,
          items: accounts.items,
        },
      }
    }

    throw new BadRequestException('不允许的 bridge 命令')
  }

  async runBridgeCommand(sessionId: string, command: string): Promise<BridgeCommandResult> {
    const session = this.resourceAccess.requireSession(sessionId)

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
    connectionId?: string,
  ): Promise<BridgeCommandResult> {
    if (!isAgentBridgeType(agentType)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }

    const normalizedConnectionId = connectionId?.trim() ?? ''
    const connection = normalizedConnectionId
      ? this.resourceAccess.requireConnection(normalizedConnectionId)
      : this.resourceAccess.resolvePrimaryConnection(agentType)
    if (!connection || connection.bridge_type !== agentType) {
      throw new NotFoundException('连接不存在')
    }
    if (!this.presence.isOnline(connection.id)) {
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
    assertAllowedBridgeCommand(trimmed)

    const input: ConnectorSendInput = {
      sessionId: sessionKey,
      text: trimmed,
      bridgeType: connection.bridge_type,
      accountId: connection.account_id,
      boundContextId: connection.bound_context_id,
      userId: this.ownerId(),
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

  private connectorFileToStreamAttachment(file: ConnectorFileInput): ChatMessageAttachmentDto {
    const name = file.name?.trim() || 'attachment'
    const mimeType = file.mimeType?.trim() || 'application/octet-stream'
    const previewUrl =
      file.base64 && mimeType.startsWith('image/')
        ? `data:${mimeType};base64,${file.base64}`
        : file.url
    return { name, mimeType, previewUrl }
  }

  private connectorFileToAttachment(file: ConnectorFileInput): ChatMessageAttachmentDto & { base64?: string } {
    return {
      ...this.connectorFileToStreamAttachment(file),
      base64: file.base64,
    }
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

  private isTempSession(session: ChatSessionRow): boolean {
    return Number(session.is_temp_session ?? 0) === 1
  }

  private async fetchBridgeHistoryPayload(
    session: ChatSessionRow,
    connection: BridgeConnectionRow,
    limit: number,
    options?: { useHistoryReload?: boolean },
  ): Promise<HistoryReloadPayload | null> {
    const agentSessionId = session.bridge_agent_session_id?.trim() ?? ''
    if (!agentSessionId) return null
    if (!this.presence.isOnline(connection.id)) return null

    const projectPath =
      session.bridge_project_path?.trim() ??
      connection.bridge_project_path?.trim() ??
      ''
    const command = options?.useHistoryReload
      ? buildHistoryReloadCommand({ limit, projectPath, agentSessionId })
      : buildHistoryCommand({
          limit,
          projectPath,
          agentSessionId,
          bridgeType: connection.bridge_type,
        })
    const { completed } = this.relay.forwardSlashCommand(
      (payload) => this.presence.sendJson(connection.id, payload),
      {
        sessionId: session.id,
        text: command,
        bridgeType: connection.bridge_type,
        accountId: connection.account_id,
        boundContextId: connection.bound_context_id,
        userId: this.ownerId(),
      },
      command,
      'history',
      BRIDGE_HISTORY_TIMEOUT_MS,
    )
    return await completed
  }

  private async maybeImportBridgeHistory(session: ChatSessionRow, limit: number): Promise<void> {
    const connection = session.bridge_connection_id
      ? this.database.getConnectionById(session.bridge_connection_id)
      : undefined
    if (!connection) return

    try {
      const payload = await this.fetchBridgeHistoryPayload(session, connection, limit)
      if (!payload) return
      importBridgeHistoryRounds(this.database, session.id, payload)
    } catch {
      // Non-critical: local SQLite remains source when import fails.
    }
  }

  private mapStoredMessage(row: ChatMessageRow): ChatMessageDto {
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      createdAt: row.create_time,
      attachments: this.parseStoredAttachments(row.attachments_json),
    }
  }

  private parseStoredAttachments(raw: string | null | undefined): ChatMessageAttachmentDto[] | undefined {
    if (!raw?.trim()) return undefined
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed) || parsed.length === 0) return undefined
      const attachments: ChatMessageAttachmentDto[] = []
      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue
        const record = item as Record<string, unknown>
        const name = typeof record.name === 'string' ? record.name.trim() : ''
        if (!name) continue
        const mimeType = typeof record.mimeType === 'string' ? record.mimeType.trim() : undefined
        const previewUrl =
          typeof record.previewUrl === 'string' ? record.previewUrl.trim() : undefined
        attachments.push({ name, mimeType, previewUrl })
      }
      return attachments.length > 0 ? attachments : undefined
    } catch {
      return undefined
    }
  }

  private maybeApplyTempSessionTitle(session: ChatSessionRow, userText: string): void {
    if (!this.isTempSession(session)) return
    if (!isTempSessionPlaceholderTitle(session.title, session.agent_type)) return

    const title = buildTempSessionTitle(userText)
    if (!title) return

    this.database.updateSessionTitle(session.id, title)
    session.title = title
  }
}
