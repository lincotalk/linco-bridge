import { showToast } from '@/utils/format'

let lastNavigateAt = 0
let lastNavigateUrl = ''

/** 确保 uni-app 页面路径以 / 开头，避免 H5 相对路径解析成 /pages/index/... */
export function normalizePageUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('/')) return trimmed
  if (trimmed.startsWith('pages/')) return `/${trimmed}`
  return trimmed
}

export function navigateOnce(
  url: string,
  options?: {
    replace?: boolean
    failMessage?: string
  },
): void {
  const normalized = normalizePageUrl(url)
  if (!normalized) return

  const now = Date.now()
  if (normalized === lastNavigateUrl && now - lastNavigateAt < 500) {
    return
  }
  lastNavigateAt = now
  lastNavigateUrl = normalized

  const navigate = options?.replace ? uni.redirectTo : uni.navigateTo
  navigate({
    url: normalized,
    fail: (err) => {
      showToast(err.errMsg || options?.failMessage || '页面跳转失败')
    },
  })
}

export function resetNavigateOnceForTests(): void {
  lastNavigateAt = 0
  lastNavigateUrl = ''
}
