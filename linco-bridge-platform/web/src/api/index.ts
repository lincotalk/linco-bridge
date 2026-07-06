import { createMockBridgeSdk } from '@/bridge/sdk'
import { restBridgeSdk } from './bridge-api'

const useRemoteApi = import.meta.env.VITE_USE_REMOTE_API !== 'false'

export function createAppBridgeSdk() {
  return useRemoteApi ? restBridgeSdk : createMockBridgeSdk()
}
