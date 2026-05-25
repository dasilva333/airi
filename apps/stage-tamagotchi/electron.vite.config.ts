import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import { resilient } from '@proj-airi/stage-shared/vite'
import { Download } from '@proj-airi/unplugin-fetch'
import { DownloadLive2DSDK } from '@proj-airi/unplugin-live2d-sdk'
import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'electron-vite'
import UnoCss from 'unocss/vite'
import Info from 'unplugin-info/vite'
import VueRouter from 'unplugin-vue-router/vite'
import Yaml from 'unplugin-yaml/vite'
import Layouts from 'vite-plugin-vue-layouts'
import VueMacros from 'vue-macros/vite'

const stageUIAssetsRoot = resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-ui', 'src', 'assets'))
const sharedCacheDir = resolve(join(import.meta.dirname, '..', '..', '.cache'))
const require = createRequire(import.meta.url)

export default defineConfig({
  main: {
    build: {
      // NOTICE: Any package added to 'include' below MUST be listed in 'dependencies'
      // (not 'devDependencies') in package.json to be available in production builds.
      externalizeDeps: {
        exclude: [
          '@proj-airi/electron-screen-capture',
          '@proj-airi/electron-eventa',
          '@proj-airi/electron-vueuse',
          '@proj-airi/plugin-sdk',
        ],
      },
    },
    plugins: [
      {
        // To replace `build.rolldownOptions`, as electron-vite still uses the deprecated
        // `rollupOptions`, using `rollupOptions` and `rolldownOptions` at the same
        // time may lead to unexpected merge results. Using `rollupOptions` to manipulate
        // `manualChunks` also did not work. Therefore, it was transformed into a plugin
        // declaration with the recommended `codeSplitting` option.
        name: 'manual-chunks',
        outputOptions(options) {
          // options.codeSplitting = {
          //   groups: [
          //     {
          //       name(moduleId) {
          //         // https://github.com/lobehub/lobehub/blob/6ecba929b738e1259e15d17e7643941e015324ee/apps/desktop/electron.vite.config.ts#L54
          //         // Prevent debug package from being bundled into index.js to avoid side-effect pollution
          //         if (moduleId.includes('node_modules/debug')) {
          //           return 'vendor-debug'
          //         }
          //       },
          //     },
          //     {
          //       name(moduleId) {
          //         // https://github.com/lobehub/lobehub/blob/6ecba929b738e1259e15d17e7643941e015324ee/apps/desktop/electron.vite.config.ts#L54
          //         // Prevent debug package from being bundled into index.js to avoid side-effect pollution
          //         if (moduleId.includes('node_modules/h3')) {
          //           return 'vendor-h3'
          //         }
          //       },
          //     },
          //   ],
          // }

          return options
        },
      },
      Info(),
    ],

    resolve: {
      alias: {
        '@proj-airi/i18n-bundle': resolve(
          join(import.meta.dirname, '..', '..', 'packages', 'i18n', 'src', 'dist-lite', 'messages.mjs'),
        ),
        '@proj-airi/server-runtime': resolve(
          join(import.meta.dirname, '..', '..', 'packages', 'server-runtime', 'src'),
        ),
      },
    },
  },

  preload: {
    build: {
      lib: {
        entry: {
          index: resolve(join(import.meta.dirname, 'src', 'preload', 'index.ts')),
        },
      },
      rollupOptions: {
        output: {
          chunkFileNames: '[name]-[hash].cjs',
          entryFileNames: '[name].cjs',
          format: 'cjs',
        },
      },
    },

    plugins: [],
  },

  renderer: {
    // Thanks to [@Maqsyo](https://github.com/Maqsyo)
    // https://github.com/alex8088/electron-vite/issues/99#issuecomment-1862671727
    base: './',

    build: {
      rollupOptions: {
        input: {
          'beat-sync': resolve(join(import.meta.dirname, 'src', 'renderer', 'beat-sync.html')),
          main: resolve(join(import.meta.dirname, 'src', 'renderer', 'index.html')),
        },
      },
      target: 'esnext',
    },

    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext',
      },
      exclude: [
        // Internal Packages
        '@proj-airi/stage-ui',
        '@proj-airi/stage-ui/*',
        '@proj-airi/stage-ui-three',
        '@proj-airi/stage-ui-three/*',
        '@proj-airi/drizzle-duckdb-wasm',
        '@proj-airi/drizzle-duckdb-wasm/*',
        '@proj-airi/electron-screen-capture',

        // Static Assets: Models, Images, etc.
        'src/renderer/public/assets/*',

        // Live2D SDK
        '@framework/live2dcubismframework',
        '@framework/math/cubismmatrix44',
        '@framework/type/csmvector',
        '@framework/math/cubismviewmatrix',
        '@framework/cubismdefaultparameterid',
        '@framework/cubismmodelsettingjson',
        '@framework/effect/cubismbreath',
        '@framework/effect/cubismeyeblink',
        '@framework/model/cubismusermodel',
        '@framework/motion/acubismmotion',
        '@framework/motion/cubismmotionqueuemanager',
        '@framework/type/csmmap',
        '@framework/utils/cubismdebug',
        '@framework/model/cubismmoc',
      ],
      include: ['tslib', '@vueuse/motion', 'popmotion', 'uncrypto', 'three'],
    },

    plugins: [
      {
        enforce: 'pre',
        load(id) {
          if (id === '\0virtual:node-shim') return 'export default {};'
          return null
        },
        name: 'force-node-crypto-shim',
        resolveId(id, importer) {
          if (id === 'node:crypto' || id === 'crypto') {
            return resolve(join(import.meta.dirname, 'src', 'renderer', 'shims', 'node-crypto.ts'))
          }
          if (id.startsWith('node:') || ['process', 'module', 'path', 'fs'].includes(id)) {
            return '\0virtual:node-shim'
          }
          if (id.includes('-node.mjs') && (id.includes('duckdb-wasm') || importer?.includes('duckdb-wasm'))) {
            return this.resolve(id.replace('-node.mjs', '-browser.mjs'), importer, { skipSelf: true })
          }
          return null
        },
      },
      Info(),

      {
        config(ctx) {
          const define: Record<string, any> = {
            'import.meta.env.RUNTIME_ENVIRONMENT': "'electron'",
          }
          if (ctx.mode === 'development') {
            define['import.meta.env.URL_MODE'] = "'server'"
          }
          if (ctx.mode === 'production') {
            define['import.meta.env.URL_MODE'] = "'file'"
          }

          return { define }
        },
        name: 'proj-airi:defines',
      },

      // Inspect(),

      Yaml(),

      VueMacros({
        betterDefine: false,
        plugins: {
          vue: Vue({
            include: [/\.vue$/, /\.md$/],
          }),
          vueJsx: false,
        },
      }),

      VueRouter({
        dts: resolve(import.meta.dirname, 'src/renderer/typed-router.d.ts'),
        exclude: ['**/components/**'],
        routesFolder: [
          {
            exclude: (base) => [
              ...base,
              '**/settings/connection/index.vue',
              '**/settings/system/general.vue',
              '**/settings/modules/mcp.vue',
            ],
            src: resolve(import.meta.dirname, '..', '..', 'packages', 'stage-pages', 'src', 'pages'),
          },
          resolve(import.meta.dirname, 'src', 'renderer', 'pages'),
        ],
      }),

      // VitePluginVueDevTools(),

      // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
      Layouts({
        layoutsDirs: [
          resolve(import.meta.dirname, 'src', 'renderer', 'layouts'),
          resolve(import.meta.dirname, '..', '..', 'packages', 'stage-layouts', 'src', 'layouts'),
        ],
        pagesDirs: [resolve(import.meta.dirname, 'src', 'renderer', 'pages')],
      }),

      UnoCss(),

      // https://github.com/intlify/bundle-tools/tree/main/packages/unplugin-vue-i18n
      VueI18n({
        compositionOnly: true,
        fullInstall: true,
        runtimeOnly: true,
      }),

      ...(!process.env.SKIP_DOWNLOADS
        ? [
            resilient(DownloadLive2DSDK()),
            resilient(
              Download(
                'https://dist.ayaka.moe/live2d-models/hiyori_free_zh.zip',
                'hiyori_free_zh.zip',
                'live2d/models',
                { cacheDir: sharedCacheDir, parentDir: stageUIAssetsRoot },
              ),
            ),
            resilient(
              Download('https://dist.ayaka.moe/live2d-models/hiyori_pro_zh.zip', 'hiyori_pro_zh.zip', 'live2d/models', {
                cacheDir: sharedCacheDir,
                parentDir: stageUIAssetsRoot,
              }),
            ),
            resilient(
              Download(
                'https://dist.ayaka.moe/vrm-models/VRoid-Hub/AvatarSample-A/AvatarSample_A.vrm',
                'AvatarSample_A.vrm',
                'vrm/models/AvatarSample-A',
                { cacheDir: sharedCacheDir, parentDir: stageUIAssetsRoot },
              ),
            ),
            resilient(
              Download(
                'https://dist.ayaka.moe/vrm-models/VRoid-Hub/AvatarSample-B/AvatarSample_B.vrm',
                'AvatarSample_B.vrm',
                'vrm/models/AvatarSample-B',
                { cacheDir: sharedCacheDir, parentDir: stageUIAssetsRoot },
              ),
            ),
          ]
        : []),
    ],

    resolve: {
      alias: [
        {
          find: '@proj-airi/server-sdk',
          replacement: resolve(join(import.meta.dirname, '..', '..', 'packages', 'server-sdk', 'src')),
        },
        {
          find: '@proj-airi/i18n',
          replacement: resolve(join(import.meta.dirname, '..', '..', 'packages', 'i18n', 'src')),
        },
        {
          find: '@proj-airi/stage-ui',
          replacement: resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-ui', 'src')),
        },
        {
          find: '@proj-airi/stage-ui-three',
          replacement: resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-ui-three', 'src')),
        },
        {
          find: '@proj-airi/stage-pages',
          replacement: resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-pages', 'src')),
        },
        {
          find: '@proj-airi/stage-shared',
          replacement: resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-shared', 'src')),
        },
        {
          find: '@proj-airi/electron-vueuse',
          replacement: resolve(join(import.meta.dirname, '..', '..', 'packages', 'electron-vueuse', 'src')),
        },
        {
          find: '@proj-airi/stage-layouts',
          replacement: resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-layouts', 'src')),
        },
        {
          find: 'node:crypto',
          replacement: resolve(join(import.meta.dirname, 'src', 'renderer', 'shims', 'node-crypto.ts')),
        },
        {
          find: 'crypto',
          replacement: resolve(join(import.meta.dirname, 'src', 'renderer', 'shims', 'node-crypto.ts')),
        },
        { find: 'tslib', replacement: require.resolve('tslib/tslib.es6.js') },
        {
          find: 'three/addons',
          replacement: resolve(join(import.meta.dirname, 'node_modules', 'three', 'examples', 'jsm')),
        },
        { find: 'three', replacement: resolve(join(import.meta.dirname, 'node_modules', 'three')) },
      ],
      conditions: ['browser', 'import', 'default'],
    },

    server: {
      fs: {
        strict: true,
      },
      // Prefer a dedicated renderer dev port override so unrelated services
      // like the AIRI channel server do not accidentally inherit it.
      port: Number.parseInt(process.env.AIRI_RENDERER_PORT || process.env.PORT || '5173'),
      strictPort: true,
      warmup: {
        clientFiles: [
          `${resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-ui', 'src'))}/*.vue`,
          `${resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-pages', 'src'))}/*.vue`,
        ],
      },
    },
    ssr: {
      noExternal: ['tslib', 'uncrypto', '@noble/hashes'],
    },

    worker: {
      format: 'es',
      rollupOptions: {
        output: {
          inlineDynamicImports: false,
        },
      },
    },
  },
})
