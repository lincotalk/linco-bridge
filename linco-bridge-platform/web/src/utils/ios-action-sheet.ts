import { reactive } from 'vue'

export interface IosActionSheetState {
  visible: boolean
  items: string[]
  cancelText: string
  resolve: ((index: number | null) => void) | null
}

export const iosActionSheetState = reactive<IosActionSheetState>({
  visible: false,
  items: [],
  cancelText: '取消',
  resolve: null,
})

/** iOS-style bottom action sheet (matches Flutter / CupertinoActionSheet on device). */
export function showIosActionSheet(
  itemList: string[],
  cancelText = '取消',
): Promise<number | null> {
  if (itemList.length === 0) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    iosActionSheetState.items = [...itemList]
    iosActionSheetState.cancelText = cancelText
    iosActionSheetState.resolve = resolve
    iosActionSheetState.visible = true
  })
}

export function resolveIosActionSheet(index: number | null) {
  const pending = iosActionSheetState.resolve
  iosActionSheetState.visible = false
  iosActionSheetState.items = []
  iosActionSheetState.resolve = null
  pending?.(index)
}
