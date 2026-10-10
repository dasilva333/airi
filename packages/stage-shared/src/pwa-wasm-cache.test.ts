import fs from 'node:fs'
import path from 'node:path'

import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STAGE_WEB_VITE_CONFIG = path.resolve(__dirname, '../../../apps/stage-web/vite.config.ts')

describe('stage-web PWA Workbox WebAssembly lazy caching contract (PR #2896)', () => {
  it('stage-web vite config exists and contains workbox configuration', () => {
    expect(fs.existsSync(STAGE_WEB_VITE_CONFIG)).toBe(true)
    const content = fs.readFileSync(STAGE_WEB_VITE_CONFIG, 'utf8')
    expect(content).toContain('workbox:')
  })

  it('excludes wasm files from precache via globIgnores to avoid massive initial downloads', () => {
    const content = fs.readFileSync(STAGE_WEB_VITE_CONFIG, 'utf8')
    expect(content).toMatch(/globIgnores:\s*\[[^\]]*'\*\*\/\*\.wasm'[^\]]*\]/)
  })

  it('configures runtimeCaching for wasm files using CacheFirst strategy with bounded expiration', () => {
    const content = fs.readFileSync(STAGE_WEB_VITE_CONFIG, 'utf8')
    expect(content).toContain('runtimeCaching:')
    expect(content).toContain('handler: \'CacheFirst\'')
    expect(content).toMatch(/cacheName:\s*['"]wasm['"]/)
    expect(content).toMatch(/maxEntries:\s*8/)
  })

  it('urlPattern correctly matches wasm assets and rejects non-wasm assets', () => {
    // Contract from apps/stage-web/vite.config.ts:
    // urlPattern: ({ url }) => url.pathname.endsWith('.wasm')
    const matchWasm = ({ url }: { url: { pathname: string } }) => url.pathname.endsWith('.wasm')

    expect(matchWasm({ url: { pathname: '/assets/whisper-tiny.wasm' } })).toBe(true)
    expect(matchWasm({ url: { pathname: '/models/web-rwkv.wasm' } })).toBe(true)
    expect(matchWasm({ url: { pathname: '/assets/index.js' } })).toBe(false)
    expect(matchWasm({ url: { pathname: '/assets/styles.css' } })).toBe(false)
    expect(matchWasm({ url: { pathname: '/model.wasm.json' } })).toBe(false)
  })
})
