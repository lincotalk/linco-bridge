import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService, type BridgeConnectionRow } from '../database/database.service'
import {
  type AgentBridgeType,
  agentDisplayName,
  agentBridgeSubtitle,
  isAgentBridgeType,
  resolveConnectionDisplayName,
} from '../shared/constants'
import {
  buildSessionsCommand,
  buildBindCommand,
  buildSelectProjectCommand,
  parseAgentPickerPayload,
  parseProfilePickerPayload,
  parseProjectsPayload,
  parseSessionsPayload,
  quoteBridgeCommandArg,
  type SessionsItemPayload,
} from './bridge.commands.util'
import { BridgePresenceService } from './bridge-presence.service'
import { BridgeRelayService, type ConnectorSendInput } from './bridge-relay.service'
import { toBridgeSetupDto } from './bridge-setup.dto'
import type { BridgeConnectionDetailDto } from './bridge-connection-detail.dto'
import { BRIDGE_CONNECT_CHANNEL } from './bridge.commands'
import { resolveConnectionDeviceName } from '../chat/session-list-title.util'
import { resolveAgentHistoryPreview } from '../chat/agent-history-list.util'
import { resolvePublicWsBaseUrl } from '../shared/public-endpoint.util'
import { ResourceAccessService } from '../shared/resource-access.service'
import {
  buildBridgeSettingsApplyCommand,
  parseBridgeSettingsOptionsPayload,
  type BridgeSessionSettingsDto,
  type BridgeSettingsOptionsDto,
} from './bridge-settings.util'
import type {
  BridgeWorkspaceSessionDto,
  WorkspaceApplyInputDto,
  WorkspaceApplyResultDto,
} from './bridge-workspace.dto'

export interface BindableContextDto {
  id: string
  label: string
  description?: string
  bindCommand?: string
  projectPath?: string
  agentSessionId?: string
}

export interface BridgeProjectDto {
  id: string
  name: string
  path: string
  selectCommand: string
  sessionsCommand: string
}

export interface BridgeAccountItemDto {
  connectionId: string
  agentType: AgentBridgeType
  accountId: string
  title: string
  description: string
  avatar: string
  status: 'online' | 'offline'
  deviceName?: string
  boundContextName?: string
  sessionId?: string
  lastMessage?: string
  updatedAt: number
}

export interface BridgeAccountsPayloadDto {
  channel: string
  accountIds: string[]
  items: BridgeAccountItemDto[]
  warning?: string
}

const BRIDGE_AVATAR: Record<AgentBridgeType, string> = {
  codex: '/static/icons/bot/bridge_codex.png',
  claude: '/static/icons/bot/bridge_claude.png',
  hermes: '/static/icons/bot/bridge_hermes.png',
  openclaw: '/static/icons/bot/bridge_claw.png',
}

const CONNECTOR_CONTEXT_TYPES = new Set<AgentBridgeType>(['codex', 'claude'])
const CONNECTOR_SELECTOR_TYPES = new Set<AgentBridgeType>(['openclaw', 'hermes'])
const ACCOUNTS_SLASH_COMMAND_TIMEOUT_MS = 10_000

@Injectable()
export class BridgeService {
  constructor(
    private readonly database: DatabaseService,
    private readonly presence: BridgePresenceService,
    private readonly relay: BridgeRelayService,
    private readonly resourceAccess: ResourceAccessService,
  ) {}

  getWsUrl(agentType?: string): string {
    const base = resolvePublicWsBaseUrl()
    return agentType?.trim() ? `${base}/${agentType.trim()}` : base
  }

  persistConnectionDeviceInfo(
    connectionId: string,
    device: { id?: string; name?: string },
    clientVersion?: string,
  ): void {
    this.presence.updateDeviceInfo(connectionId, device)
    this.database.updateConnectionDevice(connectionId, device)
    this.database.touchConnectionLastSeen(connectionId)
    if (clientVersion?.trim()) {
      this.database.updateConnectionClientVersion(connectionId, clientVersion)
    }
  }

  markConnectionOnline(connectionId: string): void {
    this.database.touchConnectionLastSeen(connectionId)
  }

  markConnectionOffline(connectionId: string): void {
    this.database.touchConnectionLastSeen(connectionId)
  }

  getSetup(type: string, connectionId?: string) {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    let connection = connectionId?.trim()
      ? this.resourceAccess.requireConnection(connectionId.trim())
      : this.resourceAccess.getOrCreatePrimaryConnection(type)
    if (connection.bridge_type !== type) {
      throw new NotFoundException('连接配置不存在')
    }
    if (
      !connection.bound_context_id &&
      DatabaseService.isDemoPlaceholderSecret(connection.bridge_type, connection.app_secret)
    ) {
      const refreshed = this.database.refreshConnectionSecret(connection.id)
      if (refreshed) {
        connection = refreshed
      }
    }
    return toBridgeSetupDto(
      {
        bridgeType: connection.bridge_type,
        connectionId: connection.id,
        appId: connection.app_id,
        appSecret: connection.app_secret,
        accountId: connection.account_id,
        boundContextId: connection.bound_context_id,
      },
      this.getWsUrl(type),
    )
  }

