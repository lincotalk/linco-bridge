/** Supported local agent bridge types (aligned with aichat-service agent-bridge). */
export type AgentBridgeType = 'codex' | 'claude' | 'hermes' | 'openclaw'

export type BridgeConnectionStatus = 'online' | 'offline' | 'unknown'

export interface AgentBridgeSetup {
  bridgeType: AgentBridgeType
  appId: string
  appSecret: string
  accountId: string
  connectionId: string
  setupCommands: string
}

export interface AgentBridgeBindableContext {
  id: string
  label: string
  description?: string
}

export interface BridgeSourceCard {
  type: AgentBridgeType
  title: string
  subtitle: string
  icon: string
  route: string
}

export interface ChatSessionItem {
  id: string
  agentType: AgentBridgeType
  title: string
  lastMessage: string
  updatedAt: number
  online: boolean
}

export type ChatMessageRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  sessionId: string
  role: ChatMessageRole
  content: string
  createdAt: number
  streaming?: boolean
}

export interface BridgeStatusResult {
  connected: boolean
  bridgeType: AgentBridgeType
  accountId?: string
  connectionId?: string
}

export interface BridgeBindContextResult {
  bridgeType: AgentBridgeType
  connectionId: string
  contextId: string
  contextName: string
  sessionId: string
  agentName: string
}

export interface BridgeSyncResult {
  bridgeType: AgentBridgeType
  connectionId: string
  sessionId: string
  agentName: string
}

/** Agent landing — recent conversation row (aligned with Flutter AgentSidePanelSession). */
export interface AgentHistoryItem {
  id: string
  title: string
  preview: string
  updatedAt: number
  projectPath?: string
  pinned?: boolean
  unread?: boolean
  working?: boolean
}

/** Agent landing header (aligned with Flutter ConversationChatAppBar + bridge status). */
export interface AgentLandingHeader {
  agentType: AgentBridgeType
  title: string
  avatar: string
  deviceId?: string
  status: BridgeConnectionStatus
}

export interface StartConversationInput {
  agentType: AgentBridgeType
  message: string
  tempSession?: boolean
}

export interface StartConversationResult {
  sessionId: string
}

export interface AgentWorkspace {
  name: string
  path: string
}

export interface ApiResponse<T> {
  code: number
  success: boolean
  data: T | null
  message: string
}
