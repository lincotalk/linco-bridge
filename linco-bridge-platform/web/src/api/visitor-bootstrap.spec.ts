import { beforeEach, describe, expect, it, vi } from 'vitest'

const requestJson = vi.fn()
const getVisitorSessionToken = vi.fn()
const setVisitorSessionToken = vi.fn()

vi.mock('./http-transport', () => ({
  buildApiUrl: (path: string) => `http://127.0.0.1:3300${path}`,
  requestJson,
}))

vi.mock('@/utils/visitor-session', () => ({
  getVisitorSessionToken,
  setVisitorSessionToken,
}))

describe('visitor-bootstrap', () => {
  beforeEach(() => {
    vi.resetModules()
    requestJson.mockReset()
    getVisitorSessionToken.mockReset()
    setVisitorSessionToken.mockReset()
  })

  it('reuses stored session token without calling bootstrap', async () => {
    getVisitorSessionToken.mockReturnValue('stored-token')
    const { ensureVisitorSession } = await import('./visitor-bootstrap')
    const result = await ensureVisitorSession()
    expect(result.reused).toBe(true)
    expect(requestJson).not.toHaveBeenCalled()
  })

  it('bootstraps once and stores session token', async () => {
    getVisitorSessionToken.mockReturnValue(null)
    requestJson.mockResolvedValue({
      success: true,
      data: {
        visitorId: 'visitor-1',
        reused: false,
        sessionToken: 'token-1',
      },
    })

    const { ensureVisitorSession } = await import('./visitor-bootstrap')
    await ensureVisitorSession()

    expect(requestJson).toHaveBeenCalledWith({
      url: 'http://127.0.0.1:3300/api/visitor/bootstrap',
      method: 'POST',
    })
    expect(setVisitorSessionToken).toHaveBeenCalledWith('token-1')
  })
})
