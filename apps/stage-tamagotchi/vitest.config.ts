import { resolve } from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@lemonneko/crop-empty-pixels': resolve(import.meta.dirname, '../../node_modules/@lemonneko/crop-empty-pixels/dist/index.js'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.git/**'],
    setupFiles: [resolve(import.meta.dirname, '../../packages/stage-ui/vitest.setup.ts')],
  },
})
