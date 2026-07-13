export type QueryParams = Record<string, string>

export function createQueryParams(initial?: QueryParams): QueryParams {
  return { ...(initial ?? {}) }
}

export function setQueryParam(
  params: QueryParams,
  key: string,
  value: string | number | boolean | null | undefined,
): QueryParams {
  const next = { ...params }
  if (value === null || value === undefined || value === '') {
    delete next[key]
    return next
  }
  next[key] = String(value)
  return next
}

export function toQueryString(params: QueryParams): string {
  return Object.entries(params)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

export function appendQueryToPath(path: string, params: QueryParams): string {
  const query = toQueryString(params)
  if (!query) return path
  const joiner = path.includes('?') ? '&' : '?'
  return `${path}${joiner}${query}`
}
