/**
 * Phase 7 (smoke track): 1.5B/2.9B Creative Code Canvas.
 *
 * Goal (user-directed 2026-08-24): generate ONE scene sketch with the g1d-1.5b
 * checkpoint, extract the p5.js/p5.brush script, render it headlessly to a
 * 600×600 PNG, and STOP as soon as a non-blank image exists for human review.
 * No 50-prompt sweep until the base output is reviewed.
 *
 * Attempt ladder (stops at first non-blank render):
 *   A-chat            chat-frame few-shot prompt, temp 0.9
 *   A-chat-hi         chat-frame few-shot prompt, temp 1.3
 *   B-chat-s0         chat-frame + corpus-conditioned S0 cartridge, temp 0.9
 *   A-completion      raw completion frame (open ```js fence), temp 0.7
 *   B-completion-s0   completion frame + S0 cartridge, temp 0.7
 *
 * Baseline B = in-browser corpus-conditioned S0 (web-rwkv has no .state mount
 * path; see Phase 7 Decision Log in docs/project-rwkv-cleanroom-harness-plan.md).
 *
 * Run: pnpm test:canvas
 * Flags: --model=2.9b (opt-in) | --scene=<id> | --maxTokens=N
 */

import fs from 'node:fs'
import path from 'node:path'

import {
  buildCanvasCompletionPrefix,

  buildCanvasUserPrompt,
  buildStateConditioningCorpus,
  CANVAS_SIZE,
} from '../engine/canvas-prompts.js'
import { CanvasRenderer } from '../engine/canvas-renderer.js'
import { RwkvWebGpuBridge } from '../engine/rwkv-session.js'
import { extractSketch } from '../engine/sketch-extract.js'
import {
  ensureModelCached,
  PHASE7_MODEL_URL_1_5B,
  PHASE7_MODEL_URL_2_9B,
} from '../engine/state-merger.js'

interface SceneEntry {
  id: string
  prompt: string
}

interface AttemptSpec {
  name: string
  baseline: 'A' | 'B'
  frame: 'chat' | 'completion'
  temperature: number
  maxTokens: number
}

const STATE_NAME = 'p5-watercolor'
const S0_ENABLED_FLAG = '--no-s0'

const argv = process.argv.slice(2)
const modelArg = argv.find(a => a.startsWith('--model='))?.split('=')[1] ?? '1.5b'
const sceneArg = argv.find(a => a.startsWith('--scene='))?.split('=')[1]
const maxTokensArg = Number(argv.find(a => a.startsWith('--maxTokens='))?.split('=')[1] ?? 2400)
const skipS0 = argv.includes(S0_ENABLED_FLAG)
if (modelArg !== '1.5b' && modelArg !== '2.9b') {
  console.error(`unknown --model=${modelArg} (expected 1.5b or 2.9b)`)
  process.exit(1)
}

