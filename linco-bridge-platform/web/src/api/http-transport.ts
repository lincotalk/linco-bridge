import type { ApiResponse } from '@/bridge/types'
import { buildVisitorSessionHeaders } from '@/utils/visitor-session'

const DEFAULT_BASE_URL = ''

/** Local server default when MP build has no VITE_API_BASE_URL baked in. */
const DEFAULT_LOCAL_API_BASE_URL = 'http://127.0.0.1:3300'

export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, '')
  }

  // Mini programs require absolute URLs; relative /api/* is invalid.
  // #ifdef MP-WEIXIN || MP-ALIPAY || MP-BAIDU || MP-TOUTIAO || MP-QQ || MP-KUAISHOU || MP-JD || MP-HARMONY || MP-XHS || MP-LARK || MP
  return DEFAULT_LOCAL_API_BASE_URL
  // #endif

  return DEFAULT_BASE_URL
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!base) return normalizedPath
  return `${base}${normalizedPath}`
}

export function buildApiRequestHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...buildVisitorSessionHeaders(),
    ...extra,
  }
}

/** 默认 HTTP 超时（毫秒） */
export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000

/** 等待本机 Agent 回复的聊天请求超时（毫秒） */
export const CHAT_REQUEST_TIMEOUT_MS = 300_000

export function requestJson<T>(options: {
  url: string
  method?: 'GET' | 'POST'
  data?: unknown
  timeout?: number
}): Promise<ApiResponse<T>> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: options.url,
      method: options.method ?? 'GET',
      data: options.data as UniApp.RequestOptions['data'],
      header: buildApiRequestHeaders(),
      withCredentials: true,
      timeout: options.timeout ?? DEFAULT_REQUEST_TIMEOUT_MS,
      success: (res) => {
        const body = res.data as ApiResponse<T>
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const error = new Error(body?.message || `请求失败 (${res.statusCode})`) as Error & {
            statusCode?: number
          }
          error.statusCode = res.statusCode
          reject(error)
          return
        }
        resolve(body)
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '网络请求失败'))
      },
    })
  })
}
