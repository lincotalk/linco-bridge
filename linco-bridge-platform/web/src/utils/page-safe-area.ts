/** Custom-nav pages (no native title bar) need explicit top inset on MP. */
export function getCustomNavPagePaddingTop(): number {
  const statusBarHeight = uni.getSystemInfoSync().statusBarHeight ?? 20

  if (typeof uni.getMenuButtonBoundingClientRect !== 'function') {
    return statusBarHeight + 8
  }

  const menu = uni.getMenuButtonBoundingClientRect()
  if (!menu?.bottom) {
    return statusBarHeight + 8
  }

  const gap = Math.max(menu.top - statusBarHeight, 0)
  return menu.bottom + gap
}

export function getCustomNavPagePaddingStyle(): Record<string, string> {
  return { paddingTop: `${getCustomNavPagePaddingTop()}px` }
}

/** 自定义顶栏顶部安全距离 */
export function getCustomNavBarPaddingStyle(): Record<string, string> {
  return getCustomNavPagePaddingStyle()
}
