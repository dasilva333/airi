/**
 * Render Gallery: Compiles and renders all successful model sketches into a single gallery folder.
 */

import fs from 'node:fs'
import path from 'node:path'

import puppeteer from 'puppeteer-core'

import { CANVAS_SIZE } from '../engine/canvas-prompts.js'
import { CanvasRenderer } from '../engine/canvas-renderer.js'
import { startStaticServer } from '../engine/server.js'
import { repairTruncatedProgram } from '../engine/sketch-extract.js'

const GALLERY_MODELS = [
  { slug: 'google-gemini-flash-lite', rawFile: '06-gemini-flash-lite/raw-output.txt', name: 'Google Gemini Flash-Lite' },
  { slug: 'minimax-m3', rawFile: '05-minimax-m3/raw-output.txt', name: 'MiniMax M3' },
  { slug: 'alibaba-qwen-3-8-27b', rawFile: '08-qwen-3-8-27b/raw-output.txt', name: 'Alibaba Qwen 3.8 27B' },
  { slug: 'kat-coder-pro-v2-5', rawFile: '10-kat-coder-pro-v2-5/raw-output.txt', name: 'Kat Coder Pro v2.5' },
]

function extractJsFromRaw(raw: string): string {
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
    // Strip think tags
    code = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    if (!code)
      code = raw.replace(/<\/?think>/gi, '').trim()
  }

  // Ensure setup() is present
  if (!code.includes('function setup()')) {
    code = `function setup() {\n  createCanvas(600, 600, WEBGL);\n  brush.load();\n  noLoop();\n  brush.seed(42);\n  background(250, 246, 238);\n${code}\n}`
  }

  return repairTruncatedProgram(code) || code
}

async function main() {
  const rootDir = path.resolve(process.cwd(), 'reports/frontier-shootout')
  const galleryDir = path.join(rootDir, 'gallery')
  fs.mkdirSync(galleryDir, { recursive: true })

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

  try {
    for (const item of GALLERY_MODELS) {
      const rawPath = path.join(rootDir, item.rawFile)
      if (!fs.existsSync(rawPath)) {
        console.log(`✗ Missing ${rawPath}`)
        continue
      }

      console.log(`Processing: ${item.name} (${item.slug})...`)
      const raw = fs.readFileSync(rawPath, 'utf8')
      const jsCode = extractJsFromRaw(raw)

      const outcome = await renderer.render({
        code: jsCode,
        size: CANVAS_SIZE,
        settleMs: 2500,
        timeoutMs: 30000,
      })

      if (outcome.dataUrl) {
        const outPng = path.join(galleryDir, `${item.slug}.png`)
        renderer.savePng(outPng, outcome.dataUrl)
        console.log(`  ✓ Rendered ${item.slug}.png (ink: ${((outcome.inkCoverage || 0) * 100).toFixed(1)}%, colors: ${outcome.uniqueColors})`)
      }
      else {
        console.log(`  ✗ Render failed: ${outcome.error || outcome.sketchError}`)
      }
    }
  }
  finally {
    await browser.close()
    await server.close()
  }

  console.log(`\n✓ All gallery images collected in: ${galleryDir}`)
}

main().catch(console.error)
