import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import Vue from '@vitejs/plugin-vue'
import UnoCss from 'unocss/vite'
import Info from 'unplugin-info/vite'
import VueRouter from 'unplugin-vue-router/vite'
import Yaml from 'unplugin-yaml/vite'
import Layouts from 'vite-plugin-vue-layouts'
import VueMacros from 'vue-macros/vite'

import { Download } from '@proj-airi/unplugin-fetch'
import { DownloadLive2DSDK } from '@proj-airi/unplugin-live2d-sdk'
import { defineConfig } from 'electron-vite'

/**
 * Helper to retry an async function multiple times with optional backoff.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn()
  }
  catch (error) {
    if (retries <= 0)
      throw error
    console.warn(`[Retry] Action failed, retrying in ${delay}ms... (${retries} retries left)`)
    await new Promise(resolve => setTimeout(resolve, delay))
    return withRetry(fn, retries - 1, delay * 2)
  }
}

/**
 * Wraps a Vite plugin's configResolved hook to make it resilient to failures.
 * If the hook fails (e.g. download error), it will retry and ultimately let the build proceed.
 */
function resilient(plugin: any) {
  const originalHook = plugin.configResolved
  if (!originalHook)
    return plugin

  plugin.configResolved = async (config: any) => {
    try {
      await withRetry(() => originalHook.call(plugin, config), 3, 2000)
    }
    catch (error: any) {
      console.error(`[ResilientPlugin] ${plugin.name} failed after all retries:`, error.message)
      console.warn(`[ResilientPlugin] Proceeding without ${plugin.name} assets.`)
    }
  }
  return plugin
}

const stageUIAssetsRoot = resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-ui', 'src', 'assets'))
const sharedCacheDir = resolve(join(import.meta.dirname, '..', '..', '.cache'))
const require = createRequire(import.meta.url)

