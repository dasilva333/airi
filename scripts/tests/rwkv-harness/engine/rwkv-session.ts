/**
 * Cleanroom RWKV engine — honest Node→Brave WebGPU bridge.
 *
 * This class does NOT run inference in Node. Node has no WebGPU (`navigator.gpu`
 * is undefined in this build), and web-rwkv's wasm is WebGPU-only with no CPU
 * fallback. Real inference runs inside headed Brave (headless is denied a GPU by
 * macOS Gatekeeper), driving the production-mirroring `/runner.js` page over the
 * Puppeteer CDP bridge.
 *
 * Only small strings cross the bridge (prompt in, generated JSON out). The 364
 * MB model is fetched by the page over the local HTTP server (`server.ts`),
 * never serialized through CDP — passing it as base64 blows the CDP message cap.
 *
 * Runner used: `/index.html?engine=1` → `runner.js` (persistent warm session).
 */

import type { Browser, Page } from 'puppeteer-core'

import type { ServedDir } from './server.js'

import path from 'node:path'

import puppeteer from 'puppeteer-core'

import { startStaticServer } from './server.js'

export interface RwkvGenerationOptions {
  prompt: string
  /** Optional System: turn prepended before the User turn. */
  system?: string
  maxTokens?: number
  temperature?: number
  topP?: number
  presencePenalty?: number
  countPenalty?: number
  penaltyDecay?: number
  /** Default true: RWKV-7 G1 `Assistant: <think></think` prefill. */
  g1Prefill?: boolean
  /**
   * Phase 4 grammar constraint: mask the value emitted after `"<key>": "` to one of
   * `values` (each may tokenize to multiple token ids — handled via a string-prefix DFA).
   * Passed through to the browser runner; sampling is still free elsewhere.
   */
  constrainEnum?: { key: string, values: string[] }
}

export interface ConstrainEnumSpec {
  key: string
  values: string[]
}

export interface RwkvGenerationResult {
  text: string
  raw: string
  promptTokens: number
  completionTokens: number
  stopped: boolean
}

export interface EngineBootInfo {
  numTensors: number
  numEmb: number
  numVocab: number
  stateLen: number
}

const BRAVE_PATH = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'

export class RwkvWebGpuBridge {
  private browser: Browser | null = null
  private page: Page | null = null
  private server: ServedDir | null = null
  private bootInfo: EngineBootInfo | null = null

  constructor(private opts: { modelFilePath: string, bravePath?: string, webroot?: string }) {}

  get info(): EngineBootInfo {
    if (!this.bootInfo)
      throw new Error('engine not booted')
    return this.bootInfo
  }

  private resolveChromeExecutable(): string {
    const env = process.env.RWKV_HARNESS_BROWSER
    return (env && env.trim()) || this.opts.bravePath || BRAVE_PATH
  }

  async boot(onProgress?: (msg: string) => void): Promise<EngineBootInfo> {
    if (this.bootInfo)
      return this.bootInfo
    const log = onProgress ?? (() => {})
    const webroot = this.opts.webroot ?? path.resolve(process.cwd(), 'webroot')
    const modelFile = path.resolve(this.opts.modelFilePath)

    this.server = await startStaticServer(webroot, { 'model.safetensors': modelFile })
    log(`serving webroot + model at ${this.server.baseUrl}`)

    this.browser = await puppeteer.launch({
      executablePath: this.resolveChromeExecutable(),
      headless: false, // headed: macOS denies headless Chrome a WebGPU adapter
      args: [
        '--enable-unsafe-webgpu',
        '--use-angle=metal',
        '--no-sandbox',
        '--enable-features=Vulkan,WebGPU',
        '--disable-gpu-sandbox',
        '--window-position=1000,80',
      ],
    })
    this.page = await this.browser.newPage()
    this.page.on('pageerror', e => console.error('[bridge:pageerror]', String(e).slice(0, 300)))

    await this.page.goto(`${this.server.baseUrl}/index.html?engine=1`)

    // Poll for boot completion (model download + wasm init + session build).
    const deadline = Date.now() + 10 * 60 * 1000
    for (;;) {
      const res = await this.page.evaluate(() => (window as any).__RWkvBootResult || null).catch(() => null)
      if (res) {
        if (!res.ok)
          throw new Error(`runner boot failed: ${res.error}`)
        this.bootInfo = res as EngineBootInfo
        log(`session ready: ${res.numTensors} tensors, emb=${res.numEmb}, vocab=${res.numVocab}, state_len=${res.stateLen}`)
        return this.bootInfo
      }
      if (Date.now() > deadline)
        throw new Error('runner boot timed out')
      await new Promise(r => setTimeout(r, 1500))
    }
  }

  private async callRunner(fn: '__rwkvGenerate' | '__rwkvGenerateRaw', opts: object): Promise<RwkvGenerationResult> {
    if (!this.page || !this.bootInfo)
      throw new Error('call boot() before generate()')
    // Pass small args via a global to avoid a giant CDP-serialized arg list.
    await this.page.evaluate((o) => { (window as any).__RWkvNextGen = o }, opts)
    const result = await this.page.evaluate(async (fnName) => {
      const g = (window as any)[fnName]
      if (!g)
        throw new Error(`runner not ready: ${fnName} missing`)
      return await g((window as any).__RWkvNextGen)
    }, fn)
    return result as RwkvGenerationResult
  }

  async generate(opts: RwkvGenerationOptions): Promise<RwkvGenerationResult> {
    return this.callRunner('__rwkvGenerate', opts)
  }

  /** Lever A: completion-mode continuation (prompt already ends with the scaffold). */
  async generateRaw(opts: RwkvGenerationOptions): Promise<RwkvGenerationResult> {
    return this.callRunner('__rwkvGenerateRaw', opts)
  }

  async dispose(): Promise<void> {
    try {
      await this.browser?.close()
    }
    catch { /* best effort */ }
    try {
      await this.server?.close()
    }
    catch { /* best effort */ }
    this.browser = null
    this.page = null
    this.server = null
  }
}
