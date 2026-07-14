export function normalizeFenceLanguage(raw: string): string {
  const value = raw.trim()
  if (!value) return 'plaintext'

  const showWidgetMatch = /type\s*=\s*["']?([a-zA-Z0-9_-]+)/i.exec(value)
  if (value.toLowerCase().startsWith('show-widget') && showWidgetMatch?.[1]) {
    return showWidgetMatch[1].toLowerCase()
  }

  return (value.split(/\s+/)[0] ?? 'plaintext').toLowerCase()
}

export function resolveCodeLanguage(language: string, code: string): string {
  const normalized = normalizeFenceLanguage(language)
  if (normalized !== 'plaintext') return mapAliasLanguage(normalized)
  if (looksLikeJson(code)) return 'json'
  return normalized
}

export function mapAliasLanguage(language: string): string {
  if (language === 'react') return 'jsx'
  if (language === 'ts') return 'typescript'
  if (language === 'js') return 'javascript'
  if (language === 'htm') return 'html'
  if (language === 'md') return 'markdown'
  if (language === 'shell') return 'bash'
  if (language === 'sh') return 'bash'
  return language
}

export function isMarkdownFenceLanguage(language: string): boolean {
  const normalized = mapAliasLanguage(normalizeFenceLanguage(language))
  return normalized === 'markdown'
}

export function isHtmlFence(language: string, code: string): boolean {
  const normalized = mapAliasLanguage(normalizeFenceLanguage(language))
  if (normalized === 'html') return true
  if (normalized !== 'plaintext') return false
  const trimmed = code.trimStart().toLowerCase()
  return (
    trimmed.startsWith('<!doctype html') ||
    trimmed.startsWith('<html') ||
    trimmed.includes('<body')
  )
}

export function formatJsonCode(code: string, language: string): string {
  if (mapAliasLanguage(normalizeFenceLanguage(language)) !== 'json') return code
  try {
    return JSON.stringify(JSON.parse(code.trim()), null, 2)
  } catch {
    return code
  }
}

export function looksLikeJson(code: string): boolean {
  const trimmed = code.trim()
  if (
    !(trimmed.startsWith('{') && trimmed.endsWith('}')) &&
    !(trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    return false
  }
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}

export function resolveHighlightLanguage(language: string): string {
  const normalized = mapAliasLanguage(normalizeFenceLanguage(language))
  if (normalized === 'jsx' || normalized === 'tsx') return 'javascript'
  if (normalized === 'plaintext' || normalized === 'text') return 'plaintext'
  return normalized
}
