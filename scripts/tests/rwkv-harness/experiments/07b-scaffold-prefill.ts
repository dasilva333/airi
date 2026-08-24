/**
 * Phase 7b: Scaffold-Prefill Experiment for Creative Code Canvas (RWKV-7 1.5B).
 *
 * Hypothesis: Bypassing the setup() boilerplate by prefilling the canvas initialization
 * forces the raw 1.5B model to jump directly into painting shapes, strokes, and washes,
 * preventing the "over-configuration loop" failure mode seen in round-2.
 */

import fs from 'node:fs'
import path from 'node:path'

import { CANVAS_SIZE, P5_BRUSH_API_REFERENCE } from '../engine/canvas-prompts.js'
import { CanvasRenderer } from '../engine/canvas-renderer.js'
import { RwkvWebGpuBridge } from '../engine/rwkv-session.js'
import { repairTruncatedProgram } from '../engine/sketch-extract.js'
import { ensureModelCached, PHASE7_MODEL_URL_1_5B } from '../engine/state-merger.js'

export const SCAFFOLD_SETUP_HEADER = `function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(11);
  background(250, 246, 238);
`

export function buildScaffoldCompletionPrefix(scene: string): string {
  return `You are an expert generative artist. Complete the following p5.js sketch using p5.brush to paint "${scene}" as a beautiful watercolor artwork.
RULES:
1. Paint shapes immediately using coordinates centered at (0,0) spanning -300..300.
2. Use watercolor washes: brush.fill(r,g,b,opacity), brush.bleed(0.1..0.5, "out"), brush.rect, brush.circle, brush.line, brush.beginShape...vertex...endShape(CLOSE).
3. Do NOT declare setup() or draw(). You are already inside function setup().
4. Output ONLY JavaScript statements that paint the scene. Close the function with } at the end.

${P5_BRUSH_API_REFERENCE}

Task: paint "${scene}".
\`\`\`js
${SCAFFOLD_SETUP_HEADER}`
}

async function main() {
  console.log('=== RWKV Cleanroom Harness: Phase 7b Scaffold-Prefill Experiment ===\n')

  const modelPath = await ensureModelCached(PHASE7_MODEL_URL_1_5B)
  console.log(`✓ Model ready: ${modelPath}\n`)

  const scenes = [
    { id: 'peach-hibiscus', prompt: 'peach hibiscus with soft petals' },
    { id: 'rainy-alley', prompt: 'moody rainy city alley at twilight with glowing lanterns' },
    { id: 'misty-forest', prompt: 'misty pine mountain forest with soft morning sun' },
  ]

  const bridge = new RwkvWebGpuBridge({ modelFilePath: modelPath })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const runDir = path.resolve(process.cwd(), `reports/07b-scaffold-prefill-${stamp}`)
  fs.mkdirSync(runDir, { recursive: true })

  try {
    await bridge.boot(m => console.log(`[engine] ${m}`))
    console.log(`✓ Engine booted: state_len=${bridge.info.stateLen}\n`)

    const renderer = new CanvasRenderer(await bridge.newPage())
    await renderer.open(bridge.baseUrl)
    console.log('✓ Renderer tab ready\n')

    const results: Array<Record<string, unknown>> = []

    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i]
      console.log(`\n======================================================`)
      console.log(`[Scene ${i + 1}/${scenes.length}] "${sc.prompt}" (id: ${sc.id})`)
      console.log(`======================================================`)

      const sceneDir = path.join(runDir, `${String(i + 1).padStart(2, '0')}-${sc.id}`)
      fs.mkdirSync(sceneDir, { recursive: true })

      const prompt = buildScaffoldCompletionPrefix(sc.prompt)
      const tg0 = Date.now()

      console.log('  Generating code with scaffold prefill (temp=0.75, maxTokens=1200)...')
      const genResult = await bridge.generateCode({
        prompt,
        maxTokens: 1200,
        temperature: 0.75,
        topP: 0.9,
        presencePenalty: 0.2,
        countPenalty: 0.2,
        stopSeqs: ['\n```\n', '```\n', '\n```', '```'],
      })
      const genMs = Date.now() - tg0
      console.log(`  ✓ Generated ${genResult.completionTokens} tok in ${(genMs / 1000).toFixed(1)}s (${(genResult.completionTokens / (genMs / 1000)).toFixed(1)} tok/s)`)
      fs.writeFileSync(path.join(sceneDir, 'raw-output.txt'), genResult.raw)

      // Reassemble the complete runnable sketch
      let rawCode = genResult.raw.replace(/```[\w-]*/g, '').replace(/```/g, '').trim()

      // If the model repeated the setup header, strip duplicate
      if (rawCode.includes('function setup()')) {
        const idx = rawCode.indexOf('function setup()')
        const openBrace = rawCode.indexOf('{', idx)
        if (openBrace >= 0) {
          rawCode = rawCode.slice(openBrace + 1)
        }
      }

      const assembledCode = `${SCAFFOLD_SETUP_HEADER}\n${rawCode}`
      const repairedSketch = repairTruncatedProgram(assembledCode) || assembledCode

      fs.writeFileSync(path.join(sceneDir, 'sketch.js'), repairedSketch)
      console.log(`  ✓ Assembled sketch (${repairedSketch.length} chars)`)

      // Render sketch in canvas harness
      console.log('  Rendering on WebGL canvas...')
      let outcome
      try {
        outcome = await renderer.render({
          code: repairedSketch,
          size: CANVAS_SIZE,
          settleMs: 2500,
          timeoutMs: 30000,
        })
      }
      catch (err) {
        console.error(`  ✗ Render error: ${String(err).slice(0, 200)}`)
        outcome = { ok: false, blank: true, error: String(err), inkCoverage: 0, uniqueColors: 0 }
      }

      fs.writeFileSync(path.join(sceneDir, 'outcome.json'), JSON.stringify(outcome, null, 2))

      if (outcome.dataUrl) {
        const pngPath = path.join(sceneDir, 'render.png')
        renderer.savePng(pngPath, outcome.dataUrl)
        console.log(`  ✓ Render output: ok=${outcome.ok}, blank=${outcome.blank}, ink=${(outcome.inkCoverage * 100).toFixed(1)}%, colors=${outcome.uniqueColors}, structureScore=${outcome.structureScore?.toFixed(3) ?? 'N/A'}`)
        console.log(`  → Saved PNG: ${pngPath}`)
      }
      else {
        console.log(`  ✗ Canvas rendered blank or errored: ${outcome.error || outcome.sketchError}`)
      }

      results.push({
        scene: sc,
        genTokens: genResult.completionTokens,
        genMs,
        outcome: {
          ok: outcome.ok,
          blank: outcome.blank,
          inkCoverage: outcome.inkCoverage,
          uniqueColors: outcome.uniqueColors,
          error: outcome.error || outcome.sketchError,
        },
      })
    }

    const reportPath = path.join(runDir, 'summary-report.json')
    fs.writeFileSync(reportPath, JSON.stringify({ meta: { runDir, stamp }, results }, null, 2))
    console.log(`\n======================================================`)
    console.log(`✓ Phase 7b Scaffold-Prefill Experiment Complete!`)
    console.log(`  Report: ${reportPath}`)
    console.log(`======================================================\n`)
  }
  finally {
    await bridge.dispose()
  }
}

main().catch((err) => {
  console.error('Fatal error in 07b-scaffold-prefill:', err)
  process.exit(1)
})
