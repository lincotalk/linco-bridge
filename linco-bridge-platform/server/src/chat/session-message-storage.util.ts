import type { ChatSessionRow } from '../database/database.service'

/** Persist chat turns in SQLite — temp sessions and project-bound sessions (aligned with Flutter local DB). */
export function shouldPersistSessionMessages(
  session: Pick<ChatSessionRow, 'is_temp_session' | 'bridge_project_path'>,
): boolean {
  if (Number(session.is_temp_session ?? 0) === 1) return true
  return Boolean(session.bridge_project_path?.trim())
}
