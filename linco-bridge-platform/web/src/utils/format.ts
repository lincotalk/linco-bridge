export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diffMs = Math.max(0, now - timestamp)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) return '刚刚'
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} 分钟前`
  if (diffMs < day) return `${Math.floor(diffMs / hour)} 小时前`

  const date = new Date(timestamp)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const dayOfMonth = `${date.getDate()}`.padStart(2, '0')
  return `${month}-${dayOfMonth}`
}

export function copyToClipboard(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    uni.setClipboardData({
      data: text,
      success: () => resolve(),
      fail: (error) => reject(error),
    })
  })
}

export function showToast(title: string, icon: 'success' | 'none' = 'none') {
  uni.showToast({ title, icon, duration: 2000 })
}
