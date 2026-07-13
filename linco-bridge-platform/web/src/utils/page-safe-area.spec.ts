import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getCustomNavBarPaddingStyle,
  getCustomNavPagePaddingTop,
} from '@/utils/page-safe-area'

describe('page-safe-area', () => {
  beforeEach(() => {
    vi.stubGlobal('uni', {
      getSystemInfoSync: vi.fn(() => ({ statusBarHeight: 20, windowWidth: 390 })),
      getMenuButtonBoundingClientRect: vi.fn(() => ({
        top: 24,
        bottom: 56,
        left: 281,
      })),
    })
  })

  it('uses menu button bottom plus gap on mini program', () => {
    expect(getCustomNavPagePaddingTop()).toBe(60)
  })

  it('exposes nav bar padding style', () => {
    expect(getCustomNavBarPaddingStyle()).toEqual({ paddingTop: '60px' })
  })

  it('falls back when menu button is unavailable', () => {
    vi.stubGlobal('uni', {
      getSystemInfoSync: vi.fn(() => ({ statusBarHeight: 20 })),
    })
    expect(getCustomNavPagePaddingTop()).toBe(28)
  })
})
