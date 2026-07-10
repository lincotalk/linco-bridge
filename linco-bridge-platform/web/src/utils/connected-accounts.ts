import type { AgentBridgeType } from '@/bridge/types'
import type { BridgeCommandResult } from '@/api/session-api'

export interface ConnectedAgentItem {
  connectionId: string
  agentType: AgentBridgeType
  accountId: string
  title: string
  description: string
  avatar: string
  status: 'online' | 'offline'
  deviceName?: string
  boundContextName?: string
  sessionId?: string
  updatedAt: number
}

export interface AccountsCommandPayload {
  channel: string
  accountIds: string[]
  items: ConnectedAgentItem[]
}

function isAgentBridgeType(value: string): value is AgentBridgeType {
  return value === 'codex' || value === 'claude' || value === 'hermes' || value === 'openclaw'
}

function parseConnectedAgentItem(raw: unknown): ConnectedAgentItem | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const agentType = String(item.agentType ?? '').trim()
  const connectionId = String(item.connectionId ?? '').trim()
  const accountId = String(item.accountId ?? '').trim()
  const title = String(item.title ?? '').trim()
  if (!isAgentBridgeType(agentType) || !connectionId || !accountId || !title) {
    return null
  }

  return {
    connectionId,
    agentType,
    accountId,
    title,
    description: String(item.description ?? '').trim(),
    avatar: String(item.avatar ?? '').trim(),
    status: item.status === 'offline' ? 'offline' : 'online',
    deviceName: String(item.deviceName ?? '').trim() || undefined,
    boundContextName: String(item.boundContextName ?? '').trim() || undefined,
    sessionId: String(item.sessionId ?? '').trim() || undefined,
    updatedAt: Number(item.updatedAt ?? 0) || 0,
  }
}

export function parseAccountsCommandResult(result: BridgeCommandResult): AccountsCommandPayload {
  const payload = result.payload ?? {}
  const channel = String(payload.channel ?? 'linco').trim() || 'linco'
  const accountIds = Array.isArray(payload.accountIds)
    ? payload.accountIds
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    : []
  const items = Array.isArray(payload.items)
    ? payload.items
        .map(parseConnectedAgentItem)
        .filter((item): item is ConnectedAgentItem => item !== null)
    : []

  return { channel, accountIds, items }
}