  refreshSetup(type: string, connectionId: string) {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const connection = this.resourceAccess.requireConnection(connectionId)
    if (connection.bridge_type !== type) {
      throw new NotFoundException('连接配置不存在')
    }
    const created = this.database.refreshConnectionCredentials(
      connectionId,
      this.resourceAccess.getOwnerId(),
      type,
    )
    return toBridgeSetupDto(
      {
        bridgeType: created.bridge_type,
        connectionId: created.id,
        appId: created.app_id,
        appSecret: created.app_secret,
        accountId: created.account_id,
        boundContextId: created.bound_context_id,
      },
      this.getWsUrl(created.bridge_type),
    )
  }

  getStatus(type: string, connectionId?: string) {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const connection = connectionId?.trim()
      ? this.resourceAccess.requireConnection(connectionId.trim())
      : this.resourceAccess.resolvePrimaryConnection(type)
    if (!connection || connection.bridge_type !== type) {
      return {
        connected: false,
        bridgeType: type,
      }
    }
    return {
      connected: this.presence.isOnline(connection.id),
      bridgeType: type,
      accountId: connection.account_id,
      connectionId: connection.id,
      deviceName:
        resolveConnectionDeviceName(connection.id, this.presence, connection) || undefined,
      boundContextName: connection.bound_context_name?.trim() || undefined,
      boundContextId: connection.bound_context_id?.trim() || undefined,
    }
  }

  getConnectionDetail(type: string, connectionId?: string): BridgeConnectionDetailDto {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const connection = this.lookupConnection(type, connectionId)
    const setup = toBridgeSetupDto(
      {
        bridgeType: connection.bridge_type,
        connectionId: connection.id,
        appId: connection.app_id,
        appSecret: connection.app_secret,
        accountId: connection.account_id,
        boundContextId: connection.bound_context_id,
      },
      this.getWsUrl(connection.bridge_type),
    )
    const online = this.presence.isOnline(connection.id)
    const deviceName =
      resolveConnectionDeviceName(connection.id, this.presence, connection) || undefined

    return {
      bridgeType: connection.bridge_type,
      connectionId: connection.id,
      displayName: resolveConnectionDisplayName(connection),
      description: agentBridgeSubtitle(connection.bridge_type),
      avatar: BRIDGE_AVATAR[connection.bridge_type],
      appId: connection.app_id,
      appSecret: '',
      secretMasked: true,
      accountId: connection.account_id,
      status: online ? 'online' : 'offline',
      deviceName,
      lastSeenAt: online ? Date.now() : connection.last_seen_at ?? undefined,
      clientVersion: connection.client_version?.trim() || undefined,
      setupCommands: '',
      connectChannel: setup.connectChannel,
    }
  }

