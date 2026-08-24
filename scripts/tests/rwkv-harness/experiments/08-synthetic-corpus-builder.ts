/**
 * Phase 8: Synthetic Dataset Collector & Verifier for p5.brush Watercolor Corpus.
 *
 * Runs all seed sketches and thematic variations through the headless/headed CanvasRenderer,
 * scores their ink coverage, color diversity, and structure, and exports a verified
 * training corpus (JSON + JSONL) ready for RWKV S0 State-Tuning / SFT.
 */

import fs from 'node:fs'
import path from 'node:path'

import puppeteer from 'puppeteer-core'

import { generateSeedCorpus } from '../dataset/sketch-generator.js'
import { CANVAS_SIZE } from '../engine/canvas-prompts.js'
import { CanvasRenderer } from '../engine/canvas-renderer.js'
import { startStaticServer } from '../engine/server.js'

const BRAVE_PATH = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'

export interface VerifiedCorpusEntry {
  id: string
  title: string
  theme: string
  prompt: string
  code: string
  verified: boolean
  metrics: {
    inkCoverage: number
    uniqueColors: number
    structureScore: number
    renderMs: number
  }
  previewPng: string
}

async function main() {
  console.log('=== RWKV Cleanroom Harness: Synthetic Dataset Builder (Phase 8) ===\n')

  const datasetDir = path.resolve(process.cwd(), 'dataset')
  const previewDir = path.join(datasetDir, 'previews')
  fs.mkdirSync(previewDir, { recursive: true })

  // 1. Generate seed corpus
  const seeds = generateSeedCorpus()
  console.log(`✓ Loaded ${seeds.length} base seed sketches across 4 themes\n`)

  // 2. Start static server and Brave renderer
  const server = await startStaticServer(path.resolve(process.cwd(), 'webroot'), {})
  const browser = await puppeteer.launch({
    executablePath: process.env.RWKV_HARNESS_BROWSER?.trim() || BRAVE_PATH,
    headless: false,
    args: ['--no-sandbox'],
  })

  const renderer = new CanvasRenderer(await browser.newPage())
  await renderer.open(server.baseUrl)
  console.log('✓ CanvasRenderer ready in browser\n')

  const verifiedEntries: VerifiedCorpusEntry[] = []

  try {
    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i]
      console.log(`[${i + 1}/${seeds.length}] Verifying: "${seed.title}" (${seed.id})...`)

      const t0 = Date.now()
      let outcome
      try {
        outcome = await renderer.render({
          code: seed.code,
          size: CANVAS_SIZE,
          settleMs: 2500,
          timeoutMs: 30000,
        })
      }
      catch (err) {
        console.error(`  ✗ Error: ${String(err)}`)
        outcome = { ok: false, blank: true, error: String(err), inkCoverage: 0, uniqueColors: 0 }
      }
      const renderMs = Date.now() - t0

      if (outcome.ok && !outcome.blank && outcome.dataUrl) {
        const previewPath = path.join(previewDir, `${seed.id}.png`)
        renderer.savePng(previewPath, outcome.dataUrl)

        const inkPct = (outcome.inkCoverage * 100).toFixed(1)
        console.log(`  ✓ VERIFIED! ink=${inkPct}%, colors=${outcome.uniqueColors}, structure=${outcome.structureScore?.toFixed(3) ?? 'N/A'} (${renderMs}ms)`)
        console.log(`  → Saved preview: ${previewPath}`)

        verifiedEntries.push({
          id: seed.id,
          title: seed.title,
          theme: seed.theme,
          prompt: seed.prompt,
          code: seed.code,
          verified: true,
          metrics: {
            inkCoverage: outcome.inkCoverage,
            uniqueColors: outcome.uniqueColors,
            structureScore: outcome.structureScore ?? 0,
            renderMs,
          },
          previewPng: `dataset/previews/${seed.id}.png`,
        })
      }
      else {
        console.warn(`  ✗ Rejected: blank=${outcome.blank}, error=${outcome.error ?? outcome.sketchError}`)
      }
    }

    // 3. Export verified corpus files
    const jsonPath = path.join(datasetDir, 'p5-watercolor-corpus.json')
    fs.writeFileSync(jsonPath, JSON.stringify(verifiedEntries, null, 2))
    console.log(`\n✓ Exported JSON dataset: ${jsonPath} (${verifiedEntries.length} verified entries)`)

    // Export JSONL for direct SFT / State-Tuning training
    const jsonlPath = path.join(datasetDir, 'p5-watercolor-corpus.jsonl')
    const jsonlLines = verifiedEntries.map(e =>
      JSON.stringify({
        messages: [
          { role: 'system', content: 'You are an expert generative artist specializing in p5.brush watercolor painting.' },
          { role: 'user', content: `Paint "${e.prompt}" as an expressive watercolor artwork using p5.js and p5.brush.` },
          { role: 'assistant', content: `\`\`\`js\n${e.code}\n\`\`\`` },
        ],
        metadata: {
          id: e.id,
          theme: e.theme,
          inkCoverage: e.metrics.inkCoverage,
          uniqueColors: e.metrics.uniqueColors,
        },
      }),
    ).join('\n')

    fs.writeFileSync(jsonlPath, jsonlLines)
    console.log(`✓ Exported JSONL training file: ${jsonlPath}`)

    console.log('\n======================================================')
    console.log(`✓ Dataset collection complete: ${verifiedEntries.length}/${seeds.length} sketches passed 100% verification gate!`)
    console.log('======================================================\n')
  }
  finally {
    await browser.close()
    await server.close()
  }
}

main().catch((err) => {
  console.error('Fatal error in dataset builder:', err)
  process.exit(1)
})
