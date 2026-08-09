/**
 * Phase 4b: Real-time Toggle-4 topic tracking via RWKV hidden-state deltas.
 *
 * Measures whether `Δh = state(t) − state(t−1)` spikes on genuine topic shifts and
 * stays flat within a single topic — without generating any text tokens. Two runs:
 *   (A) CONTROL:  a coherent single-topic slice (candidate3 'Chloe as Girlfriend')
 *   (B) SHIFT:    candidate3 but with the mid-conversation turns reordered to force
 *                 a hard topic break (morning-coffee -> explicit -> breakfast-errand).
 *
 * Only scalars cross the bridge; the recurrent state (state_len ≈ 608256 floats)
 * is snapshotted in-browser via session.back() and deltas computed there.
 */

import fs from 'node:fs'
import path from 'node:path'

import { RwkvWebGpuBridge } from '../engine/rwkv-session.js'
import {
  cachedModelPath,
  DEFAULT_BASE_MODEL_URL,
  sanitizeChatContent,
} from '../engine/state-merger.js'

interface CorpusFile {
  candidateTitle: string
  chatTranscript: Array<{ role: string, content: string | Array<Record<string, unknown>> | null, createdAt: number }>
}

function pullText(content: CorpusFile['chatTranscript'][number]['content']): string {
  if (typeof content === 'string')
    return sanitizeChatContent(content)
  if (Array.isArray(content)) {
    return sanitizeChatContent(content.map((p) => {
      const o = p as Record<string, unknown>
      return (typeof o.text === 'string' && o.text) || (typeof o.input === 'string' && o.input) || (typeof o.output === 'string' && o.output) || ''
    }).join(' '))
  }
  return ''
}

/** Format one turn as a chat line for state ingestion (role plays a part in the state). */
function asTurn(role: string, text: string, charName: string): string {
  return `${role === 'user' ? 'User' : charName}: ${text}`
}

async function main() {
  console.log('=== RWKV Cleanroom Harness: Phase 4b Toggle-4 Real-Time Δh Tracking ===\n')

  const modelPath = cachedModelPath(DEFAULT_BASE_MODEL_URL)
  if (!fs.existsSync(modelPath))
    throw new Error(`model not cached at ${modelPath}; run pnpm test:echo-chips once to warm the cache`)

  const corpus: CorpusFile = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'test-prompts/echo-chips-corpus-candidate3.json'), 'utf8'),
  )
  const charName = corpus.candidateTitle.split(' ')[0] || 'Bot' // 'Chloe'

  // Flatten transcript into ordered chat turns (drop system, sanitize).
  const turns = corpus.chatTranscript
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => asTurn(m.role, pullText(m.content), charName))
    .filter(t => t.length > 2)

  // CONTROL: consecutive dialogue (turns 0..11) — single sustained topic (morning coffee/snuggles).
  const controlTurns = turns.slice(0, 12)

  // SHIFT: force a hard topic break. Take 6 coffee-snuggle turns, then jump to the
  // breakfast/leave-the-shack errand turns (later, distinct activity) to simulate a topic shift.
  const shiftTurns = [
    ...turns.slice(0, 6), // morning coffee / snuggles
    ...turns.slice(24, 30), // breakfast-at-cottage / carry-me errand (different scene)
  ]

  const bridge = new RwkvWebGpuBridge({ modelFilePath: modelPath })
  try {
    await bridge.boot(m => console.log(`[engine] ${m}`))
    console.log(`✓ Engine ready: state_len=${bridge.info.stateLen}\n`)

    for (const run of [
      { name: 'CONTROL (single topic: morning coffee/snuggles)', turns: controlTurns },
      { name: 'SHIFT (coffee/snuggles -> breakfast errand topic break)', turns: shiftTurns },
    ]) {
      console.log(`\n########## ${run.name} ##########`)
      await bridge.resetStateChain()
      const deltas = await bridge.measureStateDelta(run.turns)
      let maxDelta = 0
      let maxAt = -1
      deltas.forEach((d, i) => {
        const snip = run.turns[i].length > 42 ? `${run.turns[i].slice(0, 42)}…` : run.turns[i]
        const flag = i > 0 && d.deltaCosine > 0.05 ? '  <-- LARGEST' : ''
        console.log(`  turn ${String(i).padStart(2)}: Δcos=${d.deltaCosine.toFixed(4)}  ΔL2=${d.deltaL2.toFixed(2)}  | ${snip}${flag}`)
        if (i > 0 && d.deltaCosine > maxDelta) { maxDelta = d.deltaCosine; maxAt = i }
      })
      const tail = deltas.slice(1)
      const mean = tail.reduce((a, d) => a + d.deltaCosine, 0) / Math.max(1, tail.length)
      console.log(`  mean Δcos (turns>0): ${mean.toFixed(4)}  |  max Δcos at turn ${maxAt}`)
    }

    console.log('\n================ PHASE 4b SUMMARY ================')
    console.log('Deltas are computed on the FULL recurrent state (all layers, ~608k floats) — aggregate')
    console.log('per-layer analysis is the follow-up if the aggregate signal is too noisy.')
  }
  finally {
    await bridge.dispose()
  }
}

main().catch((e) => {
  console.error('❌ Phase 4b failed:', e?.stack || String(e))
  process.exit(1)
})
