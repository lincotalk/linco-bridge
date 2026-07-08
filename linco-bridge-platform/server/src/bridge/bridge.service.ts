import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { DatabaseService, type BridgeConnectionRow } from '../database/database.service'
import { type AgentBridgeType, agentDisplayName, isAgentBridgeType } from '../shared/constants'
import {
  buildSessionsCommand,
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
import { resolveConnectionDeviceName } from '../chat/session-list-title.util'
import {
  buildBridgeSettingsApplyCommand,
  DEMO_BRIDGE_SETTINGS_OPTIONS,
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

const DEFAULT_CONTEXTS: Record<AgentBridgeType, BindableContextDto[]> = {
  codex: [{ id: 'project-1', label: 'demo-project', description: 'Codex workspace' }],
  claude: [{ id: 'project-1', label: 'demo-project', description: 'Claude project' }],
  hermes: [{ id: 'profile-default', label: 'default', description: 'Hermes profile' }],
  openclaw: [{ id: 'agent-main', label: 'main', description: 'OpenClaw agent' }],
}

const CONNECTOR_CONTEXT_TYPES = new Set<AgentBridgeType>(['codex', 'claude'])
const CONNECTOR_SELECTOR_TYPES = new Set<AgentBridgeType>(['openclaw', 'hermes'])

@Injectable()
export class BridgeService {
  private readonly logger = new Logger(BridgeService.name)

  constructor(
    private readonly database: DatabaseService,
    private readonly presence: BridgePresenceService,
    private readonly relay: BridgeRelayService,
  ) {}

  getWsUrl(agentType?: string): string {
    const host = process.env.PUBLIC_HOST ?? '127.0.0.1'
    const port = process.env.PORT ?? '3300'
    const base = `ws://${host}:${port}/bridge/ws`
    return agentType?.trim() ? `${base}/${agentType.trim()}` : base
  }

  persistConnectionDeviceInfo(
    connectionId: string,
    device: { id?: string; name?: string },
  ): void {
    this.presence.updateDeviceInfo(connectionId, device)
    this.database.updateConnectionDevice(connectionId, device)
  }

  getSetup(type: string) {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    let connection = this.database.getConnectionByType(type)
    if (!connection) {
      throw new NotFoundException('连接配置不存在')
    }
    // Align with production getOrCreateSetup: first load allocates a real secret
    // instead of returning the static demo placeholder from seed data.
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
    const connection = this.database.getConnectionById(connectionId)
    if (!connection || connection.bridge_type !== type) {
      throw new NotFoundException('连接配置不存在')
    }
    const refreshed = this.database.refreshConnectionSecret(connectionId)
    if (!refreshed) {
      throw new NotFoundException('连接配置不存在')
    }
    return toBridgeSetupDto(
      {
        bridgeType: refreshed.bridge_type,
        connectionId: refreshed.id,
        appId: refreshed.app_id,
        appSecret: refreshed.app_secret,
        accountId: refreshed.account_id,
        boundContextId: refreshed.bound_context_id,
      },
      this.getWsUrl(refreshed.bridge_type),
    )
  }

  getStatus(type: string) {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const connection = this.database.getConnectionByType(type)
    if (!connection) {
      throw new NotFoundException('连接配置不存在')
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

  async listContexts(type: string, connectionId?: string): Promise<BindableContextDto[]> {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const connection = connectionId
      ? this.database.getConnectionById(connectionId)
      : this.database.getConnectionByType(type)
    if (!connection || connection.bridge_type !== type) {
      throw new NotFoundException('连接配置不存在')
    }
    if (!this.presence.isOnline(connection.id)) {
      throw new ConflictException('本机 Agent 尚未连接')
    }

    if (!CONNECTOR_CONTEXT_TYPES.has(type) && !CONNECTOR_SELECTOR_TYPES.has(type)) {
      return DEFAULT_CONTEXTS[type]
    }

    try {
      if (CONNECTOR_SELECTOR_TYPES.has(type)) {
        const contexts = await this.fetchSelectorContextsFromConnector(connection, type)
        if (contexts.length > 0) return contexts
        return DEFAULT_CONTEXTS[type]
      }

      const contexts = await this.fetchContextsFromConnector(connection)
      if (contexts.length > 0) return contexts
      return DEFAULT_CONTEXTS[type]
    } catch (err) {
      this.logger.warn(
        `listContexts fallback to demo contexts type=${type}: ${(err as Error).message}`,
      )
      return DEFAULT_CONTEXTS[type]
    }
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
    const bindCommand = (raw.bindCommand ?? raw.bind_command)?.trim() ?? ''
    const selectProjectCommand = (raw.selectProjectCommand ?? raw.select_project_command)?.trim() ?? ''
    const platformSessionIdInput = (raw.platformSessionId ?? raw.platform_session_id)?.trim() ?? ''

    const platformSessionId = this.ensureConnectorSessionId(connection, type)

    if (selectProjectCommand) {
      await this.relay.forwardLocalCommand(
        (payload) => this.presence.sendJson(connection.id, payload),
        this.connectorInput(connection, platformSessionId),
        selectProjectCommand,
      ).completed
      if (projectPath) {
        this.database.updateConnectionWorkspace(connection.id, projectPath)
      }
    } else if (projectPath) {
      await this.selectProject(type, connection.id, projectPath)
    }

    let sessionId =
      platformSessionIdInput && this.database.getSession(platformSessionIdInput)
        ? platformSessionIdInput
        : platformSessionId

    if (selectProjectCommand && !bindCommand && projectPath) {
      const preferredId =
        platformSessionIdInput && this.database.getSession(platformSessionIdInput)
          ? platformSessionIdInput
          : ''
      sessionId = this.resolvePlatformSessionForProjectOnly(connection, type, {
        preferredSessionId: preferredId,
        projectPath,
        sessionTitle: sessionTitle || projectName || agentDisplayName(type),
      })

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
    if (projectPath) {
      this.database.updateConnectionWorkspace(connection.id, projectPath)
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
    const connection = connectionId
      ? this.database.getConnectionById(connectionId)
      : this.database.getConnectionByType(type)
    if (!connection || connection.bridge_type !== type) {
      throw new NotFoundException('连接配置不存在')
    }
    if (!this.presence.isOnline(connection.id)) {
      throw new ConflictException('本机 Agent 尚未连接')
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
      selected = DEFAULT_CONTEXTS[type].find((item) => item.id === contextId)
      if (!selected) {
        throw new NotFoundException('上下文不存在')
      }
    }

    const sessionId =
      connection.session_id && this.database.getSession(connection.session_id)
        ? connection.session_id
        : this.database.getSessionByConnectionId(connection.id)?.id ??
          this.database.createSession({
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

    try {
      const payload = await this.fetchSettingsOptionsFromConnector(connection, platformSessionId)
      return parseBridgeSettingsOptionsPayload(payload)
    } catch (err) {
      this.logger.warn(
        `loadSettingsOptions fallback to demo options type=${type}: ${(err as Error).message}`,
      )
      return DEMO_BRIDGE_SETTINGS_OPTIONS
    }
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
    const connection = connectionId
      ? this.database.getConnectionById(connectionId)
      : this.database.getConnectionByType(type)
    if (!connection || connection.bridge_type !== type) {
      throw new NotFoundException('连接配置不存在')
    }
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

  private resolveConnection(type: AgentBridgeType, connectionId?: string): BridgeConnectionRow {
    const connection = connectionId
      ? this.database.getConnectionById(connectionId)
      : this.database.getConnectionByType(type)
    if (!connection || connection.bridge_type !== type) {
      throw new NotFoundException('连接配置不存在')
    }
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
      userId: this.database.demoUserId,
    }
  }
}
