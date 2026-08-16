import { join, resolve } from 'node:path'
import { cwd, env } from 'node:process'

import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Info from 'unplugin-info/vite'
import VueRouter from 'unplugin-vue-router/vite'
import Yaml from 'unplugin-yaml/vite'
import Layouts from 'vite-plugin-vue-layouts'
import VueMacros from 'vue-macros/vite'

import { Download } from '@proj-airi/unplugin-fetch/vite'
import { DownloadLive2DSDK } from '@proj-airi/unplugin-live2d-sdk/vite'
import { createS3Provider, WarpDrivePlugin } from '@proj-airi/vite-plugin-warpdrive'
import { LFS, SpaceCard } from 'hfup/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

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

/**
 * Spawns a local loopback callback server on port 8976 during Vite dev
 * so that Cloudflare OAuth PKCE redirects succeed and message the web client.
 */
function cloudflareOAuthBridgePlugin() {
  let server: any = null
  return {
    name: 'vite-plugin-cloudflare-oauth-bridge',
    configureServer() {
      import('node:http').then(({ createServer }) => {
        if (server)
          return
        server = createServer((req, res) => {
          const url = new URL(req.url || '/', 'http://localhost:8976')
          if (url.pathname === '/oauth/callback') {
            const code = url.searchParams.get('code')
            const state = url.searchParams.get('state')
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(`
              <!DOCTYPE html>
              <html>
              <head><title>Cloudflare Authorization</title></head>
              <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #0f172a; color: #f8fafc;">
                <h2>✓ Authorization Successful</h2>
                <p>Returning to AIRI...</p>
                <script>
                  if (window.opener) {
                    window.opener.postMessage({ type: 'CLOUDFLARE_OAUTH_CODE', code: ${JSON.stringify(code)}, state: ${JSON.stringify(state)} }, '*');
                    setTimeout(() => window.close(), 300);
                  } else {
                    document.body.innerHTML += '<p>You may now close this window.</p>';
                  }
                </script>
              </body>
              </html>
            `)
          }
          else {
            res.writeHead(404)
            res.end('Not Found')
          }
        })
        server.on('error', (err: any) => {
          if (err.code !== 'EADDRINUSE') {
            console.warn('[CloudflareOAuthBridge] Server error:', err.message)
          }
        })
        server.listen(8976, '127.0.0.1', () => {
          console.info('✓ Cloudflare OAuth Bridge listening on http://localhost:8976/oauth/callback')
        })
      })
    },
    closeBundle() {
      if (server) {
        server.close()
        server = null
      }
    },
  }
}

const stageUIAssetsRoot = resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-ui', 'src', 'assets'))
const sharedCacheDir = resolve(join(import.meta.dirname, '..', '..', '.cache'))

