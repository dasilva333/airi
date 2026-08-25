/**
 * Test Improved Comprehensive Prompt for Simple Flower
 */

import fs from 'node:fs'
import path from 'node:path'

import puppeteer from 'puppeteer-core'

import { CANVAS_SIZE } from '../engine/canvas-prompts.js'
import { CanvasRenderer } from '../engine/canvas-renderer.js'
import { startStaticServer } from '../engine/server.js'
import { repairTruncatedProgram } from '../engine/sketch-extract.js'

const DETAILED_PROMPT = `You are a master generative artist specializing in p5.js and the p5.brush library.
Your task is to paint a clean, minimal, expressive watercolor artwork:
"A single simple flower with soft pink petals, a warm yellow center, a thin vertical stem, and one small green leaf on a light cream background."

=== P5.BRUSH API SPECIFICATION ===

1. COORDINATE SYSTEM:
   - WEBGL canvas (600x600) with origin (0,0) at the center.
   - X spans -300 to 300 (left to right).
   - Y spans -300 to 300 (top to bottom).
   - Position the flower blossom around (0, -40), stem extending down to (0, 160), and leaf around (35, 60).

2. WATERCOLOR WASHES (for petals, centers, leaves):
   - brush.fill(r, g, b, opacity) — opacity is 0..255 (e.g. brush.fill(240, 140, 165, 160) for soft pink).
   - brush.bleed(intensity, "out") — intensity 0.1 to 0.4 creates natural organic watercolor edges.
   - brush.circle(x, y, radius) — draws a circular wash.
   - brush.beginShape(); brush.vertex(x, y); ... brush.endShape("close"); — custom organic petal/leaf polygons.
   - CRITICAL: There is NO brush.pick("watercolor"). Watercolor washes are created via brush.fill() and brush.bleed().

3. PENCIL & DETAIL BRUSHES (for stems, veins, outlines):
   - brush.pick("HB") or brush.pick("2B") or brush.pick("cpencil") — selects the pencil brush.
   - brush.stroke(r, g, b) — sets pencil color.
   - brush.strokeWeight(1..3) — sets pencil thickness.
   - brush.line(x1, y1, x2, y2) — draws a pencil stroke.
   - brush.spline([[x1,y1], [x2,y2], [x3,y3]], 1) — smooth curved pencil line.

4. COMPOSITION GUIDELINES:
   - Keep the background clean light cream paper.
   - Paint the thin vertical green stem from flower base (0, -30) down to (0, 160).
   - Paint one small green leaf branching off the stem.
   - Paint 5-8 soft pink watercolor wash petals radiating around the center.
   - Paint a glowing warm yellow circular wash at the center (0, -40).

Output ONLY the JavaScript code inside function setup(). Do NOT redeclare setup() or draw().
\`\`\`js
function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(42);
  background(250, 246, 238);
`

async function query(p: any, modelId: string, temp = 0.7) {
  const url = `${p.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.apiKey}` },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: 'You are an expert generative artist specializing in p5.js and p5.brush.' },
        { role: 'user', content: DETAILED_PROMPT },
      ],
      max_tokens: 1500,
      temperature: temp,
    }),
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || ''
}

function extractJs(raw: string): string {
  const fence = raw.indexOf('```')
  let code = ''
  if (fence >= 0) {
    const after = raw.slice(fence + 3)
    const nl = after.indexOf('\n')
    const body = after.slice(nl + 1)
    const endFence = body.lastIndexOf('```')
    code = (endFence >= 0 ? body.slice(0, endFence) : body).trim()
  }
  else {
    code = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    if (!code)
      code = raw.replace(/<\/?think>/gi, '').trim()
  }

  if (code.includes('function setup()')) {
    const idx = code.indexOf('function setup()')
    const brace = code.indexOf('{', idx)
    if (brace >= 0)
      code = code.slice(brace + 1)
  }

  const scaffold = `function setup() {\n  createCanvas(600, 600, WEBGL);\n  brush.load();\n  noLoop();\n  brush.seed(42);\n  background(250, 246, 238);\n`
  const full = `${scaffold}\n${code}`
  return repairTruncatedProgram(full) || full
}

async function main() {
  const creds = JSON.parse(fs.readFileSync('credentials.json', 'utf8'))
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

  const models = [
    { name: 'Gemini Flash-Lite', p: creds.google, model: 'models/gemini-flash-lite-latest', file: 'google-gemini-flash-lite.png' },
    { name: 'MiniMax M3', p: creds.opencode, model: 'minimax-m3', file: 'opencode-minimax-m3.png' },
    { name: 'Kimi K3', p: creds.opencode, model: 'kimi-k3', file: 'opencode-kimi-k3.png', temp: 1.0 },
    { name: 'DeepSeek V4 Pro', p: creds.iamhc, model: 'DeepSeek-V4-Pro', file: 'iamhc-deepseek-v4-pro.png' },
    { name: 'Kat Coder Pro v2.5', p: creds.iamhc, model: 'kat-coder-pro-v2.5', file: 'iamhc-kat-coder-pro-v2-5.png' },
  ]

  try {
    for (const m of models) {
      console.log(`Testing with Detailed Prompt: ${m.name}...`)
      try {
        const text = await query(m.p, m.model, m.temp ?? 0.7)
        console.log(`  ✓ Received ${text.length} chars`)
        const js = extractJs(text)
        const outcome = await renderer.render({ code: js, size: CANVAS_SIZE, settleMs: 2500, timeoutMs: 30000 })
        if (outcome.dataUrl && !outcome.blank) {
          const p = path.join(outDir, m.file)
          renderer.savePng(p, outcome.dataUrl)
          console.log(`  ✓ SUCCESS -> Saved ${m.file} (ink: ${((outcome.inkCoverage || 0) * 100).toFixed(1)}%, colors: ${outcome.uniqueColors})`)
        }
        else {
          console.log(`  ✗ Blank/Error: ${outcome.error || outcome.sketchError}`)
        }
      }
      catch (e: any) {
        console.log(`  ✗ Error: ${e.message}`)
      }
    }
  }
  finally {
    await browser.close()
    await server.close()
  }
}

main().catch(console.error)
