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

/** Conversation list time — HH:mm for today, otherwise MM-DD (Flutter AppTimeFormatter). */
export function formatConversationTime(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp)
  const nowDate = new Date(now)
  const isSameDay =
    date.getFullYear() === nowDate.getFullYear() &&
    date.getMonth() === nowDate.getMonth() &&
    date.getDate() === nowDate.getDate()

  if (isSameDay) {
    const hour = `${date.getHours()}`.padStart(2, '0')
    const minute = `${date.getMinutes()}`.padStart(2, '0')
    return `${hour}:${minute}`
  }

  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${month}-${day}`
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

/** Session list preview — single line, markdown stripped (aligned with Flutter preview). */
export function formatSessionPreview(content: string): string {
  let text = content.trim()
  if (!text) return ''

  text = text.replace(/\r\n/g, '\n')
  text = text.replace(/```[\s\S]*?```/g, '[代码]')
  text = text.replace(/`([^`\n]+)`/g, '$1')
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  text = text.replace(/\n+/g, ' ')
  text = text.replace(/\s+/g, ' ').trim()

  return text
}
