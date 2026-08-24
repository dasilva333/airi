/**
 * Phase 7 offline re-render tool: re-extract + re-render saved raw outputs from
 * a previous smoke run WITHOUT any model generation. Useful when the extractor
 * or render harness improves after raw outputs already exist on disk.
 *
 * Usage: pnpm exec tsx reprocess-07-renders.ts [runDir]
 *        (defaults to the newest reports/07-creative-code-canvas-* directory)
 *
 * Writes per attempt: reextract-sketch.js, reextract.png, reextract-outcome.json.
 */
import fs from 'node:fs'
import path from 'node:path'

import puppeteer from 'puppeteer-core'

import { CANVAS_SIZE } from './engine/canvas-prompts.js'
import { CanvasRenderer } from './engine/canvas-renderer.js'
import { startStaticServer } from './engine/server.js'
import { extractSketch } from './engine/sketch-extract.js'

const BRAVE_PATH = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'

const reportsRoot = path.resolve(process.cwd(), 'reports')
const arg = process.argv[2]
const runDir = arg
  ? path.resolve(arg)
  : fs.readdirSync(reportsRoot)
    .filter(d => d.startsWith('07-creative-code-canvas-'))
    .sort()
    .map(d => path.join(reportsRoot, d))
    .pop() ?? ''
if (!runDir || !fs.existsSync(runDir)) {
  console.error(`run dir not found: ${runDir || '(none)'}`)
  process.exit(1)
}
console.log(`Reprocessing run dir: ${runDir}\n`)

const attempts = fs.readdirSync(runDir)
  .filter(d => d.startsWith('attempt-') && fs.existsSync(path.join(runDir, d, 'raw.txt')))
  .sort()

const server = await startStaticServer(path.resolve(process.cwd(), 'webroot'), {})
const browser = await puppeteer.launch({
  executablePath: process.env.RWKV_HARNESS_BROWSER?.trim() || BRAVE_PATH,
  headless: false,
  args: ['--no-sandbox'],
})
const renderer = new CanvasRenderer(await browser.newPage())
await renderer.open(server.baseUrl)

const summary: Array<Record<string, unknown>> = []
for (const name of attempts) {
  const dir = path.join(runDir, name)
  const raw = fs.readFileSync(path.join(dir, 'raw.txt'), 'utf8')
  const sketch = extractSketch(raw)
  if (!sketch) {
    console.log(`${name}: no extractable sketch`)
    summary.push({ attempt: name, extracted: false })
    continue
  }
  fs.writeFileSync(path.join(dir, 'reextract-sketch.js'), sketch)
  // Retry once: the brand-new tab can get torn down by Brave session-restore
  // navigation right after launch; recover by re-navigating the render page.
  let outcome
  try {
    outcome = await renderer.render({ code: sketch, size: CANVAS_SIZE, timeoutMs: 45_000 })
  }
  catch (err) {
    console.log(`${name}: first render failed (${String(err).slice(0, 120)}); re-opening render page and retrying`)
    await renderer.open(server.baseUrl)
    outcome = await renderer.render({ code: sketch, size: CANVAS_SIZE, timeoutMs: 45_000 })
  }
  fs.writeFileSync(path.join(dir, 'reextract-outcome.json'), JSON.stringify({ ...outcome, dataUrl: outcome.dataUrl ? `<png ${outcome.dataUrl.length} chars>` : null }, null, 2))
  if (outcome.dataUrl)
    renderer.savePng(path.join(dir, 'reextract.png'), outcome.dataUrl)
  console.log(`${name}: extracted ${sketch.length} chars -> ok=${outcome.ok} blank=${outcome.blank} ink=${(outcome.inkCoverage * 100).toFixed(1)}% colors=${outcome.uniqueColors} frames=${outcome.framesRendered} err=${outcome.error ?? outcome.sketchError ?? 'none'}`)
  summary.push({ attempt: name, extracted: true, sketchChars: sketch.length, ok: outcome.ok, blank: outcome.blank, inkCoverage: outcome.inkCoverage, uniqueColors: outcome.uniqueColors, framesRendered: outcome.framesRendered, error: outcome.error, sketchError: outcome.sketchError })
}

fs.writeFileSync(path.join(runDir, 'reprocess-summary.json'), JSON.stringify({ generatedAt: new Date().toISOString(), tool: 'reprocess-07-renders', attempts: summary }, null, 2))
await browser.close()
await server.close()
console.log(`\n✓ summary: ${path.join(runDir, 'reprocess-summary.json')}`)