export default defineConfig({
  main: {
    build: {
      // NOTICE: Any package added to 'include' below MUST be listed in 'dependencies'
      // (not 'devDependencies') in package.json to be available in production builds.
      externalizeDeps: {
        include: ['electron'],
        exclude: [
          '@proj-airi/electron-screen-capture',
          '@proj-airi/electron-eventa',
          '@proj-airi/electron-vueuse',
          '@proj-airi/plugin-sdk',
        ],
      },
      rollupOptions: {
        external: ['electron'],
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
        '@proj-airi/i18n-bundle': resolve(join(import.meta.dirname, '..', '..', 'packages', 'i18n', 'src', 'dist-lite', 'messages.mjs')),
        '@proj-airi/server-runtime': resolve(join(import.meta.dirname, '..', '..', 'packages', 'server-runtime', 'src')),
      },
    },
  },

  preload: {
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: '[name]-[hash].cjs',
        },
      },
      lib: {
        entry: {
          index: resolve(join(import.meta.dirname, 'src', 'preload', 'index.ts')),
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
      target: 'esnext',
      rollupOptions: {
        input: {
          'main': resolve(join(import.meta.dirname, 'src', 'renderer', 'index.html')),
          'beat-sync': resolve(join(import.meta.dirname, 'src', 'renderer', 'beat-sync.html')),
        },
      },
    },

    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext',
      },
      include: [
        'tslib',
        '@vueuse/motion',
        'popmotion',
        'uncrypto',
        'three',
      ],
      exclude: [
        // Internal Packages
        '@proj-airi/stage-ui',
        '@proj-airi/stage-ui/*',
        '@proj-airi/stage-ui-three',
        '@proj-airi/stage-ui-three/*',
        '@proj-airi/drizzle-duckdb-wasm',
        '@proj-airi/drizzle-duckdb-wasm/*',
        '@proj-airi/electron-screen-capture',

        // wasm-bindgen package: esbuild's dep pre-bundle mangles the wasm glue
        // (Firefox: NS_ERROR_CORRUPTED_CONTENT on the optimized module), which
        // kills the web-rwkv worker before it registers its load handler. Serve
        // the original ESM so the `?url` wasm asset resolves correctly.
        '@cryscan/web-rwkv-wasm',

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
    },

    resolve: {
      conditions: ['browser', 'import', 'default'],
      alias: [
        { find: '@proj-airi/server-sdk', replacement: resolve(join(import.meta.dirname, '..', '..', 'packages', 'server-sdk', 'src')) },
        // Headless DSL runtime ships TS source only (no build step); alias to source for dev HMR.
        { find: '@proj-airi/live2d-runtime', replacement: resolve(join(import.meta.dirname, '..', '..', 'packages', 'live2d-runtime', 'src')) },
        { find: '@proj-airi/i18n', replacement: resolve(join(import.meta.dirname, '..', '..', 'packages', 'i18n', 'src')) },
        { find: '@proj-airi/stage-ui', replacement: resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-ui', 'src')) },
        { find: '@proj-airi/stage-ui-three', replacement: resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-ui-three', 'src')) },
        { find: '@proj-airi/stage-pages', replacement: resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-pages', 'src')) },
        { find: '@proj-airi/stage-shared', replacement: resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-shared', 'src')) },
        { find: '@proj-airi/electron-vueuse', replacement: resolve(join(import.meta.dirname, '..', '..', 'packages', 'electron-vueuse', 'src')) },
        { find: '@proj-airi/stage-layouts', replacement: resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-layouts', 'src')) },
        { find: 'node:crypto', replacement: resolve(join(import.meta.dirname, 'src', 'renderer', 'shims', 'node-crypto.ts')) },
        { find: 'crypto', replacement: resolve(join(import.meta.dirname, 'src', 'renderer', 'shims', 'node-crypto.ts')) },
        { find: 'tslib', replacement: require.resolve('tslib/tslib.es6.js') },
        { find: 'three/addons', replacement: resolve(join(import.meta.dirname, 'node_modules', 'three', 'examples', 'jsm')) },
        { find: 'three', replacement: resolve(join(import.meta.dirname, 'node_modules', 'three')) },
      ],
    },
    ssr: {
      noExternal: ['tslib', 'uncrypto', '@noble/hashes'],
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

    worker: {
      format: 'es',
      rollupOptions: {
        output: {
          inlineDynamicImports: false,
        },
      },
    },

    plugins: [
      {
        name: 'force-node-crypto-shim',
        enforce: 'pre',
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
        load(id) {
          if (id === '\0virtual:node-shim') {
            return `
              export default {};
              export const readFileSync = () => '';
              export const writeFileSync = () => {};
              export const existsSync = () => false;
              export const statSync = () => ({ isDirectory: () => false, isFile: () => false });
              export const promises = { readFile: async () => '', writeFile: async () => {} };
              export const join = (...args) => args.filter(Boolean).join('/');
              export const resolve = (...args) => args.filter(Boolean).join('/');
              export const dirname = (p) => (p ? p.split('/').slice(0, -1).join('/') : '');
              export const basename = (p) => (p ? p.split('/').pop() : '');
              export const extname = (p) => (p && p.includes('.') ? '.' + p.split('.').pop() : '');
            `
          }
          return null
        },
      },
      Info(),

      {
        name: 'proj-airi:defines',
        config(ctx) {
          const define: Record<string, any> = {
            'import.meta.env.RUNTIME_ENVIRONMENT': '\'electron\'',
          }
          if (ctx.mode === 'development') {
            define['import.meta.env.URL_MODE'] = '\'server\''
          }
          if (ctx.mode === 'production') {
            define['import.meta.env.URL_MODE'] = '\'file\''
          }

          return { define }
        },
      },

      // Inspect(),

      Yaml(),

      VueMacros({
        plugins: {
          vue: Vue({
            include: [/\.vue$/, /\.md$/],
            template: {
              compilerOptions: {
                isCustomElement: (tag: string) => tag.startsWith('Tres') && tag !== 'TresCanvas',
              },
            },
          }),
          vueJsx: false,
        },
        betterDefine: false,
      }),

      VueRouter({
        dts: resolve(import.meta.dirname, 'src/renderer/typed-router.d.ts'),
        routesFolder: [
          {
            src: resolve(import.meta.dirname, '..', '..', 'packages', 'stage-pages', 'src', 'pages'),
            exclude: base => [
              ...base,
              '**/settings/connection/index.vue',
              '**/settings/system/general.vue',
              '**/settings/modules/mcp.vue',
              '**/settings/system/connection.vue',
            ],
          },
          resolve(import.meta.dirname, 'src', 'renderer', 'pages'),
        ],
        exclude: ['**/components/**'],
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
        runtimeOnly: true,
        compositionOnly: true,
        fullInstall: true,
      }),

      ...(!process.env.SKIP_DOWNLOADS
        ? [
            resilient(DownloadLive2DSDK()),
            resilient(Download('https://dist.ayaka.moe/live2d-models/hiyori_free_zh.zip', 'hiyori_free_zh.zip', 'live2d/models', { parentDir: stageUIAssetsRoot, cacheDir: sharedCacheDir })),
            resilient(Download('https://dist.ayaka.moe/live2d-models/hiyori_pro_zh.zip', 'hiyori_pro_zh.zip', 'live2d/models', { parentDir: stageUIAssetsRoot, cacheDir: sharedCacheDir })),
            resilient(Download('https://dist.ayaka.moe/vrm-models/VRoid-Hub/AvatarSample-A/AvatarSample_A.vrm', 'AvatarSample_A.vrm', 'vrm/models/AvatarSample-A', { parentDir: stageUIAssetsRoot, cacheDir: sharedCacheDir })),
            resilient(Download('https://dist.ayaka.moe/vrm-models/VRoid-Hub/AvatarSample-B/AvatarSample_B.vrm', 'AvatarSample_B.vrm', 'vrm/models/AvatarSample-B', { parentDir: stageUIAssetsRoot, cacheDir: sharedCacheDir })),
          ]
        : []),
    ],
  },
})
