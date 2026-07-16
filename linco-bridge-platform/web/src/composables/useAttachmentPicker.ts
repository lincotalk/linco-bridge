import { ref } from 'vue'
import type { OutboundChatFile } from '@/api/session-api'
import { normalizeAttachmentMimeType } from '@/utils/chat-attachments'
import { showToast } from '@/utils/format'

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const base64 = result.includes(',') ? result.split(',')[1] ?? '' : result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

function readUniFileAsBase64(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fs = uni.getFileSystemManager()
    fs.readFile({
      filePath: path,
      encoding: 'base64',
      success: (res) => {
        resolve(typeof res.data === 'string' ? res.data : '')
      },
      fail: (err) => reject(new Error(err.errMsg || '读取文件失败')),
    })
  })
}

function fileNameFromPath(path: string, index: number): string {
  return path.split('/').pop() || path.split('\\').pop() || `file-${index + 1}`
}

async function pathsToOutboundFiles(paths: string[]): Promise<OutboundChatFile[]> {
  const files: OutboundChatFile[] = []
  for (const [index, path] of paths.entries()) {
    if (!path) continue
    const name = fileNameFromPath(path, index)
    files.push({
      name,
      mimeType: normalizeAttachmentMimeType(name),
      base64: await readUniFileAsBase64(path),
      localPath: path,
    })
  }
  return files
}

async function pickViaDocument(): Promise<OutboundChatFile[]> {
  if (typeof document === 'undefined') return []

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = () => {
      void (async () => {
        const selected = Array.from(input.files ?? [])
        if (selected.length === 0) {
          resolve([])
          return
        }
        try {
          const files: OutboundChatFile[] = []
          for (const file of selected) {
            files.push({
              name: file.name,
              mimeType: normalizeAttachmentMimeType(file.name, file.type),
              base64: await readFileAsBase64(file),
            })
          }
          resolve(files)
        } catch (err) {
          showToast(err instanceof Error ? err.message : '读取附件失败')
          resolve([])
        }
      })()
    }
    input.click()
  })
}

async function pickViaUniImage(): Promise<OutboundChatFile[]> {
  return new Promise((resolve) => {
    uni.chooseImage({
      count: 9,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        void (async () => {
          try {
            const paths = Array.isArray(res.tempFilePaths) ? res.tempFilePaths : [res.tempFilePaths]
            resolve(await pathsToOutboundFiles(paths.filter(Boolean) as string[]))
          } catch (err) {
            showToast(err instanceof Error ? err.message : '读取图片失败')
            resolve([])
          }
        })()
      },
      fail: () => resolve([]),
    })
  })
}

async function pickViaChooseMessageFile(): Promise<OutboundChatFile[]> {
  const chooseMessageFile = (
    uni as typeof uni & {
      chooseMessageFile?: (options: {
        count?: number
        type?: 'all' | 'video' | 'image' | 'file'
        success?: (res: {
          tempFiles: Array<{ name?: string; path: string; type?: string }>
        }) => void
        fail?: () => void
      }) => void
    }
  ).chooseMessageFile
  if (!chooseMessageFile) return []

  return new Promise((resolve) => {
    chooseMessageFile({
      count: 9,
      type: 'all',
      success: (res) => {
        void (async () => {
          try {
            const files: OutboundChatFile[] = []
            for (const item of res.tempFiles ?? []) {
              if (!item.path) continue
              const name = item.name || fileNameFromPath(item.path, files.length)
              files.push({
                name,
                mimeType: normalizeAttachmentMimeType(name, item.type),
                base64: await readUniFileAsBase64(item.path),
                localPath: item.path,
              })
            }
            resolve(files)
          } catch (err) {
            showToast(err instanceof Error ? err.message : '读取文件失败')
            resolve([])
          }
        })()
      },
      fail: () => resolve([]),
    })
  })
}

async function pickViaChooseFile(): Promise<OutboundChatFile[]> {
  const chooseFile = (
    uni as typeof uni & {
      chooseFile?: (options: Record<string, unknown>) => void
    }
  ).chooseFile
  if (!chooseFile) return []

  return new Promise((resolve) => {
    chooseFile({
      count: 9,
      success: (res: {
        tempFilePaths?: string[]
        tempFiles?: Array<{ name?: string; path?: string; tempFilePath?: string }>
      }) => {
        void (async () => {
          try {
            if (Array.isArray(res.tempFiles) && res.tempFiles.length > 0) {
              const files: OutboundChatFile[] = []
              for (const item of res.tempFiles) {
                const path = item.path || item.tempFilePath
                if (!path) continue
                const name = item.name || fileNameFromPath(path, files.length)
                files.push({
                  name,
                  mimeType: normalizeAttachmentMimeType(name),
                  base64: await readUniFileAsBase64(path),
                  localPath: path,
                })
              }
              resolve(files)
              return
            }
            const paths = Array.isArray(res.tempFilePaths) ? res.tempFilePaths : []
            resolve(await pathsToOutboundFiles(paths))
          } catch (err) {
            showToast(err instanceof Error ? err.message : '读取文件失败')
            resolve([])
          }
        })()
      },
      fail: () => resolve([]),
    })
  })
}

async function pickViaUniPlatform(): Promise<OutboundChatFile[]> {
  const messageFiles = await pickViaChooseMessageFile()
  if (messageFiles.length > 0) return messageFiles

  const genericFiles = await pickViaChooseFile()
  if (genericFiles.length > 0) return genericFiles

  return new Promise((resolve) => {
    uni.showActionSheet({
      itemList: ['相册/拍照', '选择文件'],
      success: (res) => {
        void (async () => {
          if (res.tapIndex === 0) {
            resolve(await pickViaUniImage())
            return
          }
          const retryFiles = await pickViaChooseFile()
          if (retryFiles.length > 0) {
            resolve(retryFiles)
            return
          }
          resolve(await pickViaUniImage())
        })()
      },
      fail: () => resolve([]),
    })
  })
}

export function useAttachmentPicker() {
  const pendingFiles = ref<OutboundChatFile[]>([])

  async function pickFiles(): Promise<OutboundChatFile[]> {
    let picked: OutboundChatFile[] = []

    if (typeof document !== 'undefined') {
      picked = await pickViaDocument()
    } else if (typeof uni !== 'undefined') {
      picked = await pickViaUniPlatform()
    } else {
      showToast('当前平台暂不支持附件')
      return []
    }

    if (picked.length === 0) return []

    pendingFiles.value = [...pendingFiles.value, ...picked]
    showToast(`已选择 ${picked.length} 个附件`, 'success')
    return picked
  }

  function removeFile(index: number) {
    pendingFiles.value = pendingFiles.value.filter((_, idx) => idx !== index)
  }

  function clearFiles() {
    pendingFiles.value = []
  }

  return {
    pendingFiles,
    pickFiles,
    removeFile,
    clearFiles,
  }
}
