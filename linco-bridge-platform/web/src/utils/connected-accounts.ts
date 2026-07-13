import { getBridgeSourceCard } from '@/bridge/constants'
import { BRIDGE_CONNECT_CHANNEL } from '@/bridge/commands'
import type { AgentBridgeType, BridgeSourceCard, ChatSessionItem } from '@/bridge/types'
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
  lastMessage?: string
  updatedAt: number
}

export interface AccountsCommandPayload {
  channel: string
  accountIds: string[]
  items: ConnectedAgentItem[]
  hint?: string
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
    lastMessage: String(item.lastMessage ?? '').trim() || undefined,
    updatedAt: Number(item.updatedAt ?? 0) || 0,
  }
}

export function connectedAgentToSessionItem(item: ConnectedAgentItem): ChatSessionItem {
  return {
    id: item.sessionId?.trim() || item.connectionId,
    agentType: item.agentType,
    connectionId: item.connectionId,
    title: item.title,
    lastMessage: item.lastMessage ?? item.description ?? item.deviceName ?? '',
    updatedAt: item.updatedAt || Date.now(),
    online: item.status === 'online',
    deviceName: item.deviceName,
    boundContextName: item.boundContextName,
  }
}

function connectedAgentSubtitle(item: ConnectedAgentItem): string {
  const preview =
    item.lastMessage?.trim() ||
    item.description?.trim() ||
    item.boundContextName?.trim() ||
    item.deviceName?.trim() ||
    ''
  if (preview) return preview
  return item.status === 'online' ? '在线' : '离线'
}

function connectedAgentIcon(item: ConnectedAgentItem): string {
  const avatar = item.avatar?.trim()
  if (avatar) return avatar
  return getBridgeSourceCard(item.agentType)?.icon ?? bridgeAvatar(item.agentType)
}

export function connectedAgentToBridgeCard(item: ConnectedAgentItem): BridgeSourceCard {
  return {
    type: item.agentType,
    title: item.title,
    subtitle: connectedAgentSubtitle(item),
    icon: connectedAgentIcon(item),
    route: '',
  }
}

function buildItemsFromAccountIds(accountIds: string[]): ConnectedAgentItem[] {
  return accountIds.flatMap((rawAccountId) => {
    const accountId = rawAccountId.trim()
    if (!accountId) return []
    const agentType = inferAgentTypeFromAccountId(accountId)
    if (!agentType) return []
    return [
      {
        connectionId: accountId,
        agentType,
        accountId,
        title: agentTypeLabel(agentType),
        description: '',
        avatar: bridgeAvatar(agentType),
        status: 'offline',
        updatedAt: 0,
      },
    ]
  })
}

function inferAgentTypeFromAccountId(accountId: string): AgentBridgeType | null {
  if (accountId === 'codex' || accountId.startsWith('codex_')) return 'codex'
  if (accountId === 'claude' || accountId.startsWith('claude_')) return 'claude'
  if (accountId === 'hermes' || accountId.startsWith('hermes_')) return 'hermes'
  if (accountId === 'openclaw' || accountId.startsWith('openclaw_')) return 'openclaw'
  return null
}

function agentTypeLabel(agentType: AgentBridgeType): string {
  switch (agentType) {
    case 'codex':
      return 'Codex'
    case 'claude':
      return 'Claude Code'
    case 'hermes':
      return 'Hermes'
    case 'openclaw':
      return 'OpenClaw'
    default:
      return agentType
  }
}

function bridgeAvatar(agentType: AgentBridgeType): string {
  switch (agentType) {
    case 'codex':
      return '/static/icons/bot/bridge_codex.png'
    case 'claude':
      return '/static/icons/bot/bridge_claude.png'
    case 'hermes':
      return '/static/icons/bot/bridge_hermes.png'
    case 'openclaw':
      return '/static/icons/bot/bridge_claw.png'
    default:
      return ''
  }
}

export function parseAccountsCommandResult(result: BridgeCommandResult): AccountsCommandPayload {
  const payload = result.payload ?? {}
  const accountIds = Array.isArray(payload.accountIds)
    ? payload.accountIds
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    : []
  const parsedItems = Array.isArray(payload.items)
    ? payload.items
        .map(parseConnectedAgentItem)
        .filter((item): item is ConnectedAgentItem => item !== null)
    : []
  const items = parsedItems.length > 0 ? parsedItems : buildItemsFromAccountIds(accountIds)
  const warning = String(payload.warning ?? '').trim()
  const hint = warning || String(result.text ?? '').trim() || undefined

  return { channel: BRIDGE_CONNECT_CHANNEL, accountIds, items, hint }
}
