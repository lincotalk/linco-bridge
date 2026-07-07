import {
  buildTempSessionTitle,
  isTempSessionPlaceholderTitle,
  resolveTempSessionTitle,
} from '../src/chat/temp-session-title.util'

describe('temp-session-title.util', () => {
  it('buildTempSessionTitle normalizes whitespace and truncates', () => {
    expect(buildTempSessionTitle('  hello   world  ')).toBe('hello world')
    expect(buildTempSessionTitle('a'.repeat(40))).toBe(`${'a'.repeat(30)}...`)
  })

  it('resolveTempSessionTitle prefers first question', () => {
    expect(
      resolveTempSessionTitle({
        agentType: 'codex',
        message: '如何接入 bridge',
        title: '临时会话',
      }),
    ).toBe('如何接入 bridge')
  })

  it('isTempSessionPlaceholderTitle detects generic titles', () => {
    expect(isTempSessionPlaceholderTitle('临时会话', 'codex')).toBe(true)
    expect(isTempSessionPlaceholderTitle('如何接入 bridge', 'codex')).toBe(false)
  })
})
