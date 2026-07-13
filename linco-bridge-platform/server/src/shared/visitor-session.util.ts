import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export const VISITOR_SESSION_COOKIE = 'linco-bridge-session'
export const VISITOR_SESSION_HEADER = 'x-linco-visitor-session'

const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000

function resolveSessionSecret(): string {
  const fromEnv = process.env.VISITOR_SESSION_SECRET?.trim()
  if (fromEnv) return fromEnv
  if (process.env.NODE_ENV === 'production') {
    throw new Error('VISITOR_SESSION_SECRET is required in production')
  }
  return 'dev-visitor-session-secret'
}

export function createVisitorSessionToken(visitorId: string, issuedAt = Date.now()): string {
  const payload = `${visitorId}.${issuedAt}`
  const signature = createHmac('sha256', resolveSessionSecret())
    .update(payload)
    .digest('base64url')
  return `${payload}.${signature}`
}

export function verifyVisitorSessionToken(token: string): string | null {
  const trimmed = token.trim()
  if (!trimmed) return null

  const lastDot = trimmed.lastIndexOf('.')
  if (lastDot <= 0) return null

  const payload = trimmed.slice(0, lastDot)
  const signature = trimmed.slice(lastDot + 1)
  const secondDot = payload.indexOf('.')
  if (secondDot <= 0) return null

  const visitorId = payload.slice(0, secondDot)
  const issuedAtRaw = payload.slice(secondDot + 1)
  const issuedAt = Number(issuedAtRaw)
  if (!visitorId || !Number.isFinite(issuedAt)) return null
  if (Date.now() - issuedAt > SESSION_TTL_MS) return null

  const expected = createHmac('sha256', resolveSessionSecret())
    .update(payload)
    .digest('base64url')

  const actualBuf = Buffer.from(signature)
  const expectedBuf = Buffer.from(expected)
  if (actualBuf.length !== expectedBuf.length) return null
  if (!timingSafeEqual(actualBuf, expectedBuf)) return null

  return visitorId
}

export function buildVisitorSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  const maxAge = Math.floor(SESSION_TTL_MS / 1000)
  return `${VISITOR_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

export function createNewVisitorSession(): { visitorId: string; token: string } {
  const visitorId = randomUUID()
  return {
    visitorId,
    token: createVisitorSessionToken(visitorId),
  }
}

export function parseVisitorSessionCookie(raw: string | undefined): string | null {
  if (!raw?.trim()) return null
  const parts = raw.split(';')
  for (const part of parts) {
    const [name, ...rest] = part.trim().split('=')
    if (name?.trim() !== VISITOR_SESSION_COOKIE) continue
    const value = rest.join('=').trim()
    if (!value) return null
    try {
      return verifyVisitorSessionToken(decodeURIComponent(value))
    } catch {
      return verifyVisitorSessionToken(value)
    }
  }
  return null
}

export function parseVisitorSessionHeader(
  raw: string | string[] | undefined,
): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value?.trim()) return null
  return verifyVisitorSessionToken(value.trim())
}

export function resolveVisitorIdFromRequest(input: {
  cookieHeader?: string
  sessionHeader?: string | string[]
}): string | null {
  return (
    parseVisitorSessionCookie(input.cookieHeader) ??
    parseVisitorSessionHeader(input.sessionHeader)
  )
}
