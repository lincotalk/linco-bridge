/** Block in-memory mock SDK in production builds (misconfigured env). */
export function assertMockSdkAllowed(feature: string): void {
  if (!import.meta.env.PROD) return
  throw new Error(
    `[${feature}] 生产环境禁止使用内存 Mock SDK，请设置 VITE_USE_REMOTE_API=true`,
  )
}

export function isRemoteApiEnabled(): boolean {
  return import.meta.env.VITE_USE_REMOTE_API !== 'false'
}
