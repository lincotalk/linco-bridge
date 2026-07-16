import type { OutboundChatFile } from '@/api/session-api'
import {
  isImageMimeType,
  normalizeAttachmentMimeType,
  sanitizeOutboundBase64,
} from '@/utils/chat-attachments'

/** 对齐 Flutter ImageCompressUtil：长边上限；Claude Code 对过大图常显示 [Unsupported Image] */
const MAX_LONG_SIDE = 2048
const TARGET_MAX_BYTES = 2 * 1024 * 1024
const JPEG_QUALITY = 0.82

function toJpgName(fileName: string): string {
  const trimmed = fileName.trim() || 'image'
  const idx = trimmed.lastIndexOf('.')
  if (idx <= 0) return `${trimmed}.jpg`
  return `${trimmed.slice(0, idx)}.jpg`
}

function estimatedBytesFromBase64(base64: string): number {
  return Math.floor((base64.length * 3) / 4)
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片解码失败'))
    img.src = dataUrl
  })
}

function canvasToJpegBase64(
  img: HTMLImageElement,
  maxLongSide: number,
  quality: number,
): string | undefined {
  if (typeof document === 'undefined') return undefined
  const longSide = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height)
  const scale = longSide > maxLongSide ? maxLongSide / longSide : 1
  const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale))
  const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  ctx.drawImage(img, 0, 0, width, height)
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const comma = dataUrl.indexOf(',')
  return comma >= 0 ? dataUrl.slice(comma + 1) : undefined
}

async function compressViaCanvas(file: OutboundChatFile): Promise<OutboundChatFile | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null
  const base64 = sanitizeOutboundBase64(file.base64)
  if (!base64) return null

  const mime = normalizeAttachmentMimeType(file.name || 'attachment', file.mimeType)
  const dataUrl = `data:${mime.startsWith('image/') ? mime : 'image/jpeg'};base64,${base64}`
  try {
    const img = await loadImageFromDataUrl(dataUrl)
    let quality = JPEG_QUALITY
    let encoded = canvasToJpegBase64(img, MAX_LONG_SIDE, quality)
    if (!encoded) return null

    let rounds = 0
    while (estimatedBytesFromBase64(encoded) > TARGET_MAX_BYTES && quality > 0.45 && rounds < 3) {
      quality -= 0.12
      encoded = canvasToJpegBase64(img, MAX_LONG_SIDE, quality)
      if (!encoded) return null
      rounds += 1
    }

    // 压缩后更大则保留原图（但 MIME 仍归一）
    if (estimatedBytesFromBase64(encoded) >= estimatedBytesFromBase64(base64)) {
      return null
    }

    return {
      ...file,
      name: toJpgName(file.name || 'image'),
      mimeType: 'image/jpeg',
      base64: encoded,
    }
  } catch {
    return null
  }
}

async function compressViaUni(file: OutboundChatFile): Promise<OutboundChatFile | null> {
  const localPath = file.localPath?.trim()
  if (!localPath || typeof uni === 'undefined') return null
  const compressImage = (
    uni as typeof uni & {
      compressImage?: (options: {
        src: string
        quality?: number
        compressedWidth?: number
        success?: (res: { tempFilePath: string }) => void
        fail?: () => void
      }) => void
    }
  ).compressImage
  if (!compressImage) return null

  const compressedPath = await new Promise<string | null>((resolve) => {
    compressImage({
      src: localPath,
      quality: 80,
      compressedWidth: MAX_LONG_SIDE,
      success: (res) => resolve(res.tempFilePath || null),
      fail: () => resolve(null),
    })
  })
  if (!compressedPath) return null

  const base64 = await new Promise<string>((resolve, reject) => {
    uni.getFileSystemManager().readFile({
      filePath: compressedPath,
      encoding: 'base64',
      success: (res) => resolve(typeof res.data === 'string' ? res.data : ''),
      fail: (err) => reject(new Error(err.errMsg || '读取压缩图失败')),
    })
  })
  const cleaned = sanitizeOutboundBase64(base64)
  if (!cleaned) return null

  return {
    ...file,
    name: toJpgName(file.name || 'image'),
    mimeType: 'image/jpeg',
    base64: cleaned,
    localPath: compressedPath,
  }
}

function shouldCompressImage(file: OutboundChatFile): boolean {
  const mime = normalizeAttachmentMimeType(file.name || 'attachment', file.mimeType)
  if (isImageMimeType(mime)) return true
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(file.name || '')
}

/**
 * 发送前压缩图片：统一成 image/jpeg，降低 Claude Code [Unsupported Image] 概率。
 * 非图片或压缩失败时原样返回（仍会走 MIME 归一）。
 */
export async function compressOutboundImageIfNeeded(
  file: OutboundChatFile,
): Promise<OutboundChatFile> {
  if (!shouldCompressImage(file)) {
    return {
      ...file,
      mimeType: normalizeAttachmentMimeType(file.name || 'attachment', file.mimeType),
    }
  }

  const mime = normalizeAttachmentMimeType(file.name || 'attachment', file.mimeType)
  // 小体积且已是 connector 支持的类型，跳过重编码
  const base64 = sanitizeOutboundBase64(file.base64)
  const supported =
    mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/gif' || mime === 'image/webp'
  if (base64 && supported && estimatedBytesFromBase64(base64) <= TARGET_MAX_BYTES) {
    // 仍强制 image/jpg → image/jpeg，并尽量保证扩展名
    if (mime === 'image/jpeg' && !/\.jpe?g$/i.test(file.name || '')) {
      return { ...file, name: toJpgName(file.name || 'image'), mimeType: 'image/jpeg', base64 }
    }
    return { ...file, mimeType: mime, base64 }
  }

  const viaUni = await compressViaUni(file)
  if (viaUni) return viaUni

  const viaCanvas = await compressViaCanvas(file)
  if (viaCanvas) return viaCanvas

  return {
    ...file,
    mimeType: mime === 'image/jpg' || mime === 'image/pjpeg' ? 'image/jpeg' : mime,
    base64: base64 ?? file.base64,
  }
}

export async function prepareOutboundImages(
  files: OutboundChatFile[],
): Promise<OutboundChatFile[]> {
  const result: OutboundChatFile[] = []
  for (const file of files) {
    result.push(await compressOutboundImageIfNeeded(file))
  }
  return result
}
