/**
 * Saccade & Foveal Attention Composable Store.
 *
 * Implements the 4-Phase Saccade & Foveal Vision Pipeline in production:
 * - Phase 1: Macro Screen Decomposition via Cactus Mirage WASM
 * - Phase 2: Budgeted Targeted Micro-OCR via Tesseract.js WASM
 * - Phase 3: System-1 Cognitive Sentinel Triage via TypeSafe Jev / Laya / OpenCode Go
 * - Phase 4: Foveal 1:1 Context Extraction & Scene Description
 *
 * Emits canonical [REAL-TIME SCREEN OBSERVATION] structured markdown payloads
 * for companion consciousness and ambient observation buffers.
 */

import type {
  SpatialCandidate,
  System1TriageResult,
  TripwireQuestion,
  VerifiedCandidate,
} from '../../libs/attention'
import type { MirageAnalysisResult } from '../../libs/inference'

import { defineStore } from 'pinia'
import { createWorker } from 'tesseract.js'
import { onUnmounted, ref } from 'vue'

import {
  assembleObservationPayload,
  computeFovealCropRect,
  decomposeMacroFrame,
  runBudgetedMicroOcr,
  triageSystemOne,
  TRIPWIRE_PRESETS,
} from '../../libs/attention'
import { getMirageClient } from '../../libs/inference'
import { useSystemOneStore } from './system-one'

export interface SaccadeAttentionProcessOptions {
  dataUrl: string
  width: number
  height: number
  activeWindow?: string
  questions?: TripwireQuestion[]
  sensitivityThreshold?: number
  ocrBudgetMs?: number
  fovealPaddingPx?: number
  downscalePercent?: number
}

export interface SaccadeAttentionProcessResult {
  decision: 'PROMOTE' | 'IGNORE'
  triage: System1TriageResult
  payloadText: string
  winningCandidate: (SpatialCandidate | VerifiedCandidate) | null
  fovealCropDataUrl?: string
  fovealDimensions?: { width: number, height: number }
  candidatesCount: number
  verifiedCount: number
  latencies: {
    macroMs: number
    ocrMs: number
    systemOneMs: number
    fovealMs: number
    totalMs: number
  }
}

