import { defineConfig } from 'tsdown'
import Yaml from 'unplugin-yaml/rolldown'

export default defineConfig({
  entry: {
    'locales/index': 'src/locales/index.ts',
  },
  plugins: [Yaml()],
})
