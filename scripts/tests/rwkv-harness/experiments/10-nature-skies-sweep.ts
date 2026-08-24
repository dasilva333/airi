/**
 * Phase 10: 20-Scene Nature, Florals & Skies Sweep (RWKV-7 1.5B with S0 State Cartridge).
 *
 * Evaluates the model specifically on its highest-affinity organic domains:
 * blooming florals, sunset/sunrise atmospheres, water washes, and gentle landscapes.
 */

import fs from 'node:fs'
import path from 'node:path'

import { CANVAS_SIZE, P5_BRUSH_API_REFERENCE } from '../engine/canvas-prompts.js'
import { CanvasRenderer } from '../engine/canvas-renderer.js'
import { RwkvWebGpuBridge } from '../engine/rwkv-session.js'
import { repairTruncatedProgram } from '../engine/sketch-extract.js'
import { ensureModelCached, PHASE7_MODEL_URL_1_5B } from '../engine/state-merger.js'

export const NATURE_SWEEP_SCENES = [
  // --- FLORALS & BOTANICALS ---
  { id: '01-peach-rose', category: 'floral', title: 'Blooming Peach Rose', prompt: 'soft blooming peach rose with layered translucent blush petals and dew drops' },
  { id: '02-purple-wisteria', category: 'floral', title: 'Cascading Purple Wisteria', prompt: 'cascading purple wisteria blossoms hanging gracefully with gentle watercolor wash' },
  { id: '03-lavender-field', category: 'floral', title: 'Endless Lavender Field', prompt: 'endless field of purple lavender flowers under warm golden twilight' },
  { id: '04-red-poppy-meadow', category: 'floral', title: 'Red Poppies in Summer Meadow', prompt: 'vibrant red poppies scattered across lush green summer meadow' },
  { id: '05-sunny-white-daisies', category: 'floral', title: 'Sunny White Daisies', prompt: 'field of sunny white daisies with bright golden centers on washi paper' },
  { id: '06-sakura-petal-shower', category: 'floral', title: 'Sakura Blossom Petal Shower', prompt: 'drifting pink cherry blossom petals blowing gently in spring breeze' },
  { id: '07-morning-water-lily', category: 'floral', title: 'Morning Water Lily on Pond', prompt: 'serene pink water lily floating on emerald pond with soft water ripples' },
  { id: '08-blue-hydrangea-cluster', category: 'floral', title: 'Lush Blue Hydrangea Cluster', prompt: 'lush cluster of soft sky-blue and violet hydrangea flower petals' },

  // --- SKIES & ATMOSPHERES ---
  { id: '09-golden-sunset-clouds', category: 'sky', title: 'Golden Hour Sunset Clouds', prompt: 'dramatic golden hour sunset with glowing orange and amber watercolor clouds' },
  { id: '10-pastel-sunrise-sky', category: 'sky', title: 'Pastel Morning Dawn Sky', prompt: 'soft pastel dawn sky with blended pink and peach watercolor clouds' },
  { id: '11-twilight-purple-dusk', category: 'sky', title: 'Twilight Purple Dusk Sky', prompt: 'deep violet and indigo twilight sky over quiet horizon with soft stars' },
  { id: '12-storm-sunbeams', category: 'sky', title: 'Storm Clouds with Golden Rays', prompt: 'dark dramatic storm clouds broken by radiant golden sunbeams' },
  { id: '13-aurora-curtain-night', category: 'sky', title: 'Emerald Aurora in Night Sky', prompt: 'flowing emerald green and violet aurora curtains glowing over dark polar sky' },
  { id: '14-crescent-moon-clouds', category: 'sky', title: 'Crescent Moon in Soft Clouds', prompt: 'delicate golden crescent moon resting among soft evening watercolor clouds' },

  // --- WATERS & LANDSCAPES ---
  { id: '15-emerald-mountain-lake', category: 'landscape', title: 'Emerald Alpine Mountain Lake', prompt: 'calm emerald green alpine lake reflecting misty pine mountain ridges' },
  { id: '16-rolling-green-hills', category: 'landscape', title: 'Sunlit Rolling Green Hills', prompt: 'soft sunlit rolling green hills under gentle blue watercolor sky' },
  { id: '17-forest-meadow-stream', category: 'landscape', title: 'Clear Stream in Wildflower Meadow', prompt: 'clear mountain stream winding peacefully through a wildflower meadow' },
  { id: '18-misty-pine-valley', category: 'landscape', title: 'Misty Pine Tree Valley', prompt: 'dense white morning mist filling a quiet pine tree valley at dawn' },
  { id: '19-golden-autumn-canopy', category: 'landscape', title: 'Golden Autumn Tree Canopy', prompt: 'golden yellow and warm amber autumn tree leaves with soft sunlight' },
  { id: '20-calm-turquoise-sea', category: 'landscape', title: 'Calm Turquoise Sea and Sand', prompt: 'calm turquoise ocean watercolor waves gently meeting soft golden sand shore' },
]

