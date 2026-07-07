import type { BridgeConnectionRow, ChatSessionRow } from '../database/database.service'
import { agentDisplayName } from '../shared/constants'

const PLACEHOLDER_PREVIEWS = new Set(['', 'Waiting for bridge connection.', 'Ready when you are.'])

/** Hide seeded bridge entry sessions until the user connects or starts chatting. */
export function shouldShowSessionInList(
  row: ChatSessionRow,
  connection?: BridgeConnectionRow,
): boolean {
  const lastMessage = row.last_message.trim()
  const title = row.title.trim()
  const agentSessionId = row.bridge_agent_session_id?.trim() ?? ''
  const boundContextId = connection?.bound_context_id?.trim() ?? ''

  if (agentSessionId) return true
  if (boundContextId) return true
  if (title && title !== agentDisplayName(row.agent_type)) return true
  if (lastMessage && !PLACEHOLDER_PREVIEWS.has(lastMessage)) return true

  return false
}
