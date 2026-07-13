import {
  createNewVisitorSession,
  createVisitorSessionToken,
  parseVisitorSessionHeader,
  verifyVisitorSessionToken,
} from '../src/shared/visitor-session.util'

describe('visitor-session.util', () => {
  it('creates and verifies a signed visitor session token', () => {
    const { visitorId, token } = createNewVisitorSession()
    expect(verifyVisitorSessionToken(token)).toBe(visitorId)
  })

  it('rejects tampered tokens', () => {
    const token = createVisitorSessionToken('11111111-1111-4111-8111-111111111111')
    expect(verifyVisitorSessionToken(`${token}x`)).toBeNull()
  })

  it('accepts session token from header parser', () => {
    const { visitorId, token } = createNewVisitorSession()
    expect(parseVisitorSessionHeader(token)).toBe(visitorId)
  })
})
