import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'src/components/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/bridge/**/*.ts', 'src/utils/**/*.ts', 'src/stores/**/*.ts'],
    },
  },
})
