/**
 * Phase 11: Frontier LLM Watercolor Shootout (12 Verified Models).
 *
 * Runs 12 verified frontier & coding flagships head-to-head on the
 * exact same p5.brush generative watercolor painting prompt.
 */

import fs from 'node:fs'
import path from 'node:path'

import puppeteer from 'puppeteer-core'

import { CANVAS_SIZE, P5_BRUSH_API_REFERENCE } from '../engine/canvas-prompts.js'
import { CanvasRenderer } from '../engine/canvas-renderer.js'
import { startStaticServer } from '../engine/server.js'
import { repairTruncatedProgram } from '../engine/sketch-extract.js'

const SHOOTOUT_PROMPT = 'A serene Japanese garden pond at twilight with blooming pink water lilies, smooth river stepping stones, and glowing lantern reflections on the dark water.'

export const SCAFFOLD_HEADER = `function setup() {
  createCanvas(600, 600, WEBGL);
  brush.load();
  noLoop();
  brush.seed(42);
  background(250, 246, 238);
`

function buildShootoutPrompt(promptText: string): string {
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

interface ShootoutCandidate {
  slug: string
  name: string
  providerKey: string
  modelId: string
  temperature?: number
}

const CANDIDATES: ShootoutCandidate[] = [
  { slug: '01-kimi-k3-max', name: 'Kimi K3 (max)', providerKey: 'opencode', modelId: 'kimi-k3', temperature: 1.0 },
  { slug: '02-deepseek-v4-pro-0813', name: 'DeepSeek V4 Pro 0813', providerKey: 'alibaba', modelId: 'deepseek-v4-pro-0813', temperature: 0.7 },
  { slug: '03-deepseek-v4-pro', name: 'DeepSeek V4 Pro', providerKey: 'iamhc', modelId: 'DeepSeek-V4-Pro', temperature: 0.7 },
  { slug: '05-minimax-m3', name: 'MiniMax M3', providerKey: 'opencode', modelId: 'minimax-m3', temperature: 0.7 },
  { slug: '06-gemini-flash-lite', name: 'Gemini Flash-Lite', providerKey: 'google', modelId: 'models/gemini-flash-lite-latest', temperature: 0.7 },
  { slug: '08-qwen-3-8-27b', name: 'Qwen 3.8 27B', providerKey: 'alibaba', modelId: 'qwen3.8-27b', temperature: 0.7 },
  { slug: '10-kat-coder-pro-v2-5', name: 'Kat Coder Pro v2.5', providerKey: 'iamhc', modelId: 'kat-coder-pro-v2.5', temperature: 0.7 },
  { slug: '11-kimi-k2-7-code', name: 'Kimi K2.7 Code', providerKey: 'opencode', modelId: 'kimi-k2.7-code', temperature: 1.0 },
]

async function queryModel(p: any, modelId: string, prompt: string, temp = 0.7): Promise<{ text: string, latencyMs: number }> {
  const url = `${p.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const t0 = Date.now()

  const bodyPayload: any = {
    model: modelId,
    messages: [
      { role: 'system', content: 'You are a master generative artist specialized in p5.js and p5.brush.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 1500,
  }
  if (temp !== undefined) {
    bodyPayload.temperature = temp
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${p.apiKey}`,
    },
    body: JSON.stringify(bodyPayload),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 300)}`)
  }

  const data = await res.json()
  const latencyMs = Date.now() - t0
  const choice = data.choices?.[0]
  const text = choice?.message?.content || choice?.text || ''
  return { text, latencyMs }
}

async function main() {
  console.log('=== Frontier LLM Generative Code-Painting Shootout ===\n')
  console.log(`Prompt: "${SHOOTOUT_PROMPT}"\n`)

  const credsPath = path.resolve(process.cwd(), 'credentials.json')
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'))

  const shootoutDir = path.resolve(process.cwd(), 'reports/frontier-shootout')
  fs.mkdirSync(shootoutDir, { recursive: true })

  // Launch local web server & Brave browser for rendering
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
  console.log('✓ CanvasRenderer tab ready\n')

  const results: Array<Record<string, unknown>> = []

  try {
    for (let i = 0; i < CANDIDATES.length; i++) {
      const c = CANDIDATES[i]
      console.log(`\n======================================================`)
      console.log(`[${i + 1}/${CANDIDATES.length}] Testing: ${c.name} (${c.slug})`)
      console.log(`======================================================`)

      const modelDir = path.join(shootoutDir, c.slug)
      fs.mkdirSync(modelDir, { recursive: true })

      const provider = creds[c.providerKey]
      if (!provider) {
        console.log(`  ✗ Provider "${c.providerKey}" not found in credentials.json`)
        continue
      }

      const prompt = buildShootoutPrompt(SHOOTOUT_PROMPT)
      let genResult: { text: string, latencyMs: number }
      try {
        console.log(`  Calling ${provider.name} (${c.modelId})...`)
        genResult = await queryModel(provider, c.modelId, prompt, c.temperature)
        console.log(`  ✓ Received response in ${(genResult.latencyMs / 1000).toFixed(1)}s (${genResult.text.length} chars)`)
        fs.writeFileSync(path.join(modelDir, 'raw-output.txt'), genResult.text)
      }
      catch (err: any) {
        console.error(`  ✗ Generation failed: ${err.message}`)
        results.push({
          slug: c.slug,
          name: c.name,
          modelId: c.modelId,
          ok: false,
          error: err.message,
        })
        continue
      }

      // Strip <think>...</think> reasoning blocks if present
      const cleanText = genResult.text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

      // Assemble and repair sketch
      let rawCode = cleanText.replace(/```[\w-]*/g, '').replace(/```/g, '').trim()
      if (rawCode.includes('function setup()')) {
        const idx = rawCode.indexOf('function setup()')
        const openBrace = rawCode.indexOf('{', idx)
        if (openBrace >= 0)
          rawCode = rawCode.slice(openBrace + 1)
      }

      const assembledCode = `${SCAFFOLD_HEADER}\n${rawCode}`
      const repairedSketch = repairTruncatedProgram(assembledCode) || assembledCode
      fs.writeFileSync(path.join(modelDir, 'sketch.js'), repairedSketch)

      // Render on WebGL canvas
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
      catch (err: any) {
        console.error(`  ✗ Render error: ${err.message}`)
        outcome = { ok: false, blank: true, error: err.message, inkCoverage: 0, uniqueColors: 0 }
      }

      fs.writeFileSync(path.join(modelDir, 'outcome.json'), JSON.stringify(outcome, null, 2))

      const previewRelPath = `${c.slug}/render.png`
      if (outcome.dataUrl) {
        const pngPath = path.join(modelDir, 'render.png')
        renderer.savePng(pngPath, outcome.dataUrl)
        console.log(`  ✓ Rendered: ok=${outcome.ok}, blank=${outcome.blank}, ink=${((outcome.inkCoverage || 0) * 100).toFixed(1)}%, colors=${outcome.uniqueColors}, structure=${outcome.structureScore?.toFixed(3) ?? 'N/A'}`)
        console.log(`  → Saved PNG: ${pngPath}`)
      }
      else {
        console.log(`  ✗ Canvas blank or failed: ${outcome.error || outcome.sketchError}`)
      }

      results.push({
        slug: c.slug,
        name: c.name,
        modelId: c.modelId,
        latencyMs: genResult.latencyMs,
        inkCoverage: outcome.inkCoverage ?? 0,
        uniqueColors: outcome.uniqueColors ?? 0,
        structureScore: outcome.structureScore ?? 0,
        ok: outcome.ok,
        blank: outcome.blank,
        previewRelPath,
      })
    }

    // Export SHOOTOUT.md
    let md = `# Frontier LLM Generative Watercolor Shootout\n\n`
    md += `**Prompt:** _"${SHOOTOUT_PROMPT}"_\n\n`
    md += `**Execution:** Sandboxed Headless Brave WebGL Canvas with \`p5.brush\` on ${new Date().toISOString()}.\n\n`
    md += `| # | Model | Generation Time | Ink Coverage | Colors | Status | Preview |\n`
    md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`

    for (let i = 0; i < results.length; i++) {
      const r = results[i] as any
      const timeSec = r.latencyMs ? `${(r.latencyMs / 1000).toFixed(1)}s` : 'N/A'
      const ink = `${((r.inkCoverage || 0) * 100).toFixed(1)}%`
      const status = r.ok && !r.blank ? '✓ Rendered' : '✗ Failed/Blank'
      md += `| **${i + 1}** | **${r.name}**<br>\`${r.modelId}\` | ${timeSec} | ${ink} | ${r.uniqueColors || 0} | ${status} | ![](${r.previewRelPath}) |\n`
    }

    const mdPath = path.join(shootoutDir, 'SHOOTOUT.md')
    fs.writeFileSync(mdPath, md)
    console.log(`\n✓ Exported Shootout Markdown: ${mdPath}`)

    const reportPath = path.join(shootoutDir, 'shootout-report.json')
    fs.writeFileSync(reportPath, JSON.stringify({ meta: { prompt: SHOOTOUT_PROMPT, total: results.length }, results }, null, 2))
    console.log(`✓ Exported Shootout JSON Report: ${reportPath}`)

    console.log('\n======================================================')
    console.log(`✓ Frontier LLM Shootout Complete!`)
    console.log('======================================================\n')
  }
  finally {
    await browser.close()
    await server.close()
  }
}

main().catch(console.error)
