/**
 * Phase 3: Echo Chips Offline Synthesis vs. Ground-Truth Baseline.
 *
 * Feeds three real AIRI chat transcripts (with cloud-generated ground-truth
 * chips) into the 0.1B RWKV-7 base model over a Brave WebGPU bridge, parses the
 * raw output through a repair ladder + production normalization + valibot
 * schema, and scores semantic agreement against ground truth.
 *
 * Pipeline: corpus -> window+prompt (production-mirrored) -> WebGPU generate
 *           -> parse (repair ladder) -> score (5 metrics) -> report.
 *
 * Run: pnpm test:echo-chips
 * Optional: RWKV_HARNESS_BROWSER=/path/to/chrome to override the browser.
 */

import type { CorpusMessage } from '../engine/state-merger.js'

import fs from 'node:fs'
import path from 'node:path'

import { scoreBadge, scoreSession } from '../engine/metrics.js'
import { parseEchoChips, REPAIR_STAGES } from '../engine/parse.js'
import { RwkvWebGpuBridge } from '../engine/rwkv-session.js'
import {
  buildEchoChipsPrompt,
  buildEchoChipsPromptADB,
  buildEvidenceWindow,
  buildWindowMessages,
  cachedModelPath,

  DEFAULT_BASE_MODEL_URL,
  fetchTensorBinary,
} from '../engine/state-merger.js'

interface CorpusFile {
  candidateTitle: string
  sessionId: string
  cutoffIsoDate?: string
  chatTranscript: CorpusMessage[]
  groundTruthChips: { pills: Array<Record<string, unknown>> }
}

interface DecodingConfig {
  name: string
  temperature: number
  topP: number
  presencePenalty: number
  /** Lever D: G1 `<think></think` prefill. Disabled for scaffolded frames. */
  g1Prefill: boolean
  maxTokens: number
  /** Prompt frame: 'baseline' (production chat prompt) or 'ADB' (Lever A/B/D scaffold). */
  promptFrame: 'baseline' | 'ADB'
  /** Phase 4: grammar-constrain the `type` value to the enum via logit mask. */
  constrainTypeEnum?: boolean
}

/** Lever A completion-prefix scaffold — the model begins mid-string. */
const ADB_SCAFFOLD = '{"pills":[{"content":"'
/** Phase 4: the enum mapping production's ChipSchema picklist. */
const ENUM_TYPE_VALUES = ['mood', 'flavor', 'journal_candidate']

// Decoding configs to sweep. Structured extraction != roleplay decoding; the
// roleplay preset uses presence_pen 1.5 which will actively suppress the JSON
// schema tokens, so all extraction configs use presence_pen 0.0.
const CONFIGS: DecodingConfig[] = [
  // Phase-3 controls (committed reference runs).
  { name: 'baseline-mid', promptFrame: 'baseline', g1Prefill: true, temperature: 0.7, topP: 0.9, presencePenalty: 0.0, maxTokens: 512 },
  { name: 'adb-mid', promptFrame: 'ADB', g1Prefill: false, temperature: 0.7, topP: 0.9, presencePenalty: 0.0, maxTokens: 512 },
  // Phase 4: A+D+B + grammar constraint on the `type` enum (temp 0.7 — the only frame that parsed).
  { name: 'adbc-mid', promptFrame: 'ADB', g1Prefill: false, temperature: 0.7, topP: 0.9, presencePenalty: 0.0, maxTokens: 512, constrainTypeEnum: true },
  { name: 'adbc-low', promptFrame: 'ADB', g1Prefill: false, temperature: 0.3, topP: 0.9, presencePenalty: 0.0, maxTokens: 512, constrainTypeEnum: true },
]

// CLI flags:
//   --fast        run only candidate3 (smallest, 33 msgs, fits context) as smoke
//   --candidates=3  or =1,2  explicit subset
//   --system      include the roleplay system prompt as a System: turn (A/B).
//                 Default OFF: production passes the extraction block as a single
//                 user message with NO system role, and a 4-43k roleplay system
//                 would dominate the 8k context and bias the model to roleplay
//                 rather than emit JSON.
const argv = process.argv.slice(2)
const FLAG_FAST = argv.includes('--fast')
const FLAG_SYSTEM = argv.includes('--system')
const candArg = argv.find(a => a.startsWith('--candidates='))
const CANDIDATES: number[] = FLAG_FAST
  ? [3]
  : (candArg ? candArg.split('=')[1].split(',').map(s => Number(s.trim())).filter(n => [1, 2, 3].includes(n)) : [1, 2, 3])

