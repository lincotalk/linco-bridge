import type { Ref } from 'vue'

import type { AgentBridgeType } from '@/bridge/types'
import { runAgentBridgeCommand, runSessionBridgeCommand } from '@/api/session-api'
import { showIosActionSheet } from '@/utils/ios-action-sheet'
import { showToast } from '@/utils/format'

export const AGENT_PANEL_MENU_ITEMS = [
  'Agent 状态',
  '帮助命令',
  '刷新历史',
  'Agent 重载',
  '当前目录',
] as const

export type AgentPanelMenuItem = (typeof AGENT_PANEL_MENU_ITEMS)[number]

export interface AgentPanelMenuContext {
  sessionId?: Ref<string>
  agentType?: Ref<AgentBridgeType | null>
  connectionId?: Ref<string | undefined>
  onReloadHistory?: () => Promise<void>
}

export async function runAgentPanelCommand(
  context: AgentPanelMenuContext,
  command: string,
) {
  if (context.sessionId?.value) {
    return runSessionBridgeCommand(context.sessionId.value, command)
  }
  if (context.agentType?.value) {
    return runAgentBridgeCommand(
      context.agentType.value,
      command,
      context.connectionId?.value,
    )
  }
  throw new Error('缺少 Agent 上下文')
}

async function showCommandResult(context: AgentPanelMenuContext, command: string) {
  try {
    const result = await runAgentPanelCommand(context, command)
    uni.showModal({
      title: result.command,
      content: result.text || '命令已执行',
      showCancel: false,
    })
  } catch (err) {
    showToast(err instanceof Error ? err.message : '命令执行失败')
  }
}

export async function handleAgentPanelMenuIndex(
  context: AgentPanelMenuContext,
  tapIndex: number,
) {
  if (tapIndex === 0) {
    await showCommandResult(context, '/status')
    return
  }
  if (tapIndex === 1) {
    await showCommandResult(context, '/help')
    return
  }
  if (tapIndex === 2) {
    if (context.onReloadHistory) {
      try {
        await context.onReloadHistory()
        showToast('历史已刷新', 'success')
      } catch (err) {
        showToast(err instanceof Error ? err.message : '刷新历史失败')
      }
      return
    }
    showToast('请先进入会话后再刷新历史')
    return
  }
  if (tapIndex === 3) {
    try {
      await runAgentPanelCommand(context, '/reload')
      if (context.onReloadHistory) {
        await context.onReloadHistory()
      }
      showToast('Agent 已重载', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Agent 重载失败')
    }
    return
  }
  if (tapIndex === 4) {
    await showCommandResult(context, '/pwd')
  }
}

export async function openAgentPanelMenu(context: AgentPanelMenuContext) {
  const tapIndex = await showIosActionSheet([...AGENT_PANEL_MENU_ITEMS])
  if (tapIndex === null) return
  await handleAgentPanelMenuIndex(context, tapIndex)
}
