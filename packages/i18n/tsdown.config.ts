import { defineConfig } from 'tsdown'
import Yaml from 'unplugin-yaml/rolldown'

export default defineConfig({
  copy: [{ flatten: false, from: 'src/locales/**/*.yaml', to: 'dist' }],
  entry: {
    index: 'src/index.ts',
    'locales/en/index': 'src/locales/en/index.ts',
    'locales/es/index': 'src/locales/es/index.ts',
    'locales/fr/index': 'src/locales/fr/index.ts',
    'locales/index': 'src/locales/index.ts',
    'locales/ja/index': 'src/locales/ja/index.ts',
    'locales/ko/index': 'src/locales/ko/index.ts',
    'locales/ru/index': 'src/locales/ru/index.ts',
    'locales/vi/index': 'src/locales/vi/index.ts',
    'locales/zh-Hans/index': 'src/locales/zh-Hans/index.ts',
    'locales/zh-Hant/index': 'src/locales/zh-Hant/index.ts',
  },
  plugins: [Yaml()],
})
