import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DatabaseService } from '../database/database.service'
import { type AgentBridgeType, agentDisplayName, isAgentBridgeType } from '../shared/constants'
import { BridgePresenceService } from './bridge-presence.service'
import { toBridgeSetupDto } from './bridge-setup.dto'

export interface BindableContextDto {
  id: string
  label: string
  description?: string
}

const DEFAULT_CONTEXTS: Record<AgentBridgeType, BindableContextDto[]> = {
  codex: [{ id: 'project-1', label: 'demo-project', description: 'Codex workspace' }],
  claude: [{ id: 'project-1', label: 'demo-project', description: 'Claude project' }],
  hermes: [{ id: 'profile-default', label: 'default', description: 'Hermes profile' }],
  openclaw: [{ id: 'agent-main', label: 'main', description: 'OpenClaw agent' }],
}

@Injectable()
export class BridgeService {
  constructor(
    private readonly database: DatabaseService,
    private readonly presence: BridgePresenceService,
  ) {}

  getWsUrl(): string {
    const host = process.env.PUBLIC_HOST ?? '127.0.0.1'
    const port = process.env.PORT ?? '3300'
    return `ws://${host}:${port}/bridge/ws`
  }

  getSetup(type: string) {
    if (!isAgentBridgeType(type)) {
      throw new NotFoundException('不支持的 Agent 类型')
    }
    const connection = this.database.getConnectionByType(type)
    if (!connection) {
      throw new NotFoundException('连接配置不存在')
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
      this.getWsUrl(),
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
      this.getWsUrl(),
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
    }
  }

  listContexts(type: string, connectionId?: string) {
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
    return DEFAULT_CONTEXTS[type]
  }

  bindContext(type: string, connectionId: string | undefined, contextId: string) {
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

    const contexts = DEFAULT_CONTEXTS[type]
    const selected = contexts.find((item) => item.id === contextId)
    if (!selected) {
      throw new NotFoundException('上下文不存在')
    }

    const sessionId = connection.session_id ?? randomUUID()
    if (!connection.session_id) {
      this.database.bindConnectionContext(connection.id, selected.id, selected.label, sessionId)
    } else {
      this.database.bindConnectionContext(
        connection.id,
        selected.id,
        selected.label,
        connection.session_id,
      )
    }

    return {
      bridgeType: type,
      connectionId: connection.id,
      contextId: selected.id,
      contextName: selected.label,
      sessionId,
      agentName: agentDisplayName(type),
    }
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

    if (type === 'codex') {
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
}
