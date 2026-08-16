/// <reference types="./vite.config-env.d.ts" />

import type { PluginOption } from 'vite'

import process from 'node:process'

import { execSync } from 'node:child_process'
import { join, resolve } from 'node:path'

import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Info from 'unplugin-info/vite'
import VueRouter from 'unplugin-vue-router/vite'
import Yaml from 'unplugin-yaml/vite'
import mkcert from 'vite-plugin-mkcert'
import VueDevTools from 'vite-plugin-vue-devtools'
import Layouts from 'vite-plugin-vue-layouts'
import VueMacros from 'vue-macros/vite'

import { Download } from '@proj-airi/unplugin-fetch/vite'
import { DownloadLive2DSDK } from '@proj-airi/unplugin-live2d-sdk/vite'
import { defineConfig } from 'vite'

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

function isEnvTruthy(value: string | undefined | null): boolean {
  if (value == null)
    return false
  return /^(?:1|true|t|yes|y|on)$/i.test(value.trim())
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
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Cloudflare Authorization</title>
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    text-align: center;
                    padding: 40px 20px;
                    background: #0f172a;
                    color: #f8fafc;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 80vh;
                  }
                  .card {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    padding: 32px 24px;
                    max-width: 400px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                  }
                  .btn {
                    display: inline-block;
                    margin-top: 20px;
                    padding: 12px 28px;
                    background: #0284c7;
                    color: white;
                    text-decoration: none;
                    font-weight: 600;
                    border-radius: 8px;
                    cursor: pointer;
                    border: none;
                    font-size: 1rem;
                  }
                  .countdown {
                    color: #38bdf8;
                    font-weight: bold;
                    font-size: 1.1rem;
                  }
                </style>
              </head>
              <body>
                <div class="card">
                  <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎉</div>
                  <h2 style="margin: 0 0 8px 0; color: #38bdf8;">Authorization Successful</h2>
                  <p style="color: #94a3b8; margin: 0 0 16px 0;">Returning to AIRI...</p>
                  <p style="font-size: 0.9rem; color: #cbd5e1;">Window will close automatically in <span class="countdown" id="timer">5</span>s</p>
                  <button class="btn" id="closeBtn" onclick="closeOrReturn()">Return to AIRI</button>
                </div>
                <script>
                  const code = ${JSON.stringify(code)};
                  const state = ${JSON.stringify(state)};

                  // Broadcast credentials to app
                  try {
                    if (window.opener) {
                      window.opener.postMessage({ type: 'CLOUDFLARE_OAUTH_CODE', code, state }, '*');
                      window.opener.postMessage({ type: 'CLOUDFLARE_AUTH_CALLBACK', code, state }, '*');
                    }
                    if (typeof BroadcastChannel !== 'undefined') {
                      new BroadcastChannel('airi_cf_oauth_channel').postMessage({ type: 'CLOUDFLARE_OAUTH_CODE', code, state });
                    }
                    localStorage.setItem('airi_cf_oauth_callback', JSON.stringify({ code, state, timestamp: Date.now() }));
                  } catch (e) {}

                  function closeOrReturn() {
                    try { window.close(); } catch (e) {}
                    if (window.history.length > 1) {
                      window.history.back();
                    } else {
                      window.location.href = '/';
                    }
                  }

                  let remaining = 5;
                  const timerEl = document.getElementById('timer');
                  const interval = setInterval(() => {
                    remaining--;
                    if (timerEl) timerEl.textContent = remaining;
                    if (remaining <= 0) {
                      clearInterval(interval);
                      closeOrReturn();
                    }
                  }, 1000);
                </script>
              </body>
              </html>
            `)
          }
          else {
            res.writeHead(404)
            res.end()
          }
        })
        server.listen(8976, '127.0.0.1', () => {
          console.info('[Pocket Vite] Cloudflare OAuth local bridge active on http://localhost:8976/oauth/callback')
        })
      }).catch((err) => {
        console.warn('[Pocket Vite] Could not start OAuth callback bridge on port 8976:', err.message)
      })
    },
    buildEnd() {
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
    exclude: [
      // Internal Packages
      '@proj-airi/stage-ui/*',
      '@proj-airi/drizzle-duckdb-wasm',
      '@proj-airi/drizzle-duckdb-wasm/*',
      'uncrypto',

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
      '@proj-airi/i18n': resolve(join(import.meta.dirname, '..', '..', 'packages', 'i18n', 'src')),
      '@proj-airi/stage-ui': resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-ui', 'src')),
      '@proj-airi/stage-layouts': resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-layouts', 'src')),
      '@proj-airi/stage-pages': resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-pages', 'src')),
      '@proj-airi/stage-shared': resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-shared', 'src')),
    },
  },
  server: {
    fs: {
      strict: false,
    },
    host: '0.0.0.0',
    port: 5273,
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
        `${resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-layouts', 'src'))}/*.vue`,
      ],
    },
  },
  build: {
    target: 'esnext',
    sourcemap: false,
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
    cloudflareOAuthBridgePlugin(),
    ...isEnvTruthy(process.env.VITE_USE_MKCERT ?? '') ? [mkcert((() => {
      // Workaround: plugin's bundled downloader has a feaxios bug, prefer system mkcert
      const command = process.platform === 'win32' ? 'where' : 'which'
      try {
        const out = execSync(`${command} mkcert`, { stdio: 'pipe' }).toString().trim().split(/\r?\n/)[0]
        execSync(`"${out}" -CAROOT`, { stdio: 'pipe' })
        return { mkcertPath: out }
      }
      catch { return {} }
    })())] : [],

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

    // https://github.com/antfu/unocss
    // see uno.config.ts for config
    Unocss(),

    // https://github.com/intlify/bundle-tools/tree/main/packages/unplugin-vue-i18n
    VueI18n({
      runtimeOnly: true,
      compositionOnly: true,
      fullInstall: true,
    }),

    // https://github.com/webfansplz/vite-plugin-vue-devtools
    VueDevTools(),

    ...(!process.env.SKIP_DOWNLOADS
      ? [
          resilient(DownloadLive2DSDK()),
          resilient(Download('https://dist.ayaka.moe/live2d-models/hiyori_free_zh.zip', 'hiyori_free_zh.zip', 'live2d/models', { parentDir: stageUIAssetsRoot, cacheDir: sharedCacheDir })),
          resilient(Download('https://dist.ayaka.moe/live2d-models/hiyori_pro_zh.zip', 'hiyori_pro_zh.zip', 'live2d/models', { parentDir: stageUIAssetsRoot, cacheDir: sharedCacheDir })),
          resilient(Download('https://dist.ayaka.moe/vrm-models/VRoid-Hub/AvatarSample-A/AvatarSample_A.vrm', 'AvatarSample_A.vrm', 'vrm/models/AvatarSample-A', { parentDir: stageUIAssetsRoot, cacheDir: sharedCacheDir })),
          resilient(Download('https://dist.ayaka.moe/vrm-models/VRoid-Hub/AvatarSample-B/AvatarSample_B.vrm', 'AvatarSample_B.vrm', 'vrm/models/AvatarSample-B', { parentDir: stageUIAssetsRoot, cacheDir: sharedCacheDir })),
        ]
      : []),

    ...isEnvTruthy(process.env.VITE_CAP_SYNC_IOS_AFTER_BUILD ?? '')
      ? [{
          name: 'proj-airi:capacitor-sync',
          closeBundle: {
            sequential: true,
            handler() {
              if (this.meta.watchMode) {
                execSync('cap sync ios', { stdio: 'inherit' })
              }
            },
          },
        } as PluginOption]
      : [],

    {
      name: 'proj-airi:defines',
      config(ctx) {
        const define: Record<string, any> = {
          'import.meta.env.RUNTIME_ENVIRONMENT': '\'capacitor\'',
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
  ],
})
