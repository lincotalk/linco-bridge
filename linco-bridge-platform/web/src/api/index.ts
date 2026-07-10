import { createMockBridgeSdk } from '@/bridge/sdk'
import { assertMockSdkAllowed, isRemoteApiEnabled } from '@/utils/mock-sdk-guard'
import { restBridgeSdk } from './bridge-api'

export function createAppBridgeSdk() {
  if (!isRemoteApiEnabled()) {
    assertMockSdkAllowed('BridgeSdk')
    return createMockBridgeSdk()
  }
  return restBridgeSdk
}