export const useSaccadeAttentionStore = defineStore('saccade-attention', () => {
  const systemOneStore = useSystemOneStore()
  const mirageClient = getMirageClient()

  // State
  const isProcessing = ref(false)
  const lastResult = ref<SaccadeAttentionProcessResult | null>(null)
  const lastError = ref<string | null>(null)

  // Internal Tesseract WASM Worker Lifecycle
  let ocrWorkerInstance: any = null
  let isOcrWorkerWarmedUp = false
  let ocrInitPromise: Promise<any> | null = null

  async function getOcrWorker() {
    if (ocrWorkerInstance) {
      return ocrWorkerInstance
    }
    if (ocrInitPromise) {
      return ocrInitPromise
    }

    ocrInitPromise = (async () => {
      const worker = await createWorker('eng', 1)
      if (!isOcrWorkerWarmedUp) {
        try {
          const dummyCanvas = document.createElement('canvas')
          dummyCanvas.width = 32
          dummyCanvas.height = 32
          await worker.recognize(dummyCanvas)
        }
        catch {}
        isOcrWorkerWarmedUp = true
      }
      ocrWorkerInstance = worker
      return worker
    })()

    return ocrInitPromise
  }

  onUnmounted(async () => {
    if (ocrWorkerInstance) {
      try {
        await ocrWorkerInstance.terminate()
      }
      catch {}
      ocrWorkerInstance = null
      isOcrWorkerWarmedUp = false
      ocrInitPromise = null
    }
  })

  /**
   * Helper to crop a candidate bounding box from an HTMLImageElement with dimension clamping.
   */
  async function cropCandidateCanvas(
    cand: SpatialCandidate,
    sourceImg: HTMLImageElement,
    imgW: number,
    imgH: number,
  ): Promise<{ dataUrl: string, blob: Blob | null, cropWidth: number, cropHeight: number } | null> {
    const [x1, y1, x2, y2] = cand.bbox
    const pxX = Math.max(0, Math.round((x1 / 1000) * imgW))
    const pxY = Math.max(0, Math.round((y1 / 1000) * imgH))
    let pxW = Math.max(8, Math.round(((x2 - x1) / 1000) * imgW))
    let pxH = Math.max(8, Math.round(((y2 - y1) / 1000) * imgH))

    // Max dimension clamping to prevent Tesseract WASM latency explosion
    if (pxW > 600)
      pxW = 600
    if (pxH > 140)
      pxH = 140

    if (pxX + pxW > imgW)
      pxW = Math.max(8, imgW - pxX)
    if (pxY + pxH > imgH)
      pxH = Math.max(8, imgH - pxY)

    const scale = pxH < 36 ? Math.min(2.5, Math.max(1.5, Math.round(54 / pxH))) : 1
    const targetW = Math.round(pxW * scale)
    const targetH = Math.round(pxH * scale)

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx)
      return null

    ctx.imageSmoothingEnabled = scale > 1
    if (scale > 1) {
      ;(ctx as any).imageSmoothingQuality = 'high'
    }

    ctx.drawImage(sourceImg, pxX, pxY, pxW, pxH, 0, 0, targetW, targetH)
    const dataUrl = canvas.toDataURL('image/png')
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))

    return { dataUrl, blob, cropWidth: pxW, cropHeight: pxH }
  }

  /**
   * Evaluates an incoming screenshot through the 4-phase Saccade & Foveal vision pipeline.
   */
  async function processSaccadeAttention(
    options: SaccadeAttentionProcessOptions,
  ): Promise<SaccadeAttentionProcessResult> {
    isProcessing.value = true
    lastError.value = null
    const t0 = performance.now()

    try {
      const imgW = options.width
      const imgH = options.height
      const ocrBudgetMs = options.ocrBudgetMs ?? 1000
      const fovealPaddingPx = options.fovealPaddingPx ?? 300
      const sensitivityThreshold = options.sensitivityThreshold ?? 0.70

      // Pre-load snapshot image for synchronous canvas crops
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to load screen capture snapshot'))
        img.src = options.dataUrl
      })

      // ─────────────────────────────────────────────────────────────
      // Phase 1: Macro Screen Decomposition via Cactus Mirage WASM
      // ─────────────────────────────────────────────────────────────
      const macroStart = performance.now()
      const mirageRes: MirageAnalysisResult = await mirageClient.analyzeFrame(options.dataUrl, {
        maxDimension: 768,
      })
      const candidates = decomposeMacroFrame(
        mirageRes.parsed || {},
        mirageRes.boxes || [],
      )
      const macroMs = Math.round(performance.now() - macroStart)

      // ─────────────────────────────────────────────────────────────
      // Phase 2: Budgeted Targeted Micro-OCR
      // ─────────────────────────────────────────────────────────────
      const worker = await getOcrWorker()
      const ocrStart = performance.now()
      const ocrResult = await runBudgetedMicroOcr({
        candidates,
        budgetMs: ocrBudgetMs,
        cropAndRecognize: async (cand, perCropTimeoutMs) => {
          const crop = await cropCandidateCanvas(cand, img, imgW, imgH)
          if (!crop || !crop.blob) {
            return { ocrText: cand.textSnippet || '', confidence: 0 }
          }

          const ocrPromise = worker.recognize(crop.blob)
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Per-crop OCR timeout')), perCropTimeoutMs),
          )
          const recRes: any = await Promise.race([ocrPromise, timeoutPromise])

          const rawText = String(recRes?.data?.text || '').trim().replace(/[\r\n]+/g, ' ')
          const cleanText = rawText.replace(/[^\w\s.,!?:;@#\-/]/g, '').trim()
          const confidence = typeof recRes?.data?.confidence === 'number'
            ? Math.round(recRes.data.confidence)
            : 80

          return {
            ocrText: cleanText || cand.textSnippet || '',
            confidence,
            cropDataUrl: crop.dataUrl,
          }
        },
      })
      const ocrMs = Math.round(performance.now() - ocrStart)

      // ─────────────────────────────────────────────────────────────
      // Phase 3: System-1 Cognitive Sentinel Gating
      // ─────────────────────────────────────────────────────────────
      const s1Start = performance.now()
      const activeQuestions = options.questions && options.questions.length > 0
        ? options.questions
        : TRIPWIRE_PRESETS

      const triage = await triageSystemOne({
        verifiedCandidates: ocrResult.results,
        allCandidates: candidates,
        questions: activeQuestions,
        sensitivityThreshold,
        executeSystemOne: systemOneStore.configured
          ? (statePayload, schema) => systemOneStore.execute(statePayload, schema)
          : undefined,
      })
      const s1Ms = Math.round(performance.now() - s1Start)

      // ─────────────────────────────────────────────────────────────
      // Phase 4: Foveal 1:1 Context Extraction & Scene Description
      // ─────────────────────────────────────────────────────────────
      let fovealMs = 0
      let fovealCropDataUrl: string | undefined
      let fovealDimensions: { width: number, height: number } | undefined
      let fovealSceneDescription = '(System-1 did not trigger foveal fixation)'

      const winner = triage.winningCandidate
      if (winner && triage.triggered) {
        const f0 = performance.now()
        const rect = computeFovealCropRect(winner.bbox, imgW, imgH, fovealPaddingPx)
        fovealDimensions = { width: rect.sw, height: rect.sh }

        const fovCanvas = document.createElement('canvas')
        fovCanvas.width = rect.sw
        fovCanvas.height = rect.sh
        const fovCtx = fovCanvas.getContext('2d')
        if (fovCtx) {
          fovCtx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, rect.sw, rect.sh)
          fovealCropDataUrl = fovCanvas.toDataURL('image/png')

          const fovAnalysis = await mirageClient.analyzeFrame(fovealCropDataUrl, {
            prompt: 'Describe the primary visual subject, media player, and activity in this focused region.',
            nativeResolution: true,
          })

          fovealSceneDescription = fovAnalysis.sceneDescription
            || fovAnalysis.parsed?.reasoning
            || fovAnalysis.ocrSnippet
            || 'Focused visual media player and interactive content interface'
        }
        fovealMs = Math.round(performance.now() - f0)
      }

      // Assemble canonical [REAL-TIME SCREEN OBSERVATION] Markdown bundle
      const payloadText = assembleObservationPayload({
        windowTitle: options.activeWindow || 'Desktop',
        question: triage.matchedQuestion?.question,
        triage,
        fovealDimensions,
        fovealSceneDescription,
        verifiedCandidates: ocrResult.results,
        totalCandidatesCount: candidates.length,
      })

      const totalMs = Math.round(performance.now() - t0)
      const decision = triage.triggered ? 'PROMOTE' : 'IGNORE'

      const result: SaccadeAttentionProcessResult = {
        decision,
        triage,
        payloadText,
        winningCandidate: winner,
        fovealCropDataUrl,
        fovealDimensions,
        candidatesCount: candidates.length,
        verifiedCount: ocrResult.results.length,
        latencies: {
          macroMs,
          ocrMs,
          systemOneMs: s1Ms,
          fovealMs,
          totalMs,
        },
      }

      lastResult.value = result
      return result
    }
    catch (err: any) {
      const msg = err?.message || String(err)
      lastError.value = msg
      throw err
    }
    finally {
      isProcessing.value = false
    }
  }

  return {
    isProcessing,
    lastResult,
    lastError,
    processSaccadeAttention,
  }
})