const GATES = {
  schema: 0.90,
  similarity: 0.75,
  precision: 0.70,
  typeAgreement: 0.80,
  relevance: 0.15,
}

async function main() {
  console.log('=== RWKV Cleanroom Harness: Phase 3 Echo Chips Ground-Truth Eval ===\n')

  // 1. Warm the disk cache (instant after first download).
  await fetchTensorBinary(DEFAULT_BASE_MODEL_URL)
  const modelPath = cachedModelPath(DEFAULT_BASE_MODEL_URL)
  console.log(`✓ Base model cached at ${modelPath}\n`)

  // 2. Load candidate corpora (union schema — actual files use top-level fields).
  const corpora: CorpusFile[] = CANDIDATES.map((n) => {
    const fp = path.resolve(process.cwd(), `test-prompts/echo-chips-corpus-candidate${n}.json`)
    return JSON.parse(fs.readFileSync(fp, 'utf8'))
  })

  // 3. Boot the WebGPU bridge once; reuse the warm session across all runs.
  const bridge = new RwkvWebGpuBridge({ modelFilePath: modelPath })
  const t0 = Date.now()

  try {
    await bridge.boot(m => console.log(`[engine] ${m}`))
    console.log(`✓ Engine booted: state_len=${bridge.info.stateLen}, tensors=${bridge.info.numTensors}\n`)

    const allReports: any[] = []

    for (const cfg of CONFIGS) {
      console.log(`\n########## Decoding config: ${cfg.name} (temp=${cfg.temperature}, top_p=${cfg.topP}, presence_pen=${cfg.presencePenalty}) ##########`)
      const sessionScores: any[] = []
      const repairHist: Record<string, number> = Object.fromEntries(REPAIR_STAGES.map(s => [s, 0]))

      for (const corpus of corpora) {
        const title = corpus.candidateTitle
        const sysMsg = corpus.chatTranscript.find(m => m.role === 'system')
        const systemText = typeof sysMsg?.content === 'string' ? sysMsg.content : undefined
        const charName = 'Bot' // evidence speaker for assistant turns (prod uses card.name)

        // Window + sanitize exactly like production. The evidence window is
        // truncated oldest-first to fit the 8192-token ctx (~24k char budget).
        const windowMessages = buildWindowMessages(corpus.chatTranscript, 80)
        const evidenceWindow = buildEvidenceWindow(windowMessages, charName)
        const linesUsed = evidenceWindow ? evidenceWindow.split('\n').length : 0
        const truncatedFrom = windowMessages.length

        console.log(`\n--- ${title} [${cfg.promptFrame}${cfg.constrainTypeEnum ? '+constrain' : ''}] (windowed ${truncatedFrom} msgs -> ${linesUsed} evidence lines; evidenceChars=${evidenceWindow.length}) ---`)
        const t = Date.now()
        let rawText = ''
        let promptTokens = 0
        let completionTokens = 0
        try {
          if (cfg.promptFrame === 'ADB') {
            // Lever A completion-mode: body ends at `Output:`; append the scaffold so
            // the model continues mid-string; reassemble scaffold+continuation.
            const body = buildEchoChipsPromptADB(evidenceWindow, charName)
            const out = await bridge.generateRaw({
              prompt: body + ADB_SCAFFOLD,
              maxTokens: cfg.maxTokens,
              temperature: cfg.temperature,
              topP: cfg.topP,
              presencePenalty: cfg.presencePenalty,
              g1Prefill: false,
              ...(cfg.constrainTypeEnum ? { constrainEnum: { key: '"type"', values: ENUM_TYPE_VALUES } } : {}),
            })
            rawText = ADB_SCAFFOLD + out.text
            promptTokens = out.promptTokens
            completionTokens = out.completionTokens
          }
          else {
            // baseline: production chat-shaped prompt.
            const prompt = buildEchoChipsPrompt(evidenceWindow, charName)
            const out = await bridge.generate({
              prompt,
              system: FLAG_SYSTEM ? systemText : undefined,
              maxTokens: cfg.maxTokens,
              temperature: cfg.temperature,
              topP: cfg.topP,
              presencePenalty: cfg.presencePenalty,
              g1Prefill: cfg.g1Prefill,
            })
            rawText = out.text
            promptTokens = out.promptTokens
            completionTokens = out.completionTokens
          }
        }
        catch (err) {
          console.error('  [generate error]', String(err).slice(0, 200))
          repairHist['5-schema-failure']++
          continue
        }
        const elapsedMs = Date.now() - t
        console.log(`  raw (${completionTokens} tok, ${elapsedMs} ms): ${rawText.slice(0, 220).replace(/\n/g, ' ')}${rawText.length > 220 ? '…' : ''}`)

        // 4. Parse + repair ladder (reassembled scaffold+continuation for ADB).
        const parsed = parseEchoChips(rawText)
        repairHist[parsed.stage]++
        console.log(`  parse stage: ${parsed.stage}  ->  ${parsed.pills.length} pill(s)`)
        for (const p of parsed.pills)
          console.log(`    ${scoreBadge(0)} ${p.content}  [${p.type}]  score=${p.relevanceScore.toFixed(2)}`)

        // 5. Score against ground truth.
        const score = scoreSession(
          corpus.sessionId || title,
          parsed.pills,
          corpus.groundTruthChips.pills,
        )
        ;(score as any).elapsedMs = elapsedMs
        ;(score as any).promptTokens = promptTokens
        ;(score as any).completionTokens = completionTokens
        ;(score as any).promptFrame = cfg.promptFrame
        ;(score as any).constrainTypeEnum = !!cfg.constrainTypeEnum
        console.log(
          `  sim=${score.evidenceSpannedSimilarity.toFixed(3)} prec=${score.precision.toFixed(3)} `
          + `f1=${score.meanTokenF1.toFixed(3)} type=${score.typeAgreement.toFixed(2)} `
          + `rel=${score.relevanceCalibration.toFixed(2)} matched=${score.gtMatched}/${score.gtTotal} `
          + `${score.divergenceFlag ? '⚠DIVERGENCE' : ''}`,
        )
        sessionScores.push(score)
      }

      // Aggregate per config.
      const n = Math.max(1, sessionScores.length)
      const schemaOk = repairHist['1-direct-json-parse'] + repairHist['2-brace-substring'] + repairHist['3-codefence-strip'] + repairHist['4-regex-pill-salvage']
      const configReport = {
        configName: cfg.name,
        sessionsRun: sessionScores.length,
        schemaOkSessions: schemaOk,
        schemaCompliance: schemaOk / n,
        meanSimilarity: sessionScores.reduce((a, s) => a + s.evidenceSpannedSimilarity, 0) / n,
        meanPrecision: sessionScores.reduce((a, s) => a + s.precision, 0) / n,
        meanTokenF1: sessionScores.reduce((a, s) => a + s.meanTokenF1, 0) / n,
        meanTypeAgreement: sessionScores.reduce((a, s) => a + s.typeAgreement, 0) / n,
        meanRelevanceCalibration: sessionScores.reduce((a, s) => a + s.relevanceCalibration, 0) / n,
        totalGt: sessionScores.reduce((a, s) => a + s.gtTotal, 0),
        totalGtMatched: sessionScores.reduce((a, s) => a + s.gtMatched, 0),
        divergentSessions: sessionScores.filter(s => s.divergenceFlag).length,
        repairLadder: repairHist,
        avgElapsedMs: Math.round(sessionScores.reduce((a, s) => a + (s.elapsedMs ?? 0), 0) / n),
      }
      allReports.push({ config: cfg.name, corpusVersion: '0.1.0', generatedAt: new Date().toISOString(), aggregate: configReport, sessions: sessionScores })

      console.log(`\n===== ${cfg.name} — aggregate =====`)
      console.log(`  schema compliance : ${(configReport.schemaCompliance * 100).toFixed(0)}%  (gate ${GATES.schema * 100}%)  repairLadder=${JSON.stringify(repairHist)}`)
      console.log(`  similarity        : ${configReport.meanSimilarity.toFixed(3)}  (gate ${GATES.similarity})`)
      console.log(`  precision         : ${configReport.meanPrecision.toFixed(3)}  (gate ${GATES.precision})`)
      console.log(`  type agreement    : ${configReport.meanTypeAgreement.toFixed(3)}  (gate ${GATES.typeAgreement})`)
      console.log(`  relevance calib   : ${configReport.meanRelevanceCalibration.toFixed(3)}  (gate ${GATES.relevance})`)
      console.log(`  gt coverage       : ${configReport.totalGtMatched}/${configReport.totalGt} pills matched`)
    }

    // Write report.
    const reportsDir = path.resolve(process.cwd(), 'reports')
    fs.mkdirSync(reportsDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const reportPath = path.join(reportsDir, `03-echo-chip-eval-${stamp}.json`)
    fs.writeFileSync(reportPath, JSON.stringify({ meta: { modelPath, elapsedMs: Date.now() - t0 }, reports: allReports }, null, 2))
    console.log(`\n✓ Report written to ${reportPath}`)
  }
  finally {
    await bridge.dispose()
  }
}

main().catch((e) => {
  console.error('❌ Phase 3 eval failed:', e?.stack || String(e))
  process.exit(1)
})
