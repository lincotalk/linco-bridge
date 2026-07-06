import {
  BRIDGE_CONNECT_CHANNEL,
  buildSetupCommands,
  defaultAccountId,
  DEFAULT_BRIDGE_WS_URL,
  getAgentDisplayName,
} from '../commands'
import type {
  AgentBridgeBindableContext,
  AgentBridgeSetup,
  AgentBridgeType,
  ApiResponse,
  BridgeBindContextResult,
  BridgeStatusResult,
  BridgeSyncResult,
} from '../types'
import type { BridgeHttpClient, BridgeSdk } from './types'

function ok<T>(data: T): ApiResponse<T> {
  return { code: 0, success: true, data, message: '' }
}

function withConnectionQuery(path: string, connectionId?: string): string {
  if (!connectionId?.trim()) return path
  const joiner = path.includes('?') ? '&' : '?'
  return `${path}${joiner}connectionId=${encodeURIComponent(connectionId.trim())}`
}

/** Phase 1 REST implementation — routes match linco-bridge-platform server. */
export function createRestBridgeSdk(client: BridgeHttpClient): BridgeSdk {
  return {
    async getSetup(type) {
      const res = await client.get<AgentBridgeSetup>(`/api/agent-bridges/${type}/setup`)
      if (!res.success || !res.data) {
        throw new Error(res.message || '获取连接配置失败')
      }
      return res.data
    },

    async refreshSetup(type, connectionId) {
      const res = await client.post<AgentBridgeSetup>(`/api/agent-bridges/${type}/setup/refresh`, {
        connectionId,
      })
      if (!res.success || !res.data) {
        throw new Error(res.message || '刷新连接配置失败')
      }
      return res.data
    },

    async checkStatus(type, connectionId) {
      const res = await client.get<BridgeStatusResult>(
        withConnectionQuery(`/api/agent-bridges/${type}/status`, connectionId),
      )
      if (!res.success || !res.data) {
        throw new Error(res.message || '检测连接状态失败')
      }
      return res.data
    },

    async listContexts(type, connectionId) {
      const res = await client.get<AgentBridgeBindableContext[]>(
        withConnectionQuery(`/api/agent-bridges/${type}/contexts`, connectionId),
      )
      if (!res.success || !res.data) {
        throw new Error(res.message || '获取可绑定上下文失败')
      }
      return res.data
    },

    async bindContext(type, contextId, connectionId) {
      const res = await client.post<BridgeBindContextResult>(
        `/api/agent-bridges/${type}/bind-context`,
        { contextId, connectionId },
      )
      if (!res.success || !res.data) {
        throw new Error(res.message || '绑定上下文失败')
      }
      return res.data
    },

    async syncAgent(type, connectionId) {
      const res = await client.post<BridgeSyncResult>(`/api/agent-bridges/${type}/sync`, {
        connectionId,
      })
      if (!res.success || !res.data) {
        throw new Error(res.message || '同步 Agent 失败')
      }
      return res.data
    },
  }
}

