import type { ChatMessageAttachment } from '@/bridge/types'
import { showToast } from '@/utils/format'
import { isImageAttachment } from '@/utils/chat-attachments'

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
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

export function isLocalFileLinkTarget(target: string): boolean {
  const value = target.trim()
  if (!value || isHttpUrl(value) || value.startsWith('data:')) return false
  if (/^file:\/\//i.test(value)) return true
  return /^([A-Za-z]:\\|\\\\|\/)/.test(value)
}
