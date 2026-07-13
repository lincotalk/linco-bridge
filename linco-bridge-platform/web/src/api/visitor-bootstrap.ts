import {
  getVisitorSessionToken,
  setVisitorSessionToken,
} from '@/utils/visitor-session'
import { buildApiUrl, requestJson } from './http-transport'

export interface VisitorBootstrapResult {
  visitorId: string
  reused: boolean
  sessionToken?: string
}

let bootstrapPromise: Promise<VisitorBootstrapResult> | null = null

export async function bootstrapVisitorSession(): Promise<VisitorBootstrapResult> {
  const res = await requestJson<VisitorBootstrapResult>({
    url: buildApiUrl('/api/visitor/bootstrap'),
    method: 'POST',
  })
  if (!res.success || !res.data?.visitorId) {
    throw new Error(res.message || '初始化访客会话失败')
  }
  if (res.data.sessionToken?.trim()) {
    setVisitorSessionToken(res.data.sessionToken)
  }
  return res.data
}

export async function ensureVisitorSession(): Promise<VisitorBootstrapResult> {
  if (getVisitorSessionToken()) {
    return {
      visitorId: '',
      reused: true,
    }
  }

  bootstrapPromise ??= bootstrapVisitorSession().finally(() => {
    bootstrapPromise = null
  })

  return bootstrapPromise
}
