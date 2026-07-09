import { Injectable, NotFoundException } from '@nestjs/common'
import {
  DatabaseService,
  type BridgeConnectionRow,
  type ChatSessionRow,
} from '../database/database.service'
import type { AgentBridgeType } from './constants'
import { VisitorContextService } from './visitor-context.service'

@Injectable()
export class ResourceAccessService {
  constructor(
    private readonly visitorContext: VisitorContextService,
    private readonly database: DatabaseService,
  ) {}

  getOwnerId(): string {
    return this.visitorContext.getVisitorId()
  }

  requireConnection(connectionId: string): BridgeConnectionRow {
    const connection = this.database.getConnectionById(connectionId)
    if (!connection || connection.owner_id !== this.getOwnerId()) {
      throw new NotFoundException('连接配置不存在')
    }
    return connection
  }

  requireSession(sessionId: string): ChatSessionRow {
    const session = this.database.getSession(sessionId)
    if (!session || session.owner_id !== this.getOwnerId()) {
      throw new NotFoundException('会话不存在')
    }
    return session
  }

  resolvePrimaryConnection(type: AgentBridgeType): BridgeConnectionRow | undefined {
    return this.database.getPrimaryConnectionByType(this.getOwnerId(), type)
  }

  getOrCreatePrimaryConnection(type: AgentBridgeType): BridgeConnectionRow {
    const existing = this.resolvePrimaryConnection(type)
    if (existing) return existing
    return this.database.createBridgeConnection(this.getOwnerId(), type)
  }
}
