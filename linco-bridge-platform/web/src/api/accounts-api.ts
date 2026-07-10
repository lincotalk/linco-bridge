import { apiPost } from '@/api/http-client'
import type { BridgeCommandResult } from '@/api/session-api'
import {
  parseAccountsCommandResult,
  type AccountsCommandPayload,
} from '@/utils/connected-accounts'

export async function fetchConnectedAccounts(): Promise<AccountsCommandPayload> {
  const res = await apiPost<BridgeCommandResult>('/api/bridge-command', {
    command: 'accounts',
  })
  if (!res.success || !res.data) {
    throw new Error(res.message || '加载助手列表失败')
  }
  return parseAccountsCommandResult(res.data)
}
