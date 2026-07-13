import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { mountAppOverlayHostForH5 } from '@/utils/mount-app-overlay'

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()
  app.use(pinia)

  if (typeof document !== 'undefined') {
    queueMicrotask(() => mountAppOverlayHostForH5(pinia))
  }

  return { app }
}
