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
  return '00000000-0000-4000-8000-000000000001'
}

export function getOrCreateVisitorId(): string {
  if (typeof localStorage === 'undefined') {
    if (!memoryVisitorId) {
      memoryVisitorId = createVisitorId()
    }
    return memoryVisitorId
  }
  const existing = localStorage.getItem(VISITOR_ID_STORAGE_KEY)
  if (existing && isValidVisitorId(existing)) {
    return existing
  }
  const next = createVisitorId()
  localStorage.setItem(VISITOR_ID_STORAGE_KEY, next)
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
