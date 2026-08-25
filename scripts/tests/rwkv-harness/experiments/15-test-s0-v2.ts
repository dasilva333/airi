/**
 * Phase 15: Evaluate RWKV-7 with Retrained S0 State Cartridge V2 in WebGPU.
 *
 * Ingests the verified Corpus V2 into the recurrent state (S0),
 * and generates on-device watercolor paintings for test benchmark prompts.
 */

import fs from 'node:fs'
import path from 'node:path'

import { CANVAS_SIZE, P5_BRUSH_API_REFERENCE } from '../engine/canvas-prompts.js'
import { CanvasRenderer } from '../engine/canvas-renderer.js'
import { RwkvWebGpuBridge } from '../engine/rwkv-session.js'
import { repairTruncatedProgram } from '../engine/sketch-extract.js'
import { ensureModelCached, PHASE7_MODEL_URL_1_5B } from '../engine/state-merger.js'

export const EVAL_PROMPTS = [
  { id: '01-simple-pink-flower', title: 'Simple Pink Flower', prompt: 'a single simple flower with soft pink petals, warm yellow center, thin vertical stem, and one small green leaf' },
  { id: '02-golden-sunflower', title: 'Golden Sunflower', prompt: 'cheerful bright yellow sunflower with a rich brown seed center and tall green stem' },
  { id: '03-crimson-poppy', title: 'Crimson Poppy', prompt: 'vibrant red poppy flower with delicate crimson petals and slender green stem' },
  { id: '04-peach-rose', title: 'Peach Rose', prompt: 'single blooming peach rose with soft blush petals and two green leaves' },
  { id: '05-autumn-tree', title: 'Solitary Autumn Tree', prompt: 'solitary maple tree with golden orange canopy and slender brown trunk' },
]

export const SCAFFOLD_HEADER = `function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(42);
  background(250, 246, 238);
`

function buildEvalPrompt(promptText: string): string {
  return `You are an expert generative artist. Complete the following p5.js sketch using p5.brush to paint "${promptText}" as an expressive watercolor artwork.
RULES:
1. Paint shapes immediately using coordinates centered at (0,0) spanning -300..300.
2. Use watercolor washes: brush.fill(r,g,b,opacity), brush.bleed(0.1..0.4, "out"), brush.rect, brush.circle, brush.line, brush.beginShape...vertex...endShape("close").
3. Do NOT declare setup() or draw(). You are already inside function setup().
4. Output ONLY JavaScript statements that paint the scene. Close the function with } at the end.

${P5_BRUSH_API_REFERENCE}

Task: paint "${promptText}".
\`\`\`js
${SCAFFOLD_HEADER}`
}

