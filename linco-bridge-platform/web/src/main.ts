import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import AppOverlayHost from './components/AppOverlayHost.vue'

let overlayMounted = false

function mountAppOverlayHost(pinia: ReturnType<typeof createPinia>) {
  if (overlayMounted || typeof document === 'undefined') return
  overlayMounted = true

  const mountEl = document.createElement('div')
  mountEl.id = 'app-overlay-root'
  document.body.appendChild(mountEl)

  const hostApp = createSSRApp(AppOverlayHost)
  hostApp.use(pinia)
  hostApp.mount(mountEl)
}

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()
  app.use(pinia)

  if (typeof document !== 'undefined') {
    queueMicrotask(() => mountAppOverlayHost(pinia))
  }

  return { app }
}
