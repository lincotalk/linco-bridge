export function formatThinkingDuration(ms: number, now = Date.now()): string {
  const elapsed = Math.max(0, now - ms)
  const seconds = Math.max(1, Math.ceil(elapsed / 1000))
  return `${seconds}s`
}
