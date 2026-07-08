import type { DatabaseService } from '../database/database.service'
import { roundsToMessages, type HistoryReloadPayload } from '../bridge/history.util'

export function importBridgeHistoryRounds(
  database: DatabaseService,
  sessionId: string,
  payload: HistoryReloadPayload,
): number {
  const messages = roundsToMessages(sessionId, payload)
  if (messages.length === 0) return 0

  let changed = 0
  for (const message of messages) {
    if (database.getMessageById(message.id)) continue
    database.insertMessage({
      id: message.id,
      sessionId,
      role: message.role,
      content: message.content,
      createTime: message.createdAt,
      attachments: message.attachments,
    })
    changed++
  }
  return changed
}
