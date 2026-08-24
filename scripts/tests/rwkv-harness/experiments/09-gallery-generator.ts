/**
 * Phase 9: 10-Scene Artwork Gallery Generator (RWKV-7 1.5B with S0 State Cartridge).
 *
 * Ingests the verified watercolor corpus into the recurrent hidden state (S0),
 * then generates and renders 10 diverse watercolor artworks across all themes.
 */

import fs from 'node:fs'
import path from 'node:path'

import { CANVAS_SIZE, P5_BRUSH_API_REFERENCE } from '../engine/canvas-prompts.js'
import { CanvasRenderer } from '../engine/canvas-renderer.js'
import { RwkvWebGpuBridge } from '../engine/rwkv-session.js'
import { repairTruncatedProgram } from '../engine/sketch-extract.js'
import { ensureModelCached, PHASE7_MODEL_URL_1_5B } from '../engine/state-merger.js'

export const GALLERY_SCENES = [
  { id: '01-golden-sunflower', title: 'Golden Sunflower in Sunlit Meadow', prompt: 'blooming golden sunflower in a sunlit meadow with soft yellow petals and deep brown core' },
  { id: '02-crimson-maple', title: 'Crimson Maple Leaves in Autumn Garden', prompt: 'vibrant crimson maple leaves falling over a mossy stone lantern in an autumn garden' },
  { id: '03-misty-bamboo', title: 'Misty Bamboo Grove with Morning Dew', prompt: 'zen misty bamboo grove with emerald green stalks and soft fog washes' },
  { id: '04-neon-shinjuku', title: 'Rainy Neon Shinjuku Alley', prompt: 'rainy neon alley in Shinjuku with cyan and magenta signs reflecting in wet puddles' },
  { id: '05-cliff-lighthouse', title: 'Lighthouse on Sea Cliffs at Twilight', prompt: 'lonely seaside lighthouse on dark coastal cliffs under deep indigo twilight sky' },
  { id: '06-winter-ramen', title: 'Warm Ramen Shop in Evening Snow', prompt: 'cozy wooden ramen shop glowing warmly in soft evening snowfall' },
  { id: '07-pine-sunrise', title: 'Foggy Pine Mountain Ridge at Sunrise', prompt: 'atmospheric pine mountain ridge at sunrise with warm golden light spilling through fog' },
  { id: '08-turquoise-waves', title: 'Turquoise Ocean Waves on Golden Sand', prompt: 'calm turquoise ocean watercolor waves rolling onto soft sandy beach' },
  { id: '09-mossy-waterfall', title: 'Waterfall in Mossy Green Canyon', prompt: 'cascading mountain waterfall flowing through lush mossy green rocks and ferns' },
  { id: '10-cosmic-nebula', title: 'Cosmic Nebula with Starlight', prompt: 'deep cosmic nebula with swirling violet and cyan dust clouds and glowing stars' },
]

export const SCAFFOLD_HEADER = `function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(42);
  background(250, 246, 238);
`

function buildGalleryPrompt(promptText: string): string {
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
  console.log('=== RWKV Cleanroom Harness: 10-Scene Gallery Generator (with S0 Cartridge) ===\n')

  const modelPath = await ensureModelCached(PHASE7_MODEL_URL_1_5B)
  const galleryDir = path.resolve(process.cwd(), 'reports/gallery-500-steps')
  fs.mkdirSync(galleryDir, { recursive: true })

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

    const galleryEntries: Array<Record<string, unknown>> = []

    for (let i = 0; i < GALLERY_SCENES.length; i++) {
      const sc = GALLERY_SCENES[i]
      console.log(`\n======================================================`)
      console.log(`[${i + 1}/${GALLERY_SCENES.length}] Painting: "${sc.title}" (${sc.id})`)
      console.log(`======================================================`)

      const sceneDir = path.join(galleryDir, sc.id)
      fs.mkdirSync(sceneDir, { recursive: true })

      const prompt = buildGalleryPrompt(sc.prompt)
      const t0 = Date.now()

      console.log(`  Generating sketch code with S0 state "${STATE_NAME}" (temp=0.75, maxTokens=1200)...`)
      const genResult = await bridge.generateCode({
        prompt,
        maxTokens: 1200,
        temperature: 0.75,
        topP: 0.9,
        presencePenalty: 0.3,
        countPenalty: 0.3,
        stateName: STATE_NAME,
        stopSeqs: ['\n```\n', '```\n', '\n```', '```'],
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

      galleryEntries.push({
        id: sc.id,
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
    let md = `# RWKV-7 1.5B Watercolor Artwork Gallery (S0 State Cartridge)\n\n`
    md += `Generated autonomously via the WebGPU cleanroom render harness with S0 state conditioning on ${new Date().toISOString()}.\n\n`
    md += `| # | Title & Prompt | Ink Coverage | Colors | Status | Preview |\n`
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`

    for (let i = 0; i < galleryEntries.length; i++) {
      const e = galleryEntries[i] as any
      const ink = `${(e.inkCoverage * 100).toFixed(1)}%`
      const status = e.ok && !e.blank ? '✓ Rendered' : '✗ Blank/Error'
      md += `| **${i + 1}** | **${e.title}**<br>_${e.prompt}_ | ${ink} | ${e.uniqueColors} | ${status} | ![](${e.previewRelPath}) |\n`
    }

    const mdPath = path.join(galleryDir, 'GALLERY.md')
    fs.writeFileSync(mdPath, md)
    console.log(`\n✓ Exported Gallery Markdown: ${mdPath}`)

    const reportPath = path.join(galleryDir, 'gallery-report.json')
    fs.writeFileSync(reportPath, JSON.stringify({ meta: { galleryDir, total: galleryEntries.length }, gallery: galleryEntries }, null, 2))
    console.log(`✓ Exported Gallery JSON Report: ${reportPath}`)

    console.log('\n======================================================')
    console.log(`✓ 10-Artwork Gallery Generation Complete!`)
    console.log('======================================================\n')
  }
  finally {
    await bridge.dispose()
  }
}

main().catch((err) => {
  console.error('Fatal error in gallery generator:', err)
  process.exit(1)
})
