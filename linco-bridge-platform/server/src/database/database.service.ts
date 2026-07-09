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
  generateConnectionAccountId,
  generateConnectionAppId,
} from '../shared/constants'
import { normalizeSessionPreview } from '../chat/session-preview.util'

export interface BridgeConnectionRow {
  id: string
  bridge_type: AgentBridgeType
  app_id: string
  app_secret: string
  account_id: string
  bound_context_id: string | null
  bound_context_name: string | null
  bridge_project_path: string | null
  bridge_agent_session_id: string | null
  session_id: string | null
  device_id: string | null
  device_name: string | null
  create_time: number
  update_time: number
}

export interface ChatSessionRow {
  id: string
  agent_type: AgentBridgeType
  title: string
  bridge_connection_id: string | null
  bridge_project_path: string | null
  bridge_agent_session_id: string | null
  bridge_device_name: string | null
  bridge_settings_json: string | null
  last_message: string
  update_time: number
  hidden_from_history?: number
  is_temp_session?: number
}

export interface ChatMessageAttachmentRow {
  name: string
  mimeType?: string
  previewUrl?: string
}

export interface ChatMessageRow {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  create_time: number
  attachments_json?: string | null
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

    this.ensureColumn('bridge_connections', 'bridge_project_path', 'TEXT')
    this.ensureColumn('bridge_connections', 'bridge_agent_session_id', 'TEXT')
    this.ensureColumn('bridge_connections', 'device_id', 'TEXT')
    this.ensureColumn('bridge_connections', 'device_name', 'TEXT')
    this.ensureColumn('chat_sessions', 'bridge_project_path', 'TEXT')
    this.ensureColumn('chat_sessions', 'bridge_agent_session_id', 'TEXT')
    this.ensureColumn('chat_sessions', 'bridge_device_name', 'TEXT')
    this.ensureColumn('chat_sessions', 'hidden_from_history', 'INTEGER NOT NULL DEFAULT 0')
    this.ensureColumn('chat_sessions', 'is_temp_session', 'INTEGER NOT NULL DEFAULT 0')
    this.ensureColumn('chat_sessions', 'bridge_settings_json', 'TEXT')
    this.ensureColumn('chat_messages', 'attachments_json', 'TEXT')
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    if (columns.some((item) => item.name === column)) return
    this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
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
          (id, bridge_type, app_id, app_secret, account_id, bound_context_id, bound_context_name, bridge_project_path, bridge_agent_session_id, session_id, create_time, update_time)
          VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
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
    return this.getPrimaryConnectionByType(bridgeType)
  }

  getPrimaryConnectionByType(bridgeType: AgentBridgeType): BridgeConnectionRow | undefined {
    return this.db
      .prepare(
        `SELECT * FROM bridge_connections WHERE bridge_type = ? ORDER BY create_time ASC LIMIT 1`,
      )
      .get(bridgeType) as unknown as BridgeConnectionRow | undefined
  }

  listConnectionsByType(bridgeType: AgentBridgeType): BridgeConnectionRow[] {
    return this.db
      .prepare(`SELECT * FROM bridge_connections WHERE bridge_type = ? ORDER BY create_time ASC`)
      .all(bridgeType) as unknown as BridgeConnectionRow[]
  }

  createBridgeConnection(bridgeType: AgentBridgeType): BridgeConnectionRow {
    const now = Date.now()
    const id = randomUUID()
    const appId = generateConnectionAppId(bridgeType)
    const appSecret = DatabaseService.generateConnectionSecret()
    const accountId = generateConnectionAccountId(bridgeType)
    this.db
      .prepare(
        `INSERT INTO bridge_connections
        (id, bridge_type, app_id, app_secret, account_id, bound_context_id, bound_context_name, bridge_project_path, bridge_agent_session_id, session_id, create_time, update_time)
        VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
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

    const created = this.getConnectionById(id)
    if (!created) {
      throw new Error(`Failed to create bridge connection for ${bridgeType}`)
    }
    return created
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

  static isDemoPlaceholderSecret(bridgeType: AgentBridgeType, appSecret: string): boolean {
    return appSecret === `demo-${bridgeType}-secret`
  }

  static generateConnectionSecret(): string {
    return `${randomUUID().replace(/-/g, '').slice(0, 16)}`
  }

  refreshConnectionSecret(connectionId: string): BridgeConnectionRow | undefined {
    const nextSecret = DatabaseService.generateConnectionSecret()
    const now = Date.now()
    this.db
      .prepare(`UPDATE bridge_connections SET app_secret = ?, update_time = ? WHERE id = ?`)
      .run(nextSecret, now, connectionId)
    return this.getConnectionById(connectionId)
  }

  refreshConnectionCredentials(
    _connectionId: string,
    bridgeType: AgentBridgeType,
  ): BridgeConnectionRow {
    return this.createBridgeConnection(bridgeType)
  }

  bindConnectionContext(
    connectionId: string,
    input: {
      contextId: string
      contextName: string
      sessionId: string
      projectPath?: string | null
      agentSessionId?: string | null
    },
  ): BridgeConnectionRow | undefined {
    const now = Date.now()
    this.db
      .prepare(
        `UPDATE bridge_connections
         SET bound_context_id = ?, bound_context_name = ?, bridge_project_path = ?, bridge_agent_session_id = ?, session_id = ?, update_time = ?
         WHERE id = ?`,
      )
      .run(
        input.contextId,
        input.contextName,
        input.projectPath ?? null,
        input.agentSessionId ?? input.contextId,
        input.sessionId,
        now,
        connectionId,
      )
    return this.getConnectionById(connectionId)
  }

  listSessions(): ChatSessionRow[] {
    return this.db
      .prepare(
        `SELECT * FROM chat_sessions
         WHERE COALESCE(hidden_from_history, 0) = 0
         ORDER BY update_time DESC`,
      )
      .all() as unknown as ChatSessionRow[]
  }

  getSession(sessionId: string): ChatSessionRow | undefined {
    return this.db.prepare(`SELECT * FROM chat_sessions WHERE id = ?`).get(sessionId) as unknown as
      ChatSessionRow | undefined
  }

  getSessionByConnectionId(connectionId: string): ChatSessionRow | undefined {
    return this.db
      .prepare(`SELECT * FROM chat_sessions WHERE bridge_connection_id = ? ORDER BY update_time DESC`)
      .get(connectionId) as unknown as ChatSessionRow | undefined
  }

  findSessionByProjectOnlyBinding(
    connectionId: string,
    projectPath: string,
  ): ChatSessionRow | undefined {
    const normalizedProjectPath = projectPath.trim()
    if (!normalizedProjectPath) return undefined

    return this.db
      .prepare(
        `SELECT * FROM chat_sessions
         WHERE bridge_connection_id = ?
           AND COALESCE(bridge_project_path, '') = ?
           AND COALESCE(bridge_agent_session_id, '') = ''
         ORDER BY update_time DESC
         LIMIT 1`,
      )
      .get(connectionId, normalizedProjectPath) as unknown as ChatSessionRow | undefined
  }

  findSessionByBridgeBinding(
    connectionId: string,
    projectPath: string,
    agentSessionId: string,
  ): ChatSessionRow | undefined {
    const normalizedProjectPath = projectPath.trim()
    const normalizedAgentSessionId = agentSessionId.trim()
    if (!normalizedAgentSessionId) return undefined

    if (normalizedProjectPath) {
      return this.db
        .prepare(
          `SELECT * FROM chat_sessions
           WHERE bridge_connection_id = ?
             AND COALESCE(bridge_agent_session_id, '') = ?
             AND COALESCE(bridge_project_path, '') = ?
           ORDER BY update_time DESC
           LIMIT 1`,
        )
        .get(connectionId, normalizedAgentSessionId, normalizedProjectPath) as unknown as
        | ChatSessionRow
        | undefined
    }

    return this.db
      .prepare(
        `SELECT * FROM chat_sessions
         WHERE bridge_connection_id = ?
           AND COALESCE(bridge_agent_session_id, '') = ?
           AND COALESCE(bridge_project_path, '') = ''
         ORDER BY update_time DESC
         LIMIT 1`,
      )
      .get(connectionId, normalizedAgentSessionId) as unknown as ChatSessionRow | undefined
  }

  updateSessionBridgeBinding(
    sessionId: string,
    input: {
      projectPath?: string | null
      agentSessionId?: string | null
      deviceName?: string | null
    },
  ): void {
    const now = Date.now()
    this.db
      .prepare(
        `UPDATE chat_sessions
         SET bridge_project_path = ?, bridge_agent_session_id = ?,
             bridge_device_name = COALESCE(?, bridge_device_name),
             update_time = ?
         WHERE id = ?`,
      )
      .run(
        input.projectPath ?? null,
        input.agentSessionId ?? null,
        input.deviceName?.trim() || null,
        now,
        sessionId,
      )
  }

  updateSessionDeviceName(sessionId: string, deviceName: string): void {
    const normalized = deviceName.trim()
    if (!normalized) return
    const now = Date.now()
    this.db
      .prepare(
        `UPDATE chat_sessions
         SET bridge_device_name = ?, update_time = ?
         WHERE id = ? AND COALESCE(bridge_device_name, '') = ''`,
      )
      .run(normalized, now, sessionId)
  }

  linkConnectionSession(connectionId: string, sessionId: string): void {
    const now = Date.now()
    this.db
      .prepare(`UPDATE bridge_connections SET session_id = ?, update_time = ? WHERE id = ?`)
      .run(sessionId, now, connectionId)
  }

  updateConnectionWorkspace(connectionId: string, projectPath: string): void {
    const now = Date.now()
    this.db
      .prepare(
        `UPDATE bridge_connections SET bridge_project_path = ?, update_time = ? WHERE id = ?`,
      )
      .run(projectPath.trim(), now, connectionId)
  }

  updateConnectionDevice(
    connectionId: string,
    input: { id?: string; name?: string },
  ): void {
    const deviceId = input.id?.trim() || null
    const deviceName = input.name?.trim() || null
    if (!deviceId && !deviceName) return
    const now = Date.now()
    this.db
      .prepare(
        `UPDATE bridge_connections SET device_id = COALESCE(?, device_id), device_name = COALESCE(?, device_name), update_time = ? WHERE id = ?`,
      )
      .run(deviceId, deviceName, now, connectionId)
  }

  touchSession(sessionId: string, lastMessage: string): void {
    const now = Date.now()
    this.db
      .prepare(`UPDATE chat_sessions SET last_message = ?, update_time = ? WHERE id = ?`)
      .run(lastMessage, now, sessionId)
  }

  updateSessionTitle(sessionId: string, title: string): void {
    const normalized = title.trim()
    if (!normalized) return
    const now = Date.now()
    this.db
      .prepare(`UPDATE chat_sessions SET title = ?, update_time = ? WHERE id = ?`)
      .run(normalized, now, sessionId)
  }

  hideSessionsFromHistory(sessionIds: string[]): string[] {
    const unique = [...new Set(sessionIds.map((id) => id.trim()).filter(Boolean))]
    if (unique.length === 0) return []

    const now = Date.now()
    const stmt = this.db.prepare(
      `UPDATE chat_sessions SET hidden_from_history = 1, update_time = ? WHERE id = ?`,
    )
    for (const sessionId of unique) {
      stmt.run(now, sessionId)
    }
    return unique
  }

  createSession(input: {
    agentType: AgentBridgeType
    title: string
    bridgeConnectionId?: string | null
    bridgeProjectPath?: string | null
    bridgeAgentSessionId?: string | null
    lastMessage?: string
    isTempSession?: boolean
    bridgeSettingsJson?: string | null
  }): ChatSessionRow {
    const id = randomUUID()
    const now = Date.now()
    const lastMessage = input.lastMessage ?? ''
    const isTempSession = input.isTempSession ? 1 : 0
    this.db
      .prepare(
        `INSERT INTO chat_sessions
         (id, agent_type, title, bridge_connection_id, bridge_project_path, bridge_agent_session_id, bridge_settings_json, last_message, update_time, is_temp_session)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.agentType,
        input.title,
        input.bridgeConnectionId ?? null,
        input.bridgeProjectPath ?? null,
        input.bridgeAgentSessionId ?? null,
        input.bridgeSettingsJson ?? null,
        lastMessage,
        now,
        isTempSession,
      )
    return {
      id,
      agent_type: input.agentType,
      title: input.title,
      bridge_connection_id: input.bridgeConnectionId ?? null,
      bridge_project_path: input.bridgeProjectPath ?? null,
      bridge_agent_session_id: input.bridgeAgentSessionId ?? null,
      bridge_device_name: null,
      bridge_settings_json: input.bridgeSettingsJson ?? null,
      last_message: lastMessage,
      update_time: now,
      is_temp_session: isTempSession,
    }
  }

  updateSessionBridgeSettings(sessionId: string, bridgeSettingsJson: string | null): void {
    this.db
      .prepare(`UPDATE chat_sessions SET bridge_settings_json = ?, update_time = ? WHERE id = ?`)
      .run(bridgeSettingsJson, Date.now(), sessionId)
  }

  listMessages(sessionId: string, limit?: number): ChatMessageRow[] {
    if (limit && limit > 0) {
      const rows = this.db
        .prepare(
          `SELECT * FROM chat_messages WHERE session_id = ? ORDER BY create_time DESC LIMIT ?`,
        )
        .all(sessionId, limit) as unknown as ChatMessageRow[]
      return rows.reverse()
    }

    return this.db
      .prepare(`SELECT * FROM chat_messages WHERE session_id = ? ORDER BY create_time ASC`)
      .all(sessionId) as unknown as ChatMessageRow[]
  }

  insertMessage(input: {
    id?: string
    sessionId: string
    role: ChatMessageRow['role']
    content: string
    createTime?: number
    attachments?: ChatMessageAttachmentRow[]
  }): ChatMessageRow {
    const id = input.id?.trim() || randomUUID()
    const existing = this.getMessageById(id)
    if (existing) return existing

    const now = input.createTime ?? Date.now()
    const attachmentsJson =
      input.attachments && input.attachments.length > 0
        ? JSON.stringify(input.attachments)
        : null
    this.db
      .prepare(
        `INSERT INTO chat_messages (id, session_id, role, content, create_time, attachments_json) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.sessionId, input.role, input.content, now, attachmentsJson)
    this.db
      .prepare(`UPDATE chat_sessions SET last_message = ?, update_time = ? WHERE id = ?`)
      .run(normalizeSessionPreview(input.content) || input.content.trim(), now, input.sessionId)
    return {
      id,
      session_id: input.sessionId,
      role: input.role,
      content: input.content,
      create_time: now,
      attachments_json: attachmentsJson,
    }
  }

  getMessageById(messageId: string): ChatMessageRow | undefined {
    const id = messageId.trim()
    if (!id) return undefined
    const row = this.db.prepare(`SELECT * FROM chat_messages WHERE id = ?`).get(id) as
      | ChatMessageRow
      | undefined
    return row
  }

  getFirstUserMessage(sessionId: string): ChatMessageRow | undefined {
    return this.db
      .prepare(
        `SELECT * FROM chat_messages WHERE session_id = ? AND role = 'user' ORDER BY create_time ASC LIMIT 1`,
      )
      .get(sessionId) as ChatMessageRow | undefined
  }

  getLastAssistantMessage(sessionId: string): ChatMessageRow | undefined {
    return this.db
      .prepare(
        `SELECT * FROM chat_messages WHERE session_id = ? AND role = 'assistant' ORDER BY create_time DESC LIMIT 1`,
      )
      .get(sessionId) as ChatMessageRow | undefined
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
