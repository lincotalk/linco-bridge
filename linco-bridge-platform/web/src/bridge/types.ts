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
  /** linco-connect IM channel; self-hosted platform uses `linco-demo`. */
  connectChannel?: string
  wsBaseUrl?: string
  wsUrl?: string
}

export interface AgentBridgeBindableContext {
  id: string
  label: string
  description?: string
  bindCommand?: string
  projectPath?: string
  agentSessionId?: string
}

export interface BridgeProjectItem {
  id: string
  name: string
  path: string
  selectCommand?: string
  sessionsCommand?: string
}

export interface BridgeWorkspaceSession {
  id: string
  title: string
  timeText?: string
  bindCommand?: string
  historyCommand?: string
  updatedAt?: number
}

export interface BridgeWorkspaceSelection {
  sessionId: string
  title: string
  projectPath: string
  projectName: string
  agentSessionId?: string
}

export interface BridgeWorkspaceApplyInput {
  projectPath?: string
  projectName?: string
  agentSessionId?: string
  sessionTitle?: string
  bindCommand?: string
  selectProjectCommand?: string
  platformSessionId?: string
  connectionId?: string
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
  connectionId?: string
  /** Message tab row title: agent name + device. */
  title: string
  /** Conversation title for chat page header. */
  conversationTitle?: string
  lastMessage: string
  updatedAt: number
  online: boolean
  bridgeProjectPath?: string
  isTempSession?: boolean
  deviceName?: string
}

export type ChatMessageRole = 'user' | 'assistant' | 'system'

export interface ChatMessageAttachment {
  name: string
  mimeType?: string
  previewUrl?: string
}

export interface ChatMessageReasoning {
  content: string
  startedAt: number
  endedAt?: number
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: ChatMessageRole
  content: string
  createdAt: number
  streaming?: boolean
  reasoning?: ChatMessageReasoning
  reasoningStreaming?: boolean
  attachments?: ChatMessageAttachment[]
}

export interface BridgeStatusResult {
  connected: boolean
  bridgeType: AgentBridgeType
  accountId?: string
  connectionId?: string
  deviceName?: string
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
  agentSessionId?: string
  pinned?: boolean
  unread?: boolean
  working?: boolean
}

export interface ResumeSessionResult {
  sessionId: string
  title: string
  projectPath?: string
  agentSessionId?: string
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
  message?: string
  tempSession?: boolean
  title?: string
  connectionId?: string
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
