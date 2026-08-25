/**
 * Phase 14: Synthesize Verified High-Quality Training Corpus V2 (Full 24-Subject Run).
 *
 * Uses KiosAPI (Kimi K3 & Nemotron 3 Ultra 550B) with 10s rate-limit pacing.
 * Verified 100% non-blank WebGL execution for every training sample.
 */

import fs from 'node:fs'
import path from 'node:path'

import puppeteer from 'puppeteer-core'

import { CANVAS_SIZE } from '../engine/canvas-prompts.js'
import { CanvasRenderer } from '../engine/canvas-renderer.js'
import { startStaticServer } from '../engine/server.js'
import { repairTruncatedProgram } from '../engine/sketch-extract.js'

interface SubjectSpec {
  category: string
  subject: string
  prompt: string
  anchors: string
}

const SUBJECT_CATALOG: SubjectSpec[] = [
  // 1. Florals & Botanical
  { category: 'floral', subject: 'peach rose', prompt: 'A single blooming peach rose with soft blush petals, a green stem, and two leaves on a light cream background.', anchors: 'Blossom at (0, -40), stem down to (0, 160), leaves at (-35, 60) and (35, 90).' },
  { category: 'floral', subject: 'red poppy', prompt: 'A vibrant red poppy flower with delicate crimson petals, a dark center, and a slender green stem on a light background.', anchors: 'Blossom at (0, -30), dark core at (0, -30), stem down to (0, 170).' },
  { category: 'floral', subject: 'sunflower', prompt: 'A cheerful bright yellow sunflower with a rich textured brown seed center and green stem on a light background.', anchors: 'Flower head at (0, -40), large brown center at (0, -40), stem down to (0, 160).' },
  { category: 'floral', subject: 'blue hydrangea', prompt: 'A cluster of soft sky-blue hydrangea petals forming a round blossom with green leaves below on a light background.', anchors: 'Blossom cluster centered at (0, -30), green leaves at (-40, 70) and (40, 70).' },
  { category: 'floral', subject: 'lavender sprig', prompt: 'A delicate sprig of purple lavender with small violet flower buds along a slender green stem on a light background.', anchors: 'Buds clustered from (0, -120) to (0, 20), slender stem extending down to (0, 180).' },
  { category: 'floral', subject: 'white daisy', prompt: 'A simple white daisy with radiating petals, a sunny yellow center, and a fresh green stem on a light cream background.', anchors: 'Center at (0, -30), petals radiating out, stem down to (0, 160).' },
  { category: 'floral', subject: 'cherry blossom branch', prompt: 'A graceful cherry blossom twig with delicate pale pink petals and tiny brown branches on a light background.', anchors: 'Twig spanning from (-120, -60) to (120, 60), blossoms clustered along the branch.' },
  { category: 'floral', subject: 'tulip', prompt: 'A solitary elegant red tulip with closed cupped petals and two long upright green leaves on a light background.', anchors: 'Tulip cup at (0, -50), stem down to (0, 170), long leaves curving up from (0, 120).' },
  { category: 'floral', subject: 'monstera leaf', prompt: 'A single lush green monstera leaf with iconic cutouts and delicate vein lines centered on light paper.', anchors: 'Leaf centered at (0, -10), stem extending down to (0, 170).' },
  { category: 'floral', subject: 'bonsai pine', prompt: 'A miniature Japanese bonsai pine with a gnarled brown trunk and rounded green needle clusters on a light background.', anchors: 'Trunk rooted at (0, 120) curving up to (-30, -20), green needle clouds around (-40, -50) and (40, -20).' },

  // 2. Still Life & Organic Objects
  { category: 'still-life', subject: 'matcha bowl', prompt: 'A rustic ceramic Japanese matcha bowl with frothy vibrant green tea inside centered on light paper.', anchors: 'Bowl base at (0, 60), rim at (0, -20), green tea surface inside.' },
  { category: 'still-life', subject: 'steaming tea cup', prompt: 'A simple ceramic teacup with gentle curling steam lines rising into the air on a light background.', anchors: 'Cup at (0, 40), steam swirls rising from (0, 0) up to (0, -120).' },
  { category: 'still-life', subject: 'ripe peach', prompt: 'A plump ripe peach with golden-yellow and blush-pink watercolor blush and a single green leaf on top.', anchors: 'Fruit centered at (0, 0), stem and green leaf at (0, -70).' },
  { category: 'still-life', subject: 'strawberry', prompt: 'A bright red ripe strawberry with tiny golden seed dots and a green leafy cap on a light background.', anchors: 'Berry centered at (0, 10), green cap at (0, -60).' },
  { category: 'still-life', subject: 'slice of watermelon', prompt: 'A fresh wedge of watermelon with pink-red fruit flesh, dark seeds, and a green rind on a light background.', anchors: 'Curved green rind along the bottom, red triangle body pointing up to (0, -80).' },
  { category: 'still-life', subject: 'origami crane', prompt: 'A graceful paper origami crane folded from pale blue paper with soft shadow washes on a light background.', anchors: 'Body centered at (0, 0), wings spreading to (-120, -50) and (120, -50), tail and head.' },

  // 3. Creatures & Nature Elements
  { category: 'creature', subject: 'monarch butterfly', prompt: 'A vibrant monarch butterfly with glowing orange wings and delicate black veins centered on light paper.', anchors: 'Body along central vertical axis, wings spreading symmetrically from (-130, -60) to (130, 40).' },
  { category: 'creature', subject: 'blue dragonfly', prompt: 'A slender blue dragonfly with long translucent wings and pencil body lines centered on light background.', anchors: 'Long vertical body from (0, -80) to (0, 100), wings spreading out to (-140, -30) and (140, -30).' },
  { category: 'creature', subject: 'goldfish', prompt: 'A flowing orange and red Japanese goldfish with delicate ruffled fin washes swimming on a light background.', anchors: 'Fish body from (-50, -20) to (40, 10), wavy tail fin trailing to (120, 40).' },
  { category: 'creature', subject: 'small bird on twig', prompt: 'A charming small round songbird with a warm yellow chest perched on a slender brown twig on a light background.', anchors: 'Bird body centered at (0, -30), twig spanning horizontally from (-120, 50) to (120, 50).' },

  // 4. Scenery Landmarks & Trees
  { category: 'scenery', subject: 'solitary autumn tree', prompt: 'A solitary maple tree with a golden-orange leafy canopy and a slender brown trunk on a light cream background.', anchors: 'Round orange foliage canopy centered at (0, -60), brown trunk rooted at (0, 140).' },
  { category: 'scenery', subject: 'mountain peak at dawn', prompt: 'A solitary majestic mountain peak with soft purple watercolor mountain slopes and a pale morning sun behind it.', anchors: 'Mountain peak at (0, -80) sloping down to (-250, 140) and (250, 140), golden sun at (60, -120).' },
  { category: 'scenery', subject: 'lighthouse', prompt: 'A simple white and red coastal lighthouse on a small grassy hill with a light watercolor sky.', anchors: 'Hill at (0, 120), lighthouse tower rising from (0, 110) up to (0, -80).' },
  { category: 'scenery', subject: 'sunset cloud', prompt: 'A soft drifting cumulus cloud glowing with pink, apricot, and golden twilight watercolor washes on a light background.', anchors: 'Puffy cloud cluster spanning from (-140, -40) to (140, 40).' },
]

