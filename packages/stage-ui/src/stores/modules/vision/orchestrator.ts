/**
 * Vision Orchestrator Store (proposal §10).
 *
 * Routes captured frames to the selected vision workload:
 *   - `screen:attention-ecology-guard` -> the 0-cost local cascading guard
 *     (Web Worker). Promotions publish a [Visual Event] summary into the
 *     character context via `modsServerChannelStore.sendContextUpdate`.
 *   - Upstream VLM workloads (`screen:interpret`, ...) -> the existing cloud
 *     vision ingestion path (chat orchestrator with an image attachment).
 *
 * Tracks telemetry (`lastResultText/At/Error/WorkloadId`) and enforces §6
 * promotion discipline (attention budget + hysteresis cooldown).
 */

import type { AttentionGuardAdapter } from '../../../libs/inference/adapters/attention-guard'
import type { AttentionGuardProcessResult } from '../../../libs/inference/contract'
import type { SentinelQuestionConfig } from '../airi-card'

import { ContextUpdateStrategy } from '@proj-airi/server-sdk'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { ATTENTION_GUARD_WORKLOAD_ID } from '../../../composables/vision/use-vision-workloads'
import { createAttentionGuardAdapter } from '../../../libs/inference/adapters/attention-guard'
import { useChatOrchestratorStore } from '../../chat'
import { useEntityLedgerStore } from '../../entity-ledger'
import { useLLM } from '../../llm'
import { useModsServerChannelStore } from '../../mods/api/channel-server'
import { useProvidersStore } from '../../providers'
import { useLiveSessionStore } from '../live-session'
import { useSystemOneStore } from '../system-one'
import { useVisionStore } from '../vision'

export { ATTENTION_GUARD_WORKLOAD_ID, useVisionWorkloads, VISION_WORKLOADS } from '../../../composables/vision/use-vision-workloads'

/** §6: maximum unsolicited promotions per rolling hour. */
const ATTENTION_BUDGET_PER_HOUR = 3
/** §6: hysteresis cooldown after a promotion (threshold spikes, then decays). */
const HYSTERESIS_COOLDOWN_MS = 60_000

export interface ChronoLogEntry {
  timestamp: number
  activeWindow?: string
  caption: string
  rawOcrSnippet?: string
}

export interface VisionCapturePayload {
  /** Base64/URL-encoded capture frame. */
  dataUrl: string
  width: number
  height: number
  sourceId: string
  workloadId: string
  timestamp: number
  interestTags?: string[]
  enableVlm?: boolean
  vlmTier?: 'lightweight' | 'moondream' | 'external'
  gatingMode?: 'trigger_tags' | 'system1_sentinel'
  sentinelProvider?: 'laya-local' | 'typesafe-ai' | 'openrouter-ai'
  sentinelModel?: string
  sentinelQuestions?: SentinelQuestionConfig[]
  sentinelPolicy?: 'any' | 'all'
  sentinelThreshold?: number
  sentinelEvidenceEnabled?: boolean
  activeWindow?: string
}

const CHRONO_LOG_MAX_ENTRIES = 5
const chronoLogBuffer: ChronoLogEntry[] = []

export function appendChronoLogEntry(entry: ChronoLogEntry): void {
  chronoLogBuffer.push(entry)
  while (chronoLogBuffer.length > CHRONO_LOG_MAX_ENTRIES) {
    chronoLogBuffer.shift()
  }
}

export function getChronoLogEntries(): readonly ChronoLogEntry[] {
  return chronoLogBuffer
}

