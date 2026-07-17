# Mini Program Attachment Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让微信小程序点击附件按钮后直接显示“拍摄 / 选择图片 / 选择文件”，同时保持 H5 文件选择流程不变。

**Architecture:** 保留 `useAttachmentPicker()` 的公共接口和 H5 `document` 分支，只重排 UniApp 分支。小程序先显示 `uni.showActionSheet()`，再根据明确的用户选择调用相机、相册或文件 API；普通文件仅在对应 API 缺失时回退，用户取消不会触发第二个选择器。

**Tech Stack:** Vue 3 Composition API、UniApp、TypeScript、Vitest、微信小程序 API

---

## 文件结构

- Create: `src/composables/useAttachmentPicker.spec.ts` - 从 composable 公共接口验证小程序调用顺序、来源选择、文件回退和 H5 隔离。
- Modify: `src/composables/useAttachmentPicker.ts` - 将操作菜单前置，并按用户选择调用明确的选择器。

### Task 1: 用回归测试固定平台行为

**Files:**
- Create: `src/composables/useAttachmentPicker.spec.ts`
- Test: `src/composables/useAttachmentPicker.spec.ts`

- [ ] **Step 1: 写入现状下会失败的调用顺序和平台隔离测试**

```ts
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

    expect(chooseImage).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: [sourceType] }),
    )
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
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npx vitest run src/composables/useAttachmentPicker.spec.ts`

Expected: FAIL；现有实现会在 `showActionSheet()` 前调用 `chooseMessageFile()`，且图片来源仍为 `['album', 'camera']`。

### Task 2: 最小化调整小程序选择流程

**Files:**
- Modify: `src/composables/useAttachmentPicker.ts:87-227`
- Test: `src/composables/useAttachmentPicker.spec.ts`

- [ ] **Step 1: 让图片选择函数接受单一来源**

```diff
+type ImageSourceType = 'album' | 'camera'
+
-async function pickViaUniImage(): Promise<OutboundChatFile[]> {
+async function pickViaUniImage(sourceType: ImageSourceType): Promise<OutboundChatFile[]> {
   return new Promise((resolve) => {
     uni.chooseImage({
       count: 9,
       sizeType: ['compressed'],
-      sourceType: ['album', 'camera'],
+      sourceType: [sourceType],
       success: (res) => {
```

- [ ] **Step 2: 区分 API 不可用与用户取消**

将两个文件选择函数的返回类型改为 `Promise<OutboundChatFile[] | null>`。只有 API 不存在时返回 `null`，API 已调用但用户取消时仍返回空数组：

```diff
-async function pickViaChooseMessageFile(): Promise<OutboundChatFile[]> {
+async function pickViaChooseMessageFile(): Promise<OutboundChatFile[] | null> {
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
-  if (!chooseMessageFile) return []
+  if (!chooseMessageFile) return null

   return new Promise((resolve) => {

-async function pickViaChooseFile(): Promise<OutboundChatFile[]> {
+async function pickViaChooseFile(): Promise<OutboundChatFile[] | null> {
   const chooseFile = (
     uni as typeof uni & {
       chooseFile?: (options: Record<string, unknown>) => void
     }
   ).chooseFile
-  if (!chooseFile) return []
+  if (!chooseFile) return null

   return new Promise((resolve) => {
```

- [ ] **Step 3: 添加只按 API 可用性回退的文件入口**

```ts
async function pickViaUniFile(): Promise<OutboundChatFile[]> {
  const messageFiles = await pickViaChooseMessageFile()
  if (messageFiles !== null) return messageFiles

  const genericFiles = await pickViaChooseFile()
  if (genericFiles !== null) return genericFiles

  showToast('当前平台不支持选择文件')
  return []
}
```

- [ ] **Step 4: 将操作菜单改为 UniApp 分支第一步**

```ts
async function pickViaUniPlatform(): Promise<OutboundChatFile[]> {
  return new Promise((resolve) => {
    uni.showActionSheet({
      itemList: ['拍摄', '选择图片', '选择文件'],
      success: (res) => {
        void (async () => {
          if (res.tapIndex === 0) {
            resolve(await pickViaUniImage('camera'))
            return
          }
          if (res.tapIndex === 1) {
            resolve(await pickViaUniImage('album'))
            return
          }
          if (res.tapIndex === 2) {
            resolve(await pickViaUniFile())
            return
          }
          resolve([])
        })()
      },
      fail: () => resolve([]),
    })
  })
}
```

- [ ] **Step 5: 运行测试并确认 GREEN**

Run: `npx vitest run src/composables/useAttachmentPicker.spec.ts`

Expected: PASS，7 个测试全部通过。

### Task 3: 回归验证与提交

**Files:**
- Modify: `src/composables/useAttachmentPicker.ts`
- Create: `src/composables/useAttachmentPicker.spec.ts`
- Include: `docs/superpowers/plans/2026-07-17-mini-program-attachment-picker.md`

- [ ] **Step 1: 格式与 lint 验证**

Run: `npx prettier --write src/composables/useAttachmentPicker.ts src/composables/useAttachmentPicker.spec.ts`

Run: `npx eslint src/composables/useAttachmentPicker.ts src/composables/useAttachmentPicker.spec.ts --max-warnings 0`

Expected: 两条命令均退出码 0。

- [ ] **Step 2: 运行 Web 全量测试**

Run: `npm test`

Expected: 所有 Vitest 测试通过。

- [ ] **Step 3: 验证 H5 构建**

Run: `npm run build:h5`

Expected: 构建完成，`verify-h5-tabbar` 输出 `OK`。

- [ ] **Step 4: 验证微信小程序构建**

Run: `npm run build:mp-weixin`

Expected: 微信小程序编译完成且退出码 0。

- [ ] **Step 5: 检查变更范围并提交**

Run: `git diff --check && git status --short`

Expected: 只有 `linco-bridge-platform/web` 下的计划、测试和附件选择器实现发生变化。

```bash
git add linco-bridge-platform/web/docs/superpowers/plans/2026-07-17-mini-program-attachment-picker.md \
  linco-bridge-platform/web/src/composables/useAttachmentPicker.ts \
  linco-bridge-platform/web/src/composables/useAttachmentPicker.spec.ts
git commit -m "fix: open mini program attachment menu first"
```
