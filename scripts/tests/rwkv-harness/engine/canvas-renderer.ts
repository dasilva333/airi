/**
 * Phase 7 canvas renderer driver (Node side).
 *
 * Drives `webroot/render.html` (second tab of the same headed Brave as the
 * inference page) over CDP. The generated sketch executes sandboxed per-iframe
 * in the page; only the base64 PNG + scalar stats cross the bridge.
 */

import type { Page } from 'puppeteer-core'

import fs from 'node:fs'

export interface RenderSpec {
  code: string
  size?: number
  /** Target frameCount for looping sketches. */
  frames?: number
  /** Quiet-time (ms) that marks a noLoop() painting as settled. */
  settleMs?: number
  /** Hard cap (ms) for the whole render run. */
  timeoutMs?: number
}

export interface RenderOutcome {
  ok: boolean
  blank: boolean
  error: string | null
  sketchError: string | null
  framesRendered: number
  inkCoverage: number
  /** 1 - modal-bucket frequency: 0 = perfectly uniform canvas, high = diverse. */
  structureScore: number
  uniqueColors: number
  captureStrategy: string
  brushLoaded: boolean
  ms: number
  dataUrl: string | null
}

export class CanvasRenderer {
  constructor(private page: Page) {}

  async open(baseUrl: string): Promise<void> {
    await this.page.goto(`${baseUrl}/render.html`, { waitUntil: 'load' })
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      const ready = await this.page.evaluate(() => (window as any).__renderReady === true).catch(() => false)
      if (ready) {
        // Warm the execution context so a brand-new tab's session-restore
        // teardown can't race the first real evaluate (observed 2026-08-24).
        await this.page.evaluate(() => true).catch(() => {})
        return
      }
      await new Promise(r => setTimeout(r, 250))
    }
    throw new Error('render page failed to become ready')
  }

  async render(spec: RenderSpec): Promise<RenderOutcome> {
    await this.page.evaluate((s) => { (window as any).__RWkvNextRender = s }, spec)
    const timeoutMs = (spec.timeoutMs ?? 30_000) + 10_000
    const result = await Promise.race([
      this.page.evaluate(async () => {
        const g = (window as any).__renderSketch
        if (!g)
          throw new Error('render page not ready: __renderSketch missing')
        return await g((window as any).__RWkvNextRender)
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`render driver timed out after ${timeoutMs}ms`)), timeoutMs)
      }),
    ])
    return result as RenderOutcome
  }

  /** Decode a data: URL PNG and write it to disk. */
  savePng(outPath: string, dataUrl: string): void {
    const b64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    fs.writeFileSync(outPath, Buffer.from(b64, 'base64'))
  }
}
