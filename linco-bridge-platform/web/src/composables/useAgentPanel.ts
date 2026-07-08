import type { Ref } from 'vue'



import type { AgentBridgeType } from '@/bridge/types'

import { openAgentPanelMenu } from '@/utils/agent-panel-menu'



export function useAgentPanel(options: {

  sessionId?: Ref<string>

  agentType?: Ref<AgentBridgeType | null>

  connectionId?: Ref<string | undefined>

  onReloadHistory?: () => Promise<void>

}) {

  function openPanel() {

    void openAgentPanelMenu({

      sessionId: options.sessionId,

      agentType: options.agentType,

      connectionId: options.connectionId,

      onReloadHistory: options.onReloadHistory,

    })

  }



  return { openPanel }

}

