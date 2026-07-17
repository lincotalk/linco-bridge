import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAttachmentPicker } from '@/composables/useAttachmentPicker'

type ActionSheetOptions = {
  itemList: string[]
  success?: (result: { tapIndex: number }) => void
  fail?: () => void
}

type ChooseImageOptions = {
  sourceType?: Array<'album' | 'camera'>
  fail?: () => void
}

function stubMiniProgram(tapIndex?: number, overrides: Record<string, unknown> = {}) {
  const showActionSheet = vi.fn((options: ActionSheetOptions) => {
    if (tapIndex === undefined) return
    options.success?.({ tapIndex })
  })
  const chooseImage = vi.fn((options: ChooseImageOptions) => options.fail?.())
  const chooseMessageFile = vi.fn((options: { fail?: () => void }) => options.fail?.())
  const chooseFile = vi.fn((options: { fail?: () => void }) => options.fail?.())

  vi.stubGlobal('document', undefined)
  vi.stubGlobal('uni', {
    showActionSheet,
    chooseImage,
    chooseMessageFile,
    chooseFile,
    ...overrides,
  })

  return { showActionSheet, chooseImage, chooseMessageFile, chooseFile }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useAttachmentPicker', () => {
  it('shows the mini program action sheet before opening any picker', async () => {
    let actionSheet: ActionSheetOptions | undefined
    const showActionSheet = vi.fn((options: ActionSheetOptions) => {
      actionSheet = options
    })
    const chooseMessageFile = vi.fn()
    const chooseFile = vi.fn()
    vi.stubGlobal('document', undefined)
    vi.stubGlobal('uni', { showActionSheet, chooseMessageFile, chooseFile })

    const pending = useAttachmentPicker().pickFiles()

    expect(showActionSheet).toHaveBeenCalledTimes(1)
    expect(actionSheet?.itemList).toEqual(['拍摄', '选择图片', '选择文件'])
    expect(chooseMessageFile).not.toHaveBeenCalled()
    expect(chooseFile).not.toHaveBeenCalled()
    actionSheet?.fail?.()
    await pending
  })

  it.each([
    [0, 'camera'],
    [1, 'album'],
  ] as const)('uses the selected image source for action %s', async (tapIndex, sourceType) => {
    const { chooseImage } = stubMiniProgram(tapIndex)

    await useAttachmentPicker().pickFiles()

    expect(chooseImage).toHaveBeenCalledWith(expect.objectContaining({ sourceType: [sourceType] }))
  })

  it('opens the WeChat file picker only after choosing files', async () => {
    const { chooseMessageFile, chooseFile } = stubMiniProgram(2)

    await useAttachmentPicker().pickFiles()

    expect(chooseMessageFile).toHaveBeenCalledTimes(1)
    expect(chooseFile).not.toHaveBeenCalled()
  })

  it('falls back to chooseFile only when chooseMessageFile is unavailable', async () => {
    const chooseFile = vi.fn((options: { fail?: () => void }) => options.fail?.())
    const { chooseMessageFile } = stubMiniProgram(2, {
      chooseMessageFile: undefined,
      chooseFile,
    })

    await useAttachmentPicker().pickFiles()

    expect(chooseMessageFile).not.toHaveBeenCalled()
    expect(chooseFile).toHaveBeenCalledTimes(1)
  })

  it('does not open a fallback picker after the user cancels chooseMessageFile', async () => {
    const { chooseMessageFile, chooseFile } = stubMiniProgram(2)

    await useAttachmentPicker().pickFiles()

    expect(chooseMessageFile).toHaveBeenCalledTimes(1)
    expect(chooseFile).not.toHaveBeenCalled()
  })

  it('keeps H5 on the document file input path', async () => {
    const showActionSheet = vi.fn()
    vi.stubGlobal('uni', { showActionSheet })
    const input = {
      type: '',
      multiple: false,
      files: [],
      onchange: null as null | (() => void),
      click() {
        this.onchange?.()
      },
    }
    vi.spyOn(document, 'createElement').mockReturnValue(input as unknown as HTMLInputElement)

    await useAttachmentPicker().pickFiles()

    expect(showActionSheet).not.toHaveBeenCalled()
  })
})
