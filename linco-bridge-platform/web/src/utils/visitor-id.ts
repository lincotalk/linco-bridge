export const VISITOR_ID_STORAGE_KEY = 'linco-bridge-visitor-id'
export const VISITOR_ID_HEADER = 'X-Linco-Visitor-Id'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidVisitorId(value: string): boolean {
  return UUID_RE.test(value.trim())
}

let memoryVisitorId: string | null = null

function createVisitorId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export function getOrCreateVisitorId(): string {
  try {
    const fromUni = uni.getStorageSync(VISITOR_ID_STORAGE_KEY)
    if (typeof fromUni === 'string' && isValidVisitorId(fromUni)) {
      return fromUni
    }
  } catch {
    // ignore storage read errors
  }

  if (typeof localStorage !== 'undefined') {
    const existing = localStorage.getItem(VISITOR_ID_STORAGE_KEY)
    if (existing && isValidVisitorId(existing)) {
      return existing
    }
  }

  if (!memoryVisitorId) {
    memoryVisitorId = createVisitorId()
  }

  const next = memoryVisitorId
  try {
    uni.setStorageSync(VISITOR_ID_STORAGE_KEY, next)
  } catch {
    // ignore storage write errors
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(VISITOR_ID_STORAGE_KEY, next)
    } catch {
      // ignore storage write errors
    }
  }
  return next
}

export function resetVisitorIdForTests(): void {
  memoryVisitorId = null
}

export function buildVisitorHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    [VISITOR_ID_HEADER]: getOrCreateVisitorId(),
    ...extra,
  }
}
