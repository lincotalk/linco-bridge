import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  AGENT_BRIDGE_TYPES,
  DEMO_USER_ID,
  type AgentBridgeType,
  agentDisplayName,
  defaultAccountId,
} from '../shared/constants'

export interface BridgeConnectionRow {
  id: string
  bridge_type: AgentBridgeType
  app_id: string
  app_secret: string
  account_id: string
  bound_context_id: string | null
  bound_context_name: string | null
  session_id: string | null
  create_time: number
  update_time: number
}

export interface ChatSessionRow {
  id: string
  agent_type: AgentBridgeType
  title: string
  bridge_connection_id: string | null
  last_message: string
  update_time: number
}

export interface ChatMessageRow {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  create_time: number
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name)
  private db!: DatabaseSync

  onModuleInit(): void {
    const dbPath = process.env.SQLITE_PATH ?? join(process.cwd(), 'data', 'linco-bridge.db')
    mkdirSync(dirname(dbPath), { recursive: true })
    this.db = new DatabaseSync(dbPath)
    this.migrate()
    this.seed()
    this.logger.log(`SQLite ready at ${dbPath}`)
  }

  onModuleDestroy(): void {
    this.db?.close()
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bridge_connections (
        id TEXT PRIMARY KEY,
        bridge_type TEXT NOT NULL,
        app_id TEXT NOT NULL UNIQUE,
        app_secret TEXT NOT NULL,
        account_id TEXT NOT NULL,
        bound_context_id TEXT,
        bound_context_name TEXT,
        session_id TEXT,
        create_time INTEGER NOT NULL,
        update_time INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        agent_type TEXT NOT NULL,
        title TEXT NOT NULL,
        bridge_connection_id TEXT,
        last_message TEXT NOT NULL DEFAULT '',
        update_time INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        create_time INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_bridge_connections_type ON bridge_connections(bridge_type);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
    `)
  }

  private seed(): void {
    const now = Date.now()
    for (const bridgeType of AGENT_BRIDGE_TYPES) {
      const existing = this.getConnectionByType(bridgeType)
      if (existing) continue

      const id = randomUUID()
      const appId = `demo-${bridgeType}-app`
      const appSecret = `demo-${bridgeType}-secret`
      const accountId = defaultAccountId(bridgeType)
      this.db
        .prepare(
          `INSERT INTO bridge_connections
          (id, bridge_type, app_id, app_secret, account_id, bound_context_id, bound_context_name, session_id, create_time, update_time)
          VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
        )
        .run(id, bridgeType, appId, appSecret, accountId, now, now)

      const sessionId = randomUUID()
      this.db
        .prepare(
          `INSERT INTO chat_sessions (id, agent_type, title, bridge_connection_id, last_message, update_time)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          sessionId,
          bridgeType,
          agentDisplayName(bridgeType),
          id,
          bridgeType === 'codex' ? 'Ready when you are.' : 'Waiting for bridge connection.',
          now,
        )
    }
  }

  getConnectionByType(bridgeType: AgentBridgeType): BridgeConnectionRow | undefined {
    return this.db
      .prepare(`SELECT * FROM bridge_connections WHERE bridge_type = ?`)
      .get(bridgeType) as unknown as BridgeConnectionRow | undefined
  }

  getConnectionById(connectionId: string): BridgeConnectionRow | undefined {
    return this.db
      .prepare(`SELECT * FROM bridge_connections WHERE id = ?`)
      .get(connectionId) as unknown as BridgeConnectionRow | undefined
  }

  getConnectionByToken(appId: string, appSecret: string): BridgeConnectionRow | undefined {
    return this.db
      .prepare(`SELECT * FROM bridge_connections WHERE app_id = ? AND app_secret = ?`)
      .get(appId, appSecret) as unknown as BridgeConnectionRow | undefined
  }

  refreshConnectionSecret(connectionId: string): BridgeConnectionRow | undefined {
    const nextSecret = `${randomUUID().replace(/-/g, '').slice(0, 16)}`
    const now = Date.now()
    this.db
      .prepare(`UPDATE bridge_connections SET app_secret = ?, update_time = ? WHERE id = ?`)
      .run(nextSecret, now, connectionId)
    return this.getConnectionById(connectionId)
  }

  bindConnectionContext(
    connectionId: string,
    contextId: string,
    contextName: string,
    sessionId: string,
  ): BridgeConnectionRow | undefined {
    const now = Date.now()
    this.db
      .prepare(
        `UPDATE bridge_connections
         SET bound_context_id = ?, bound_context_name = ?, session_id = ?, update_time = ?
         WHERE id = ?`,
      )
      .run(contextId, contextName, sessionId, now, connectionId)
    return this.getConnectionById(connectionId)
  }

  listSessions(): ChatSessionRow[] {
    return this.db
      .prepare(`SELECT * FROM chat_sessions ORDER BY update_time DESC`)
      .all() as unknown as ChatSessionRow[]
  }

  getSession(sessionId: string): ChatSessionRow | undefined {
    return this.db.prepare(`SELECT * FROM chat_sessions WHERE id = ?`).get(sessionId) as unknown as
      ChatSessionRow | undefined
  }

  getSessionByConnectionId(connectionId: string): ChatSessionRow | undefined {
    return this.db
      .prepare(`SELECT * FROM chat_sessions WHERE bridge_connection_id = ?`)
      .get(connectionId) as unknown as ChatSessionRow | undefined
  }

  linkConnectionSession(connectionId: string, sessionId: string): void {
    const now = Date.now()
    this.db
      .prepare(`UPDATE bridge_connections SET session_id = ?, update_time = ? WHERE id = ?`)
      .run(sessionId, now, connectionId)
  }

  touchSession(sessionId: string, lastMessage: string): void {
    const now = Date.now()
    this.db
      .prepare(`UPDATE chat_sessions SET last_message = ?, update_time = ? WHERE id = ?`)
      .run(lastMessage, now, sessionId)
  }

  createSession(input: {
    agentType: AgentBridgeType
    title: string
    bridgeConnectionId?: string | null
    lastMessage?: string
  }): ChatSessionRow {
    const id = randomUUID()
    const now = Date.now()
    const lastMessage = input.lastMessage ?? ''
    this.db
      .prepare(
        `INSERT INTO chat_sessions (id, agent_type, title, bridge_connection_id, last_message, update_time)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.agentType, input.title, input.bridgeConnectionId ?? null, lastMessage, now)
    return {
      id,
      agent_type: input.agentType,
      title: input.title,
      bridge_connection_id: input.bridgeConnectionId ?? null,
      last_message: lastMessage,
      update_time: now,
    }
  }

  listMessages(sessionId: string): ChatMessageRow[] {
    return this.db
      .prepare(`SELECT * FROM chat_messages WHERE session_id = ? ORDER BY create_time ASC`)
      .all(sessionId) as unknown as ChatMessageRow[]
  }

  insertMessage(input: {
    sessionId: string
    role: ChatMessageRow['role']
    content: string
  }): ChatMessageRow {
    const id = randomUUID()
    const now = Date.now()
    this.db
      .prepare(
        `INSERT INTO chat_messages (id, session_id, role, content, create_time) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, input.sessionId, input.role, input.content, now)
    this.db
      .prepare(`UPDATE chat_sessions SET last_message = ?, update_time = ? WHERE id = ?`)
      .run(input.content, now, input.sessionId)
    return {
      id,
      session_id: input.sessionId,
      role: input.role,
      content: input.content,
      create_time: now,
    }
  }

  static createInMemory(): DatabaseService {
    const service = new DatabaseService()
    service.db = new DatabaseSync(':memory:')
    service.migrate()
    service.seed()
    return service
  }

  get demoUserId(): string {
    return DEMO_USER_ID
  }
}
