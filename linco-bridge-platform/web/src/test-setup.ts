import { vi } from 'vitest'

vi.stubGlobal('uni', {
  setClipboardData: vi.fn(({ success }: { success?: () => void }) => success?.()),
  showToast: vi.fn(),
  navigateTo: vi.fn(),
  switchTab: vi.fn(),
  getSystemInfoSync: vi.fn(() => ({ statusBarHeight: 20 })),
})
