import { describe, expect, it, vi } from 'vitest'
import {
  getOrCreateVisitorId,
  isValidVisitorId,
  VISITOR_ID_STORAGE_KEY,
} from '@/utils/visitor-id'

describe('visitor-id', () => {
  it('creates and reuses a UUID in localStorage', () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
    })
    vi.stubGlobal('crypto', { randomUUID: () => '11111111-1111-4111-8111-111111111111' })

    const first = getOrCreateVisitorId()
    const second = getOrCreateVisitorId()

    expect(isValidVisitorId(first)).toBe(true)
    expect(second).toBe(first)
    expect(storage.get(VISITOR_ID_STORAGE_KEY)).toBe(first)
  })
})
