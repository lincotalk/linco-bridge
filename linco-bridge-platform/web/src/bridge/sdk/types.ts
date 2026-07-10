import type {
  AgentBridgeBindableContext,
  AgentBridgeConnectionDetail,
  AgentBridgeSetup,
  AgentBridgeType,
  ApiResponse,
  BridgeBindContextResult,
  BridgeConnectionDeleteResult,
  BridgeProjectItem,
  BridgeStatusResult,
  BridgeSyncResult,
  BridgeWorkspaceApplyInput,
  BridgeWorkspaceSelection,
  BridgeWorkspaceSession,
  BridgeSettingsOptions,
  BridgeSessionSettings,
} from '../types'

/** HTTP transport for bridge SDK — swappable when real backend is wired. */
export interface BridgeHttpClient {
  get<T>(path: string): Promise<ApiResponse<T>>
  post<T>(path: string, body?: unknown): Promise<ApiResponse<T>>
}

export interface BridgeSdk {
  getSetup(type: AgentBridgeType, connectionId?: string): Promise<AgentBridgeSetup>
  refreshSetup(type: AgentBridgeType, connectionId: string): Promise<AgentBridgeSetup>
  checkStatus(type: AgentBridgeType, connectionId?: string): Promise<BridgeStatusResult>
  listContexts(type: AgentBridgeType, connectionId?: string): Promise<AgentBridgeBindableContext[]>
  listProjects(type: AgentBridgeType, connectionId?: string): Promise<BridgeProjectItem[]>
  selectProject(
    type: AgentBridgeType,
    projectPath: string,
    connectionId?: string,
  ): Promise<{ projectPath: string; projectName: string }>
  listProjectSessions(
    type: AgentBridgeType,
    projectPath: string,
    connectionId?: string,
    limit?: number,
  ): Promise<BridgeWorkspaceSession[]>
  listChats(type: AgentBridgeType, connectionId?: string, limit?: number): Promise<BridgeWorkspaceSession[]>
  applyWorkspaceSelection(
    type: AgentBridgeType,
    input: BridgeWorkspaceApplyInput,
  ): Promise<BridgeWorkspaceSelection>
  bindContext(
    type: AgentBridgeType,
    contextId: string,
    connectionId?: string,
  ): Promise<BridgeBindContextResult>
  /** Link seeded session after connector online — codex / claude path. */
  syncAgent(type: AgentBridgeType, connectionId?: string): Promise<BridgeSyncResult>
  getConnectionDetail(type: AgentBridgeType, connectionId?: string): Promise<AgentBridgeConnectionDetail>
  renameConnection(
    type: AgentBridgeType,
    connectionId: string,
    displayName: string,
  ): Promise<AgentBridgeConnectionDetail>
  deleteConnection(type: AgentBridgeType, connectionId: string): Promise<BridgeConnectionDeleteResult>
  loadSettingsOptions(
    type: AgentBridgeType,
    connectionId?: string,
    sessionId?: string,
  ): Promise<BridgeSettingsOptions>
  updateBridgeSettings(
    type: AgentBridgeType,
    input: {
      connectionId?: string
      sessionId: string
      reasoningEffort?: string
      modelId?: string
      modelName?: string
    },
  ): Promise<BridgeSessionSettings>
}

export type BridgeSdkFactory = (client: BridgeHttpClient) => BridgeSdk