export default defineConfig({
  optimizeDeps: {
    esbuildOptions: { target: 'esnext' },
    include: [
      'uncrypto',
    ],
    exclude: [
      // Internal Packages
      '@proj-airi/stage-ui/*',
      '@proj-airi/drizzle-duckdb-wasm',
      '@proj-airi/drizzle-duckdb-wasm/*',

      // wasm-bindgen package: esbuild's dep pre-bundle mangles the wasm glue
      // (Firefox: NS_ERROR_CORRUPTED_CONTENT on the optimized module), which
      // kills the web-rwkv worker before it registers its load handler. Serve
      // the original ESM so the `?url` wasm asset resolves correctly.
      '@cryscan/web-rwkv-wasm',

      // Static Assets: Models, Images, etc.
      'public/assets/*',

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
    alias: {
      '@proj-airi/server-sdk': resolve(join(import.meta.dirname, '..', '..', 'packages', 'server-sdk', 'src')),
      // Headless DSL runtime ships TS source only (no build step); alias to source for dev HMR.
      '@proj-airi/live2d-runtime': resolve(join(import.meta.dirname, '..', '..', 'packages', 'live2d-runtime', 'src')),
      '@proj-airi/i18n': resolve(join(import.meta.dirname, '..', '..', 'packages', 'i18n', 'src')),
      '@proj-airi/stage-ui': resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-ui', 'src')),
      '@proj-airi/stage-pages': resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-pages', 'src')),
      '@proj-airi/stage-shared': resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-shared', 'src')),
      '@proj-airi/stage-layouts': resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-layouts', 'src')),
      '@proj-airi/electron-vueuse': resolve(join(import.meta.dirname, '..', '..', 'packages', 'electron-vueuse', 'src')),
    },
  },
  server: {
    fs: {
      strict: false,
    },
    proxy: {
      '/api/cf-oauth-token': {
        target: 'https://dash.cloudflare.com',
        changeOrigin: true,
        rewrite: () => '/oauth2/token',
      },
      '/api/cloudflare': {
        target: 'https://api.cloudflare.com/client/v4',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/cloudflare/, ''),
      },
      '/cors-proxy': {
        target: 'https://airi-cors-proxy.r1ch4rd.workers.dev',
        changeOrigin: true,
      },
    },
    warmup: {
      clientFiles: [
        `${resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-ui', 'src'))}/*.vue`,
        `${resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-pages', 'src'))}/*.vue`,
      ],
    },
  },
  build: {
    target: 'esnext',
    sourcemap: process.env.SOURCE_MAP === 'true',
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
    Info(),

    Yaml(),

    VueMacros({
      plugins: {
        vue: Vue({
          include: [/\.vue$/, /\.md$/],
        }),
        vueJsx: false,
      },
      betterDefine: false,
    }),

    // https://github.com/posva/unplugin-vue-router
    VueRouter({
      extensions: ['.vue', '.md'],
      dts: resolve(import.meta.dirname, 'src/typed-router.d.ts'),
      importMode: 'async',
      routesFolder: [
        resolve(import.meta.dirname, 'src', 'pages'),
        resolve(import.meta.dirname, '..', '..', 'packages', 'stage-pages', 'src', 'pages'),
      ],
      exclude: ['**/components/**'],
    }),

    // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
    Layouts({
      layoutsDirs: [
        resolve(import.meta.dirname, 'src', 'layouts'),
        resolve(import.meta.dirname, '..', '..', 'packages', 'stage-layouts', 'src', 'layouts'),
      ],
    }),

    cloudflareOAuthBridgePlugin(),

    // https://github.com/antfu/unocss
    // see uno.config.ts for config
    Unocss(),

    // https://github.com/antfu/vite-plugin-pwa
    ...(env.TARGET_HUGGINGFACE_SPACE
      ? []
      : [VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
          manifest: {
            name: 'AIRI',
            short_name: 'AIRI',
            icons: [
              {
                src: '/web-app-manifest-192x192.png',
                sizes: '192x192',
                type: 'image/png',
              },
              {
                src: '/web-app-manifest-512x512.png',
                sizes: '512x512',
                type: 'image/png',
              },
              {
                purpose: 'maskable',
                sizes: '192x192',
                src: '/maskable_icon_x192.png',
                type: 'image/png',
              },
              {
                purpose: 'maskable',
                sizes: '512x512',
                src: '/maskable_icon_x512.png',
                type: 'image/png',
              },
            ],
          },
          workbox: {
            maximumFileSizeToCacheInBytes: 64 * 1024 * 1024,
            navigateFallbackDenylist: [
              /^\/docs\//,
              /^\/ui\//,
              /^\/remote-assets\//,
              /^\/api\//,
            ],
          },
        })]),

    // https://github.com/intlify/bundle-tools/tree/main/packages/unplugin-vue-i18n
    VueI18n({
      runtimeOnly: true,
      compositionOnly: true,
      fullInstall: true,
    }),

    // https://github.com/webfansplz/vite-plugin-vue-devtools
    // VueDevTools(),

    ...(!process.env.SKIP_DOWNLOADS
      ? [
          resilient(DownloadLive2DSDK()),
          resilient(Download('https://dist.ayaka.moe/live2d-models/hiyori_free_zh.zip', 'hiyori_free_zh.zip', 'live2d/models', { parentDir: stageUIAssetsRoot, cacheDir: sharedCacheDir })),
          resilient(Download('https://dist.ayaka.moe/live2d-models/hiyori_pro_zh.zip', 'hiyori_pro_zh.zip', 'live2d/models', { parentDir: stageUIAssetsRoot, cacheDir: sharedCacheDir })),
          resilient(Download('https://dist.ayaka.moe/vrm-models/VRoid-Hub/AvatarSample-A/AvatarSample_A.vrm', 'AvatarSample_A.vrm', 'vrm/models/AvatarSample-A', { parentDir: stageUIAssetsRoot, cacheDir: sharedCacheDir })),
          resilient(Download('https://dist.ayaka.moe/vrm-models/VRoid-Hub/AvatarSample-B/AvatarSample_B.vrm', 'AvatarSample_B.vrm', 'vrm/models/AvatarSample-B', { parentDir: stageUIAssetsRoot, cacheDir: sharedCacheDir })),
        ]
      : []),

    // HuggingFace Spaces
    LFS({ root: cwd(), extraGlobs: [
      // Scene & Models
      '*.vrm',
      '*.vrma',
      '*.hdr',
      '*.cmo3',
      // Images & Fonts
      '*.png',
      '*.jpg',
      '*.jpeg',
      '*.gif',
      '*.webp',
      '*.bmp',
      '*.ttf',
      '*.avif',
      // Tensorflow / MediaPipe task
      '*.task',
    ] }),
    SpaceCard({
      root: cwd(),
      title: 'AIRI: Virtual Companion',
      emoji: '🧸',
      colorFrom: 'pink',
      colorTo: 'pink',
      sdk: 'static',
      pinned: false,
      license: 'mit',
      models: [
        'onnx-community/whisper-base',
        'onnx-community/silero-vad',
      ],
      short_description: 'AI driven VTuber & Companion, supports Live2D and VRM.',
    }),

    // For the following example assets:
    //
    // dist/assets/ort-wasm-simd-threaded.jsep-B0T3yYHD.wasm                21,596.01 kB │ gzip: 5,121.95 kB
    // dist/assets/XiaolaiSC-Regular-SNWuh554.ttf                           22,183.94 kB
    // dist/assets/cjkFonts_allseto_v1.11-ByBdljxl.ttf                      31,337.14 kB
    // dist/assets/duckdb-coi-CSr8FQO4.wasm                                 32,320.49 kB │ gzip: 7,194.65 kB
    // dist/assets/duckdb-eh-BJOC5S4x.wasm                                  32,604.02 kB │ gzip: 7,133.37 kB
    // dist/assets/duckdb-mvp-8HYqhb4i.wasm                                 37,345.64 kB │ gzip: 8,099.69 kB
    //
    // they are too large to be able to put into deployments like Cloudflare Workers or Pages,
    // we need to upload them to external storage and use renderBuiltUrl to rewrite their URLs.
    ...((!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)
      ? []
      : [
          WarpDrivePlugin({
            prefix: env.STAGE_WEB_WARP_DRIVE_PREFIX || 'proj-airi/stage-web/main/',
            include: [/\.wasm$/i, /\.ttf$/i, /\.vrm$/i, /\.zip$/i], // in existing assets, wasm, ttf, vrm files are the largest ones
            manifest: true,
            clean: false,
            contentTypeBy: (filename: string) => {
              if (filename.endsWith('.wasm')) {
                return 'application/wasm'
              }
              if (filename.endsWith('.ttf')) {
                return 'font/ttf'
              }
              if (filename.endsWith('.vrm')) {
                return 'application/octet-stream'
              }
              if (filename.endsWith('.zip')) {
                return 'application/zip'
              }
            },
            provider: createS3Provider({
              endpoint: env.S3_ENDPOINT,
              accessKeyId: env.S3_ACCESS_KEY_ID,
              secretAccessKey: env.S3_SECRET_ACCESS_KEY,
              region: env.S3_REGION,
              publicBaseUrl: env.WARP_DRIVE_PUBLIC_BASE ?? env.S3_ENDPOINT,
            }),
          }),
        ]),
  ],
})
