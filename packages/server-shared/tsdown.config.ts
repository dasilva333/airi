import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'types/index': 'src/types/index.ts',
  },
  inlineOnly: false,
  sourcemap: true,
  unused: true,
})