async function main() {
  console.log('=== Phase 15: Evaluating RWKV-7 S0 State Cartridge V2 in WebGPU ===\n')

  const modelPath = await ensureModelCached(PHASE7_MODEL_URL_1_5B)
  const evalDir = path.resolve(process.cwd(), 'reports/s0-v2-eval')
  fs.mkdirSync(evalDir, { recursive: true })

  const bridge = new RwkvWebGpuBridge({ modelFilePath: modelPath })

  try {
    await bridge.boot(m => console.log(`[engine] ${m}`))
    console.log(`✓ WebGPU Engine booted: state_len=${bridge.info.stateLen}\n`)

    // Load verified Corpus V2 and condition S0 cartridge
    const corpusPath = path.resolve(process.cwd(), 'datasets/p5-watercolor-corpus-v2.jsonl')
    const lines = fs.readFileSync(corpusPath, 'utf8').trim().split('\n').filter(Boolean)
    const conditioningTexts = lines.map((l) => {
      const d = JSON.parse(l)
      return `Artwork "${d.subject}":\n\`\`\`js\n${d.code}\n\`\`\`\n`
    })

    const STATE_NAME = 'p5-watercolor-s0-v2'
    const ts0 = Date.now()
    const stateInfo = await bridge.makeState({ name: STATE_NAME, texts: conditioningTexts })
    console.log(`✓ Ingested S0 state cartridge "${STATE_NAME}" (${stateInfo.fedTokens} tokens in ${((Date.now() - ts0) / 1000).toFixed(1)}s)\n`)

    const renderer = new CanvasRenderer(await bridge.newPage())
    await renderer.open(bridge.baseUrl)
    console.log('✓ CanvasRenderer tab ready\n')

    const evalEntries: Array<Record<string, unknown>> = []

    for (let i = 0; i < EVAL_PROMPTS.length; i++) {
      const sc = EVAL_PROMPTS[i]
      console.log(`\n======================================================`)
      console.log(`[${i + 1}/${EVAL_PROMPTS.length}] Painting: "${sc.title}" (${sc.id})`)
      console.log(`======================================================`)

      const prompt = buildEvalPrompt(sc.prompt)
      const t0 = Date.now()

      console.log(`  Generating sketch code with S0 state "${STATE_NAME}"...`)
      const genResult = await bridge.generateCode({
        prompt,
        maxTokens: 800,
        temperature: 0.7,
        topP: 0.85,
        presencePenalty: 0.3,
        countPenalty: 0.3,
        stateName: STATE_NAME,
        stopSeqs: ['\n```\n', '```\n', '\n```'],
      })
      const genMs = Date.now() - t0
      console.log(`  ✓ Generated ${genResult.completionTokens} tok in ${(genMs / 1000).toFixed(1)}s (${(genResult.completionTokens / (genMs / 1000)).toFixed(1)} tok/s)`)

      // Clean & balance sketch
      let rawCode = genResult.raw.replace(/```[\w-]*/g, '').replace(/```/g, '').trim()
      if (rawCode.includes('function setup()')) {
        const idx = rawCode.indexOf('function setup()')
        const brace = rawCode.indexOf('{', idx)
        if (brace >= 0)
          rawCode = rawCode.slice(brace + 1)
      }

      const fullCode = `${SCAFFOLD_HEADER}\n${rawCode}`
      const repaired = repairTruncatedProgram(fullCode) || fullCode

      // Render on WebGL canvas
      console.log('  Rendering on WebGL canvas...')
      let outcome
      try {
        outcome = await renderer.render({
          code: repaired,
          size: CANVAS_SIZE,
          settleMs: 2500,
          timeoutMs: 30000,
        })
      }
      catch (err: any) {
        console.log(`  ✗ Render error: ${err.message}`)
        continue
      }

      if (outcome.dataUrl && !outcome.blank) {
        const outPng = path.join(evalDir, `${sc.id}.png`)
        renderer.savePng(outPng, outcome.dataUrl)
        console.log(`  ✓ SUCCESS -> Saved ${outPng} (ink: ${((outcome.inkCoverage || 0) * 100).toFixed(1)}%, colors: ${outcome.uniqueColors}, structure: ${outcome.structureScore?.toFixed(3) ?? 'N/A'})`)
      }
      else {
        console.log(`  ✗ Blank canvas or error: ${outcome.error || outcome.sketchError}`)
      }

      evalEntries.push({
        id: sc.id,
        title: sc.title,
        prompt: sc.prompt,
        genTimeMs: genMs,
        completionTokens: genResult.completionTokens,
        inkCoverage: outcome.inkCoverage ?? 0,
        uniqueColors: outcome.uniqueColors ?? 0,
        structureScore: outcome.structureScore ?? 0,
        ok: outcome.ok,
        blank: outcome.blank,
      })
    }

    const summaryPath = path.join(evalDir, 'eval-summary.json')
    fs.writeFileSync(summaryPath, JSON.stringify({ entries: evalEntries }, null, 2))
    console.log(`\n======================================================`)
    console.log(`✓ S0 Cartridge V2 Evaluation Complete!`)
    console.log(`✓ Results saved to: ${evalDir}`)
    console.log(`======================================================\n`)
  }
  finally {
    await bridge.dispose()
  }
}

main().catch(console.error)
