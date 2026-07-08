import type { BridgeConnectionRow, ChatSessionRow } from '../database/database.service'
import { agentDisplayName } from '../shared/constants'
import { normalizeSessionPreview } from './session-preview.util'
import { stripDeviceSuffixFromTitle } from './session-list-title.util'

const PLACEHOLDER_PREVIEWS = new Set([
  '',
  'Waiting for bridge connection.',
  'Ready when you are.',
])

function pathBasename(path: string): string {
  const normalized = path.trim().replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  return parts.length > 0 ? (parts[parts.length - 1] ?? '') : ''
}

export function isPlaceholderHistoryPreview(preview: string): boolean {
  return PLACEHOLDER_PREVIEWS.has(preview.trim())
}

/** Hide seeded bridge entry rows until the user connects or chats (Flutter isEmptyBridgeAgentEntrySession). */
export function isEmptyBridgeEntrySession(row: ChatSessionRow): boolean {
  if (row.bridge_project_path?.trim()) return false
  if (row.bridge_agent_session_id?.trim()) return false
  if (Number(row.is_temp_session ?? 0) === 1) return false
  if (!isPlaceholderHistoryPreview(row.last_message)) return false

  const title = row.title.trim()
  return !title || title === agentDisplayName(row.agent_type)
}

export function isBridgeProjectOnlyGeneratedTitle(row: ChatSessionRow): boolean {
  const projectPath = row.bridge_project_path?.trim() ?? ''
  if (!projectPath) return false
  if (row.bridge_agent_session_id?.trim()) return false

  const normalizedTitle = row.title.trim().toLowerCase()
  if (!normalizedTitle) return false

  const basename = pathBasename(projectPath).toLowerCase()
  if (basename && normalizedTitle === basename) return true
  return normalizedTitle === agentDisplayName(row.agent_type).toLowerCase()
}

export function bridgeHistorySessionKey(row: ChatSessionRow): string {
  const projectPath = row.bridge_project_path?.trim() ?? ''
  const agentSessionId = row.bridge_agent_session_id?.trim() ?? ''
  if (agentSessionId) {
    return `desktop:${agentSessionId}:${projectPath}`
  }
  if (projectPath) {
    return `project:${projectPath}:${row.title.trim()}`
  }
  return `session:${row.id}`
}

export function deduplicateBridgeHistorySessions(rows: ChatSessionRow[]): ChatSessionRow[] {
  const sorted = [...rows].sort((a, b) => b.update_time - a.update_time)
  const seen = new Set<string>()
  const result: ChatSessionRow[] = []
  for (const row of sorted) {
    const key = bridgeHistorySessionKey(row)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(row)
  }
  return result
}

export function resolveAgentHistoryTitle(
  row: ChatSessionRow,
  deviceName: string,
  firstUserMessage?: string,
): string {
  const stripped = stripDeviceSuffixFromTitle(row.title.trim(), deviceName)
  if (!isBridgeProjectOnlyGeneratedTitle(row)) {
    return stripped || '新的会话'
  }

  const userTitle = firstUserMessage?.trim()
  if (userTitle) return userTitle

  const preview = normalizeSessionPreview(row.last_message)
  if (preview) return preview

  return '新的会话'
}

export function resolveAgentHistoryPreview(
  row: ChatSessionRow,
  lastAssistantMessage?: string,
): string {
  const fromAssistant = normalizeSessionPreview(lastAssistantMessage ?? '')
  if (fromAssistant) return fromAssistant

  const fromLast = normalizeSessionPreview(row.last_message)
  if (fromLast) return fromLast

  return '暂无消息'
}

export function shouldShowSessionInAgentHistory(
  row: ChatSessionRow,
  connection?: BridgeConnectionRow,
): boolean {
  if (Number(row.hidden_from_history ?? 0) === 1) return false
  if (isEmptyBridgeEntrySession(row)) return false

  const lastMessage = row.last_message.trim()
  const title = row.title.trim()
  const agentSessionId = row.bridge_agent_session_id?.trim() ?? ''
  const boundContextId = connection?.bound_context_id?.trim() ?? ''

  if (agentSessionId) return true
  if (boundContextId) return true
  if (Number(row.is_temp_session ?? 0) === 1) return true
  if (row.bridge_project_path?.trim()) return true
  if (title && title !== agentDisplayName(row.agent_type)) return true
  if (lastMessage && !isPlaceholderHistoryPreview(lastMessage)) return true

  return false
}
