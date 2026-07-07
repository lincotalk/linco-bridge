import type { ChatSessionDto } from './chat.service'

/** Message tab shows one row per bridge connection (latest activity only). */
export function groupSessionsForMessageList(sessions: ChatSessionDto[]): ChatSessionDto[] {
  const byConnection = new Map<string, ChatSessionDto>()

  for (const session of sessions) {
    const key = session.connectionId?.trim() || session.agentType
    const existing = byConnection.get(key)
    if (!existing) {
      byConnection.set(key, session)
      continue
    }

    const isNewer =
      session.updatedAt > existing.updatedAt ||
      (session.updatedAt === existing.updatedAt && session.id > existing.id)

    if (isNewer) {
      byConnection.set(key, session)
    }
  }

  return [...byConnection.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}