  async fetchAccountsFromConnector(): Promise<Record<string, unknown>> {
    const ownerId = this.resourceAccess.getOwnerId()
    const connection = this.database
      .listConnectionsByOwner(ownerId)
      .find((row) => this.presence.isOnline(row.id))
    if (!connection) {
      throw new ConflictException('本机 Agent 未连接')
    }

    const sessionKey = connection.session_id ?? `landing-${connection.bridge_type}`
    const { completed } = this.relay.forwardSlashCommand(
      (payload) => this.presence.sendJson(connection.id, payload),
      this.connectorInput(connection, sessionKey),
      `/accounts --channel ${BRIDGE_CONNECT_CHANNEL}`,
      'accounts',
      ACCOUNTS_SLASH_COMMAND_TIMEOUT_MS,
    )
    try {
      const data = await completed
      return data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error
      }
      throw new ConflictException('读取本机 Agent 配置失败，请确认 linco-connect 在线')
    }
  }

  enrichAccountsPayload(pluginPayload: Record<string, unknown>): BridgeAccountsPayloadDto {
    const channel =
      String(pluginPayload.channel ?? BRIDGE_CONNECT_CHANNEL).trim() || BRIDGE_CONNECT_CHANNEL
    const accountIds = Array.isArray(pluginPayload.accountIds)
      ? pluginPayload.accountIds
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean)
      : []
    const ownerId = this.resourceAccess.getOwnerId()
    const items: BridgeAccountItemDto[] = []
    const unmatchedAccountIds: string[] = []

    for (const accountId of accountIds) {
      const connection = this.database.getConnectionByAccountId(ownerId, accountId)
      if (!connection) {
        unmatchedAccountIds.push(accountId)
        continue
      }

      const session = connection.session_id
        ? this.database.getSession(connection.session_id)
        : undefined
      const lastAssistant = session
        ? this.database.getLastAssistantMessage(session.id)
        : undefined
      const preview = session
        ? resolveAgentHistoryPreview(session, lastAssistant?.content)
        : ''
      const deviceName = resolveConnectionDeviceName(connection.id, this.presence, connection)
      const online = this.presence.isOnline(connection.id)

      items.push({
        connectionId: connection.id,
        agentType: connection.bridge_type,
        accountId: connection.account_id,
        title: resolveConnectionDisplayName(connection),
        description: agentBridgeSubtitle(connection.bridge_type),
        avatar: BRIDGE_AVATAR[connection.bridge_type],
        status: online ? 'online' : 'offline',
        deviceName: deviceName || undefined,
        boundContextName: connection.bound_context_name?.trim() || undefined,
        sessionId: connection.session_id ?? undefined,
        lastMessage:
          preview && preview !== '暂无消息'
            ? preview
            : session?.last_message?.trim() || undefined,
        updatedAt: session?.update_time ?? connection.update_time ?? connection.create_time,
      })
    }

    const warning =
      unmatchedAccountIds.length > 0
        ? `以下账号未在平台找到连接记录：${unmatchedAccountIds.join(', ')}`
        : undefined

    return {
      channel,
      accountIds,
      items,
      warning,
    }
  }

  renameConnection(type: string, connectionId: string, displayName: string): BridgeConnectionDetailDto {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const normalizedId = connectionId.trim()
    const normalizedName = displayName.trim()
    if (!normalizedId) {
      throw new NotFoundException('connectionId 不能为空')
    }
    if (!normalizedName) {
      throw new NotFoundException('名称不能为空')
    }
    const connection = this.resourceAccess.requireConnection(normalizedId)
    if (connection.bridge_type !== type) {
      throw new NotFoundException('连接配置不存在')
    }
    this.database.updateConnectionDisplayName(normalizedId, normalizedName)
    return this.getConnectionDetail(type, normalizedId)
  }

  deleteConnection(type: string, connectionId: string): {
    deleted: boolean
    commandSent: boolean
    connectionId: string
  } {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const normalizedId = connectionId.trim()
    if (!normalizedId) {
      throw new NotFoundException('connectionId 不能为空')
    }
    const connection = this.resourceAccess.requireConnection(normalizedId)
    if (connection.bridge_type !== type) {
      throw new NotFoundException('连接配置不存在')
    }

    let commandSent = false
    if (this.presence.isOnline(connection.id)) {
      const sessionId =
        connection.session_id ??
        this.database.getSessionByConnectionId(connection.id)?.id ??
        `delete:${connection.id}`
      const removeCommand = `/remove-account --agent ${type} --account ${connection.account_id}`
      commandSent = this.presence.sendJson(connection.id, {
        type: 'inbound_message',
        to: type,
        accountId: connection.account_id,
        agentId: connection.bound_context_id ?? 'main',
        channel: BRIDGE_CONNECT_CHANNEL,
        chatType: 'direct',
        userId: this.resourceAccess.getOwnerId(),
        messageId: `remove_account_${connection.id}_${Date.now()}`,
        streamId: `linco-remove-account-${connection.id}-${Date.now()}`,
        sessionKey: sessionId,
        text: removeCommand,
        files: [],
      })
      this.presence.disconnect(connection.id, 'Connection deleted')
    }

    const deleted = this.database.deleteBridgeConnectionPermanently(normalizedId)
    return {
      deleted,
      commandSent,
      connectionId: normalizedId,
    }
  }

  async listContexts(type: string, connectionId?: string): Promise<BindableContextDto[]> {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const connection = this.resolveOwnedConnection(type, connectionId)
    if (!this.presence.isOnline(connection.id)) {
      throw new ConflictException('本机 Agent 尚未连接')
    }

    if (!CONNECTOR_CONTEXT_TYPES.has(type) && !CONNECTOR_SELECTOR_TYPES.has(type)) {
      throw new ConflictException('当前 Agent 不支持绑定上下文')
    }

    if (CONNECTOR_SELECTOR_TYPES.has(type)) {
      return this.fetchSelectorContextsFromConnector(connection, type)
    }

    return this.fetchContextsFromConnector(connection)
  }

  async listProjects(type: string, connectionId?: string): Promise<BridgeProjectDto[]> {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const connection = this.resolveConnection(type, connectionId)
    if (!CONNECTOR_CONTEXT_TYPES.has(type)) {
      return []
    }
    return this.fetchProjectsFromConnector(connection)
  }

  async listProjectSessions(
    type: string,
    connectionId: string | undefined,
    projectPath: string,
    limit = 10,
  ): Promise<BridgeWorkspaceSessionDto[]> {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const normalizedPath = projectPath.trim()
    if (!normalizedPath) {
      throw new NotFoundException('projectPath 不能为空')
    }
    const connection = this.resolveConnection(type, connectionId)
    if (!CONNECTOR_CONTEXT_TYPES.has(type)) {
      return []
    }
    return this.fetchProjectSessionsFromConnector(connection, normalizedPath, limit)
  }

  async listChats(
    type: string,
    connectionId?: string,
    limit = 10,
  ): Promise<BridgeWorkspaceSessionDto[]> {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const connection = this.resolveConnection(type, connectionId)
    if (type !== 'codex') {
      return []
    }
    return this.fetchChatsAsWorkspaceSessions(connection, limit)
  }

  async applyWorkspaceSelection(
    type: string,
    connectionId: string | undefined,
    raw: WorkspaceApplyInputDto,
  ): Promise<WorkspaceApplyResultDto> {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const connection = this.resolveConnection(type, connectionId)
    const projectPath = (raw.projectPath ?? raw.project_path)?.trim() ?? ''
    const projectName = (raw.projectName ?? raw.project_name)?.trim() ?? ''
    const agentSessionId = (raw.agentSessionId ?? raw.agent_session_id)?.trim() ?? ''
    const sessionTitle = (raw.sessionTitle ?? raw.session_title)?.trim() ?? ''
    const platformSessionIdInput = (raw.platformSessionId ?? raw.platform_session_id)?.trim() ?? ''

    const selectProjectCommand = projectPath ? buildSelectProjectCommand(projectPath) : ''
    const bindCommand = agentSessionId
      ? buildBindCommand({ projectPath: projectPath || null, agentSessionId })
      : ''

    const connectorSessionId = this.ensureConnectorSessionId(connection, type)

    let sessionId = connectorSessionId
    if (platformSessionIdInput) {
      sessionId = this.resourceAccess.requireSession(platformSessionIdInput).id
    }

    // + 新建项目会话：先解析/创建平台 session，再向同一 session relay select（对齐 Flutter conversationId）
    if (selectProjectCommand && !bindCommand && projectPath) {
      const preferredId = platformSessionIdInput
        ? this.resourceAccess.requireSession(platformSessionIdInput).id
        : ''
      sessionId = this.resolvePlatformSessionForProjectOnly(connection, type, {
        preferredSessionId: preferredId,
        projectPath,
        sessionTitle: sessionTitle || projectName || agentDisplayName(type),
      })

      await this.relay.forwardLocalCommand(
        (payload) => this.presence.sendJson(connection.id, payload),
        this.connectorInput(connection, sessionId),
        selectProjectCommand,
      ).completed

      if (projectPath) {
        this.database.updateConnectionWorkspace(connection.id, projectPath)
      }

      const title = sessionTitle || projectName || agentDisplayName(type)
      this.database.bindConnectionContext(connection.id, {
        contextId: projectPath || sessionId,
        contextName: title,
        sessionId,
        projectPath,
        agentSessionId: null,
      })
      this.database.updateSessionBridgeBinding(sessionId, {
        projectPath,
        agentSessionId: null,
        deviceName: resolveConnectionDeviceName(connection.id, this.presence, connection),
      })
      this.database.updateSessionTitle(sessionId, title)
      this.database.touchSession(sessionId, 'Ready when you are.')
      this.database.linkConnectionSession(connection.id, sessionId)

      return {
        sessionId,
        title,
        projectPath,
        projectName: projectName || projectPath,
      }
    }

    if (bindCommand) {
      sessionId = this.resolvePlatformSessionForBinding(connection, type, {
        preferredSessionId: sessionId,
        projectPath,
        agentSessionId,
        sessionTitle:
          sessionTitle ||
          projectName ||
          agentSessionId ||
          agentDisplayName(type),
      })

      if (selectProjectCommand) {
        await this.relay.forwardLocalCommand(
          (payload) => this.presence.sendJson(connection.id, payload),
          this.connectorInput(connection, sessionId),
          selectProjectCommand,
        ).completed
        if (projectPath) {
          this.database.updateConnectionWorkspace(connection.id, projectPath)
        }
      } else if (projectPath) {
        await this.selectProject(type, connection.id, projectPath)
      }

      await this.relay.forwardLocalCommand(
        (payload) => this.presence.sendJson(connection.id, payload),
        this.connectorInput(connection, sessionId),
        bindCommand,
      ).completed

      const title =
        sessionTitle ||
        projectName ||
        agentSessionId ||
        agentDisplayName(type)
      const contextId = agentSessionId || projectPath || sessionId

      this.database.bindConnectionContext(connection.id, {
        contextId,
        contextName: title,
        sessionId,
        projectPath: projectPath || null,
        agentSessionId: agentSessionId || null,
      })
      this.database.updateSessionBridgeBinding(sessionId, {
        projectPath: projectPath || null,
        agentSessionId: agentSessionId || null,
        deviceName: resolveConnectionDeviceName(connection.id, this.presence, connection),
      })
      this.database.updateSessionTitle(sessionId, title)
      this.database.touchSession(sessionId, 'Ready when you are.')
      this.database.linkConnectionSession(connection.id, sessionId)

      return {
        sessionId,
        title,
        projectPath,
        projectName: projectName || projectPath,
        agentSessionId: agentSessionId || undefined,
      }
    }

    const fallbackTitle = projectName || projectPath || agentDisplayName(type)
    if (selectProjectCommand) {
      await this.relay.forwardLocalCommand(
        (payload) => this.presence.sendJson(connection.id, payload),
        this.connectorInput(connection, sessionId),
        selectProjectCommand,
      ).completed
      if (projectPath) {
        this.database.updateConnectionWorkspace(connection.id, projectPath)
      }
    } else if (projectPath) {
      await this.selectProject(type, connection.id, projectPath)
    }

    return {
      sessionId,
      title: fallbackTitle,
      projectPath,
      projectName: projectName || projectPath,
      agentSessionId: agentSessionId || undefined,
    }
  }

  async selectProject(
    type: string,
    connectionId: string | undefined,
    projectPath: string,
  ): Promise<{ projectPath: string; projectName: string }> {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const normalizedPath = projectPath.trim()
    if (!normalizedPath) {
      throw new NotFoundException('项目路径不能为空')
    }
    const connection = this.resolveConnection(type, connectionId)
    if (!CONNECTOR_CONTEXT_TYPES.has(type)) {
      throw new ConflictException('当前 Agent 不支持项目选择')
    }

    const platformSessionId = this.resolvePlatformSessionId(connection)
    const selectCommand = `/project --select ${quoteBridgeCommandArg(normalizedPath)}`
    await this.relay.forwardLocalCommand(
      (payload) => this.presence.sendJson(connection.id, payload),
      this.connectorInput(connection, platformSessionId),
      selectCommand,
    ).completed

    this.database.updateConnectionWorkspace(connection.id, normalizedPath)

    const projects = await this.fetchProjectsFromConnector(connection).catch(() => [])
    const matched = projects.find((item) => item.path === normalizedPath)

    return {
      projectPath: normalizedPath,
      projectName: matched?.name ?? normalizedPath,
    }
  }

  async bindContext(type: string, connectionId: string | undefined, contextId: string) {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const connection = this.resolveOwnedConnection(type, connectionId)
    if (!this.presence.isOnline(connection.id)) {
      throw new ConflictException('本机 Agent 尚未连接')
    }

    const boundContextId = connection.bound_context_id?.trim() ?? ''
    if (CONNECTOR_SELECTOR_TYPES.has(type) && boundContextId) {
      if (boundContextId !== contextId.trim()) {
        throw new ConflictException(
          'Hermes / OpenClaw 每个 appSecret 仅绑定一个 Profile，不支持切换',
        )
      }
      const sessionId =
        connection.session_id && this.database.getSession(connection.session_id)
          ? connection.session_id
          : this.database.getSessionByConnectionId(connection.id)?.id
      if (sessionId) {
        return {
          bridgeType: type,
          connectionId: connection.id,
          contextId: boundContextId,
          contextName: connection.bound_context_name?.trim() || boundContextId,
          sessionId,
          agentName: agentDisplayName(type),
        }
      }
    }

    const platformSessionId = this.ensureConnectorSessionId(connection, type)
    let selected: BindableContextDto | undefined

    if (CONNECTOR_SELECTOR_TYPES.has(type)) {
      const contexts = await this.fetchSelectorContextsFromConnector(connection, type)
      selected = contexts.find((item) => item.id === contextId)
      if (!selected?.bindCommand) {
        throw new NotFoundException('上下文不存在')
      }

      await this.relay.forwardLocalCommand(
        (payload) => this.presence.sendJson(connection.id, payload),
        this.connectorInput(connection, platformSessionId),
        selected.bindCommand,
      ).completed
    } else if (CONNECTOR_CONTEXT_TYPES.has(type)) {
      const contexts = await this.fetchContextsFromConnector(connection)
      selected = contexts.find((item) => item.id === contextId)
      if (!selected?.bindCommand) {
        throw new NotFoundException('上下文不存在')
      }

      await this.relay.forwardLocalCommand(
        (payload) => this.presence.sendJson(connection.id, payload),
        this.connectorInput(connection, platformSessionId),
        selected.bindCommand,
      ).completed
    } else {
      throw new ConflictException('当前 Agent 不支持绑定上下文')
    }

    const sessionId =
      connection.session_id && this.database.getSession(connection.session_id)
        ? connection.session_id
        : this.database.getSessionByConnectionId(connection.id)?.id ??
          this.database.createSession({
            ownerId: connection.owner_id,
            agentType: type,
            title: selected.label,
            bridgeConnectionId: connection.id,
          }).id

    this.database.bindConnectionContext(connection.id, {
      contextId: selected.id,
      contextName: selected.label,
      sessionId,
      projectPath: selected.projectPath ?? null,
      agentSessionId: selected.agentSessionId ?? selected.id,
    })

    return {
      bridgeType: type,
      connectionId: connection.id,
      contextId: selected.id,
      contextName: selected.label,
      sessionId,
      agentName: agentDisplayName(type),
    }
  }

  async loadSettingsOptions(
    type: string,
    connectionId?: string,
    sessionId?: string,
  ): Promise<BridgeSettingsOptionsDto> {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    if (type !== 'codex' && type !== 'claude') {
      throw new ConflictException('当前 Agent 不支持模型与推理设置')
    }

    const connection = this.resolveConnection(type, connectionId)
    const platformSessionId = sessionId?.trim()
      ? this.ensureSettingsSessionId(connection, type, sessionId.trim())
      : this.ensureConnectorSessionId(connection, type)

    const payload = await this.fetchSettingsOptionsFromConnector(connection, platformSessionId)
    return parseBridgeSettingsOptionsPayload(payload)
  }

  async updateBridgeSettings(
    type: string,
    connectionId: string | undefined,
    sessionId: string,
    input: {
      reasoningEffort?: string
      modelId?: string
      modelName?: string
    },
  ): Promise<BridgeSessionSettingsDto> {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    if (type !== 'codex' && type !== 'claude') {
      throw new ConflictException('当前 Agent 不支持模型与推理设置')
    }

    const reasoningEffort = input.reasoningEffort?.trim() ?? ''
    const modelId = input.modelId?.trim() ?? ''
    const modelName = input.modelName?.trim() ?? ''
    if (!reasoningEffort && !modelId) {
      throw new ConflictException('至少需要更新一项 Bridge 设置')
    }

    const session = this.database.getSession(sessionId)
    if (!session || session.agent_type !== type) {
      throw new NotFoundException('会话不存在')
    }

    const connection = this.resolveConnection(type, connectionId)
    const command = buildBridgeSettingsApplyCommand({ reasoningEffort, modelId })
    await this.relay.forwardSlashCommand(
      (payload) => this.presence.sendJson(connection.id, payload),
      this.connectorInput(connection, sessionId),
      command,
      'getModelsAndReasons',
    ).completed

    const next: BridgeSessionSettingsDto = {
      ...(reasoningEffort ? { reasoningEffort } : {}),
      ...(modelId ? { modelId } : {}),
      ...(modelName || modelId ? { modelName: modelName || modelId } : {}),
      updatedAt: Date.now(),
    }
    this.database.updateSessionBridgeSettings(sessionId, JSON.stringify(next))
    return next
  }

  syncAgent(type: string, connectionId?: string) {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const connection = this.resolveOwnedConnection(type, connectionId)
    if (!this.presence.isOnline(connection.id)) {
      throw new ConflictException('本机 Agent 尚未连接')
    }

    const session = this.database.getSessionByConnectionId(connection.id)
    if (!session) {
      throw new NotFoundException('会话不存在')
    }

    if (!connection.session_id) {
      this.database.linkConnectionSession(connection.id, session.id)
    }

    if (type === 'codex' || type === 'claude') {
      this.database.touchSession(session.id, 'Ready when you are.')
    }

    return {
      bridgeType: type,
      connectionId: connection.id,
      sessionId: session.id,
      agentName: agentDisplayName(type),
    }
  }

  authenticateToken(token: string) {
    const trimmed = token.trim()
    const separator = trimmed.indexOf(':')
    if (separator <= 0) return null
    const appId = trimmed.slice(0, separator)
    const appSecret = trimmed.slice(separator + 1)
    if (!appId || !appSecret) return null
    return this.database.getConnectionByToken(appId, appSecret) ?? null
  }

  private async fetchProjectsFromConnector(connection: BridgeConnectionRow): Promise<BridgeProjectDto[]> {
    const platformSessionId = this.ensureConnectorSessionId(connection, connection.bridge_type)
    const { completed } = this.relay.forwardSlashCommand(
      (payload) => this.presence.sendJson(connection.id, payload),
      this.connectorInput(connection, platformSessionId),
      '/project',
      'project',
    )
    const payload = parseProjectsPayload(await completed)
    const items = Array.isArray(payload?.items) ? payload.items : []

    return items
      .filter((item) => typeof item.path === 'string' && item.path.trim())
      .map((item) => {
        const path = item.path!.trim()
        const name = (item.label || item.name || path).trim()
        return {
          id: path,
          name,
          path,
          selectCommand:
            item.command?.trim() || `/project --select ${quoteBridgeCommandArg(path)}`,
          sessionsCommand: buildSessionsCommand(path, 10),
        }
      })
  }

  private async fetchProjectSessionsFromConnector(
    connection: BridgeConnectionRow,
    projectPath: string,
    limit: number,
  ): Promise<BridgeWorkspaceSessionDto[]> {
    const platformSessionId = this.ensureConnectorSessionId(connection, connection.bridge_type)
    const command = buildSessionsCommand(projectPath, limit)
    const { completed } = this.relay.forwardSlashCommand(
      (payload) => this.presence.sendJson(connection.id, payload),
      this.connectorInput(connection, platformSessionId),
      command,
      'sessions',
    )
    const payload = parseSessionsPayload(await completed)
    const items = Array.isArray(payload?.items) ? payload.items : []
    return this.mapWorkspaceSessions(items, projectPath)
  }

  private async fetchChatsAsWorkspaceSessions(
    connection: BridgeConnectionRow,
    limit: number,
  ): Promise<BridgeWorkspaceSessionDto[]> {
    const platformSessionId = this.ensureConnectorSessionId(connection, connection.bridge_type)
    const { completed } = this.relay.forwardSlashCommand(
      (payload) => this.presence.sendJson(connection.id, payload),
      this.connectorInput(connection, platformSessionId),
      `/chats ${limit}`,
      'chats',
    )
    const payload = parseSessionsPayload(await completed)
    const items = Array.isArray(payload?.items) ? payload.items : []
    return items
      .filter((item) => typeof item.id === 'string' && item.id.trim())
      .map((item) => {
        const id = item.id!.trim()
        const title = (item.title || item.firstMessage || id).trim()
        const workspace = typeof item.workspace === 'string' ? item.workspace.trim() : ''
        return {
          id,
          title,
          bindCommand:
            typeof item.bindCommand === 'string'
              ? item.bindCommand.trim()
              : `/bind --chat ${quoteBridgeCommandArg(id)}`,
          historyCommand: workspace ? undefined : undefined,
        }
      })
  }

  private mapWorkspaceSessions(
    items: SessionsItemPayload[],
    workspace: string,
  ): BridgeWorkspaceSessionDto[] {
    return items
      .filter((item) => typeof item.id === 'string' && item.id.trim())
      .map((item) => {
        const id = item.id!.trim()
        const title = (item.title || item.firstMessage || id).trim()
        const bindCommand =
          item.bindCommand?.trim() ||
          (workspace
            ? `/bind --project ${quoteBridgeCommandArg(workspace)} ${quoteBridgeCommandArg(id)}`
            : `/bind --chat ${quoteBridgeCommandArg(id)}`)
        return {
          id,
          title,
          bindCommand,
        }
      })
  }

  private async fetchContextsFromConnector(connection: BridgeConnectionRow): Promise<BindableContextDto[]> {
    const sessions = await this.fetchSessionsFromConnector(connection)
    if (sessions.length > 0 || connection.bridge_type !== 'codex') {
      return sessions
    }
    return this.fetchChatsFromConnector(connection)
  }

  private async fetchSessionsFromConnector(connection: BridgeConnectionRow): Promise<BindableContextDto[]> {
    const platformSessionId = this.ensureConnectorSessionId(connection, connection.bridge_type)
    const sessionsCommand = buildSessionsCommand(connection.bridge_project_path, 10)
    const { completed } = this.relay.forwardSlashCommand(
      (payload) => this.presence.sendJson(connection.id, payload),
      this.connectorInput(connection, platformSessionId),
      sessionsCommand,
      'sessions',
    )
    const payload = parseSessionsPayload(await completed)
    const workspace =
      connection.bridge_project_path?.trim() || payload?.workspace?.trim() || ''
    const items = Array.isArray(payload?.items) ? payload.items : []

    return items
      .filter((item) => typeof item.id === 'string' && item.id.trim())
      .map((item) => {
        const id = item.id!.trim()
        const label = (item.title || item.firstMessage || id).trim()
        return {
          id,
          label,
          description: workspace || undefined,
          bindCommand: item.bindCommand?.trim() || undefined,
          projectPath: workspace || undefined,
          agentSessionId: id,
        }
      })
  }

  private async fetchChatsFromConnector(connection: BridgeConnectionRow): Promise<BindableContextDto[]> {
    const platformSessionId = this.ensureConnectorSessionId(connection, connection.bridge_type)
    const { completed } = this.relay.forwardSlashCommand(
      (payload) => this.presence.sendJson(connection.id, payload),
      this.connectorInput(connection, platformSessionId),
      '/chats 10',
      'chats',
    )
    const payload = parseSessionsPayload(await completed)
    const items = Array.isArray(payload?.items) ? payload.items : []

    return items
      .filter((item) => typeof item.id === 'string' && item.id.trim())
      .map((item) => {
        const id = item.id!.trim()
        const label = (item.title || item.firstMessage || id).trim()
        const workspace = typeof item.workspace === 'string' ? item.workspace.trim() : ''
        return {
          id,
          label,
          description: workspace ? `Codex chat · ${workspace}` : 'Codex chat',
          bindCommand:
            typeof item.bindCommand === 'string'
              ? item.bindCommand.trim()
              : `/bind --chat ${quoteBridgeCommandArg(id)}`,
          projectPath: workspace || undefined,
          agentSessionId: id,
        }
      })
  }

  private async fetchSelectorContextsFromConnector(
    connection: BridgeConnectionRow,
    type: AgentBridgeType,
  ): Promise<BindableContextDto[]> {
    const platformSessionId = this.ensureConnectorSessionId(connection, type)
    const command = type === 'openclaw' ? '/agent' : '/profile'
    const expectedCommand = type === 'openclaw' ? 'agent' : 'profile'
    const { completed } = this.relay.forwardSlashCommand(
      (payload) => this.presence.sendJson(connection.id, payload),
      this.connectorInput(connection, platformSessionId),
      command,
      expectedCommand,
    )
    const payload = await completed

    if (type === 'openclaw') {
      const parsed = parseAgentPickerPayload(payload)
      const items = Array.isArray(parsed?.items) ? parsed.items : []
      return items
        .filter((item) => typeof item.id === 'string' && item.id.trim())
        .map((item) => {
          const id = item.id!.trim()
          const label = (item.name || id).trim()
          const description = [item.model, item.workspace].filter(Boolean).join(' · ') || undefined
          return {
            id,
            label,
            description,
            bindCommand:
              item.bindCommand?.trim() ||
              item.command?.trim() ||
              `/agent --bind ${quoteBridgeCommandArg(id)}`,
            agentSessionId: id,
          }
        })
    }

    const parsed = parseProfilePickerPayload(payload)
    const items = Array.isArray(parsed?.items) ? parsed.items : []
    return items
      .filter((item) => typeof item.name === 'string' && item.name.trim())
      .map((item) => {
        const name = item.name!.trim()
        return {
          id: name,
          label: name,
          description: 'Hermes profile',
          bindCommand:
            item.bindCommand?.trim() ||
            item.command?.trim() ||
            `/profile --bind ${quoteBridgeCommandArg(name)}`,
          agentSessionId: name,
        }
      })
  }

  private async fetchSettingsOptionsFromConnector(
    connection: BridgeConnectionRow,
    platformSessionId: string,
  ): Promise<Record<string, unknown>> {
    const { completed } = this.relay.forwardSlashCommand(
      (payload) => this.presence.sendJson(connection.id, payload),
      this.connectorInput(connection, platformSessionId),
      '/settings',
      'getModelsAndReasons',
    )
    const payload = await completed
    return payload as Record<string, unknown>
  }

  private ensureSettingsSessionId(
    connection: BridgeConnectionRow,
    agentType: AgentBridgeType,
    sessionId: string,
  ): string {
    const session = this.database.getSession(sessionId)
    if (!session || session.agent_type !== agentType) {
      return this.ensureConnectorSessionId(connection, agentType)
    }
    return sessionId
  }

  private lookupConnection(type: AgentBridgeType, connectionId?: string): BridgeConnectionRow {
    const connection = connectionId?.trim()
      ? this.resourceAccess.requireConnection(connectionId.trim())
      : this.resourceAccess.resolvePrimaryConnection(type)
    if (!connection || connection.bridge_type !== type) {
      throw new NotFoundException('连接配置不存在')
    }
    return connection
  }

  private resolveOwnedConnection(
    type: AgentBridgeType,
    connectionId?: string,
  ): BridgeConnectionRow {
    const connection = connectionId?.trim()
      ? this.resourceAccess.requireConnection(connectionId.trim())
      : this.resourceAccess.resolvePrimaryConnection(type)
    if (!connection || connection.bridge_type !== type) {
      throw new NotFoundException('连接配置不存在')
    }
    return connection
  }

  private resolveConnection(type: AgentBridgeType, connectionId?: string): BridgeConnectionRow {
    const connection = this.lookupConnection(type, connectionId)
    if (!this.presence.isOnline(connection.id)) {
      throw new ConflictException('本机 Agent 尚未连接')
    }
    return connection
  }

  private resolvePlatformSessionForProjectOnly(
    connection: BridgeConnectionRow,
    agentType: AgentBridgeType,
    input: {
      preferredSessionId: string
      projectPath: string
      sessionTitle: string
    },
  ): string {
    const projectPath = input.projectPath.trim()
    const preferredSessionId = input.preferredSessionId.trim()

    if (preferredSessionId) {
      const preferred = this.database.getSession(preferredSessionId)
      if (preferred) {
        const boundProjectPath = preferred.bridge_project_path?.trim() ?? ''
        const boundAgentSessionId = preferred.bridge_agent_session_id?.trim() ?? ''
        if (!boundAgentSessionId && boundProjectPath === projectPath) {
          return preferred.id
        }
      }
    }

    const existing = this.database.findSessionByProjectOnlyBinding(connection.id, projectPath)
    if (existing) return existing.id

    const session = this.database.createSession({
      ownerId: connection.owner_id,
      agentType,
      title: input.sessionTitle.trim() || agentDisplayName(agentType),
      bridgeConnectionId: connection.id,
      bridgeProjectPath: projectPath,
      bridgeAgentSessionId: null,
      lastMessage: 'Ready when you are.',
    })
    return session.id
  }

  private resolvePlatformSessionForBinding(
    connection: BridgeConnectionRow,
    agentType: AgentBridgeType,
    input: {
      preferredSessionId: string
      projectPath: string
      agentSessionId: string
      sessionTitle: string
    },
  ): string {
    const projectPath = input.projectPath.trim()
    const agentSessionId = input.agentSessionId.trim()
    const preferredSessionId = input.preferredSessionId.trim()

    if (agentSessionId) {
      const existing = this.database.findSessionByBridgeBinding(
        connection.id,
        projectPath,
        agentSessionId,
      )
      if (existing) return existing.id
    }

    const preferred = preferredSessionId
      ? this.database.getSession(preferredSessionId)
      : undefined
    if (preferred) {
      const boundProjectPath = preferred.bridge_project_path?.trim() ?? ''
      const boundAgentSessionId = preferred.bridge_agent_session_id?.trim() ?? ''
      const unbound = !boundAgentSessionId && !boundProjectPath
      const sameBinding =
        boundAgentSessionId === agentSessionId && boundProjectPath === projectPath
      if (sameBinding || (unbound && agentSessionId)) {
        return preferred.id
      }
    }

    if (!agentSessionId) {
      return preferred?.id ?? preferredSessionId
    }

    const session = this.database.createSession({
      ownerId: connection.owner_id,
      agentType,
      title: input.sessionTitle.trim() || agentDisplayName(agentType),
      bridgeConnectionId: connection.id,
      bridgeProjectPath: projectPath || null,
      bridgeAgentSessionId: agentSessionId,
      lastMessage: 'Ready when you are.',
    })
    return session.id
  }

  private ensureConnectorSessionId(
    connection: BridgeConnectionRow,
    agentType: AgentBridgeType,
  ): string {
    const linked =
      connection.session_id && this.database.getSession(connection.session_id)
        ? connection.session_id
        : null
    const seeded = this.database.getSessionByConnectionId(connection.id)?.id ?? null
    const existing = linked ?? seeded
    if (existing) return existing

    const session = this.database.createSession({
      ownerId: connection.owner_id,
      agentType,
      title: agentDisplayName(agentType),
      bridgeConnectionId: connection.id,
    })
    this.database.linkConnectionSession(connection.id, session.id)
    return session.id
  }

  private resolvePlatformSessionId(connection: BridgeConnectionRow): string {
    const linked =
      connection.session_id && this.database.getSession(connection.session_id)
        ? connection.session_id
        : null
    const seeded = this.database.getSessionByConnectionId(connection.id)?.id ?? null
    const sessionId = linked ?? seeded
    if (!sessionId) {
      throw new ConflictException('请先创建或同步 IM 会话后再绑定上下文')
    }
    return sessionId
  }

  private connectorInput(connection: BridgeConnectionRow, sessionId: string): ConnectorSendInput {
    return {
      sessionId,
      text: '',
      bridgeType: connection.bridge_type,
      accountId: connection.account_id,
      boundContextId: connection.bound_context_id,
      userId: this.resourceAccess.getOwnerId(),
    }
  }
}
