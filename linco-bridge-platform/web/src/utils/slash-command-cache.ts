import type { SlashCommandItem } from '@/bridge/slash-command'
import type { AgentBridgeType } from '@/bridge/types'

const STORAGE_PREFIX = 'linco_bridge_slash_commands_v1'
export const SLASH_COMMANDS_SHARED_SCOPE = '__shared__'

const memoryCache = new Map<string, SlashCommandItem[]>()

interface SlashCommandCacheRecord {
  items: SlashCommandItem[]
  updatedAt: number
}

function normalizeConnectionId(connectionId?: string): string {
  return connectionId?.trim() || 'default'
}

function normalizeScopeKey(sessionId?: string): string {
  const normalized = sessionId?.trim() ?? ''
  return normalized || SLASH_COMMANDS_SHARED_SCOPE
}

export function slashCommandsMemoryKey(
  agentType: AgentBridgeType,
  connectionId?: string,
  sessionId?: string,
): string {
  return `${agentType}|${normalizeConnectionId(connectionId)}|${normalizeScopeKey(sessionId)}`
}

function storageKey(
  agentType: AgentBridgeType,
  connectionId: string,
  scopeKey: string,
): string {
  return `${STORAGE_PREFIX}:${agentType}:${connectionId}:${scopeKey}`
}

function readStorage(key: string): SlashCommandItem[] | null {
  try {
    const raw = uni.getStorageSync(key)
    if (!raw) return null
    const parsed =
      typeof raw === 'string'
        ? (JSON.parse(raw) as SlashCommandCacheRecord)
        : (raw as SlashCommandCacheRecord)
    if (!Array.isArray(parsed.items)) return null
    return parsed.items
  } catch {
    return null
  }
}

function writeStorage(key: string, items: SlashCommandItem[]): void {
  const record: SlashCommandCacheRecord = {
    items,
    updatedAt: Date.now(),
  }
  try {
    uni.setStorageSync(key, JSON.stringify(record))
  } catch {
    // ignore quota / unavailable storage
  }
}

function cacheInMemory(
  agentType: AgentBridgeType,
  connectionId: string,
  scopeKey: string,
  items: SlashCommandItem[],
): void {
  const immutable = [...items]
  memoryCache.set(slashCommandsMemoryKey(agentType, connectionId, scopeKey), immutable)
  memoryCache.set(
    slashCommandsMemoryKey(agentType, connectionId, SLASH_COMMANDS_SHARED_SCOPE),
    immutable,
  )
}

export function readSlashCommandsFromCache(
  agentType: AgentBridgeType,
  connectionId?: string,
  sessionId?: string,
): SlashCommandItem[] {
  const normalizedConnectionId = normalizeConnectionId(connectionId)
  const scopeKey = normalizeScopeKey(sessionId)

  const scopedMemory = memoryCache.get(
    slashCommandsMemoryKey(agentType, normalizedConnectionId, scopeKey),
  )
  if (scopedMemory?.length) return [...scopedMemory]

  const sharedMemory = memoryCache.get(
    slashCommandsMemoryKey(agentType, normalizedConnectionId, SLASH_COMMANDS_SHARED_SCOPE),
  )
  if (sharedMemory?.length) return [...sharedMemory]

  const scopedPersisted = readStorage(
    storageKey(agentType, normalizedConnectionId, scopeKey),
  )
  if (scopedPersisted?.length) {
    cacheInMemory(agentType, normalizedConnectionId, scopeKey, scopedPersisted)
    return [...scopedPersisted]
  }

  const sharedPersisted = readStorage(
    storageKey(agentType, normalizedConnectionId, SLASH_COMMANDS_SHARED_SCOPE),
  )
  if (sharedPersisted?.length) {
    cacheInMemory(agentType, normalizedConnectionId, SLASH_COMMANDS_SHARED_SCOPE, sharedPersisted)
    return [...sharedPersisted]
  }

  return []
}

export function writeSlashCommandsToCache(
  agentType: AgentBridgeType,
  connectionId: string | undefined,
  sessionId: string | undefined,
  items: SlashCommandItem[],
): void {
  if (items.length === 0) return
  const normalizedConnectionId = normalizeConnectionId(connectionId)
  const scopeKey = normalizeScopeKey(sessionId)
  cacheInMemory(agentType, normalizedConnectionId, scopeKey, items)
  writeStorage(storageKey(agentType, normalizedConnectionId, scopeKey), items)
  writeStorage(
    storageKey(agentType, normalizedConnectionId, SLASH_COMMANDS_SHARED_SCOPE),
    items,
  )
}

export function clearSlashCommandCacheForTests(): void {
  memoryCache.clear()
}
