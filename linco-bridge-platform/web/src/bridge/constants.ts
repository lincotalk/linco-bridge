import type { AgentBridgeType, BridgeSourceCard } from './types'

/** Bridge tab cards — aligned with Flutter create_bot_page (first 4 items only). */
export const BRIDGE_SOURCE_CARDS: readonly BridgeSourceCard[] = [
  {
    type: 'codex',
    title: '从 Codex 导入',
    subtitle: '将手机与 Codex 连接',
    icon: '/static/icons/bot/codex.png',
    route: '/pages/bridge/import-local?type=codex',
  },
  {
    type: 'claude',
    title: '从 Claude Code 导入',
    subtitle: '将手机与 Claude Code 连接',
    icon: '/static/icons/bot/claude.png',
    route: '/pages/bridge/import-local?type=claude',
  },
  {
    type: 'hermes',
    title: '从 Hermes 导入',
    subtitle: '将手机与 Hermes 连接',
    icon: '/static/icons/bot/hermes.png',
    route: '/pages/bridge/import-local?type=hermes',
  },
  {
    type: 'openclaw',
    title: '从 OpenClaw 导入',
    subtitle: '将手机与 OpenClaw 连接',
    icon: '/static/icons/bot/claw.png',
    route: '/pages/bridge/import-openclaw',
  },
] as const

export function getBridgeSourceCard(type: AgentBridgeType): BridgeSourceCard | undefined {
  return BRIDGE_SOURCE_CARDS.find((item) => item.type === type)
}

export function requiresContextBinding(type: AgentBridgeType): boolean {
  return type === 'openclaw' || type === 'hermes'
}

/** Hermes only — AppBar profile switcher. OpenClaw binds agent at import; no in-chat picker. */
export function supportsBridgeContextSelector(type: AgentBridgeType): boolean {
  return type === 'hermes'
}

/** Codex / Claude Code only — aligned with Flutter `_supportsBridgeWorkspaceSelector`. */
export function supportsBridgeWorkspaceSelector(type: AgentBridgeType): boolean {
  return type === 'codex' || type === 'claude'
}

/** Codex / Claude Code only — model + reasoning settings entry in input toolbar. */
export function supportsBridgeSettingsSelector(type: AgentBridgeType): boolean {
  return type === 'codex' || type === 'claude'
}
