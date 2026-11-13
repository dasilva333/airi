import type { SpatialCandidate, System1TriageResult, TripwireQuestion, VerifiedCandidate } from './types'

export const TRIPWIRE_PRESETS: TripwireQuestion[] = [
  {
    id: 'video',
    label: 'Video / Stream Watching',
    question: 'Did the user start watching a notable video, live stream, or music release?',
    sensitivity: 0.70,
  },
  {
    id: 'error',
    label: 'Compiler / Build Error',
    question: 'Did the user encounter a compiler error, broken build, failing test run, or terminal exception?',
    sensitivity: 0.80,
  },
  {
    id: 'chat',
    label: 'Direct Messaging / Chat',
    question: 'Is the user messaging, chatting, or collaborating with a friend or colleague?',
    sensitivity: 0.75,
  },
  {
    id: 'novelty',
    label: 'Novelty & Social Events',
    question: 'Did a notable, unexpected, or socially meaningful event occur on screen that warrants conversation?',
    sensitivity: 0.75,
  },
]

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
  if ((lowerQ.includes('error') || lowerQ.includes('build') || lowerQ.includes('exception'))
    && /error|exception|fail|warn|crash|fatal|undefined|null|syntaxerror/i.test(lowerText)) {
    score += 0.35
  }
  if ((lowerQ.includes('video') || lowerQ.includes('stream') || lowerQ.includes('music'))
    && /video|youtube|play|stream|watch|live|podcast|music/i.test(lowerText)) {
    score += 0.35
  }
  if ((lowerQ.includes('chat') || lowerQ.includes('messag') || lowerQ.includes('collaborat'))
    && /chat|message|dm|discord|slack|telegram|reply/i.test(lowerText)) {
    score += 0.35
  }
  if (tags.includes('#action_button') || tags.includes('#heading'))
    score += 0.10

  return Math.min(0.95, score)
}

export interface TriageSystemOneOptions {
  verifiedCandidates: VerifiedCandidate[]
  allCandidates: SpatialCandidate[]
  question?: string
  questions?: TripwireQuestion[]
  sensitivityThreshold?: number
  executeSystemOne?: (state: Record<string, any>, schema: Record<string, any>) => Promise<any>
}

export async function triageSystemOne(
  options: TriageSystemOneOptions,
): Promise<System1TriageResult> {
  const startTime = performance.now()
  const defaultSensitivity = options.sensitivityThreshold ?? 0.65

  const activeQuestions: TripwireQuestion[] = options.questions && options.questions.length > 0
    ? options.questions
    : [{
        id: 'default',
        label: 'Active Tripwire',
        question: options.question || TRIPWIRE_PRESETS[3].question,
        sensitivity: defaultSensitivity,
      }]

  const pool = options.verifiedCandidates.length > 0
    ? options.verifiedCandidates
    : options.allCandidates

  if (pool.length === 0) {
    return {
      winningCandidate: null,
      matchedQuestion: activeQuestions[0],
      questionScores: {},
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
  let matchedQuestion: TripwireQuestion = activeQuestions[0]
  const questionScores: Record<string, number> = {}
  let triggered = false
  let triggerConfidence = 0
  let triageReason = ''
  let usedFallback = false

  if (options.executeSystemOne) {
    try {
      const statePayload = {
        observation_candidates: candidateSummaries,
        tripwire_questions: activeQuestions.map(q => ({ id: q.id, label: q.label, question: q.question })),
      }

      const criteria: Record<string, string> = {}
      for (const c of candidateSummaries) {
        criteria[c.id] = `${c.label} in ${c.zone}${c.text ? ` ("${c.text.slice(0, 60)}")` : ''}`
      }

      // Single-pass parallel classification heads: one noul head per question + focal_candidate choice head
      const schema: Record<string, any> = {
        focal_candidate: {
          type: 'choice',
          instructions: 'Which UI candidate is the primary focal point for this observation?',
          criteria,
        },
      }
      for (const q of activeQuestions) {
        schema[`q_${q.id}`] = {
          type: 'noul',
          instructions: q.question,
        }
      }

      const res = await options.executeSystemOne(statePayload, schema)

      let bestProb = -1
      for (const q of activeQuestions) {
        const prob = res?.answers?.[`q_${q.id}`]?.noul ?? 0.0
        questionScores[q.id] = prob
        if (prob > bestProb) {
          bestProb = prob
          matchedQuestion = q
        }
      }

      triggerConfidence = Math.max(0, bestProb)
      const threshold = matchedQuestion.sensitivity ?? defaultSensitivity
      triggered = triggerConfidence >= threshold

      const chosenId = res?.answers?.focal_candidate?.choice
      const found = pool.find(c => c.id === chosenId)
      if (found)
        winningCandidate = found

      triageReason = `System-1 evaluated ${activeQuestions.length}Q x ${candidateSummaries.length}C -> [${matchedQuestion.label}] ${winningCandidate.id} (${Math.round(triggerConfidence * 100)}%)`
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
    for (const q of activeQuestions) {
      let bestForQ = -1
      for (const cand of pool) {
        const text = ('ocrText' in cand && typeof cand.ocrText === 'string' && cand.ocrText) ? cand.ocrText : (cand.textSnippet || '')
        const score = computeLocalTripwireScore(`${cand.label} ${text}`, q.question, cand.tags)
        if (score > bestForQ)
          bestForQ = score
        if (score > bestScore) {
          bestScore = score
          winningCandidate = cand
          matchedQuestion = q
        }
      }
      questionScores[q.id] = Math.max(0, bestForQ)
    }
    triggerConfidence = Math.max(0, bestScore)
    const threshold = matchedQuestion.sensitivity ?? defaultSensitivity
    triggered = triggerConfidence >= threshold
    if (!triageReason)
      triageReason = `Local heuristic [${matchedQuestion.label}] scored ${winningCandidate.id} at ${Math.round(triggerConfidence * 100)}%`
  }

  return {
    winningCandidate,
    matchedQuestion,
    questionScores,
    triggered,
    triggerConfidence,
    triageReason,
    latencyMs: Math.round(performance.now() - startTime),
    usedFallback,
  }
}
