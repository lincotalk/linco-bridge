import { beforeEach, describe, expect, it, vi } from 'vitest'



import type { ConnectedAgentItem } from '@/utils/connected-accounts'



const navigateTo = vi.fn()

const showToastMock = vi.fn()

const getSession = vi.fn()

const sessions = vi.fn(() => [] as Array<{ id: string; agentType: string; connectionId?: string }>)



vi.mock('@/stores', () => ({

  useSessionStore: () => ({

    getSession,

    sessions: sessions(),

  }),

}))



vi.mock('@/utils/format', () => ({

  showToast: (...args: unknown[]) => showToastMock(...args),

}))



vi.stubGlobal('uni', { navigateTo })



const { openConnectedAgent } = await import('@/utils/open-connected-agent')



describe('openConnectedAgent', () => {

  beforeEach(() => {

    navigateTo.mockClear()

    showToastMock.mockClear()

    getSession.mockReset()

    sessions.mockReset()

    sessions.mockReturnValue([])

  })



  const item: ConnectedAgentItem = {

    connectionId: 'conn-1',

    agentType: 'codex',

    accountId: 'codex_1',

    title: 'Codex',

    description: 'Codex CLI',

    avatar: '/static/agents/codex.png',

    status: 'online',

    sessionId: 'session-1',

    updatedAt: 1,

  }



  it('opens landing page with connectionId from connected agent', () => {

    openConnectedAgent(item)



    expect(navigateTo).toHaveBeenCalledWith({

      url: '/pages/chat/landing?agentType=codex&connectionId=conn-1',

    })

  })



  it('prefers session store connectionId when matched', () => {

    getSession.mockReturnValue({

      id: 'session-1',

      agentType: 'codex',

      connectionId: 'conn-from-session',

      title: 'Codex-dd',

      lastMessage: '',

      updatedAt: 1,

      online: true,

    })



    openConnectedAgent(item)



    expect(navigateTo).toHaveBeenCalledWith({

      url: '/pages/chat/landing?agentType=codex&connectionId=conn-from-session',

    })

  })



  it('shows toast when connectionId is missing', () => {

    openConnectedAgent({ ...item, connectionId: '' })



    expect(showToastMock).toHaveBeenCalledWith('助手连接信息无效')

    expect(navigateTo).not.toHaveBeenCalled()

  })

})

