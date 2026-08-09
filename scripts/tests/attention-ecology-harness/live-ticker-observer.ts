import path from 'node:path'

import { evalFrame } from './engine/stage2-salience-eval.js'
import { disposeStage3, synthesizeVisualEventSummary } from './engine/stage3-vlm-forwarder.js'

const FIXTURES_DIR = path.resolve(import.meta.dirname, 'fixtures')

const TEST_CYCLES = [
  { id: '01', name: '01-idle-terminal.png', desc: 'Idle Baseline' },
  { id: '02', name: '02-idle-terminal-subtle-cursor.png', desc: 'Subtle Cursor Shift (Stage 0 Filtered)' },
  { id: '03', name: '03-app-switch-vs-code.png', desc: 'App Switch to VS Code (Stage 1 Window Change)' },
  { id: '04', name: '04-term-error-stack.png', desc: 'Terminal Error Cascade (Stage 2 OCR Promoted)' },
  { id: '05a', name: '05a-video-frame-1.png', desc: 'Video Drift Frame 1' },
  { id: '05b', name: '05b-video-frame-2.png', desc: 'Video Drift Frame 2 (Stage 1 Centroid Muted)' },
]

console.log('='.repeat(80))
console.log('  👁️  ATTENTION ECOLOGY GUARD: LIVE TERMINAL OBSERVER & TELEMETRY')
console.log('='.repeat(80))
console.log('  Mode: Continuous Live Ticker (Press Ctrl+C to stop)\n')

let tickCount = 0
let prevPath: string | null = null
let currentCentroid: number[] | null = null

async function runTick() {
  tickCount++
  const item = TEST_CYCLES[(tickCount - 1) % TEST_CYCLES.length]
  const currentPath = path.join(FIXTURES_DIR, item.name)

  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8)
  console.log(`[${timestamp}] --- TICK #${tickCount} | Frame: ${item.name} (${item.desc}) ---`)

  const startMs = Date.now()
  const result = await evalFrame({
    framePath: currentPath,
    prevPath: prevPath ?? currentPath,
    centroid: currentCentroid,
  })
  const totalMs = Date.now() - startMs

  prevPath = currentPath
  if (result.newCentroid) {
    currentCentroid = result.newCentroid
  }

  const decisionBadge = result.decision === 'PROMOTE'
    ? '🚨 PROMOTED (HIGH SALIENCE)'
    : result.decision === 'NOTE'
      ? '📝 NOTE (QUIET DIARY)'
      : '💤 IGNORED (0-COST FILTERED)'

  console.log(`  ├─ Verdict:       ${decisionBadge}`)
  console.log(`  ├─ Stage 0 aHash:  norm=${result.ahashNorm.toFixed(4)} (threshold: 0.0050)`)
  console.log(`  ├─ Stage 1 CLIP:   novelty=${result.clipNovelty.toFixed(4)} (threshold: 0.0200)`)
  console.log(`  ├─ Stage 2 OCR:    errorHits=${result.ocrHits} (${result.ocrHits >= 2 ? 'TRIGGERED' : 'QUIET'})`)
  console.log(`  └─ Total Latency:  ${totalMs}ms`)

  if (result.decision === 'PROMOTE') {
    console.log('  ┌────────────────────────────────────────────────────────────┐')
    console.log('  │  SYNTHESIZING PROMOTION PACKET & VISUAL EVENT SUMMARY...  │')
    console.log('  └────────────────────────────────────────────────────────────┘')
    const summary = await synthesizeVisualEventSummary({
      framePath: currentPath,
      ocrHits: result.ocrHits,
    })
    console.log(summary)
  }

  console.log('')
}

// Run immediately, then repeat every 2.5 seconds
await runTick()
const interval = setInterval(async () => {
  try {
    await runTick()
  }
  catch (err) {
    console.error('Error in live ticker tick:', err)
  }
}, 2500)

process.on('SIGINT', () => {
  clearInterval(interval)
  disposeStage3()
  console.log('\n👋 Observer stopped. Clean teardown complete.')
  process.exit(0)
})
