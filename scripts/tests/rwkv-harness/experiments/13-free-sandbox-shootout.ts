/**
 * Phase 13: 100% Free Sandbox Shootout (Simple Flower Target).
 *
 * Runs exclusively on 100% free / zero-cost provider endpoints (Kios, SeekAI, OrcaRouter).
 * Tests generative p5.brush synthesis against the minimal simple flower reference target.
 */

import fs from 'node:fs'
import path from 'node:path'

import puppeteer from 'puppeteer-core'

import { CANVAS_SIZE } from '../engine/canvas-prompts.js'
import { CanvasRenderer } from '../engine/canvas-renderer.js'
import { startStaticServer } from '../engine/server.js'
import { repairTruncatedProgram } from '../engine/sketch-extract.js'

const COMPREHENSIVE_FLOWER_PROMPT = `You are a master generative artist specializing in p5.js and the p5.brush watercolor library.
Your task is to write a p5.js sketch using p5.brush to paint:
"A single simple flower with soft pink petals, a warm yellow center, a thin vertical stem, and one small green leaf on a light cream background."

=== P5.BRUSH API & COMPOSITION SPECIFICATION ===

1. COORDINATE SYSTEM:
   - WEBGL canvas (600x600) with origin (0,0) at the center.
   - X spans -300 to 300 (left to right).
   - Y spans -300 to 300 (top to bottom).
   - Position the flower blossom around (0, -40).
   - Position the thin vertical stem from (0, -30) down to (0, 160).
   - Position one small green leaf around (35, 60).

2. WATERCOLOR WASHES (for petals, center, and leaf):
   - brush.fill(r, g, b, opacity) — opacity is 0..255 (e.g. brush.fill(245, 160, 180, 170) for soft pink).
   - brush.bleed(intensity, "out") — intensity 0.1 to 0.4 creates natural watercolor edge bleeds.
   - brush.circle(x, y, radius) — draws a watercolor circular wash.
   - brush.beginShape(); brush.vertex(x, y); ... brush.endShape("close"); — custom organic petal/leaf polygons.
   - CRITICAL: There is NO brush.pick("watercolor"). Watercolor washes are created via brush.fill() and brush.bleed().

3. PENCIL & DETAIL BRUSHES (for stem, leaf veins, and petal outlines):
   - brush.pick("HB") or brush.pick("2B") or brush.pick("cpencil") — selects the pencil brush.
   - brush.stroke(r, g, b) — sets pencil color.
   - brush.strokeWeight(1..3) — sets pencil thickness.
   - brush.line(x1, y1, x2, y2) — draws a clean pencil line.

4. COMPOSITION STEPS:
   - Background is already set to light cream (250, 246, 238).
   - Step 1: Draw the thin vertical green stem from (0, -30) down to (0, 160) using brush.pick("HB") and brush.stroke(80, 130, 70).
   - Step 2: Draw one small soft green leaf wash around (35, 60) with brush.fill(110, 170, 95, 160) and brush.bleed(0.25, "out").
   - Step 3: Draw 5 to 7 soft pink watercolor petals radiating around the center (0, -40) using brush.fill(245, 160, 185, 150) and brush.bleed(0.3, "out").
   - Step 4: Draw a glowing warm yellow circular wash at the center (0, -40) using brush.fill(245, 205, 75, 200) and brush.circle(0, -40, 25).

Output ONLY JavaScript statements that execute inside function setup(). Close the function with } at the end.
\`\`\`js
function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(42);
  background(250, 246, 238);
`

interface FreeModelCandidate {
  filename: string
  name: string
  providerKey: string
  modelId: string
  temperature?: number
}

