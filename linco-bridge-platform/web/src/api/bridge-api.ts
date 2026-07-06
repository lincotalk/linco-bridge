import { createRestBridgeSdk, type BridgeHttpClient } from '@/bridge'
import { apiGet, apiPost } from './http-client'

export const restBridgeHttpClient: BridgeHttpClient = {
  get: (path) => apiGet(path),
  post: (path, body) => apiPost(path, body),
}

export const restBridgeSdk = createRestBridgeSdk(restBridgeHttpClient)
