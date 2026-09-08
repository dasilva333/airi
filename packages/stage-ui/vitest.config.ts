import type { Plugin } from 'vite'

import { join, resolve } from 'node:path'
import { cwd } from 'node:process'

import Vue from '@vitejs/plugin-vue'
import Info from 'unplugin-info/vite'
import Yaml from 'unplugin-yaml/vite'

import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  return ({
    plugins: [
      Vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag: string) => tag.startsWith('Tres') && tag !== 'TresCanvas',
          },
        },
      }),
      Info(),
      Yaml() as Plugin,
    ],
    resolve: {
      alias: {
        '@lemonneko/crop-empty-pixels': resolve(import.meta.dirname, '../../node_modules/@lemonneko/crop-empty-pixels/dist/index.js'),
        '@proj-airi/i18n': resolve(join(import.meta.dirname, '..', '..', 'packages', 'i18n', 'src')),
        '@proj-airi/stage-shared': resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-shared', 'src')),
      },
    },
    test: {
      include: ['src/**/*.test.ts'],
      setupFiles: [resolve(import.meta.dirname, 'vitest.setup.ts')],
      env: loadEnv(mode, join(cwd(), 'packages', 'stage-ui'), ''),
    },
  })
})
