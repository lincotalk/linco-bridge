import { Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'
import { BridgePresenceService } from '../bridge/bridge-presence.service'
import { BridgeRelayService } from '../bridge/bridge-relay.service'
import { BridgeService } from '../bridge/bridge.service'
import { type AgentBridgeType, agentDisplayName, isAgentBridgeType } from '../shared/constants'

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

export interface CreateSessionInput {
  agentType: AgentBridgeType
  title?: string
  tempSession?: boolean
  message?: string
}

const BRIDGE_AVATAR: Record<AgentBridgeType, string> = {
  codex: '/static/icons/bot/bridge_codex.png',
  claude: '/static/icons/bot/bridge_claude.png',
  hermes: '/static/icons/bot/bridge_hermes.png',
  openclaw: '/static/icons/bot/bridge_claw.png',
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

  listMessages(sessionId: string): ChatMessageDto[] {
    const session = this.database.getSession(sessionId)
    if (!session) {
      throw new NotFoundException('会话不存在')
    }
    return this.database.listMessages(sessionId).map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      createdAt: row.create_time,
    }))
  }

  async sendMessage(sessionId: string, content: string): Promise<ChatMessageDto> {
    const session = this.database.getSession(sessionId)
    if (!session) {
      throw new NotFoundException('会话不存在')
    }

    this.database.insertMessage({
      sessionId,
      role: 'user',
      content,
    })

    const connection = session.bridge_connection_id
      ? this.database.getConnectionById(session.bridge_connection_id)
      : undefined

    let assistantText = `[Demo] ${session.title} 已收到：${content}`

    if (connection && this.presence.isOnline(connection.id)) {
      try {
        assistantText = await this.relay.forwardToConnector(
          (payload) => this.presence.sendJson(connection.id, payload),
          {
            sessionId,
            text: content,
            bridgeType: connection.bridge_type,
            accountId: connection.account_id,
            boundContextId: connection.bound_context_id,
            userId: this.database.demoUserId,
          },
        )
      } catch {
        assistantText = `[Offline fallback] ${session.title} 暂未返回实时回复，请确认本机 Agent 正在运行。`
      }
    }

    const assistantMessage = this.database.insertMessage({
      sessionId,
      role: 'assistant',
      content: assistantText,
    })

    return {
      id: assistantMessage.id,
      sessionId: assistantMessage.session_id,
      role: assistantMessage.role,
      content: assistantMessage.content,
      createdAt: assistantMessage.create_time,
    }
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
      .map((row) => ({
        id: row.id,
        title: row.title,
        preview: row.last_message || '暂无消息',
        updatedAt: row.update_time,
      }))
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
      lastMessage: input.message?.trim() ?? '',
    })

    if (connection && !input.tempSession) {
      this.database.linkConnectionSession(connection.id, session.id)
    }

    const firstMessage = input.message?.trim()
    if (firstMessage) {
      this.database.touchSession(session.id, firstMessage)
    }

    return { sessionId: session.id }
  }
}
