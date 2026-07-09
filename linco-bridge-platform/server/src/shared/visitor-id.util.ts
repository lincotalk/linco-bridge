import { randomUUID } from 'node:crypto'

export const VISITOR_ID_HEADER = 'x-linco-visitor-id'
export const TEST_SEED_OWNER_ID = 'test-visitor'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidVisitorId(value: string): boolean {
  return UUID_RE.test(value.trim())
}

export function parseVisitorIdHeader(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value?.trim()) return null
  const normalized = value.trim()
  return isValidVisitorId(normalized) ? normalized : null
}

export function generateVisitorId(): string {
  return randomUUID()
}
