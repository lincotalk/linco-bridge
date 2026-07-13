import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resetNavigateOnceForTests, navigateOnce, normalizePageUrl } from '@/utils/navigate-once'

const navigateTo = vi.fn()
const redirectTo = vi.fn()

vi.stubGlobal('uni', { navigateTo, redirectTo })

describe('navigateOnce', () => {
  beforeEach(() => {
    resetNavigateOnceForTests()
    navigateTo.mockClear()
    redirectTo.mockClear()
  })

  it('dedupes repeated navigation within 500ms', () => {
    navigateOnce('/pages/chat/landing?agentType=codex')
    navigateOnce('/pages/chat/landing?agentType=codex')

    expect(navigateTo).toHaveBeenCalledTimes(1)
  })

  it('uses redirectTo when replace is true', () => {
    navigateOnce('/pages/chat/index?sessionId=1', { replace: true })

    expect(redirectTo).toHaveBeenCalledTimes(1)
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('normalizes pages/ prefix to absolute path', () => {
    expect(normalizePageUrl('pages/bridge/import-local?type=codex')).toBe(
      '/pages/bridge/import-local?type=codex',
    )
  })
})