async function main() {
  console.log('=== RWKV Cleanroom Harness: Phase 7 Creative Code Canvas (smoke) ===\n')

  // 1. Model cache (one-time ~3GB download for 1.5B; streamed to disk, >2GiB-safe).
  const modelUrl = modelArg === '2.9b' ? PHASE7_MODEL_URL_2_9B : PHASE7_MODEL_URL_1_5B
  const modelPath = await ensureModelCached(modelUrl)
  console.log(`✓ Base model cached at ${modelPath}\n`)

  // 2. Scene selection (smoke = first scene unless --scene given).
  const sceneFile = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'test-prompts/canvas-scenes.json'), 'utf8')) as { scenes: SceneEntry[] }
  const scene = sceneArg
    ? sceneFile.scenes.find(s => s.id === sceneArg)
    : sceneFile.scenes[0]
  if (!scene) {
    console.error(`scene not found: ${sceneArg ?? '(default)'}`)
    process.exit(1)
  }
  console.log(`Scene: "${scene.prompt}" (id=${scene.id})`)

  // 3. Boot the WebGPU bridge once.
  const bridge = new RwkvWebGpuBridge({ modelFilePath: modelPath })
  const t0 = Date.now()

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const runDir = path.resolve(process.cwd(), `reports/07-creative-code-canvas-${stamp}`)
  fs.mkdirSync(runDir, { recursive: true })

  const attemptLog: Array<Record<string, unknown>> = []
  let winner: { attempt: AttemptSpec, pngPath: string } | null = null

  try {
    await bridge.boot(m => console.log(`[engine] ${m}`))
    console.log(`✓ Engine booted: state_len=${bridge.info.stateLen}, tensors=${bridge.info.numTensors}\n`)

    // 4. Pre-bake the Baseline B S0 cartridge (cheap prefill pass, ~1.5k tokens).
    let stateInfo: { name: string, fedTokens: number, stateLen: number } | null = null
    if (!skipS0) {
      const ts = Date.now()
      stateInfo = await bridge.makeState({ name: STATE_NAME, texts: buildStateConditioningCorpus() })
      console.log(`✓ S0 cartridge "${STATE_NAME}" conditioned on ${stateInfo.fedTokens} tokens in ${((Date.now() - ts) / 1000).toFixed(1)}s (state_len=${stateInfo.stateLen})\n`)
    }

    // 5. Open the render page (2nd tab, same browser).
    const renderer = new CanvasRenderer(await bridge.newPage())
    await renderer.open(bridge.baseUrl)
    console.log('✓ Render page ready\n')

    // 6. Attempt ladder. --ladder=core (default) runs only the two round-1-viable
    // frames; --ladder=full re-adds the round-1-dead variants (temp 1.3, S0).
    const ladderArg = argv.find(a => a.startsWith('--ladder='))?.split('=')[1] ?? 'core'
    const attempts: AttemptSpec[] = [
      { name: 'A-chat', baseline: 'A', frame: 'chat', temperature: 0.9, maxTokens: maxTokensArg },
      { name: 'A-completion', baseline: 'A', frame: 'completion', temperature: 0.7, maxTokens: maxTokensArg },
    ]
    if (ladderArg === 'full') {
      attempts.splice(1, 0, { name: 'A-chat-hi', baseline: 'A', frame: 'chat', temperature: 1.3, maxTokens: maxTokensArg }, ...(skipS0 ? [] : [{ name: 'B-chat-s0', baseline: 'B', frame: 'chat', temperature: 0.9, maxTokens: maxTokensArg }] as const as AttemptSpec[]))
      if (!skipS0)
        attempts.push({ name: 'B-completion-s0', baseline: 'B', frame: 'completion', temperature: 0.7, maxTokens: maxTokensArg })
    }

    for (let i = 0; i < attempts.length && !winner; i++) {
      const a = attempts[i]
      console.log(`\n########## Attempt ${i + 1}/${attempts.length}: ${a.name} (temp=${a.temperature}, maxTokens=${a.maxTokens}${a.baseline === 'B' ? `, S0=${STATE_NAME}` : ''}) ##########`)
      const dir = path.join(runDir, `attempt-${String(i + 1).padStart(2, '0')}-${a.name}`)
      fs.mkdirSync(dir, { recursive: true })

      // Generate.
      const tg = Date.now()
      let raw = ''
      let promptTokens = 0
      let completionTokens = 0
      try {
        if (a.frame === 'chat') {
          const out = await bridge.generate({
            prompt: buildCanvasUserPrompt(scene.prompt, { fewShot: true }),
            maxTokens: a.maxTokens,
            temperature: a.temperature,
            topP: 0.9,
            presencePenalty: 0.0,
            g1Prefill: true,
            ...(a.baseline === 'B' ? { stateName: STATE_NAME } : {}),
          })
          raw = out.text; promptTokens = out.promptTokens; completionTokens = out.completionTokens
        }
        else {
          const out = await bridge.generateCode({
            prompt: buildCanvasCompletionPrefix(scene.prompt),
            maxTokens: a.maxTokens,
            temperature: a.temperature,
            topP: 0.9,
            presencePenalty: 0.0,
            stopSeqs: ['\n```\n', '```\n'],
            ...(a.baseline === 'B' ? { stateName: STATE_NAME } : {}),
          })
          raw = out.text; promptTokens = out.promptTokens; completionTokens = out.completionTokens
        }
      }
      catch (err) {
        console.error(`  [generate error] ${String(err).slice(0, 300)}`)
        attemptLog.push({ attempt: a.name, stage: 'generate', error: String(err).slice(0, 300) })
        continue
      }
      const genMs = Date.now() - tg
      console.log(`  generated ${completionTokens} tok (prompt ${promptTokens} tok) in ${(genMs / 1000).toFixed(1)}s (${(completionTokens / (genMs / 1000)).toFixed(1)} tok/s)`)
      fs.writeFileSync(path.join(dir, 'raw.txt'), raw)
      console.log(`  raw head: ${raw.slice(0, 180).replace(/\n/g, ' ⏎ ')}${raw.length > 180 ? '…' : ''}`)

      // Extract an executable sketch.
      const sketch = extractSketch(raw)
      if (!sketch) {
        console.log('  ✗ no extractable p5 sketch in output (no createCanvas/setup block)')
        attemptLog.push({ attempt: a.name, stage: 'extract', promptTokens, completionTokens, genMs })
        continue
      }
      fs.writeFileSync(path.join(dir, 'sketch.js'), sketch)
      console.log(`  ✓ extracted sketch (${sketch.length} chars)`)

      // Render.
      let outcome
      try {
        outcome = await renderer.render({ code: sketch, size: CANVAS_SIZE, frames: 150, settleMs: 2500, timeoutMs: 45_000 })
      }
      catch (err) {
        console.error(`  [render error] ${String(err).slice(0, 300)}`)
        attemptLog.push({ attempt: a.name, stage: 'render', error: String(err).slice(0, 300) })
        continue
      }
      fs.writeFileSync(path.join(dir, 'outcome.json'), JSON.stringify({ ...outcome, dataUrl: outcome.dataUrl ? `<png ${outcome.dataUrl.length} chars>` : null }, null, 2))
      if (outcome.dataUrl) {
        const pngPath = path.join(dir, 'render.png')
        renderer.savePng(pngPath, outcome.dataUrl)
        console.log(`  render: ok=${outcome.ok} blank=${outcome.blank} ink=${(outcome.inkCoverage * 100).toFixed(1)}% struct=${outcome.structureScore.toFixed(3)} colors=${outcome.uniqueColors} frames=${outcome.framesRendered} capture=${outcome.captureStrategy} brush=${outcome.brushLoaded} (${(outcome.ms / 1000).toFixed(1)}s)`)
        if (outcome.sketchError)
          console.log(`  sketch runtime error: ${outcome.sketchError.slice(0, 200)}`)
        console.log(`  → PNG: ${pngPath}`)
        attemptLog.push({ attempt: a.name, frame: a.frame, baseline: a.baseline, temperature: a.temperature, promptTokens, completionTokens, genMs, ...outcome, dataUrl: undefined, png: path.relative(runDir, pngPath) })
        if (outcome.ok) {
          winner = { attempt: a, pngPath }
          break
        }
      }
      else {
        console.log(`  ✗ render produced no image: ${outcome.error ?? 'unknown'}`)
        attemptLog.push({ attempt: a.name, stage: 'render', ...outcome, dataUrl: undefined })
      }
    }

    // 7. Report.
    const report = {
      meta: {
        phase: '7-creative-code-canvas-smoke',
        generatedAt: new Date().toISOString(),
        modelArg,
        modelUrl,
        modelPath,
        scene,
        s0: stateInfo,
        maxTokens: maxTokensArg,
        elapsedMs: Date.now() - t0,
      },
      winner: winner ? { attempt: winner.attempt.name, pngPath: path.relative(runDir, winner.pngPath) } : null,
      attempts: attemptLog,
    }
    fs.writeFileSync(path.join(runDir, 'report.json'), JSON.stringify(report, null, 2))

    console.log('\n===== Phase 7 smoke summary =====')
    if (winner) {
      console.log(`✓ NON-BLANK RENDER achieved on attempt "${winner.attempt.name}"`)
      console.log(`  → ${winner.pngPath}`)
    }
    else {
      console.log('✗ No non-blank render in the attempt ladder — inspect raw outputs under the run dir.')
    }
    console.log(`  run dir: ${runDir}`)
  }
  finally {
    await bridge.dispose()
  }
}

main().catch((e) => {
  console.error('❌ Phase 7 smoke failed:', e?.stack || String(e))
  process.exit(1)
})