const FREE_CANDIDATES: FreeModelCandidate[] = [
  { filename: 'kios-kimi-k3.png', name: 'Kimi K3 (Kios)', providerKey: 'kios', modelId: 'kimi-k3', temperature: 1.0 },
  { filename: 'kios-minimax-m3.png', name: 'MiniMax M3 (Kios)', providerKey: 'kios', modelId: 'minimax-m3', temperature: 0.7 },
  { filename: 'kios-nemotron-3-ultra.png', name: 'Nemotron 3 Ultra 550B (Kios)', providerKey: 'kios', modelId: 'nemotron-3-ultra-550b-a55b', temperature: 0.7 },
  { filename: 'seekai-ox-alpha.png', name: 'Stealth Ox-Alpha (SeekAI)', providerKey: 'seekai', modelId: 'stealth/ox-alpha', temperature: 0.7 },
  { filename: 'seekai-deepseek-v4-flash.png', name: 'DeepSeek V4 Flash (SeekAI)', providerKey: 'seekai', modelId: 'deepseek-v4-flash', temperature: 0.7 },
  { filename: 'orcarouter-qwen-3-8-free.png', name: 'Qwen 3.8 27B Free (OrcaRouter)', providerKey: 'orcarouter', modelId: 'qwen/qwen3.8-27b-free', temperature: 0.7 },
  { filename: 'orcarouter-deepseek-v4-flash.png', name: 'DeepSeek V4 Flash Free (OrcaRouter)', providerKey: 'orcarouter', modelId: 'deepseek/deepseek-v4-flash-free', temperature: 0.7 },
]

function extractJs(raw: string): string {
  const firstFence = raw.indexOf('```')
  let code = ''
  if (firstFence >= 0) {
    const afterFirstFence = raw.slice(firstFence + 3)
    const newline = afterFirstFence.indexOf('\n')
    const codeContent = afterFirstFence.slice(newline + 1)
    const lastFence = codeContent.lastIndexOf('```')
    code = (lastFence >= 0 ? codeContent.slice(0, lastFence) : codeContent).trim()
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

async function queryModel(p: any, modelId: string, temp = 0.7): Promise<{ text: string, latencyMs: number }> {
  const url = `${p.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const t0 = Date.now()

  const payload: any = {
    model: modelId,
    messages: [
      { role: 'system', content: 'You are a master generative artist specializing in p5.js and p5.brush.' },
      { role: 'user', content: COMPREHENSIVE_FLOWER_PROMPT },
    ],
    max_tokens: 1500,
  }
  if (temp !== undefined)
    payload.temperature = temp

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${p.apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HTTP ${res.status}: ${err.slice(0, 150)}`)
  }

  const data = await res.json()
  const latencyMs = Date.now() - t0
  const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || ''
  return { text, latencyMs }
}

async function main() {
  console.log('=== 100% Free Sandbox Shootout: Simple Flower Target ===\n')

  const credsPath = path.resolve(process.cwd(), 'credentials.json')
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'))

  const outDir = path.resolve(process.cwd(), 'reports/simple-flower-shootout')
  fs.mkdirSync(outDir, { recursive: true })

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

  try {
    for (let i = 0; i < FREE_CANDIDATES.length; i++) {
      const c = FREE_CANDIDATES[i]
      console.log(`------------------------------------------------------`)
      console.log(`[${i + 1}/${FREE_CANDIDATES.length}] ${c.name} -> ${c.filename}`)
      console.log(`------------------------------------------------------`)

      const provider = creds[c.providerKey]
      if (!provider) {
        console.log(`  ✗ Provider "${c.providerKey}" missing`)
        continue
      }

      let gen
      try {
        console.log(`  Calling ${provider.name} (${c.modelId})...`)
        gen = await queryModel(provider, c.modelId, c.temperature)
        console.log(`  ✓ Generated in ${(gen.latencyMs / 1000).toFixed(1)}s (${gen.text.length} chars)`)
      }
      catch (err: any) {
        console.log(`  ✗ Generation failed: ${err.message}`)
        continue
      }

      const jsCode = extractJs(gen.text)
      console.log('  Rendering sketch on WebGL canvas...')
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

      if (outcome.dataUrl && !outcome.blank) {
        const outPath = path.join(outDir, c.filename)
        renderer.savePng(outPath, outcome.dataUrl)
        console.log(`  ✓ SAVED -> ${outPath} (ink: ${((outcome.inkCoverage || 0) * 100).toFixed(1)}%, colors: ${outcome.uniqueColors})`)
      }
      else {
        console.log(`  ✗ Blank canvas or error: ${outcome.error || outcome.sketchError}`)
      }
    }
  }
  finally {
    await browser.close()
    await server.close()
  }

  console.log(`\n======================================================`)
  console.log(`✓ 100% Free Sandbox Shootout Complete!`)
  console.log(`✓ Files saved to: ${outDir}`)
  console.log(`======================================================\n`)
}

main().catch(console.error)
