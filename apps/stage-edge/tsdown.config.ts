import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/deployer/index.ts', 'src/deployer/oauth.ts'],
  format: ['esm'],
  clean: true,
  dts: false,
})