function buildSynthesisPrompt(spec: SubjectSpec): string {
  return `You are a master generative artist specializing in p5.js and the p5.brush watercolor library.
Your task is to write a p5.js sketch using p5.brush to paint:
"${spec.prompt}"

=== P5.BRUSH API & COMPOSITION SPECIFICATION ===
1. COORDINATE SYSTEM:
   - WEBGL canvas (600x600) with origin (0,0) at center.
   - X spans -300 to 300, Y spans -300 to 300.
   - LANDMARKS: ${spec.anchors}

2. WATERCOLOR WASHES (for colored bodies, petals, leaves, gradients):
   - brush.fill(r, g, b, opacity) — opacity 0..255 (e.g. brush.fill(240, 140, 160, 180)).
   - brush.bleed(intensity, "out") — intensity 0.1 to 0.4 creates natural edge bleeds.
   - brush.circle(x, y, radius) — draws a circular watercolor wash.
   - brush.rect(x, y, w, h) — draws a rectangular watercolor wash.
   - brush.beginShape(); brush.vertex(x, y); ... brush.endShape("close"); — custom polygon washes.
   - CRITICAL: There is NO brush.pick("watercolor"). Watercolor washes use brush.fill() and brush.bleed().

3. PENCIL & DETAIL BRUSHES (for stems, outlines, veins, accents):
   - brush.pick("HB") or brush.pick("2B") or brush.pick("cpencil") — selects pencil.
   - brush.stroke(r, g, b) — sets stroke color.
   - brush.strokeWeight(1..3) — sets stroke thickness.
   - brush.line(x1, y1, x2, y2) — draws pencil stroke.

4. Output ONLY JavaScript statements that execute inside function setup(). Close the function with } at the end.
\`\`\`js
function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(42);
  background(250, 246, 238);
`
}

