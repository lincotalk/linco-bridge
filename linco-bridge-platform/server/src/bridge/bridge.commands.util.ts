export function quoteBridgeCommandArg(value: string): string {
  const trimmed = value.trim()
  if (/[\s"\\]/.test(trimmed)) {
    return `"${trimmed.replace(/"/g, '\\"')}"`
  }
  return trimmed
}

export function buildHistoryReloadCommand(input: {
  limit?: number
  projectPath?: string | null
  agentSessionId?: string | null
}): string {
  const limit = input.limit && input.limit > 0 ? Math.floor(input.limit) : 0
  const projectPath = input.projectPath?.trim() ?? ''
  const agentSessionId = input.agentSessionId?.trim() ?? ''

  if (projectPath && agentSessionId) {
    const suffix = limit > 0 ? ` ${limit}` : ''
    return `/history-reload --project ${quoteBridgeCommandArg(projectPath)} --session ${quoteBridgeCommandArg(agentSessionId)}${suffix}`
  }

  return limit > 0 ? `/history-reload ${limit}` : '/history-reload'
}

/** Read-only history fetch — aligned with Flutter `bridgeHistoryCommandForSelection`. */
export function buildHistoryCommand(input: {
  limit?: number
  projectPath?: string | null
  agentSessionId?: string | null
  bridgeType?: string | null
}): string {
  const limit = input.limit && input.limit > 0 ? Math.floor(input.limit) : 0
  const projectPath = input.projectPath?.trim() ?? ''
  const agentSessionId = input.agentSessionId?.trim() ?? ''
  const suffix = limit > 0 ? ` ${limit}` : ''

  if (!projectPath && agentSessionId && input.bridgeType === 'codex') {
    return `/history --chat ${quoteBridgeCommandArg(agentSessionId)}${suffix}`
  }

  if (projectPath && agentSessionId) {
    return `/history --project ${quoteBridgeCommandArg(projectPath)} --session ${quoteBridgeCommandArg(agentSessionId)}${suffix}`
  }

  return limit > 0 ? `/history ${limit}` : '/history'
}

export interface SessionsItemPayload {
  id?: string
  title?: string
  firstMessage?: string
  bindCommand?: string
  workspace?: string
}

export interface SessionsPayload {
  workspace?: string
  items?: SessionsItemPayload[]
}

export interface ProjectItemPayload {
  label?: string
  name?: string
  path?: string
  command?: string
}

export interface ProjectsPayload {
  currentWorkspace?: string
  items?: ProjectItemPayload[]
}

export function parseSessionsPayload(data: unknown): SessionsPayload | null {
  if (!data || typeof data !== 'object') return null
  return data as SessionsPayload
}

export function parseProjectsPayload(data: unknown): ProjectsPayload | null {
  if (!data || typeof data !== 'object') return null
  return data as ProjectsPayload
}

export function buildSessionsCommand(projectPath?: string | null, limit = 10): string {
  const normalized = projectPath?.trim() ?? ''
  if (normalized) {
    return `/sessions --project ${quoteBridgeCommandArg(normalized)} ${limit}`
  }
  return `/sessions ${limit}`
}

export function buildSelectProjectCommand(projectPath: string): string {
  const normalized = projectPath.trim()
  if (!normalized) {
    throw new Error('projectPath required')
  }
  return `/project --select ${quoteBridgeCommandArg(normalized)}`
}

export function buildBindCommand(input: {
  projectPath?: string | null
  agentSessionId: string
}): string {
  const agentSessionId = input.agentSessionId.trim()
  if (!agentSessionId) {
    throw new Error('agentSessionId required')
  }
  const projectPath = input.projectPath?.trim() ?? ''
  if (projectPath) {
    return `/bind --project ${quoteBridgeCommandArg(projectPath)} ${quoteBridgeCommandArg(agentSessionId)}`
  }
  return `/bind --chat ${quoteBridgeCommandArg(agentSessionId)}`
}

export function formatSlashPayload(payload: Record<string, unknown>): string {
  const items = payload.items
  if (Array.isArray(items) && items.length > 0) {
    return items
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>
          const command =
            typeof record.command === 'string'
              ? record.command
              : typeof record.name === 'string'
                ? record.name
                : ''
          const description =
            typeof record.description === 'string'
              ? record.description
              : typeof record.summary === 'string'
                ? record.summary
                : ''
          if (command && description) return `${command} — ${description}`
          return command || description || JSON.stringify(record)
        }
        return String(item)
      })
      .join('\n')
  }

  if (typeof payload.text === 'string' && payload.text.trim()) {
    return payload.text.trim()
  }

  return JSON.stringify(payload, null, 2)
}

export interface AgentPickerItemPayload {
  id?: string
  name?: string
  model?: string
  workspace?: string
  bindCommand?: string
  command?: string
}

export interface ProfilePickerItemPayload {
  name?: string
  bindCommand?: string
  command?: string
}

export interface AgentPickerPayload {
  items?: AgentPickerItemPayload[]
}

export interface ProfilePickerPayload {
  items?: ProfilePickerItemPayload[]
}

export function parseAgentPickerPayload(data: unknown): AgentPickerPayload | null {
  if (!data || typeof data !== 'object') return null
  return data as AgentPickerPayload
}

export function parseProfilePickerPayload(data: unknown): ProfilePickerPayload | null {
  if (!data || typeof data !== 'object') return null
  return data as ProfilePickerPayload
}
