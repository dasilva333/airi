/**
 * Benchmark Script: Needle 3 Chain-of-Thought (CoT) Spoken Aside Pivot Detection
 *
 * Compares Fast vs. Balanced vs. Full configurations across:
 * - Latency (ms) / Token throughput
 * - Extracted pivot phrase / candidate detection (WASM neural tool vs Hybrid regex fallback)
 * - Candidate quality for spoken asides
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const CACHE_DIR = path.join(os.homedir(), '.cache', 'needle3')
const WASM_PATH = path.join(CACHE_DIR, 'cactus.wasm')
const JS_PATH = path.join(CACHE_DIR, 'cactus.js')
const CACT_PATH = path.join(CACHE_DIR, 'needle3.cact')

const COT_PIVOT_TOOL = {
  name: 'record_cot_pivot',
  description: 'Extract a concise 2-8 word turning point or spoken aside realization from internal reasoning.',
  parameters: {
    type: 'object',
    properties: {
      pivot: {
        type: 'string',
        description: 'Short 2 to 8 word pivot phrase, e.g. "Wait, actually...", "The key nuance is...", "Hold on, let me reconsider..."',
      },
    },
    required: ['pivot'],
  },
}

// 3 Realistic Synthetic Chain-of-Thought Monologues
const SCENARIOS = [
  {
    id: 'Scenario 1: Algorithmic Recurrence Pivot',
    cot: `Let's trace the dynamic programming array. If dp[i][j] represents the minimum edits... wait, we need to handle the base case where one string is empty. Let's see, if len is 0, the cost is just insertion. Wait, actually, the inner loop indices are shifted by 1. That changes the recurrence relation completely. Let me recalculate the step transition from i-1 to j.`,
  },
  {
    id: 'Scenario 2: Narrative Nuance & Tone Balancing',
    cot: `The user is asking if I prefer cats or dogs, but earlier they mentioned having three rescue kittens named Mochi, Taro, and Boba. If I say dogs, that might sound cold and disconnected from their personal story. On the other hand, if I blindly agree just to flatter them, it lacks personality. Hold on, let me strike a playful balance between acknowledging their rescue kittens while keeping my own cheeky character preference.`,
  },
  {
    id: 'Scenario 3: Async Race Condition Root-Cause',
    cot: `Examining the stack trace: Task 802 rejected with timeout error. Why did the timer not clear? The setTimeout was invoked inside Promise.race, but the abortController listener was attached on line 315. But wait, if the storage lookup is asynchronous, the clock advances before the timeout is registered on the virtual queue. The key nuance is the microtask scheduling order. Let's break this down step by step.`,
  },
]

// Fallback neural-grammar extractor from packages/stage-ui/src/workers/needle/worker.ts
const pivotPatterns = [
  /\b(?:no\s+)?wait[,\s—-]+([^.\n?!]{4,80})/i,
  /\b(?:actually|in\s+fact)[,\s—-]+([^.\n?!]{4,80})/i,
  /\b(?:however|on\s+the\s+other\s+hand)[,\s—-]+([^.\n?!]{4,80})/i,
  /\b(?:hold|hang)\s+on[,\s—-]+([^.\n?!]{4,80})/i,
  /\blet(?:'s|\s+me)\s+(?:actually\s+)?(?:think|see|check|consider|examine|re-?evaluate|reconsider|break)[,\s—:]+([^.\n?!]{4,80})/i,
  /\b(?:ah+|oh+|hm{2,})[,\s—-]+([^.\n?!]{4,80})/i,
  /\bthe\s+(?:key|nuance|catch|distinction|difference)\s+is[,\s—-]+([^.\n?!]{4,80})/i,
  /\b(?:there's\s+research|evidence\s+shows|studies\s+show)[,\s—-]+([^.\n?!]{4,80})/i,
  /\b(?:on\s+second\s+thought|come\s+to\s+think\s+of\s+it)[,\s—-]+([^.\n?!]{4,80})/i,
  /\b(?:interestingly|notably|surprisingly)[,\s—-]+([^.\n?!]{4,80})/i,
]

function extractCotPivotFallback(snippet) {
  for (const regex of pivotPatterns) {
    const match = snippet.match(regex)
    if (match && match[0]) {
      let phrase = match[0].trim()
      phrase = phrase.replace(/[^\w\s',.-]/g, ' ')
      const words = phrase.split(/\s+/).filter(Boolean)
      phrase = words.length > 8 ? words.slice(0, 8).join(' ') : words.join(' ')
      if (phrase.length >= 6) {
        return `${phrase.charAt(0).toUpperCase() + phrase.slice(1).replace(/[.,]+$/, '')}...`
      }
    }
  }
  return null
}

const CONFIGURATIONS = [
  {
    name: 'Instant Heuristic (Sub-1ms)',
    isFallback: true,
    threads: 0,
    maxTokens: 0,
    windowChars: 400,
    description: 'Deterministic neural-grammar regex fallback for zero-latency instant spoken aside dispatch',
  },
  {
    name: 'Fast WASM (Budget 64, 1 Thread)',
    isFallback: false,
    threads: 1,
    maxTokens: 64,
    windowChars: 200,
    description: 'Minimal token budget & single WASM thread for low CPU footprint',
  },
  {
    name: 'Balanced WASM (Budget 80, 2 Threads)',
    isFallback: false,
    threads: 2,
    maxTokens: 80,
    windowChars: 400,
    description: 'Standard 2-thread WASM execution with full CoT phrase extraction',
  },
  {
    name: 'Full WASM (Budget 100, 4 Threads)',
    isFallback: false,
    threads: 4,
    maxTokens: 100,
    windowChars: 800,
    description: 'Maximum 4-thread CPU parallelism across entire reasoning window',
  },
]

async function runBenchmark() {
  console.log('='.repeat(80))
  console.log(' NEEDLE 3 / CACTUS WASM: COT SPOKEN ASIDE PIVOT BENCHMARK')
  console.log('='.repeat(80))

  if (!fs.existsSync(WASM_PATH) || !fs.existsSync(CACT_PATH)) {
    console.error('Error: Cactus assets not found in ~/.cache/needle3.')
    process.exit(1)
  }

  const createCactus = require(JS_PATH)
  const wasmBinary = fs.readFileSync(WASM_PATH)
  const cactBinary = fs.readFileSync(CACT_PATH)

  console.log('-> Instantiating Cactus WASM runtime...')
  const Module = await createCactus({
    wasmBinary,
    locateFile: f => path.join(CACHE_DIR, f),
  })

  const cactus_load = Module.cwrap('cactus_load', 'number', ['number', 'number'])
  const cactus_init = Module.cwrap('cactus_init', 'number', ['string', 'string', 'string'])
  const cactus_complete = Module.cwrap('cactus_complete', 'number', ['string', 'number', 'number', 'number', 'number', 'number'])
  const cactus_reset = Module.cwrap('cactus_reset', 'void', [])
  const cactus_set_threads = Module.cwrap('cactus_set_threads', 'void', ['number'])
  const cactus_last_error = Module.cwrap('cactus_last_error', 'string', [])

  console.log('-> Loading Needle 3 weights into WASM linear memory...')
  const cactPtr = Module._malloc(cactBinary.length)
  Module.HEAPU8.set(cactBinary, cactPtr)
  const loadRet = Module._cactus_load(cactPtr, BigInt(cactBinary.length))
  Module._free(cactPtr)

  if (loadRet !== 0) {
    console.warn(`[Warning] cactus_load returned code: ${loadRet} (${cactus_last_error()})`)
  }

  const outCap = 16384
  const outPtr = Module._malloc(outCap)

  // Initialize tool with explicit system instruction
  const sysPrompt = 'You are an on-device pacing engine. Extract the pivot realization as a spoken aside using record_cot_pivot.'
  const toolsJson = JSON.stringify([COT_PIVOT_TOOL])
  cactus_init(sysPrompt, toolsJson, '')

  console.log('-> Needle 3 ready. Running side-by-side benchmark across scenarios...\n')

  const results = []

  for (const scenario of SCENARIOS) {
    console.log('-'.repeat(80))
    console.log(`SCENARIO: ${scenario.id}`)
    console.log(`FULL REASONING SNIPPET: "${scenario.cot}"\n`)

    for (const config of CONFIGURATIONS) {
      const snippet = scenario.cot.slice(-config.windowChars)

      if (config.isFallback) {
        const t0 = performance.now()
        const pivot = extractCotPivotFallback(snippet)
        const elapsed = (performance.now() - t0).toFixed(3)

        results.push({
          scenario: scenario.id,
          config: config.name,
          latency: `${elapsed} ms`,
          pivot: pivot || '(none detected)',
          tps: 'Instant (>1M/s)',
        })

        console.log(`  [${config.name}]`)
        console.log(`    Latency:      ${elapsed} ms`)
        console.log(`    Pivot Output: "${pivot || '(none detected)'}"\n`)
        continue
      }

      // WASM execution
      cactus_set_threads(config.threads)
      const query = `Reasoning text: ${snippet}\n\nTask: Extract a concise spoken pivot phrase using record_cot_pivot.`

      // Reset and execute
      cactus_reset()
      const t0 = performance.now()
      cactus_complete(query, 0, 0, config.maxTokens, outPtr, outCap)
      const elapsed = (performance.now() - t0).toFixed(1)

      const lastOutput = Module.UTF8ToString(outPtr)
      let extractedPivot = null
      let decodeTps = null
      let reasoningSnippet = null

      try {
        const parsed = JSON.parse(lastOutput)
        if (parsed.decode_tps)
          decodeTps = `${parsed.decode_tps.toFixed(1)} tok/s`
        if (parsed.reasoning)
          reasoningSnippet = parsed.reasoning

        const calls = (Array.isArray(parsed?.function_calls) && parsed.function_calls.length > 0)
          ? parsed.function_calls
          : (Array.isArray(parsed?.suppressed_calls) && parsed.suppressed_calls.length > 0)
              ? parsed.suppressed_calls
              : []

        if (calls.length > 0 && calls[0].arguments?.pivot) {
          extractedPivot = calls[0].arguments.pivot
        }
      }
      catch (err) {
        console.warn('    Parse error:', err)
      }

      results.push({
        scenario: scenario.id,
        config: config.name,
        latency: `${elapsed} ms`,
        pivot: extractedPivot ? `"${extractedPivot}"` : '(truncated/exhausted)',
        tps: decodeTps || 'N/A',
      })

      console.log(`  [${config.name}]`)
      console.log(`    Latency:      ${elapsed} ms (Decode: ${decodeTps || 'N/A'})`)
      console.log(`    Reasoning:    ${reasoningSnippet ? `"${reasoningSnippet.slice(0, 50)}..."` : '(none)'}`)
      console.log(`    Pivot Output: ${extractedPivot ? `"${extractedPivot}"` : '(truncated/exhausted)'}\n`)
    }
  }

  Module._free(outPtr)

  console.log('='.repeat(80))
  console.log(' BENCHMARK SUMMARY TABLE')
  console.log('='.repeat(80))
  console.table(results.map(r => ({
    'Scenario': r.scenario.split(':')[0],
    'Profile': r.config.split(' ')[0],
    'Latency': r.latency,
    'Throughput': r.tps,
    'Detected Spoken Aside': r.pivot,
  })))
}

runBenchmark().catch((err) => {
  console.error('Benchmark error:', err)
  process.exit(1)
})
