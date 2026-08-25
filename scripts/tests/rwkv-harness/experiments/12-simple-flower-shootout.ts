/**
 * Simple Flower Shootout: Benchmarking models against a clean, minimal reference target.
 * Target: A single simple flower with pink petals, yellow center, thin stem, and one leaf.
 */

import fs from 'node:fs'
import path from 'node:path'

import puppeteer from 'puppeteer-core'

import { CANVAS_SIZE, P5_BRUSH_API_REFERENCE } from '../engine/canvas-prompts.js'
import { CanvasRenderer } from '../engine/canvas-renderer.js'
import { startStaticServer } from '../engine/server.js'
import { repairTruncatedProgram } from '../engine/sketch-extract.js'

const SIMPLE_FLOWER_PROMPT = 'A single simple flower with soft pink petals, a warm yellow center, a thin vertical stem, and one small green leaf on a light background.'

export const SCAFFOLD_HEADER = `function setup() {
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
4. Output ONLY JavaScript statements that paint the flower. Close the function with } at the end.

${P5_BRUSH_API_REFERENCE}

Task: paint "${promptText}".
\`\`\`js
${SCAFFOLD_HEADER}`
}

interface Candidate {
  filename: string
  name: string
  providerKey: string
  modelId: string
  temperature?: number
}

const CANDIDATES: Candidate[] = [
  { filename: 'google-gemini-flash-lite.png', name: 'Gemini Flash-Lite', providerKey: 'google', modelId: 'models/gemini-flash-lite-latest', temperature: 0.7 },
  { filename: 'alibaba-qwen-3-8-27b.png', name: 'Qwen 3.8 27B', providerKey: 'alibaba', modelId: 'qwen3.8-27b', temperature: 0.7 },
  { filename: 'iamhc-kat-coder-pro-v2-5.png', name: 'Kat Coder Pro v2.5', providerKey: 'iamhc', modelId: 'kat-coder-pro-v2.5', temperature: 0.7 },
  { filename: 'opencode-minimax-m3.png', name: 'MiniMax M3', providerKey: 'opencode', modelId: 'minimax-m3', temperature: 0.7 },
  { filename: 'opencode-kimi-k3.png', name: 'Kimi K3', providerKey: 'opencode', modelId: 'kimi-k3', temperature: 1.0 },
  { filename: 'iamhc-deepseek-v4-pro.png', name: 'DeepSeek V4 Pro', providerKey: 'iamhc', modelId: 'DeepSeek-V4-Pro', temperature: 0.7 },
  { filename: 'orcarouter-qwen-3-8-free.png', name: 'Qwen 3.8 Free', providerKey: 'orcarouter', modelId: 'qwen/qwen3.8-27b-free', temperature: 0.7 },
  { filename: 'openrouter-ox-alpha.png', name: 'Stealth Ox-Alpha', providerKey: 'openrouter', modelId: 'stealth/ox-alpha', temperature: 0.7 },
  { filename: 'kios-nemotron-3-ultra.png', name: 'Nemotron 3 Ultra', providerKey: 'kios', modelId: 'nemotron-3-ultra-550b-a55b', temperature: 0.7 },
  { filename: 'alibaba-deepseek-v4-pro.png', name: 'DeepSeek V4 Pro 0813', providerKey: 'alibaba', modelId: 'deepseek-v4-pro-0813', temperature: 0.7 },
]

function extractJs(raw: string): string {
  // 1. Look for ```js or ```javascript codeblocks
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

  // 2. Ensure setup() wraps the body
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
  console.log('=== Simple Flower Shootout: 10 Models Head-to-Head ===\n')
  console.log(`Prompt: "${SIMPLE_FLOWER_PROMPT}"\n`)

  const credsPath = path.resolve(process.cwd(), 'credentials.json')
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'))

  // Single destination folder for all images
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

  const prompt = buildPrompt(SIMPLE_FLOWER_PROMPT)

  try {
    for (let i = 0; i < CANDIDATES.length; i++) {
      const c = CANDIDATES[i]
      console.log(`------------------------------------------------------`)
      console.log(`[${i + 1}/${CANDIDATES.length}] ${c.name} (${c.filename})`)
      console.log(`------------------------------------------------------`)

      const provider = creds[c.providerKey]
      if (!provider) {
        console.log(`  ✗ Provider "${c.providerKey}" missing`)
        continue
      }

      let gen
      try {
        console.log(`  Calling ${provider.name} (${c.modelId})...`)
        gen = await queryModel(provider, c.modelId, prompt, c.temperature)
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
  console.log(`✓ All rendered images are in: ${outDir}`)
  console.log(`======================================================\n`)
}

main().catch(console.error)
