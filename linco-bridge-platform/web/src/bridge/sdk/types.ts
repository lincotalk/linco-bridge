import type {
  AgentBridgeBindableContext,
  AgentBridgeSetup,
  AgentBridgeType,
  ApiResponse,
  BridgeBindContextResult,
  BridgeStatusResult,
  BridgeSyncResult,
} from '../types'

/** HTTP transport for bridge SDK — swappable when real backend is wired. */
export interface BridgeHttpClient {
  get<T>(path: string): Promise<ApiResponse<T>>
  post<T>(path: string, body?: unknown): Promise<ApiResponse<T>>
}

export interface BridgeSdk {
  getSetup(type: AgentBridgeType): Promise<AgentBridgeSetup>
  refreshSetup(type: AgentBridgeType, connectionId: string): Promise<AgentBridgeSetup>
  checkStatus(type: AgentBridgeType, connectionId?: string): Promise<BridgeStatusResult>
  listContexts(type: AgentBridgeType, connectionId?: string): Promise<AgentBridgeBindableContext[]>
  bindContext(
    type: AgentBridgeType,
    contextId: string,
    connectionId?: string,
  ): Promise<BridgeBindContextResult>
  /** Link seeded session after connector online — codex / claude path. */
  syncAgent(type: AgentBridgeType, connectionId?: string): Promise<BridgeSyncResult>
}

export type BridgeSdkFactory = (client: BridgeHttpClient) => BridgeSdk
