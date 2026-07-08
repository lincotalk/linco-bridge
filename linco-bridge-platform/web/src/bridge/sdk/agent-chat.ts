import { getAgentDisplayName } from '../commands'
import { buildBridgeHeaderSubtitle } from '@/utils/chat-header'
import type {
  AgentBridgeType,
  AgentHistoryItem,
  AgentLandingHeader,
  StartConversationInput,
  StartConversationResult,
} from '../types'
import type { AgentChatSdk } from './agent-chat-types'

const BRIDGE_AVATAR: Record<AgentBridgeType, string> = {
  codex: '/static/icons/bot/bridge_codex.png',
  claude: '/static/icons/bot/bridge_claude.png',
  hermes: '/static/icons/bot/bridge_hermes.png',
  openclaw: '/static/icons/bot/bridge_claw.png',
}

function todayAt(hour: number, minute: number): number {
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  return date.getTime()
}

const MOCK_HISTORY: Record<AgentBridgeType, AgentHistoryItem[]> = {
  codex: [
    {
      id: 'hist-codex-admin',
      title: 'AIChat-Admin',
      preview: '我会先按本会话的技能规则加载基础流程，然…',
      updatedAt: todayAt(10, 28),
    },
    {
      id: 'hist-codex-bpms',
      title: 'bpms-workbench',
      preview: 'D:\\project\\bpms-workbench',
      projectPath: 'D:\\project\\bpms-workbench',
      updatedAt: todayAt(9, 55),
    },
    {
      id: 'hist-codex-bims',
      title: 'ddjf-bims',
      preview: 'D:\\project\\ddjf-bims',
      projectPath: 'D:\\project\\ddjf-bims',
      updatedAt: todayAt(9, 55),
    },
    {
      id: 'hist-codex-bridge',
      title: 'linco-bridge-platform',
      preview: '整理 demo 平台 web/server 目录结构',
      updatedAt: todayAt(8, 12),
    },
  ],
  claude: [
    {
      id: 'hist-claude-admin',
      title: 'AIChat-Admin',
      preview: 'Claude Code 工作区会话',
      updatedAt: todayAt(10, 15),
    },
    {
      id: 'hist-claude-bridge',
      title: 'linco-bridge-platform',
      preview: '对齐 demo 平台 Claude Code 能力',
      projectPath: 'D:\\project\\linco-bridge',
      updatedAt: todayAt(9, 40),
    },
    {
      id: 'hist-claude-1',
      title: '新的会话',
      preview: 'Waiting for bridge connection.',
      updatedAt: todayAt(9, 30),
    },
  ],
  hermes: [
    {
      id: 'hist-hermes-1',
      title: '新的会话',
      preview: 'Waiting for bridge connection.',
      updatedAt: todayAt(9, 30),
    },
  ],
  openclaw: [
    {
      id: 'hist-openclaw-1',
      title: '新的会话',
      preview: 'Waiting for bridge connection.',
      updatedAt: todayAt(9, 30),
    },
  ],
}

const MOCK_DEVICE_ID: Record<AgentBridgeType, string> = {
  codex: 'HQ-TS-0182',
  claude: 'HQ-TS-0183',
  hermes: 'HQ-TS-0184',
  openclaw: 'HQ-TS-0185',
}

const MOCK_BOUND_CONTEXT: Partial<Record<AgentBridgeType, string>> = {
  hermes: 'Default Profile',
  openclaw: 'main',
}

/** In-memory mock for landing UI when VITE_USE_REMOTE_API=false. */
export function createMockAgentChatSdk(options?: {
  online?: Partial<Record<AgentBridgeType, boolean>>
}): AgentChatSdk {
  const online = new Map<AgentBridgeType, boolean>(
    Object.entries(options?.online ?? {}) as [AgentBridgeType, boolean][],
  )
  const hiddenIds = new Set<string>()

  return {
    async getLandingHeader(agentType) {
      const connected = online.get(agentType) ?? false
      return {
        agentType,
        title: getAgentDisplayName(agentType),
        avatar: BRIDGE_AVATAR[agentType],
        deviceId: MOCK_DEVICE_ID[agentType],
        boundContextName: MOCK_BOUND_CONTEXT[agentType],
        status: connected ? 'online' : 'offline',
      }
    },

    async listHistory(agentType, opts) {
      const limit = opts?.limit ?? 50
      const offset = opts?.offset ?? 0
      return (MOCK_HISTORY[agentType] ?? [])
        .filter((item) => !hiddenIds.has(item.id))
        .slice(offset, offset + limit)
    },

    async hideHistorySessions(_agentType, sessionIds) {
      const unique = [...new Set(sessionIds.map((id) => id.trim()).filter(Boolean))]
      unique.forEach((id) => hiddenIds.add(id))
      return unique.length
    },

    async startConversation(input: StartConversationInput): Promise<StartConversationResult> {
      const slug = input.tempSession ? `temp-${Date.now()}` : 'new'
      return {
        sessionId: `${input.agentType}-${slug}`,
      }
    },

    async pickWorkspace(_agentType) {
      return null
    },

    openAgentPanel(_agentType) {
      // Plugin phase: open native side panel
    },
  }
}

export function buildLandingSubtitle(header: AgentLandingHeader): string {
  return buildBridgeHeaderSubtitle(
    header.agentType,
    header.status === 'online',
    header.deviceId,
    header.boundContextName,
  )
}

export function getAgentAvatar(agentType: AgentBridgeType): string {
  return BRIDGE_AVATAR[agentType]
}

/** Resolve mock landing history row by id (hist-* sessions from landing page). */
export function findMockHistoryItem(sessionId: string): AgentHistoryItem | undefined {
  for (const items of Object.values(MOCK_HISTORY)) {
    const found = items.find((item) => item.id === sessionId)
    if (found) return found
  }
  return undefined
}

export function parseAgentTypeFromSessionId(sessionId: string): AgentBridgeType | null {
  const histMatch = sessionId.match(/^hist-(codex|claude|hermes|openclaw)-/)
  if (histMatch?.[1]) return histMatch[1] as AgentBridgeType

  for (const type of Object.keys(BRIDGE_AVATAR) as AgentBridgeType[]) {
    if (sessionId.startsWith(`${type}-`)) return type
  }
  return null
}

export function parseAgentTypeFromQuery(value: string | undefined | null): AgentBridgeType | null {
  const normalized = value?.trim() ?? ''
  if (!normalized) return null
  return (Object.keys(BRIDGE_AVATAR) as AgentBridgeType[]).includes(normalized as AgentBridgeType)
    ? (normalized as AgentBridgeType)
    : null
}

/** Resolve agent type from session metadata, query, or legacy sessionId prefix. */
export function resolveSessionAgentType(input: {
  sessionId?: string
  sessionAgentType?: AgentBridgeType | null
  queryAgentType?: AgentBridgeType | null
}): AgentBridgeType | null {
  if (input.sessionAgentType) return input.sessionAgentType
  if (input.queryAgentType) return input.queryAgentType
  if (input.sessionId?.trim()) return parseAgentTypeFromSessionId(input.sessionId.trim())
  return null
}

export function appendAgentTypeQuery(
  params: URLSearchParams,
  agentType: AgentBridgeType | null | undefined,
): URLSearchParams {
  if (agentType) params.set('agentType', agentType)
  return params
}
