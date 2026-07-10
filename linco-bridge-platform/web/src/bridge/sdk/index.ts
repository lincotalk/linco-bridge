import {
  BRIDGE_CONNECT_CHANNEL,
  buildSetupCommands,
  defaultAccountId,
  generateConnectionAccountId,
  DEFAULT_BRIDGE_WS_URL,
  getAgentBridgeSubtitle,
  getAgentDisplayName,
} from '../commands'
import type {
  AgentBridgeBindableContext,
  AgentBridgeConnectionDetail,
  AgentBridgeSetup,
  AgentBridgeType,
  ApiResponse,
  BridgeBindContextResult,
  BridgeConnectionDeleteResult,
  BridgeProjectItem,
  BridgeStatusResult,
  BridgeSyncResult,
  BridgeWorkspaceApplyInput,
  BridgeWorkspaceSelection,
  BridgeWorkspaceSession,
  BridgeSettingsOptions,
  BridgeSessionSettings,
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
    async getSetup(type, connectionId) {
      const res = await client.get<AgentBridgeSetup>(
        withConnectionQuery(`/api/agent-bridges/${type}/setup`, connectionId),
      )
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

    async listProjects(type, connectionId) {
      const res = await client.get<BridgeProjectItem[]>(
        withConnectionQuery(`/api/agent-bridges/${type}/projects`, connectionId),
      )
      if (!res.success || !res.data) {
        throw new Error(res.message || '获取工作区列表失败')
      }
      return res.data
    },

    async selectProject(type, projectPath, connectionId) {
      const res = await client.post<{ projectPath: string; projectName: string }>(
        `/api/agent-bridges/${type}/select-project`,
        { projectPath, connectionId },
      )
      if (!res.success || !res.data) {
        throw new Error(res.message || '切换工作区失败')
      }
      return res.data
    },

    async listProjectSessions(type, projectPath, connectionId, limit = 10) {
      const params = new URLSearchParams({
        projectPath,
        limit: String(limit),
      })
      if (connectionId?.trim()) params.set('connectionId', connectionId.trim())
      const res = await client.get<BridgeWorkspaceSession[]>(
        `/api/agent-bridges/${type}/sessions?${params.toString()}`,
      )
      if (!res.success || !res.data) {
        throw new Error(res.message || '获取项目会话失败')
      }
      return res.data
    },

    async listChats(type, connectionId, limit = 10) {
      const params = new URLSearchParams({ limit: String(limit) })
      if (connectionId?.trim()) params.set('connectionId', connectionId.trim())
      const res = await client.get<BridgeWorkspaceSession[]>(
        `/api/agent-bridges/${type}/chats?${params.toString()}`,
      )
      if (!res.success || !res.data) {
        throw new Error(res.message || '获取对话列表失败')
      }
      return res.data
    },

    async applyWorkspaceSelection(type, input) {
      const res = await client.post<BridgeWorkspaceSelection>(
        `/api/agent-bridges/${type}/workspace/apply`,
        input,
      )
      if (!res.success || !res.data) {
        throw new Error(res.message || '绑定工作区失败')
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

    async getConnectionDetail(type, connectionId) {
      const res = await client.get<AgentBridgeConnectionDetail>(
        withConnectionQuery(`/api/agent-bridges/${type}/connection-detail`, connectionId),
      )
      if (!res.success || !res.data) {
        throw new Error(res.message || '加载连接配置失败')
      }
      return res.data
    },

    async renameConnection(type, connectionId, displayName) {
      const res = await client.post<AgentBridgeConnectionDetail>(
        `/api/agent-bridges/${type}/connection/rename`,
        { connectionId, displayName },
      )
      if (!res.success || !res.data) {
        throw new Error(res.message || '保存名称失败')
      }
      return res.data
    },

    async deleteConnection(type, connectionId) {
      const res = await client.post<BridgeConnectionDeleteResult>(
        `/api/agent-bridges/${type}/connection/delete`,
        { connectionId },
      )
      if (!res.success || !res.data) {
        throw new Error(res.message || '删除机器人失败')
      }
      return res.data
    },

    async loadSettingsOptions(type, connectionId, sessionId) {
      const params = new URLSearchParams()
      if (connectionId?.trim()) params.set('connectionId', connectionId.trim())
      if (sessionId?.trim()) params.set('sessionId', sessionId.trim())
      const query = params.toString()
      const res = await client.get<BridgeSettingsOptions>(
        `/api/agent-bridges/${type}/settings/options${query ? `?${query}` : ''}`,
      )
      if (!res.success || !res.data) {
        throw new Error(res.message || '加载模型与推理设置失败')
      }
      return res.data
    },

    async updateBridgeSettings(type, input) {
      const res = await client.post<BridgeSessionSettings>(
        `/api/agent-bridges/${type}/settings/update`,
        input,
      )
      if (!res.success || !res.data) {
        throw new Error(res.message || '更新模型与推理设置失败')
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

      const projectsMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/projects/)
      if (projectsMatch) {
        const type = projectsMatch[1] as AgentBridgeType
        if (!online.has(type)) {
          return { code: 409, success: false, data: null, message: '本机 Agent 尚未连接' }
        }
        return ok([
          {
            id: 'D:\\project\\demo',
            name: 'demo',
            path: 'D:\\project\\demo',
            selectCommand: '/project --select "D:\\project\\demo"',
            sessionsCommand: '/sessions --project "D:\\project\\demo" 10',
          },
          {
            id: 'D:\\project\\aichat',
            name: 'aichat',
            path: 'D:\\project\\aichat',
            selectCommand: '/project --select "D:\\project\\aichat"',
            sessionsCommand: '/sessions --project "D:\\project\\aichat" 10',
          },
        ]) as ApiResponse<T>
      }

      const sessionsMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/sessions/)
      if (sessionsMatch) {
        return ok([
          {
            id: 'session-a',
            title: 'First session',
            bindCommand: '/bind --project "D:\\project\\demo" session-a',
          },
        ]) as ApiResponse<T>
      }

      const chatsMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/chats/)
      if (chatsMatch) {
        return ok([
          {
            id: 'chat-a',
            title: 'Codex chat',
            bindCommand: '/bind --chat chat-a',
          },
        ]) as ApiResponse<T>
      }

      const connectionDetailMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/connection-detail/)
      if (connectionDetailMatch) {
        const type = connectionDetailMatch[1] as AgentBridgeType
        const setup = ensureSetup(type)
        const detail: AgentBridgeConnectionDetail = {
          bridgeType: type,
          connectionId: setup.connectionId,
          displayName: getAgentDisplayName(type),
          description: getAgentBridgeSubtitle(type),
          avatar: `/static/icons/bot/bridge_${type === 'openclaw' ? 'claw' : type}.png`,
          appId: setup.appId,
          appSecret: setup.appSecret,
          accountId: setup.accountId,
          status: online.has(type) ? 'online' : 'offline',
          deviceName: 'HQ-TS-0182',
          lastSeenAt: Date.now(),
          clientVersion: '1.2.29',
          setupCommands: setup.setupCommands,
          connectChannel: setup.connectChannel,
        }
        return ok(detail) as ApiResponse<T>
      }

      return { code: 404, success: false, data: null, message: `Mock route not found: ${path}` }
    },

    async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
      const refreshMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/setup\/refresh$/)
      if (refreshMatch) {
        const type = refreshMatch[1] as AgentBridgeType
        const setup = ensureSetup(type)
        const nextConnectionId = `conn-${type}-${Date.now()}`
        const nextSecret = `${setup.appSecret}-refreshed-${Date.now()}`
        const nextAccountId = generateConnectionAccountId(type)
        const nextAppId = `demo-${type}-${Date.now()}-app`
        const next: AgentBridgeSetup = {
          ...setup,
          appId: nextAppId,
          appSecret: nextSecret,
          accountId: nextAccountId,
          connectionId: nextConnectionId,
          setupCommands: buildSetupCommands(type, {
            appId: nextAppId,
            appSecret: nextSecret,
            accountId: nextAccountId,
            channel: setup.connectChannel ?? BRIDGE_CONNECT_CHANNEL,
            wsUrl: setup.wsUrl,
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

      const selectProjectMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/select-project$/)
      if (selectProjectMatch) {
        const payload = (body ?? {}) as { projectPath?: string }
        const projectPath = payload.projectPath ?? 'D:\\project\\demo'
        return ok({
          projectPath,
          projectName: projectPath.split(/[/\\]/).pop() ?? projectPath,
        }) as ApiResponse<T>
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

      const applyMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/workspace\/apply$/)
      if (applyMatch) {
        const type = applyMatch[1] as AgentBridgeType
        const payload = (body ?? {}) as BridgeWorkspaceApplyInput
        const sessionId = payload.platformSessionId ?? sessionByType.get(type) ?? `mock-session-${type}`
        return ok({
          sessionId,
          title: payload.sessionTitle ?? payload.projectName ?? 'demo',
          projectPath: payload.projectPath ?? '',
          projectName: payload.projectName ?? payload.projectPath ?? 'demo',
          agentSessionId: payload.agentSessionId,
        }) as ApiResponse<T>
      }

      const settingsOptionsMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/settings\/options/)
      if (settingsOptionsMatch) {
        const options: BridgeSettingsOptions = {
          reasoning: {
            currentId: 'medium',
            defaultId: 'medium',
            model: 'gpt-5.4',
            options: [
              { id: 'low', label: 'Low' },
              { id: 'medium', label: 'Medium' },
              { id: 'high', label: 'High' },
              { id: 'xhigh', label: 'Extra High' },
            ],
          },
          model: {
            items: [
              { id: 'gpt-5.4', label: 'GPT-5.4' },
              { id: 'gpt-5.5', label: 'GPT-5.5' },
            ],
          },
        }
        return ok(options) as ApiResponse<T>
      }

      const settingsUpdateMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/settings\/update$/)
      if (settingsUpdateMatch) {
        const payload = (body ?? {}) as {
          reasoningEffort?: string
          modelId?: string
          modelName?: string
        }
        const next: BridgeSessionSettings = {
          ...(payload.reasoningEffort?.trim()
            ? { reasoningEffort: payload.reasoningEffort.trim() }
            : {}),
          ...(payload.modelId?.trim()
            ? {
                modelId: payload.modelId.trim(),
                modelName: payload.modelName?.trim() || payload.modelId.trim(),
              }
            : {}),
          updatedAt: Date.now(),
        }
        return ok(next) as ApiResponse<T>
      }

      const renameMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/connection\/rename$/)
      if (renameMatch) {
        const type = renameMatch[1] as AgentBridgeType
        const setup = ensureSetup(type)
        const payload = (body ?? {}) as { displayName?: string }
        const detail: AgentBridgeConnectionDetail = {
          bridgeType: type,
          connectionId: setup.connectionId,
          displayName: payload.displayName?.trim() || getAgentDisplayName(type),
          description: getAgentBridgeSubtitle(type),
          avatar: `/static/icons/bot/bridge_${type === 'openclaw' ? 'claw' : type}.png`,
          appId: setup.appId,
          appSecret: setup.appSecret,
          accountId: setup.accountId,
          status: online.has(type) ? 'online' : 'offline',
          deviceName: 'HQ-TS-0182',
          lastSeenAt: Date.now(),
          clientVersion: '1.2.29',
          setupCommands: setup.setupCommands,
          connectChannel: setup.connectChannel,
        }
        return ok(detail) as ApiResponse<T>
      }

      const deleteMatch = path.match(/^\/api\/agent-bridges\/(\w+)\/connection\/delete$/)
      if (deleteMatch) {
        const type = deleteMatch[1] as AgentBridgeType
        const setup = ensureSetup(type)
        online.delete(type)
        const result: BridgeConnectionDeleteResult = {
          deleted: true,
          commandSent: false,
          connectionId: setup.connectionId,
        }
        return ok(result) as ApiResponse<T>
      }

      return { code: 404, success: false, data: null, message: `Mock route not found: ${path}` }
    },
  }

  return createRestBridgeSdk(client)
}

export { getAgentDisplayName }
export {
  buildLandingSubtitle,
  getAgentAvatar,
  parseAgentTypeFromSessionId,
} from './agent-chat'
export type { AgentChatSdk } from './agent-chat-types'
