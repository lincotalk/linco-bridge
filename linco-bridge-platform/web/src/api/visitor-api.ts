import { apiPost } from './http-client'

export interface VisitorBootstrapResult {
  visitorId: string
  reused: boolean
}

export async function bootstrapVisitorSession(): Promise<VisitorBootstrapResult> {
  const res = await apiPost<VisitorBootstrapResult>('/api/visitor/bootstrap')
  if (!res.success || !res.data?.visitorId) {
    throw new Error(res.message || '初始化访客会话失败')
  }
  return res.data
}
