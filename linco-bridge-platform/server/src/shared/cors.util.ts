export function resolveCorsOrigin(): boolean | string | string[] {
  const raw = process.env.CORS_ORIGINS?.trim()
  if (!raw) {
    return true
  }
  if (raw === '*') {
    return true
  }
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}
