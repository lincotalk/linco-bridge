import type {
  AgentBridgeBindableContext,
  AgentBridgeSetup,
  AgentBridgeType,
  ApiResponse,
  BridgeStatusResult,
} from '../types'

/** HTTP transport for bridge SDK — swappable when real backend is wired. */
export interface BridgeHttpClient {
  get<T>(path: string): Promise<ApiResponse<T>>
  post<T>(path: string, body?: unknown): Promise<ApiResponse<T>>
}

export interface BridgeSdk {
  getSetup(type: AgentBridgeType): Promise<AgentBridgeSetup>
  refreshSetup(type: AgentBridgeType, connectionId: string): Promise<AgentBridgeSetup>
  checkStatus(type: AgentBridgeType): Promise<BridgeStatusResult>
  listContexts(type: AgentBridgeType): Promise<AgentBridgeBindableContext[]>
  bindContext(type: AgentBridgeType, contextId: string): Promise<void>
}

export type BridgeSdkFactory = (client: BridgeHttpClient) => BridgeSdk