export const SCAFFOLD_HEADER = `function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(42);
  background(250, 246, 238);
`

function buildNaturePrompt(promptText: string): string {
  return `You are an expert generative artist. Complete the following p5.js sketch using p5.brush to paint "${promptText}" as an expressive watercolor artwork.
RULES:
1. Paint shapes immediately using coordinates centered at (0,0) spanning -300..300.
2. Use watercolor washes: brush.fill(r,g,b,opacity), brush.bleed(0.1..0.5, "out"), brush.rect, brush.circle, brush.line, brush.beginShape...vertex...endShape(CLOSE).
3. Do NOT declare setup() or draw(). You are already inside function setup().
4. Output ONLY JavaScript statements that paint the scene. Close the function with } at the end.

${P5_BRUSH_API_REFERENCE}

Task: paint "${promptText}".
\`\`\`js
${SCAFFOLD_HEADER}`
}

async function main() {
  console.log('=== RWKV Cleanroom Harness: 20-Scene Nature & Skies Sweep ===\n')

  const modelPath = await ensureModelCached(PHASE7_MODEL_URL_1_5B)
  const sweepDir = path.resolve(process.cwd(), 'reports/nature-skies-sweep')
  fs.mkdirSync(sweepDir, { recursive: true })

  const bridge = new RwkvWebGpuBridge({ modelFilePath: modelPath })

  try {
    await bridge.boot(m => console.log(`[engine] ${m}`))
    console.log(`✓ Engine booted: state_len=${bridge.info.stateLen}\n`)

    // Load verified dataset and condition S0 cartridge
    const corpusPath = path.resolve(process.cwd(), 'dataset/p5-watercolor-corpus.json')
    const corpusData = JSON.parse(fs.readFileSync(corpusPath, 'utf8'))
    const conditioningTexts = corpusData.map((d: any) => `Artwork "${d.title}":\n\`\`\`js\n${d.code}\n\`\`\`\n`)

    const STATE_NAME = 'p5-watercolor-s0'
    const ts0 = Date.now()
    const stateInfo = await bridge.makeState({ name: STATE_NAME, texts: conditioningTexts })
    console.log(`✓ Ingested S0 state cartridge "${STATE_NAME}" (${stateInfo.fedTokens} tokens in ${((Date.now() - ts0) / 1000).toFixed(1)}s)\n`)

    const renderer = new CanvasRenderer(await bridge.newPage())
    await renderer.open(bridge.baseUrl)
    console.log('✓ CanvasRenderer tab ready\n')

    const sweepEntries: Array<Record<string, unknown>> = []

    for (let i = 0; i < NATURE_SWEEP_SCENES.length; i++) {
      const sc = NATURE_SWEEP_SCENES[i]
      console.log(`\n======================================================`)
      console.log(`[${i + 1}/${NATURE_SWEEP_SCENES.length}] Painting: "${sc.title}" (${sc.id}) [${sc.category}]`)
      console.log(`======================================================`)

      const sceneDir = path.join(sweepDir, sc.id)
      fs.mkdirSync(sceneDir, { recursive: true })

      const prompt = buildNaturePrompt(sc.prompt)
      const t0 = Date.now()

      console.log(`  Generating sketch code with S0 state "${STATE_NAME}" (temp=0.75, maxTokens=1200)...`)
      const genResult = await bridge.generateCode({
        prompt,
        maxTokens: 1200,
        temperature: 0.75,
        topP: 0.9,
        presencePenalty: 0.2,
        countPenalty: 0.2,
        stateName: STATE_NAME,
        stopSeqs: ['\n```\n', '```\n', '\n```'],
      })
      const genMs = Date.now() - t0
      console.log(`  ✓ Generated ${genResult.completionTokens} tok in ${(genMs / 1000).toFixed(1)}s (${(genResult.completionTokens / (genMs / 1000)).toFixed(1)} tok/s)`)
      fs.writeFileSync(path.join(sceneDir, 'raw-output.txt'), genResult.raw)

      // Assemble full sketch
      let rawCode = genResult.raw.replace(/```[\w-]*/g, '').replace(/```/g, '').trim()
      if (rawCode.includes('function setup()')) {
        const idx = rawCode.indexOf('function setup()')
        const openBrace = rawCode.indexOf('{', idx)
        if (openBrace >= 0)
          rawCode = rawCode.slice(openBrace + 1)
      }

      const assembledCode = `${SCAFFOLD_HEADER}\n${rawCode}`
      const repairedSketch = repairTruncatedProgram(assembledCode) || assembledCode
      fs.writeFileSync(path.join(sceneDir, 'sketch.js'), repairedSketch)

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

      const previewRelPath = `${sc.id}/render.png`
      if (outcome.dataUrl) {
        const pngPath = path.join(sceneDir, 'render.png')
        renderer.savePng(pngPath, outcome.dataUrl)
        console.log(`  ✓ Rendered: ok=${outcome.ok}, blank=${outcome.blank}, ink=${(outcome.inkCoverage * 100).toFixed(1)}%, colors=${outcome.uniqueColors}, structure=${outcome.structureScore?.toFixed(3) ?? 'N/A'}`)
        console.log(`  → Saved PNG: ${pngPath}`)
      }
      else {
        console.log(`  ✗ Canvas blank or failed: ${outcome.error || outcome.sketchError}`)
      }

      sweepEntries.push({
        id: sc.id,
        category: sc.category,
        title: sc.title,
        prompt: sc.prompt,
        tokens: genResult.completionTokens,
        genMs,
        inkCoverage: outcome.inkCoverage ?? 0,
        uniqueColors: outcome.uniqueColors ?? 0,
        structureScore: outcome.structureScore ?? 0,
        ok: outcome.ok,
        blank: outcome.blank,
        previewRelPath,
      })
    }

    // Export GALLERY.md
    let md = `# RWKV-7 1.5B Nature, Florals & Skies Gallery (20-Scene Sweep)\n\n`
    md += `Generated autonomously via the WebGPU cleanroom render harness on ${new Date().toISOString()}.\n\n`
    md += `| # | Category | Title & Prompt | Ink Coverage | Colors | Status | Preview |\n`
    md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`

    for (let i = 0; i < sweepEntries.length; i++) {
      const e = sweepEntries[i] as any
      const ink = `${(e.inkCoverage * 100).toFixed(1)}%`
      const status = e.ok && !e.blank ? '✓ Rendered' : '✗ Blank/Error'
      md += `| **${i + 1}** | \`${e.category}\` | **${e.title}**<br>_${e.prompt}_ | ${ink} | ${e.uniqueColors} | ${status} | ![](${e.previewRelPath}) |\n`
    }

    const mdPath = path.join(sweepDir, 'GALLERY.md')
    fs.writeFileSync(mdPath, md)
    console.log(`\n✓ Exported Gallery Markdown: ${mdPath}`)

    const reportPath = path.join(sweepDir, 'sweep-report.json')
    fs.writeFileSync(reportPath, JSON.stringify({ meta: { sweepDir, total: sweepEntries.length }, sweep: sweepEntries }, null, 2))
    console.log(`✓ Exported Sweep JSON Report: ${reportPath}`)

    console.log('\n======================================================')
    console.log(`✓ 20-Scene Nature & Skies Sweep Complete!`)
    console.log('======================================================\n')
  }
  finally {
    await bridge.dispose()
  }
}

main().catch((err) => {
  console.error('Fatal error in nature sweep generator:', err)
  process.exit(1)
})
