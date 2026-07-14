import type { DatabaseService } from '../database/database.service'

import { roundsToMessages, type HistoryReloadPayload } from '../bridge/history.util'

import { sanitizeBridgeAssistantContent } from './bridge-message-sanitize.util'



export function importBridgeHistoryRounds(

  database: DatabaseService,

  sessionId: string,

  payload: HistoryReloadPayload,

  agentType?: string,

): number {

  const messages = roundsToMessages(sessionId, payload)

  if (messages.length === 0) return 0



  let changed = 0

  for (const message of messages) {

    if (database.getMessageById(message.id)) continue

    const content =

      message.role === 'assistant'

        ? sanitizeBridgeAssistantContent(message.content, { agentType })

        : message.content

    database.insertMessage({

      id: message.id,

      sessionId,

      role: message.role,

      content,

      createTime: message.createdAt,

      attachments: message.attachments,

    })

    changed++

  }

  return changed

}

