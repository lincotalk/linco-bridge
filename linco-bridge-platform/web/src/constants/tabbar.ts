export type TabKey = 'messages' | 'agents' | 'bridge'

export const AGENTS_TAB_ROUTE = '/pages/agents/index'

export interface TabItem {
  key: TabKey
  label: string
  route: string
}

export const TAB_ITEMS: readonly TabItem[] = [
  {
    key: 'messages',
    label: '消息',
    route: '/pages/messages/index',
  },
  {
    key: 'agents',
    label: '助手',
    route: AGENTS_TAB_ROUTE,
  },
  {
    key: 'bridge',
    label: '桥接',
    route: '/pages/bridge/index',
  },
] as const

export function switchRootTab(key: TabKey): void {
  const target = TAB_ITEMS.find((item) => item.key === key)
  if (!target) return
  uni.switchTab({ url: target.route })
}