/** In-memory mock for UI development and unit tests without a running server. */
export function createMockBridgeSdk(options?: {
  autoConnectOnCheck?: boolean
  overrides?: Partial<Record<AgentBridgeType, Partial<AgentBridgeSetup>>>
}): BridgeSdk {
  const store = new Map<AgentBridgeType, AgentBridgeSetup>()
  const online = new Set<AgentBridgeType>()
  const sessionByType = new Map<AgentBridgeType, string>()
  const autoConnectOnCheck = options?.autoConnectOnCheck ?? true
  const setupOverrides = options?.overrides

  const ensureSetup = (type: AgentBridgeType): AgentBridgeSetup => {
    const existing = store.get(type)
    if (existing) return existing

    const appId = `demo-${type}-app`
    const appSecret = `demo-${type}-secret`
    const accountId = defaultAccountId(type)
    const setup: AgentBridgeSetup = {
      bridgeType: type,
      appId,
      appSecret,
      accountId,
      connectionId: `conn-${type}-demo`,
      connectChannel: BRIDGE_CONNECT_CHANNEL,
      wsBaseUrl: DEFAULT_BRIDGE_WS_URL,
      wsUrl: DEFAULT_BRIDGE_WS_URL,
      setupCommands: buildSetupCommands(type, {
        appId,
        appSecret,
        accountId,
        channel: BRIDGE_CONNECT_CHANNEL,
        wsUrl: `${DEFAULT_BRIDGE_WS_URL}/${type}`,
      }),
      ...setupOverrides?.[type],
    }
    store.set(type, setup)
    sessionByType.set(type, `mock-session-${type}`)
    return setup
  }

  const mockContexts: Record<AgentBridgeType, AgentBridgeBindableContext[]> = {
    codex: [{ id: 'project-1', label: 'demo-project', description: 'Codex workspace' }],
    claude: [{ id: 'project-1', label: 'demo-project', description: 'Claude project' }],
    hermes: [{ id: 'profile-default', label: 'default', description: 'Hermes profile' }],
    openclaw: [{ id: 'agent-main', label: 'main', description: 'OpenClaw agent' }],
  }

  const buildBindResult = (
    type: AgentBridgeType,
    contextId: string,
    contextName: string,
  ): BridgeBindContextResult => {
    const setup = ensureSetup(type)
    return {
      bridgeType: type,
      connectionId: setup.connectionId,
      contextId,
      contextName,
      sessionId: sessionByType.get(type) ?? `mock-session-${type}`,
      agentName: getAgentDisplayName(type),
    }
  }

  const client: BridgeHttpClient = {
    async get<T>(path: string): Promise<ApiResponse<T>> {
      const statusMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/status/)
      if (statusMatch) {
        const type = statusMatch[1] as AgentBridgeType
        if (autoConnectOnCheck && !online.has(type)) {
          online.add(type)
        }
        return ok({
          connected: online.has(type),
          bridgeType: type,
          accountId: ensureSetup(type).accountId,
          connectionId: ensureSetup(type).connectionId,
        }) as ApiResponse<T>
      }

      const setupMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/setup$/)
      if (setupMatch) {
        const type = setupMatch[1] as AgentBridgeType
        return ok(ensureSetup(type)) as ApiResponse<T>
      }

      const contextsMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/contexts/)
      if (contextsMatch) {
        const type = contextsMatch[1] as AgentBridgeType
        if (!online.has(type)) {
          return { code: 409, success: false, data: null, message: '本机 Agent 尚未连接' }
        }
        return ok(mockContexts[type] ?? []) as ApiResponse<T>
      }

      return { code: 404, success: false, data: null, message: `Mock route not found: ${path}` }
    },

    async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
      const refreshMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/setup\/refresh$/)
      if (refreshMatch) {
        const type = refreshMatch[1] as AgentBridgeType
        const setup = ensureSetup(type)
        const nextSecret = `${setup.appSecret}-refreshed`
        const next: AgentBridgeSetup = {
          ...setup,
          appSecret: nextSecret,
          setupCommands: buildSetupCommands(type, {
            appId: setup.appId,
            appSecret: nextSecret,
            accountId: setup.accountId,
            channel: setup.connectChannel ?? BRIDGE_CONNECT_CHANNEL,
            wsUrl: setup.wsUrl ?? setup.wsBaseUrl ?? `${DEFAULT_BRIDGE_WS_URL}/${type}`,
          }),
        }
        store.set(type, next)
        return ok(next) as ApiResponse<T>
      }

      const bindMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/bind-context$/)
      if (bindMatch) {
        const type = bindMatch[1] as AgentBridgeType
        online.add(type)
        const payload = (body ?? {}) as { contextId?: string }
        const contextId = payload.contextId ?? mockContexts[type]?.[0]?.id ?? 'default'
        const context = mockContexts[type]?.find((item) => item.id === contextId)
        return ok(
          buildBindResult(type, contextId, context?.label ?? contextId),
        ) as ApiResponse<T>
      }

      const syncMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/sync$/)
      if (syncMatch) {
        const type = syncMatch[1] as AgentBridgeType
        online.add(type)
        const setup = ensureSetup(type)
        return ok({
          bridgeType: type,
          connectionId: setup.connectionId,
          sessionId: sessionByType.get(type) ?? `mock-session-${type}`,
          agentName: getAgentDisplayName(type),
        }) as ApiResponse<T>
      }

      return { code: 404, success: false, data: null, message: `Mock route not found: ${path}` }
    },
  }

  return createRestBridgeSdk(client)
}

export { getAgentDisplayName }
export {
  buildLandingSubtitle,
  createMockAgentChatSdk,
  findMockHistoryItem,
  getAgentAvatar,
  parseAgentTypeFromSessionId,
} from './agent-chat'
export type { AgentChatSdk } from './agent-chat-types'