export function clearChronoLog(): void {
  chronoLogBuffer.length = 0
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function enrichChronoLogWithEntities(
  chronoEntries: ChronoLogEntry[],
): Promise<{ formattedHistory: string, attachedEvidence: string[] }> {
  const attachedEvidence: string[] = []
  const now = Date.now()

  try {
    const entityLedgerStore = useEntityLedgerStore()
    const combinedText = chronoEntries.map(e => `${e.activeWindow || ''} ${e.caption}`).join(' ')

    const entities = entityLedgerStore.entities || []
    if (entities.length > 0) {
      const matched = entities.filter((entity) => {
        if (!entity.label)
          return false
        const labelRegex = new RegExp(`\\b${escapeRegExp(entity.label)}\\b`, 'i')
        if (labelRegex.test(combinedText))
          return true
        if (entity.mentions) {
          for (const mention of entity.mentions) {
            if (mention && new RegExp(`\\b${escapeRegExp(mention)}\\b`, 'i').test(combinedText))
              return true
          }
        }
        return false
      })

      const claims = entityLedgerStore.claims || []
      for (const ent of matched.slice(0, 3)) {
        const relatedClaims = claims
          .filter(c => c.subject === ent.label || c.object === ent.label)
          .slice(0, 2)
          .map(c => `${c.subject} ${c.predicate} ${c.object}`)

        const contextDetail = relatedClaims.length > 0
          ? relatedClaims.join('; ')
          : (ent.attributes?.summary || ent.attributes?.relationship || 'Recognized entity in memory')

        attachedEvidence.push(`- Entity: ${ent.label} (${ent.type || 'Entity'}). Context: ${contextDetail}`)
      }
    }
  }
  catch (e) {
    console.warn('[Vision Orchestrator] Entity ledger scan error:', e)
  }

  const formattedHistory = chronoEntries.map((e) => {
    const elapsedSec = Math.max(0, Math.round((now - e.timestamp) / 1000))
    const windowPrefix = e.activeWindow ? `[App: ${e.activeWindow}] ` : ''
    return `[${elapsedSec}s ago] ${windowPrefix}${e.caption}`
  }).join('\n')

  return {
    formattedHistory,
    attachedEvidence,
  }
}

export interface VisionOrchestratorResult {
  decision: 'IGNORE' | 'NOTE' | 'PROMOTE' | 'BASELINE'
  summary?: string
  novelty?: number
  ocrErrorPatternHits?: number
  ocrErrorPatterns?: string[]
  interestKeywordHits?: number
  interestKeywords?: string[]
}

export const useVisionOrchestratorStore = defineStore('vision-orchestrator', () => {
  const modsServerChannelStore = useModsServerChannelStore()

  // Telemetry
  const lastResultText = ref('')
  const lastResultAt = ref<number>(0)
  const lastError = ref<string | null>(null)
  const lastWorkloadId = ref<string>('')

  // §6 promotion discipline state
  const promotionTimes: number[] = []
  const lastPromotionAt = ref<number>(0)

  // Provisioning state
  const isProvisioning = ref(false)
  const provisioningPercent = ref<number>(0)
  const provisioningMessage = ref<string>('')
  const provisioningPhase = ref<'idle' | 'downloading' | 'compiling' | 'ready' | 'error'>('idle')
  const isLightweightReady = ref(false)
  const isVlmReady = ref(false)

  // Guard adapter (lazy)
  let guardAdapter: AttentionGuardAdapter | null = null
  let guardLoadPromise: Promise<void> | null = null

  function ensureGuardAdapter(): AttentionGuardAdapter {
    if (!guardAdapter)
      guardAdapter = createAttentionGuardAdapter()
    return guardAdapter
  }

  async function ensureGuardLoaded(options?: {
    enableVlm?: boolean
    forceReload?: boolean
    onProgress?: (p: any) => void
    signal?: AbortSignal
  }): Promise<AttentionGuardAdapter> {
    const adapter = ensureGuardAdapter()
    const needsReload = Boolean(options?.forceReload)
      || (Boolean(options?.enableVlm) && !adapter.lastLoadConfig?.enableVlm)

    if (!needsReload && (adapter.state === 'ready' || adapter.state === 'processing')) {
      if (options?.enableVlm) {
        isVlmReady.value = true
        isLightweightReady.value = true
      }
      else {
        isLightweightReady.value = true
      }
      return adapter
    }

    if (!guardLoadPromise || adapter.state === 'idle' || adapter.state === 'error' || adapter.state === 'terminated' || needsReload) {
      guardLoadPromise = (async () => {
        try {
          await adapter.load({
            enableVlm: options?.enableVlm,
            signal: options?.signal,
            onProgress: (p) => {
              if (p.phase === 'warmup' || (typeof p.percent === 'number' && p.percent >= 100)) {
                provisioningPhase.value = 'compiling'
                provisioningPercent.value = 100
                provisioningMessage.value = p.message || 'Compiling WebGPU shaders & warming up model…'
              }
              else if (typeof p.percent === 'number' && p.percent >= 0) {
                provisioningPhase.value = 'downloading'
                const candidate = Math.min(99, Math.round(p.percent))
                provisioningPercent.value = Math.max(provisioningPercent.value, candidate)
                provisioningMessage.value = p.message || `Downloading shards (${provisioningPercent.value}%)...`
              }
              else if (p.message) {
                provisioningMessage.value = p.message
              }
              options?.onProgress?.(p)
            },
          })
          if (options?.enableVlm) {
            isVlmReady.value = true
            isLightweightReady.value = true
          }
          else {
            isLightweightReady.value = true
          }
          provisioningPhase.value = 'ready'
        }
        catch (err: any) {
          provisioningPhase.value = 'error'
          lastError.value = `guard load failed: ${err.message || String(err)}`
          throw err
        }
        finally {
          guardLoadPromise = null
        }
      })()
    }

    await guardLoadPromise
    return adapter
  }

  async function provisionModels(options: { enableVlm?: boolean }): Promise<void> {
    if (isProvisioning.value)
      return

    isProvisioning.value = true
    provisioningPercent.value = 0
    provisioningPhase.value = 'downloading'
    provisioningMessage.value = options.enableVlm
      ? 'Downloading and compiling Moondream2 VLM (~1.1GB)...'
      : 'Downloading and compiling Lightweight models (CLIP + Tesseract ~307MB)...'

    try {
      await ensureGuardLoaded({
        enableVlm: options.enableVlm,
        forceReload: true,
      })
      provisioningPercent.value = 100
      provisioningPhase.value = 'ready'
      provisioningMessage.value = options.enableVlm
        ? 'Moondream2 VLM primed & ready for real-time commentary.'
        : 'Lightweight OCR & CLIP engine primed and ready.'
    }
    catch (err: any) {
      provisioningPhase.value = 'error'
      provisioningMessage.value = `Provisioning failed: ${err.message || String(err)}`
      throw err
    }
    finally {
      isProvisioning.value = false
    }
  }

  /** True when the §6 promotion budget + hysteresis cooldown allow a publish. */
  function promotionAllowed(now = Date.now()): boolean {
    if (now - lastPromotionAt.value < HYSTERESIS_COOLDOWN_MS)
      return false
    const windowStart = now - 60 * 60 * 1000
    while (promotionTimes.length > 0 && promotionTimes[0] < windowStart) promotionTimes.shift()
    return promotionTimes.length < ATTENTION_BUDGET_PER_HOUR
  }

  function recordPromotion(): void {
    const now = Date.now()
    lastPromotionAt.value = now
    promotionTimes.push(now)
  }

  /** Publish a promotion summary into character context (ReplaceSelf). */
  function publishContext(summary: string, workloadId: string, sourceId: string): void {
    modsServerChannelStore.sendContextUpdate({
      strategy: ContextUpdateStrategy.ReplaceSelf,
      contextId: `vision:${workloadId}:${sourceId}`,
      text: summary,
      metadata: { kind: 'vision', workload: workloadId },
    })
  }

  /** Cloud VLM path: existing chat-orchestrator ingestion with the frame attached. */
  async function runCloudWorkload(payload: VisionCapturePayload): Promise<void> {
    const chatOrchestrator = useChatOrchestratorStore()
    const base64 = payload.dataUrl.split(',')[1] ?? payload.dataUrl
    await chatOrchestrator.ingest('You are acting as a continuous ambient vision observer. Observe the screen and describe anything interesting, relevant, or notable. Stay in character.', {
      attachments: [
        {
          type: 'image',
          data: base64,
          mimeType: 'image/png',
          fileName: 'screenshot.png',
          size: 0,
        },
      ],
    })
  }

  /**
   * Route one captured frame through the selected workload. The guard path
   * returns the cascade result; the cloud path ingests via the chat
   * orchestrator (promotions surface through the normal reply flow).
   */
  async function processCapture(payload: VisionCapturePayload): Promise<VisionOrchestratorResult | null> {
    lastWorkloadId.value = payload.workloadId

    if (payload.workloadId === ATTENTION_GUARD_WORKLOAD_ID) {
      try {
        const isMoondream = payload.vlmTier === 'moondream' || (Boolean(payload.enableVlm) && payload.vlmTier !== 'external')
        const adapter = await ensureGuardLoaded({ enableVlm: isMoondream })
        const tags = Array.isArray(payload.interestTags) ? Array.from(payload.interestTags).map(t => String(t)) : []
        const result: AttentionGuardProcessResult = await adapter.process(
          payload.dataUrl,
          payload.width,
          payload.height,
          tags,
        )

        lastResultAt.value = Date.now()
        lastError.value = null

        const currentCaption = result.caption
          || (result.summary ? result.summary.replace(/\[Visual Event\]\s*/g, '').trim() : '')
          || (result.ocrErrorPatterns?.length ? `Terminal/code patterns: ${result.ocrErrorPatterns.join(', ')}` : '')
          || (result.interestKeywords?.length ? `Keywords: ${result.interestKeywords.join(', ')}` : 'Screen activity observed')

        if (result.decision !== 'IGNORE') {
          appendChronoLogEntry({
            timestamp: payload.timestamp || Date.now(),
            activeWindow: payload.activeWindow,
            caption: currentCaption,
          })
        }

        // System-1 Cognitive Sentinel evaluation
        if (payload.gatingMode === 'system1_sentinel') {
          const systemOneStore = useSystemOneStore()
          const activeQuestions = (payload.sentinelQuestions || []).filter(q => q.enabled)

          if (activeQuestions.length > 0 && systemOneStore.configured) {
            try {
              const { formattedHistory, attachedEvidence } = payload.sentinelEvidenceEnabled !== false
                ? await enrichChronoLogWithEntities(chronoLogBuffer)
                : {
                    formattedHistory: chronoLogBuffer.map(e => `[${Math.max(0, Math.round((Date.now() - e.timestamp) / 1000))}s ago] ${e.activeWindow ? `[${e.activeWindow}] ` : ''}${e.caption}`).join('\n'),
                    attachedEvidence: [],
                  }

              const stateText = [
                `CURRENT SCREEN OBSERVATION:`,
                currentCaption,
                `\nRECENT VISUAL CHRONO-LOG (LAST ${chronoLogBuffer.length} FRAMES):`,
                formattedHistory || `[0s ago] ${currentCaption}`,
                attachedEvidence.length > 0 ? `\nRELEVANT ENTITY & RELATIONAL EVIDENCE:\n${attachedEvidence.join('\n')}` : '',
              ].filter(Boolean).join('\n')

              const questionsMap: Record<string, { type: 'noul', instructions: string }> = {}
              for (const q of activeQuestions) {
                questionsMap[q.id] = {
                  type: 'noul',
                  instructions: `Given this screen observation and historical context, evaluate truth probability: ${q.text}`,
                }
              }

              console.log(`[Vision Orchestrator] ⚡ Evaluating System-1 Sentinel (${activeQuestions.length} tripwires, provider=${payload.sentinelProvider || 'laya-local'})...`)
              const res = await systemOneStore.execute(
                stateText,
                questionsMap,
                payload.sentinelModel,
              )

              let shouldPromote = false
              let maxConfidence = 0
              let triggeringQuestionText = ''
              const fallbackThreshold = payload.sentinelThreshold ?? 0.75

              if (payload.sentinelPolicy === 'all') {
                shouldPromote = activeQuestions.every((q) => {
                  const ans = res.answers?.[q.id]
                  const prob = ans?.noul ?? 0
                  const targetThreshold = q.threshold ?? fallbackThreshold
                  return prob >= targetThreshold
                })
                if (shouldPromote) {
                  triggeringQuestionText = 'All sentinel conditions satisfied'
                  maxConfidence = Math.min(...activeQuestions.map(q => res.answers?.[q.id]?.noul ?? 0))
                }
              }
              else {
                // Default: 'any'
                for (const q of activeQuestions) {
                  const ans = res.answers?.[q.id]
                  const prob = ans?.noul ?? 0
                  const targetThreshold = q.threshold ?? fallbackThreshold
                  if (prob >= targetThreshold) {
                    shouldPromote = true
                    if (prob > maxConfidence) {
                      maxConfidence = prob
                      triggeringQuestionText = q.text
                    }
                  }
                }
              }

              if (shouldPromote) {
                result.decision = 'PROMOTE'
                result.summary = `[System-1 Sentinel Alert: "${triggeringQuestionText}" (${Math.round(maxConfidence * 100)}%)]\n${currentCaption}`
                console.log(`[Vision Orchestrator] 🚨 System-1 Sentinel TRIPWIRE TRIGGERED: "${triggeringQuestionText}" (${Math.round(maxConfidence * 100)}% >= threshold)`)
              }
              else {
                result.decision = 'NOTE'
              }
            }
            catch (sentinelErr) {
              console.warn('[Vision Orchestrator] System-1 Sentinel evaluation failed, falling back to heuristic tags:', sentinelErr)
            }
          }
        }

        if (result.decision === 'PROMOTE') {
          // If external VLM tier is selected, query the global VLM for a rich scene caption
          if (payload.vlmTier === 'external') {
            try {
              const visionStore = useVisionStore()
              const providersStore = useProvidersStore()
              const llmStore = useLLM()

              if (visionStore.activeProvider && visionStore.activeModel) {
                const vlmProvider = await providersStore.getProviderInstance(visionStore.activeProvider) as any
                const base64 = payload.dataUrl.includes(',') ? payload.dataUrl.split(',')[1] : payload.dataUrl
                const prompt = 'Observe this screenshot and describe what is happening in 1-2 concise, objective sentences. Mention any visible applications, active tasks, code, games, or errors. Do not use conversational filler or speak as a character.'

                const vlmMessages = [
                  {
                    role: 'user' as const,
                    content: [
                      { type: 'text', text: prompt },
                      {
                        type: 'image_url' as const,
                        image_url: {
                          url: `data:image/png;base64,${base64}`,
                        },
                      },
                    ],
                  },
                ]

                console.log(`[Vision Orchestrator] Requesting external VLM (${visionStore.activeProvider}/${visionStore.activeModel}) caption for promoted event...`)
                const vlmResponse = await llmStore.generate(
                  visionStore.activeModel,
                  vlmProvider,
                  vlmMessages as any,
                  { vision: true },
                )

                const caption = vlmResponse.text?.trim().replace(/^["']|["']$/g, '').replace(/\r?\n+/g, ' ').trim()
                if (caption) {
                  result.caption = caption
                  if (result.summary && result.summary.includes('[Visual Event]')) {
                    const lines = result.summary.split('\n')
                    const matchIdx = lines.findIndex(l => l.startsWith('Matched Interests:'))
                    const insertIdx = matchIdx >= 0 ? matchIdx + 1 : (lines.length > 1 ? 2 : lines.length)
                    lines.splice(insertIdx, 0, `Screen Content Tags: ${caption}`)
                    result.summary = lines.join('\n')
                  }
                  else {
                    result.summary = `[Visual Event]\nScreen Content Tags: ${caption}${result.summary ? `\n${result.summary}` : ''}`
                  }
                  useLiveSessionStore().recordInferenceUsage(vlmResponse.usage)
                }
              }
              else {
                console.warn('[Vision Orchestrator] External VLM tier selected, but no global vision provider/model is configured in Vision Settings.')
              }
            }
            catch (vlmErr: any) {
              console.warn('[Vision Orchestrator] External VLM caption failed, keeping deterministic summary:', vlmErr)
            }
          }

          lastResultText.value = result.summary ?? `[Visual Event] (${result.ocrErrorPatterns.join(', ')})`
          if (result.summary && promotionAllowed()) {
            publishContext(result.summary, payload.workloadId, payload.sourceId)
            recordPromotion()
          }
        }
        else {
          lastResultText.value = `${result.decision} (novelty=${result.novelty.toFixed(4)})`
        }

        return {
          decision: result.decision,
          summary: result.summary,
          novelty: result.novelty,
          ocrErrorPatternHits: result.ocrErrorPatternHits,
          ocrErrorPatterns: result.ocrErrorPatterns,
          interestKeywordHits: result.interestKeywordHits,
          interestKeywords: result.interestKeywords,
        }
      }
      catch (err: any) {
        lastError.value = err.message || String(err)
        throw err
      }
    }

    // Upstream cloud VLM workloads -> existing ingestion path.
    try {
      await runCloudWorkload(payload)
      lastResultText.value = 'cloud vision ingestion dispatched'
      lastResultAt.value = Date.now()
      lastError.value = null
      return { decision: 'NOTE' }
    }
    catch (err: any) {
      lastError.value = err.message || String(err)
      throw err
    }
  }

  function terminate(): void {
    guardAdapter?.terminate()
    guardAdapter = null
    guardLoadPromise = null
  }

  return {
    lastResultText,
    lastResultAt,
    lastError,
    lastWorkloadId,
    isProvisioning,
    provisioningPercent,
    provisioningMessage,
    provisioningPhase,
    isLightweightReady,
    isVlmReady,
    provisionModels,
    processCapture,
    publishContext,
    terminate,
    ensureGuardLoaded,
  }
})
