function readPublicHost(): string {
  return (process.env.PUBLIC_HOST ?? '127.0.0.1').trim()
}

/** True when platform runs on loopback (local full-stack demo). */
export function isLocalPublicHost(host = readPublicHost()): boolean {
  const normalized = host.trim().toLowerCase()
  return normalized === '127.0.0.1' || normalized === 'localhost'
}

export function resolvePublicHttpScheme(): 'http' | 'https' {
  const explicit = process.env.PUBLIC_HTTP_SCHEME?.trim().toLowerCase()
  if (explicit === 'https' || explicit === 'http') {
    return explicit
  }
  return isLocalPublicHost() ? 'http' : 'https'
}

export function resolvePublicWsScheme(): 'ws' | 'wss' {
  const explicit = process.env.PUBLIC_WS_SCHEME?.trim().toLowerCase()
  if (explicit === 'wss' || explicit === 'ws') {
    return explicit
  }
  return isLocalPublicHost() ? 'ws' : 'wss'
}

/** External REST origin written into demo-config (no trailing slash). */
export function resolvePublicHttpOrigin(): string {
  const host = readPublicHost()
  const scheme = resolvePublicHttpScheme()
  if (isLocalPublicHost(host)) {
    const port = process.env.PORT ?? '3300'
    return `${scheme}://${host}:${port}`
  }
  return `${scheme}://${host}`
}

/** External WS base for connector setup (no agent suffix). */
export function resolvePublicWsBaseUrl(): string {
  const host = readPublicHost()
  const scheme = resolvePublicWsScheme()
  if (isLocalPublicHost(host)) {
    const port = process.env.PORT ?? '3300'
    return `${scheme}://${host}:${port}/bridge/ws`
  }
  return `${scheme}://${host}/bridge/ws`
}

/** Remote demo should embed --ws-url so linco-connect reaches the hosted gateway. */
export function shouldEmbedWsUrlInSetupCommands(): boolean {
  return !isLocalPublicHost()
}
