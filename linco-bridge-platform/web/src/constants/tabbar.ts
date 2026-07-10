export type TabKey = 'messages' | 'bridge'

/** 助手 Tab 暂未开放；页面保留在 /pages/agents/index，恢复时加回 tabBar 与 TAB_ITEMS。 */
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
