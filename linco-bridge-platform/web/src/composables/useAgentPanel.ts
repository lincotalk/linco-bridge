import type { Ref } from 'vue'
import type { AgentBridgeType } from '@/bridge/types'
import { runAgentBridgeCommand, runSessionBridgeCommand } from '@/api/session-api'
import { showToast } from '@/utils/format'

export function useAgentPanel(options: {
  sessionId?: Ref<string>
  agentType?: Ref<AgentBridgeType | null>
  onReloadHistory?: () => Promise<void>
}) {
  async function runCommand(command: string) {
    if (options.sessionId?.value) {
      return runSessionBridgeCommand(options.sessionId.value, command)
    }
    if (options.agentType?.value) {
      return runAgentBridgeCommand(options.agentType.value, command)
    }
    throw new Error('缺少 Agent 上下文')
  }

  async function showCommandResult(command: string) {
    try {
      const result = await runCommand(command)
      uni.showModal({
        title: result.command,
        content: result.text || '命令已执行',
        showCancel: false,
      })
    } catch (err) {
      showToast(err instanceof Error ? err.message : '命令执行失败')
    }
  }

  function openPanel() {
    uni.showActionSheet({
      itemList: ['Agent 状态', '帮助命令', '刷新历史', 'Agent 重载', '当前目录'],
      success: (res) => {
        void (async () => {
          if (res.tapIndex === 0) {
            await showCommandResult('/status')
            return
          }
          if (res.tapIndex === 1) {
            await showCommandResult('/help')
            return
          }
          if (res.tapIndex === 2) {
            if (options.onReloadHistory) {
              try {
                await options.onReloadHistory()
                showToast('历史已刷新', 'success')
              } catch (err) {
                showToast(err instanceof Error ? err.message : '刷新历史失败')
              }
              return
            }
            showToast('请先进入会话后再刷新历史')
            return
          }
          if (res.tapIndex === 3) {
            try {
              await runCommand('/reload')
              if (options.onReloadHistory) {
                await options.onReloadHistory()
              }
              showToast('Agent 已重载', 'success')
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Agent 重载失败')
            }
            return
          }
          if (res.tapIndex === 4) {
            await showCommandResult('/pwd')
          }
        })()
      },
    })
  }

  return { openPanel, runCommand }
}
