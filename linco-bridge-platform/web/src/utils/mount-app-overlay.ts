import { createSSRApp } from 'vue'
import type { Pinia } from 'pinia'

import AppOverlayHost from '@/components/AppOverlayHost.vue'

let overlayMounted = false

/** H5：独立挂载到 body，避免与页面路由层叠冲突 */
export function mountAppOverlayHostForH5(pinia: Pinia): void {
  if (overlayMounted || typeof document === 'undefined') return
  overlayMounted = true

  const mountEl = document.createElement('div')
  mountEl.id = 'app-overlay-root'
  document.body.appendChild(mountEl)

  const hostApp = createSSRApp(AppOverlayHost)
  hostApp.use(pinia)
  hostApp.mount(mountEl)
}

export function resetAppOverlayHostForTests(): void {
  overlayMounted = false
}
