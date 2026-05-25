import DrizzleORMMigrations from '@proj-airi/unplugin-drizzle-orm-migrations/rolldown'

import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: true,
  entry: ['src/index.ts'],
  fixedExtension: true,
  plugins: [
    DrizzleORMMigrations({
      root: '../../apps/server',
    }),
  ],
  sourcemap: true,
  unused: true,
})
