import type { ChatMessageAttachment } from '@/bridge/types'
import { showToast } from '@/utils/format'
import { isImageAttachment } from '@/utils/chat-attachments'

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function unwrapAngleBrackets(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function decodeFileUri(value: string): string {
  if (!/^file:\/\//i.test(value)) return value
  try {
    const url = new URL(value)
    let path = decodeURIComponent(url.pathname)
    if (/^\/[A-Za-z]:/.test(path)) {
      path = path.slice(1)
    }
    return path
  } catch {
    return value.replace(/^file:\/\//i, '')
  }
}

/** Strip Codex line suffix like `/path/file.md:284` → `/path/file.md`. */
function stripLineNumberSuffix(path: string): string {
  const match = path.match(/^(.+):(\d+)$/)
  if (!match) return path
  const base = match[1]?.trim() ?? path
  if (!base) return path
  if (/^[A-Za-z]:$/.test(base)) return path
  if (
    base.startsWith('/') ||
    /^[A-Za-z]:[\\/]/.test(base) ||
    base.startsWith('\\\\') ||
    /\.[A-Za-z0-9]{1,12}$/.test(base)
  ) {
    return base
  }
  return path
}

function looksLikeWorkspaceFilename(value: string): boolean {
  const basename = value.split(/[/\\]/).pop()?.trim() ?? ''
  return /^[^/\\:*?"<>|]+\.[A-Za-z0-9]{1,12}$/.test(basename)
}

function looksLikeRelativeWorkspacePath(value: string): boolean {
  return /^(?:\.{0,2}[\\/])?[^/\\]+(?:[\\/][^/\\]+)+$/.test(value)
}

export function isLocalFileLinkTarget(target: string): boolean {
  const value = unwrapAngleBrackets(target.trim())
  if (!value || isHttpUrl(value) || value.startsWith('data:')) return false
  if (/^file:\/\//i.test(value)) return true
  if (/^([A-Za-z]:\\|\\\\|\/)/.test(value)) return true
  if (looksLikeRelativeWorkspacePath(value)) return true
  if (looksLikeWorkspaceFilename(value)) return true
  return false
}

function looksLikeDirectoryPath(value: string): boolean {
  const basename = value.split(/[/\\]/).pop()?.trim() ?? ''
  if (!basename) return true
  if (/^(workspace|attachments|runtime|sessions?)$/i.test(basename)) return true
  if (/^sid_[a-f0-9]{32}$/i.test(basename)) return true
  return false
}

/** Whether the link should trigger bridge `/get` (excludes workspace directories). */
export function isOpenableFileLinkTarget(target: string): boolean {
  if (!isLocalFileLinkTarget(target)) return false
  const normalized = normalizeBridgeFileGetPath(target)
  if (!normalized) return false
  if (looksLikeDirectoryPath(normalized)) return false

  const basename = normalized.split(/[/\\]/).pop()?.trim() ?? normalized
  if (/^([A-Za-z]:\\|\\\\|\/)/.test(normalized)) {
    return looksLikeWorkspaceFilename(basename)
  }
  return true
}

export function buildBridgeFileGetCandidates(target: string): string[] {
  const normalized = normalizeBridgeFileGetPath(target)
  if (!normalized) return []

  const candidates = [normalized]
  const basename = normalized.split(/[/\\]/).pop()?.trim() ?? ''
  if (basename && basename !== normalized && !candidates.includes(basename)) {
    candidates.push(basename)
  }
  return candidates
}

export function shouldRetryBridgeFileGet(errorText: string): boolean {
  const text = errorText.trim()
  return text.includes('拒绝读取') || text.includes('文件不存在')
}

/** Normalize markdown link target for bridge `/get` command (aligned with Flutter local file links). */
export function normalizeBridgeFileGetPath(target: string): string | null {
  if (!isLocalFileLinkTarget(target)) return null
  let value = unwrapAngleBrackets(target.trim())
  if (/^file:\/\//i.test(value)) {
    value = decodeFileUri(value)
  }
  return stripLineNumberSuffix(value)
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'attachment'
}

function triggerH5Download(url: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.click()
}

function downloadBase64File(base64: string, mimeType: string, filename: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  triggerH5Download(url, filename)
  URL.revokeObjectURL(url)
}

function previewBase64InNewTab(base64: string, mimeType: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  const blob = new Blob([bytes], { type: mimeType || 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function shouldPreviewInline(mimeType: string, filename: string): boolean {
  const normalized = mimeType.trim().toLowerCase()
  if (normalized.startsWith('text/')) return true
  if (normalized.includes('json') || normalized.includes('xml')) return true
  const lowerName = filename.trim().toLowerCase()
  return /\.(txt|md|markdown|json|xml|csv|log|yaml|yml|html|htm)$/.test(lowerName)
}

function getUserDataPath(): string {
  const env = (uni as unknown as { env?: { USER_DATA_PATH?: string } }).env
  return env?.USER_DATA_PATH ?? ''
}

function writeBase64ToTempFile(base64: string, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fs = uni.getFileSystemManager?.()
    const root = getUserDataPath()
    if (!fs || !root) {
      reject(new Error('当前平台不支持写入临时文件'))
      return
    }

    const filePath = `${root}/${Date.now()}-${sanitizeFilename(filename)}`
    fs.writeFile({
      filePath,
      data: base64,
      encoding: 'base64',
      success: () => resolve(filePath),
      fail: (error) => reject(error),
    })
  })
}

async function openLocalFilePath(filePath: string) {
  await new Promise<void>((resolve, reject) => {
    uni.openDocument({
      filePath,
      showMenu: true,
      success: () => resolve(),
      fail: (error) => reject(error),
    })
  })
}

export async function openChatAttachment(attachment: ChatMessageAttachment & { base64?: string }) {
  const name = attachment.name || 'attachment'
  const mimeType = attachment.mimeType || 'application/octet-stream'

  if (isImageAttachment(attachment) && attachment.previewUrl) {
    uni.previewImage({
      current: attachment.previewUrl,
      urls: [attachment.previewUrl],
    })
    return
  }

  const previewUrl = attachment.previewUrl?.trim() ?? ''
  if (previewUrl && isHttpUrl(previewUrl)) {
    // #ifdef H5
    window.open(previewUrl, '_blank', 'noopener,noreferrer')
    return
    // #endif

    await new Promise<void>((resolve, reject) => {
      uni.downloadFile({
        url: previewUrl,
        success: async (result) => {
          if (result.statusCode >= 200 && result.statusCode < 300) {
            try {
              await openLocalFilePath(result.tempFilePath)
              resolve()
            } catch (error) {
              reject(error)
            }
            return
          }
          reject(new Error('下载失败'))
        },
        fail: (error) => reject(error),
      })
    }).catch(() => {
      showToast('下载失败')
    })
    return
  }

  const base64 = attachment.base64?.trim()
  if (base64) {
    // #ifdef H5
    if (shouldPreviewInline(mimeType, name)) {
      previewBase64InNewTab(base64, mimeType)
      return
    }
    downloadBase64File(base64, mimeType, name)
    return
    // #endif

    try {
      const filePath = await writeBase64ToTempFile(base64, name)
      await openLocalFilePath(filePath)
    } catch {
      showToast('打开文件失败')
    }
    return
  }

  if (previewUrl.startsWith('data:')) {
    // #ifdef H5
    triggerH5Download(previewUrl, name)
    return
    // #endif

    const dataMatch = previewUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (dataMatch) {
      try {
        const filePath = await writeBase64ToTempFile(dataMatch[2] ?? '', name)
        await openLocalFilePath(filePath)
      } catch {
        showToast('打开文件失败')
      }
      return
    }
  }

  showToast('暂无可打开的文件链接')
}

export function quoteGetPath(path: string): string {
  const trimmed = path.trim()
  if (!/\s/.test(trimmed)) return trimmed
  return `"${trimmed.replace(/"/g, '\\"')}"`
}
