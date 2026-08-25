/**
 * Fix and fill remaining models for the Simple Flower Shootout.
 */

import fs from 'node:fs'
import path from 'node:path'

import puppeteer from 'puppeteer-core'

import { CANVAS_SIZE, P5_BRUSH_API_REFERENCE } from '../engine/canvas-prompts.js'
import { CanvasRenderer } from '../engine/canvas-renderer.js'
import { startStaticServer } from '../engine/server.js'
import { repairTruncatedProgram } from '../engine/sketch-extract.js'

const SIMPLE_FLOWER_PROMPT = 'A single simple flower with soft pink petals, a warm yellow center, a thin vertical stem, and one small green leaf on a light background.'

const SCAFFOLD_HEADER = `function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(42);
  background(250, 246, 238);
`

function buildPrompt(promptText: string): string {
  return `You are an expert generative artist. Complete the following p5.js sketch using p5.brush to paint "${promptText}" as an expressive watercolor artwork.
RULES:
1. Paint shapes centered at (0,0) spanning -300..300. Keep the composition clean and centered.
2. Use watercolor washes: brush.fill(r,g,b,opacity), brush.bleed(0.1..0.4, "out"), brush.circle, brush.rect, brush.line.
3. Do NOT declare setup() or draw(). You are already inside function setup().
4. Declare all variables with const or let.
5. Output ONLY JavaScript statements that paint the flower. Close the function with } at the end.

${P5_BRUSH_API_REFERENCE}

Task: paint "${promptText}".
\`\`\`js
${SCAFFOLD_HEADER}`
}

interface Target {
  filename: string
  name: string
  providerKey: string
  modelId: string
  temperature?: number
}

const TARGETS: Target[] = [
  { filename: 'google-gemini-flash-lite.png', name: 'Gemini Flash-Lite', providerKey: 'google', modelId: 'models/gemini-flash-lite-latest', temperature: 0.7 },
  { filename: 'opencode-minimax-m3.png', name: 'MiniMax M3', providerKey: 'opencode', modelId: 'minimax-m3', temperature: 0.7 },
  { filename: 'iamhc-kat-coder-pro-v2-5.png', name: 'Kat Coder Pro v2.5', providerKey: 'iamhc', modelId: 'kat-coder-pro-v2.5', temperature: 0.7 },
]

function extractJs(raw: string): string {
  // If there's a code block anywhere in raw (even inside <think>), extract it directly!
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

  // If text already has setup(), return it
  if (code.includes('function setup()')) {
    const idx = code.indexOf('function setup()')
    const brace = code.indexOf('{', idx)
    if (brace >= 0) {
      code = code.slice(brace + 1)
    }
  }

  const full = `${SCAFFOLD_HEADER}\n${code}`
  return repairTruncatedProgram(full) || full
}

async function queryModel(p: any, modelId: string, prompt: string, temp = 0.7): Promise<{ text: string, latencyMs: number }> {
  const url = `${p.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const t0 = Date.now()

  const payload: any = {
    model: modelId,
    messages: [
      { role: 'system', content: 'You are a master generative artist specializing in p5.js and p5.brush.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 1200,
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
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const latencyMs = Date.now() - t0
  const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || ''
  return { text, latencyMs }
}

async function main() {
  const creds = JSON.parse(fs.readFileSync('credentials.json', 'utf8'))
  const outDir = path.resolve(process.cwd(), 'reports/simple-flower-shootout')

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

  const prompt = buildPrompt(SIMPLE_FLOWER_PROMPT)

  try {
    for (const c of TARGETS) {
      console.log(`Processing: ${c.name}...`)
      const provider = creds[c.providerKey]
      if (!provider)
        continue

      try {
        const gen = await queryModel(provider, c.modelId, prompt, c.temperature)
        console.log(`  ✓ Received ${gen.text.length} chars in ${(gen.latencyMs / 1000).toFixed(1)}s`)
        const jsCode = extractJs(gen.text)

        const outcome = await renderer.render({
          code: jsCode,
          size: CANVAS_SIZE,
          settleMs: 2500,
          timeoutMs: 30000,
        })

        if (outcome.dataUrl && !outcome.blank) {
          const outPath = path.join(outDir, c.filename)
          renderer.savePng(outPath, outcome.dataUrl)
          console.log(`  ✓ SAVED: ${outPath} (ink: ${((outcome.inkCoverage || 0) * 100).toFixed(1)}%, colors: ${outcome.uniqueColors})`)
        }
        else {
          console.log(`  ✗ Blank/Error: ${outcome.error || outcome.sketchError}`)
        }
      }
      catch (err: any) {
        console.log(`  ✗ Error: ${err.message}`)
      }
    }
  }
  finally {
    await browser.close()
    await server.close()
  }
}

main().catch(console.error)
