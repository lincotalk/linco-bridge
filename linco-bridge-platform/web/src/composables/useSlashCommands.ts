import { ref } from 'vue'
import { runAgentBridgeCommand, runSessionBridgeCommand } from '@/api/session-api'
import { supportsBridgeSlashCommands } from '@/bridge/constants'
import {
  slashCommandsFromHelpPayload,
  type SlashCommandItem,
} from '@/bridge/slash-command'
import type { AgentBridgeType } from '@/bridge/types'
import {
  readSlashCommandsFromCache,
  writeSlashCommandsToCache,
} from '@/utils/slash-command-cache'

export interface SlashCommandsLoadParams {
  agentType: AgentBridgeType
  connectionId?: string
  sessionId?: string
}

export function useSlashCommands() {
  const commands = ref<SlashCommandItem[]>([])

  async function loadFromRemote(params: SlashCommandsLoadParams) {
    const { agentType, connectionId, sessionId } = params
    if (!supportsBridgeSlashCommands(agentType)) {
      commands.value = []
      return []
    }

    const result = sessionId?.trim()
      ? await runSessionBridgeCommand(sessionId.trim(), '/help')
      : await runAgentBridgeCommand(agentType, '/help', connectionId)

    const parsed = slashCommandsFromHelpPayload(result.payload)
    if (parsed.length > 0) {
      writeSlashCommandsToCache(agentType, connectionId, sessionId, parsed)
      commands.value = parsed
    }
    return parsed
  }

  async function preload(params: SlashCommandsLoadParams) {
    const { agentType, connectionId, sessionId } = params
    if (!supportsBridgeSlashCommands(agentType)) {
      commands.value = []
      return
    }

    const cached = readSlashCommandsFromCache(agentType, connectionId, sessionId)
    if (cached.length > 0) {
      commands.value = cached
    }

    try {
      await loadFromRemote(params)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.debug('[useSlashCommands] preload failed', error)
      }
    }
  }

  return {
    commands,
    preload,
    loadFromRemote,
  }
}
