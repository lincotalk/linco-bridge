/**
 * Resolves NestJS CORS `origin` option.
 *
 * - Explicit `CORS_ORIGINS` (comma-separated) → whitelist; `*` opts into allow-all.
 * - Development without `CORS_ORIGINS` → allow all (local full-stack: Vite :5173 → server :3300).
 * - Production without `CORS_ORIGINS` → deny cross-origin (same-origin H5 + API still works).
 */
export function resolveCorsOrigin(): boolean | string | string[] {
  const raw = process.env.CORS_ORIGINS?.trim()
  if (raw) {
    if (raw === '*') {
      return true
    }
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (process.env.NODE_ENV !== 'production') {
    return true
  }

  return false
}
