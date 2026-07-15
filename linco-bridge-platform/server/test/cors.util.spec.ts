import { resolveCorsOrigin } from '../src/shared/cors.util'

describe('cors.util', () => {
  const envSnapshot = { ...process.env }

  afterEach(() => {
    process.env = { ...envSnapshot }
  })

  it('allows all origins in development when CORS_ORIGINS is unset', () => {
    delete process.env.CORS_ORIGINS
    process.env.NODE_ENV = 'development'
    expect(resolveCorsOrigin()).toBe(true)
  })

  it('denies cross-origin in production when CORS_ORIGINS is unset', () => {
    delete process.env.CORS_ORIGINS
    process.env.NODE_ENV = 'production'
    expect(resolveCorsOrigin()).toBe(false)
  })

  it('parses comma-separated production whitelist', () => {
    process.env.CORS_ORIGINS = 'https://bridge-demo.lincotalk.com,https://example.com'
    expect(resolveCorsOrigin()).toEqual([
      'https://bridge-demo.lincotalk.com',
      'https://example.com',
    ])
  })

  it('treats CORS_ORIGINS=* as allow-all', () => {
    process.env.CORS_ORIGINS = '*'
    process.env.NODE_ENV = 'production'
    expect(resolveCorsOrigin()).toBe(true)
  })
})