function extractJs(raw: string): string {
  const fence = raw.indexOf('```')
  let code = ''
  if (fence >= 0) {
    const after = raw.slice(fence + 3)
    const nl = after.indexOf('\n')
    const body = after.slice(nl + 1)
    const end = body.lastIndexOf('```')
    code = (end >= 0 ? body.slice(0, end) : body).trim()
  }
  else {
    code = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    if (!code)
      code = raw.replace(/<\/?think>/gi, '').trim()
  }

  if (code.includes('function setup()')) {
    const idx = code.indexOf('function setup()')
    const brace = code.indexOf('{', idx)
    if (brace >= 0) {
      code = code.slice(brace + 1)
    }
  }

  const scaffold = `function setup() {\n  createCanvas(600, 600, WEBGL);\n  brush.load();\n  noLoop();\n  brush.seed(42);\n  background(250, 246, 238);\n`
  const full = `${scaffold}\n${code}`
  return repairTruncatedProgram(full) || full
}

async function queryKios(p: any, modelId: string, promptText: string, temp = 0.7): Promise<string> {
  const url = `${p.baseUrl.replace(/\/+$/, '')}/chat/completions`

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.apiKey}` },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: 'You are an expert generative artist specializing in p5.js and p5.brush.' },
            { role: 'user', content: promptText },
          ],
          max_tokens: 1500,
          temperature: temp,
        }),
        signal: AbortSignal.timeout(60000),
      })

      if (res.status === 429) {
        console.log(`    [429 Rate Limit on ${modelId}] Pausing 15s before retry...`)
        await new Promise(r => setTimeout(r, 15000))
        continue
      }

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`HTTP ${res.status}: ${err.slice(0, 100)}`)
      }

      const data = await res.json()
      return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || ''
    }
    catch (e: any) {
      if (attempt === 3)
        throw e
      console.log(`    [Retry ${attempt}] ${e.message}. Waiting 10s...`)
      await new Promise(r => setTimeout(r, 10000))
    }
  }
  return ''
}

async function main() {
  console.log('=== Phase 14: Synthesizing Full Training Corpus V2 (24 Subjects) ===\n')

  const credsPath = path.resolve(process.cwd(), 'credentials.json')
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'))

  const datasetDir = path.resolve(process.cwd(), 'datasets')
  fs.mkdirSync(datasetDir, { recursive: true })
  const corpusPath = path.join(datasetDir, 'p5-watercolor-corpus-v2.jsonl')

  const previewDir = path.resolve(process.cwd(), 'reports/corpus-v2-previews')
  fs.mkdirSync(previewDir, { recursive: true })

  const server = await startStaticServer(path.resolve(process.cwd(), 'webroot'), {})
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    headless: false,
    defaultViewport: { width: 800, height: 800 },
    args: ['--enable-unsafe-webgpu', '--use-angle=metal', '--disable-background-timer-throttling'],
  })

  const page = await browser.newPage()
  const renderer = new CanvasRenderer(page)
  await renderer.open(server.baseUrl)
  console.log('✓ CanvasRenderer ready\n')

  const models = [
    { name: 'Kios Kimi K3', model: 'kimi-k3', temp: 1.0 },
    { name: 'Kios Nemotron 3 Ultra', model: 'nemotron-3-ultra-550b-a55b', temp: 0.7 },
  ]

  let verifiedCount = 0

  try {
    for (let i = 0; i < SUBJECT_CATALOG.length; i++) {
      const spec = SUBJECT_CATALOG[i]
      const modelChoice = models[i % models.length]

      console.log(`------------------------------------------------------`)
      console.log(`[${i + 1}/${SUBJECT_CATALOG.length}] Synthesizing: "${spec.subject}" via ${modelChoice.name}`)
      console.log(`------------------------------------------------------`)

      const promptStr = buildSynthesisPrompt(spec)
      let rawText = ''
      try {
        rawText = await queryKios(creds.kios, modelChoice.model, promptStr, modelChoice.temp)
        console.log(`  ✓ Generated ${rawText.length} chars`)
      }
      catch (err: any) {
        console.log(`  ✗ Query failed: ${err.message}`)
        continue
      }

      const jsCode = extractJs(rawText)
      let outcome
      try {
        outcome = await renderer.render({
          code: jsCode,
          size: CANVAS_SIZE,
          settleMs: 2500,
          timeoutMs: 30000,
        })
      }
      catch (err: any) {
        console.log(`  ✗ Render error: ${err.message}`)
        continue
      }

      if (outcome.dataUrl && !outcome.blank && (outcome.inkCoverage || 0) > 0.01) {
        verifiedCount++
        const slug = `${String(verifiedCount).padStart(2, '0')}-${spec.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
        const previewPath = path.join(previewDir, `${slug}.png`)
        renderer.savePng(previewPath, outcome.dataUrl)

        const record = {
          id: `sample-v2-${String(verifiedCount).padStart(3, '0')}`,
          category: spec.category,
          subject: spec.subject,
          prompt: spec.prompt,
          code: jsCode,
          metrics: {
            inkCoverage: outcome.inkCoverage,
            uniqueColors: outcome.uniqueColors,
            structureScore: outcome.structureScore,
          },
        }

        fs.appendFileSync(corpusPath, `${JSON.stringify(record)}\n`)
        console.log(`  ✓ VERIFIED & SAVED [${record.id}] (ink: ${((outcome.inkCoverage || 0) * 100).toFixed(1)}%, colors: ${outcome.uniqueColors}) -> ${slug}.png`)
      }
      else {
        console.log(`  ✗ Rejected (blank/low ink: ${outcome.inkCoverage ?? 0})`)
      }

      // 10s cooldown per request to keep within 6 req/min (< 10 req/min limit)
      console.log('  (Cooldown 10s for zero-rate-limit safety...)')
      await new Promise(r => setTimeout(r, 10000))
    }
  }
  finally {
    await browser.close()
    await server.close()
  }

  console.log(`\n======================================================`)
  console.log(`✓ Full Corpus V2 Generation Complete!`)
  console.log(`✓ Total Verified Samples: ${verifiedCount}/${SUBJECT_CATALOG.length}`)
  console.log(`✓ Dataset saved to: ${corpusPath}`)
  console.log(`✓ Visual previews in: ${previewDir}`)
  console.log(`======================================================\n`)
}

main().catch(console.error)
