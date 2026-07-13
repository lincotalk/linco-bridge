import { isH5Runtime } from '@/utils/platform-runtime'

export const VISITOR_SESSION_STORAGE_KEY = 'linco-bridge-visitor-session'
export const VISITOR_SESSION_HEADER = 'X-Linco-Visitor-Session'
export const VISITOR_SESSION_COOKIE = 'linco-bridge-session'

let memoryToken: string | null = null

function readStoredToken(): string | null {
  try {
    const fromUni = uni.getStorageSync(VISITOR_SESSION_STORAGE_KEY)
    if (typeof fromUni === 'string' && fromUni.trim()) {
      return fromUni.trim()
    }
  } catch {
    // ignore storage read errors
  }

  if (typeof localStorage !== 'undefined') {
    const fromWeb = localStorage.getItem(VISITOR_SESSION_STORAGE_KEY)
    if (fromWeb?.trim()) {
      return fromWeb.trim()
    }
  }

  return null
}

export function getVisitorSessionToken(): string | null {
  if (memoryToken) return memoryToken
  memoryToken = readStoredToken()
  return memoryToken
}

export function setVisitorSessionToken(token: string): void {
  const normalized = token.trim()
  if (!normalized) return
  memoryToken = normalized

  try {
    uni.setStorageSync(VISITOR_SESSION_STORAGE_KEY, normalized)
  } catch {
    // ignore storage write errors
  }

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(VISITOR_SESSION_STORAGE_KEY, normalized)
    } catch {
      // ignore storage write errors
    }
  }
}

export function clearVisitorSessionToken(): void {
  memoryToken = null
  try {
    uni.removeStorageSync(VISITOR_SESSION_STORAGE_KEY)
  } catch {
    // ignore storage write errors
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(VISITOR_SESSION_STORAGE_KEY)
    } catch {
      // ignore storage write errors
    }
  }
}

export function buildVisitorSessionHeaders(): Record<string, string> {
  const token = getVisitorSessionToken()
  if (!token) return {}

  const headers: Record<string, string> = {
    [VISITOR_SESSION_HEADER]: token,
  }

  // 浏览器禁止 JS 手动设置 Cookie；H5 依赖 withCredentials + 响应 Set-Cookie 或 header 鉴权
  if (!isH5Runtime()) {
    headers.Cookie = `${VISITOR_SESSION_COOKIE}=${encodeURIComponent(token)}`
  }

  return headers
}
