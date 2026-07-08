import type { ChatSessionRow } from '../database/database.service'
import type { AgentBridgeType } from '../shared/constants'

const SQLITE_PERSIST_AGENT_TYPES = new Set<AgentBridgeType>(['hermes', 'openclaw'])

/** Persist chat turns in SQLite — temp sessions, project-bound sessions, and Hermes/OpenClaw. */
export function shouldPersistSessionMessages(
  session: Pick<ChatSessionRow, 'is_temp_session' | 'bridge_project_path' | 'agent_type'>,
): boolean {
  if (Number(session.is_temp_session ?? 0) === 1) return true
  if (SQLITE_PERSIST_AGENT_TYPES.has(session.agent_type)) return true
  return Boolean(session.bridge_project_path?.trim())
}
