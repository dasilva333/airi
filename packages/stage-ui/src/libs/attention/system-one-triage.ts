import type { SpatialCandidate, System1TriageResult, VerifiedCandidate } from './types'

export function computeLocalTripwireScore(text: string, question: string, tags: string[]): number {
  const lowerText = text.toLowerCase()
  const lowerQ = question.toLowerCase()
  let score = 0.25

  // Direct keyword overlap
  const qWords = lowerQ.split(/\W+/).filter(w => w.length > 3)
  let matches = 0
  for (const w of qWords) {
    if (lowerText.includes(w))
      matches++
  }
  if (matches > 0)
    score += Math.min(0.45, matches * 0.15)

  // Error / alert / action signals
  if (/error|exception|fail|warn|crash|fatal|undefined|null/i.test(lowerText))
    score += 0.30
  if (/video|youtube|play|stream|watch|live|chat|message|dm|discord/i.test(lowerText))
    score += 0.20
  if (tags.includes('#action_button') || tags.includes('#heading'))
    score += 0.10

  return Math.min(0.95, score)
}

export interface TriageSystemOneOptions {
  verifiedCandidates: VerifiedCandidate[]
  allCandidates: SpatialCandidate[]
  question: string
  sensitivityThreshold?: number
  executeSystemOne?: (state: Record<string, any>, schema: Record<string, any>) => Promise<any>
}

export async function triageSystemOne(
  options: TriageSystemOneOptions,
): Promise<System1TriageResult> {
  const startTime = performance.now()
  const sensitivityThreshold = options.sensitivityThreshold ?? 0.65

  const pool = options.verifiedCandidates.length > 0
    ? options.verifiedCandidates
    : options.allCandidates

  if (pool.length === 0) {
    return {
      winningCandidate: null,
      triggered: false,
      triggerConfidence: 0,
      triageReason: 'No spatial candidates available for triage.',
      latencyMs: Math.round(performance.now() - startTime),
      usedFallback: true,
    }
  }

  const candidateSummaries = pool.slice(0, 12).map(c => ({
    id: c.id,
    label: c.label,
    zone: c.zone,
    text: ('ocrText' in c && typeof c.ocrText === 'string' && c.ocrText) ? c.ocrText : (c.textSnippet || ''),
    tags: c.tags.join(', '),
  }))

  let winningCandidate: VerifiedCandidate | SpatialCandidate = pool[0]
  let triggered = false
  let triggerConfidence = 0
  let triageReason = ''
  let usedFallback = false

  if (options.executeSystemOne) {
    try {
      const statePayload = {
        observation_candidates: candidateSummaries,
        tripwire_question: options.question,
      }

      const criteria: Record<string, string> = {}
      for (const c of candidateSummaries) {
        criteria[c.id] = `${c.label} in ${c.zone}${c.text ? ` ("${c.text.slice(0, 60)}")` : ''}`
      }

      const res = await options.executeSystemOne(statePayload, {
        tripwire_triggered: {
          type: 'noul',
          instructions: options.question,
        },
        focal_candidate: {
          type: 'choice',
          instructions: 'Which UI candidate is the primary focal point for this observation?',
          criteria,
        },
      })

      triggerConfidence = res?.answers?.tripwire_triggered?.noul ?? 0.0
      triggered = triggerConfidence >= sensitivityThreshold

      const chosenId = res?.answers?.focal_candidate?.choice
      const found = pool.find(c => c.id === chosenId)
      if (found)
        winningCandidate = found

      triageReason = `System-1 Jev evaluated ${candidateSummaries.length} candidates -> ${winningCandidate.id} (${Math.round(triggerConfidence * 100)}%)`
    }
    catch (err: any) {
      usedFallback = true
      triageReason = `System-1 fallback (${err?.message || 'provider error'})`
    }
  }
  else {
    usedFallback = true
  }

  if (usedFallback) {
    let bestScore = -1
    for (const cand of pool) {
      const text = ('ocrText' in cand && cand.ocrText) ? cand.ocrText : (cand.textSnippet || '')
      const score = computeLocalTripwireScore(`${cand.label} ${text}`, options.question, cand.tags)
      if (score > bestScore) {
        bestScore = score
        winningCandidate = cand
      }
    }
    triggerConfidence = Math.max(0, bestScore)
    triggered = triggerConfidence >= sensitivityThreshold
    if (!triageReason)
      triageReason = `Local heuristic scored ${winningCandidate.id} at ${Math.round(triggerConfidence * 100)}%`
  }

  return {
    winningCandidate,
    triggered,
    triggerConfidence,
    triageReason,
    latencyMs: Math.round(performance.now() - startTime),
    usedFallback,
  }
}
