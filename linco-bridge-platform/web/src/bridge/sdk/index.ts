import { buildSetupCommands, defaultAccountId, getAgentDisplayName } from '../commands'
import type {
  AgentBridgeBindableContext,
  AgentBridgeSetup,
  AgentBridgeType,
  ApiResponse,
  BridgeStatusResult,
} from '../types'
import type { BridgeHttpClient, BridgeSdk } from './types'

function ok<T>(data: T): ApiResponse<T> {
  return { code: 0, success: true, data, message: '' }
}

/** Phase 1 REST implementation — routes match future linco-bridge-platform server. */
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

    async checkStatus(type) {
      const res = await client.get<BridgeStatusResult>(`/api/agent-bridges/${type}/status`)
      if (!res.success || !res.data) {
        throw new Error(res.message || '检测连接状态失败')
      }
      return res.data
    },

    async listContexts(type) {
      const res = await client.get<AgentBridgeBindableContext[]>(
        `/api/agent-bridges/${type}/contexts`,
      )
      if (!res.success || !res.data) {
        throw new Error(res.message || '获取可绑定上下文失败')
      }
      return res.data
    },

    async bindContext(type, contextId) {
      const res = await client.post<null>(`/api/agent-bridges/${type}/bind-context`, {
        contextId,
      })
      if (!res.success) {
        throw new Error(res.message || '绑定上下文失败')
      }
    },
  }
}

/** In-memory mock for UI development and unit tests without a running server. */
export function createMockBridgeSdk(
  overrides?: Partial<Record<AgentBridgeType, Partial<AgentBridgeSetup>>>,
): BridgeSdk {
  const store = new Map<AgentBridgeType, AgentBridgeSetup>()
  const online = new Set<AgentBridgeType>()

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
      setupCommands: buildSetupCommands(type, { appId, appSecret, accountId }),
      ...overrides?.[type],
    }
    store.set(type, setup)
    return setup
  }

  const mockContexts: Record<AgentBridgeType, AgentBridgeBindableContext[]> = {
    codex: [{ id: 'project-1', label: 'demo-project', description: 'Codex workspace' }],
    claude: [{ id: 'project-1', label: 'demo-project', description: 'Claude project' }],
    hermes: [{ id: 'profile-default', label: 'default', description: 'Hermes profile' }],
    openclaw: [{ id: 'agent-main', label: 'main', description: 'OpenClaw agent' }],
  }

  const client: BridgeHttpClient = {
    async get<T>(path: string): Promise<ApiResponse<T>> {
      const statusMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/status$/)
      if (statusMatch) {
        const type = statusMatch[1] as AgentBridgeType
        return ok({
          connected: online.has(type),
          bridgeType: type,
          accountId: ensureSetup(type).accountId,
        }) as ApiResponse<T>
      }

      const setupMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/setup$/)
      if (setupMatch) {
        const type = setupMatch[1] as AgentBridgeType
        return ok(ensureSetup(type)) as ApiResponse<T>
      }

      const contextsMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/contexts$/)
      if (contextsMatch) {
        const type = contextsMatch[1] as AgentBridgeType
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
          }),
        }
        store.set(type, next)
        return ok(next) as ApiResponse<T>
      }

      const bindMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/bind-context$/)
      if (bindMatch) {
        const type = bindMatch[1] as AgentBridgeType
        online.add(type)
        void body
        return ok(null) as ApiResponse<T>
      }

      return { code: 404, success: false, data: null, message: `Mock route not found: ${path}` }
    },
  }

  return createRestBridgeSdk(client)
}

export { getAgentDisplayName }
