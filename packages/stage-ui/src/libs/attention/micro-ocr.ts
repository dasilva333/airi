import type { SpatialCandidate, VerifiedCandidate } from './types'

export function sortCandidatesForOcr(candidates: SpatialCandidate[]): SpatialCandidate[] {
  return [...candidates].sort((a, b) => {
    // 1. Big containers go last
    const aIsContainer = a.category === 'macro_window' || a.category === 'sub_panel' || a.areaPercent > 10
    const bIsContainer = b.category === 'macro_window' || b.category === 'sub_panel' || b.areaPercent > 10
    if (aIsContainer && !bIsContainer)
      return 1
    if (!aIsContainer && bIsContainer)
      return -1

    // 2. Has text or is text banner comes first
    const aHasText = a.category === 'text_banner' || !!a.textSnippet || a.tags.includes('#has_text')
    const bHasText = b.category === 'text_banner' || !!b.textSnippet || b.tags.includes('#has_text')
    if (aHasText && !bHasText)
      return -1
    if (!aHasText && bHasText)
      return 1

    // 3. Higher confidence first
    if (Math.abs(b.confidence - a.confidence) > 0.05)
      return b.confidence - a.confidence

    // 4. Smaller area (more focused glyph) first
    return a.areaPercent - b.areaPercent
  })
}

export interface RunBudgetedMicroOcrOptions {
  candidates: SpatialCandidate[]
  budgetMs?: number
  cropAndRecognize: (
    candidate: SpatialCandidate,
    perCropTimeoutMs: number,
  ) => Promise<{ ocrText: string, confidence: number, cropDataUrl?: string }>
  onProgress?: (info: {
    index: number
    total: number
    candidate: SpatialCandidate
    elapsedMs: number
  }) => void
}

export interface RunBudgetedMicroOcrResult {
  results: VerifiedCandidate[]
  exitReason: string
  elapsedMs: number
}

export async function runBudgetedMicroOcr(
  options: RunBudgetedMicroOcrOptions,
): Promise<RunBudgetedMicroOcrResult> {
  const budgetMs = options.budgetMs ?? 1000
  const perCropTimeoutMs = Math.max(600, Math.round(budgetMs * 0.4))
  const startTime = performance.now()
  let exitReason = 'Budget Complete'

  const sorted = sortCandidatesForOcr(options.candidates)
  const results: VerifiedCandidate[] = []

  for (let i = 0; i < sorted.length; i++) {
    const cand = sorted[i]
    const elapsed = performance.now() - startTime

    if (elapsed >= budgetMs) {
      exitReason = `${budgetMs}ms budget reached (${Math.round(elapsed)}ms elapsed, verified ${results.length}/${sorted.length})`
      break
    }

    options.onProgress?.({
      index: i + 1,
      total: sorted.length,
      candidate: cand,
      elapsedMs: Math.round(elapsed),
    })

    const cropStart = performance.now()
    try {
      const recognized = await options.cropAndRecognize(cand, perCropTimeoutMs)
      results.push({
        ...cand,
        ocrText: recognized.ocrText,
        ocrConfidence: recognized.confidence,
        ocrLatencyMs: Math.round(performance.now() - cropStart),
        cropDataUrl: recognized.cropDataUrl,
      })
    }
    catch {
      results.push({
        ...cand,
        ocrText: cand.textSnippet || '',
        ocrConfidence: 0,
        ocrLatencyMs: Math.round(performance.now() - cropStart),
      })
    }
  }

  return {
    results,
    exitReason,
    elapsedMs: Math.round(performance.now() - startTime),
  }
}
