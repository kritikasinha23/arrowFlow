import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@arrowflow/engine': fileURLToPath(new URL('./packages/engine/src/index.ts', import.meta.url)),
      '@arrowflow/levels': fileURLToPath(new URL('./packages/levels/src/index.ts', import.meta.url)),
      '@arrowflow/twine': fileURLToPath(new URL('./packages/twine/src/index.ts', import.meta.url)),
      '@arrowflow/renderer': fileURLToPath(new URL('./packages/renderer/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'tools/**/*.test.ts', 'apps/api/**/*.test.ts', 'apps/web/src/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
  },
})
