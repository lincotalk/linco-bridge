/** Chat input toolbar icons — aligned with Flutter ChatInputArea / p2p_chat_input_area. */
export const CHAT_ICON = {
  add: '/static/icons/chat/home_input_add.png',
  voice: '/static/icons/chat/home_input_voice.png',
  skill: '/static/icons/chat/home_input_skill.png',
  folder: '/static/icons/chat/folder.png',
  /** Full green circle + up arrow — Flutter p2p_input_send.png */
  send: '/static/icons/chat/p2p_input_send.png',
  /** Disabled send — generated from p2p_input_send (bgOverlay + textGhost) */
  sendDisabled: '/static/icons/chat/p2p_input_send_disabled.png',
} as const

/** Toolbar sizes (Flutter: 32.w tool, 20.w add/voice icon, 32.w send circle). */
export const CHAT_INPUT_TOOL_SIZE_RPX = 64
export const CHAT_INPUT_ICON_SIZE_RPX = 40
export const CHAT_INPUT_SEND_SIZE_RPX = 64
