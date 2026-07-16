import { isH5Runtime } from '@/utils/platform-runtime'

const mpPathCache = new Map<string, string>()

function cacheKeyForDataUrl(dataUrl: string): string {
  return `${dataUrl.length}:${dataUrl.slice(0, 48)}:${dataUrl.slice(-24)}`
}

function extFromMime(mime: string): string {
  const lower = mime.toLowerCase()
  if (lower.includes('png')) return 'png'
  if (lower.includes('gif')) return 'gif'
  if (lower.includes('webp')) return 'webp'
  if (lower.includes('bmp')) return 'bmp'
  return 'jpg'
}

/**
 * H5 可直接用 data: URL；小程序 <image> 对 data: 支持差，落临时文件再展示。
 */
export async function resolveDisplayImageSrc(src?: string): Promise<string | undefined> {
  const trimmed = src?.trim()
  if (!trimmed) return undefined
  if (!trimmed.startsWith('data:image/')) return trimmed
  if (isH5Runtime()) return trimmed

  const key = cacheKeyForDataUrl(trimmed)
  const cached = mpPathCache.get(key)
  if (cached) return cached

  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(trimmed)
  if (!match) return trimmed
  const mime = match[1] ?? 'image/jpeg'
  const base64 = match[2] ?? ''
  if (!base64) return trimmed

  const userDataPath =
    (typeof uni !== 'undefined' &&
      (uni as { env?: { USER_DATA_PATH?: string } }).env?.USER_DATA_PATH) ||
    ''
  if (!userDataPath || typeof uni.getFileSystemManager !== 'function') {
    return trimmed
  }

  const path = `${userDataPath}/chat-preview-${key.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}.${extFromMime(mime)}`

  return new Promise((resolve) => {
    uni.getFileSystemManager().writeFile({
      filePath: path,
      data: base64,
      encoding: 'base64',
      success: () => {
        mpPathCache.set(key, path)
        resolve(path)
      },
      fail: () => resolve(trimmed),
    })
  })
}

export async function resolveDisplayImageSrcList(srcs: Array<string | undefined>): Promise<string[]> {
  const resolved = await Promise.all(srcs.map((src) => resolveDisplayImageSrc(src)))
  return resolved.filter((src): src is string => Boolean(src))
}
