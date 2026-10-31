export const QTYPES: Record<string, number> = { choice: 0, score: 1, noul: 2 }

export function toInternal(q: any) {
  let crit = q.criteria
  if (q.type === 'choice' && Array.isArray(crit)) {
    crit = Object.fromEntries(crit.map((c: string) => [c, null]))
  }
  return {
    t: q.type,
    ins: typeof q.instructions === 'string' ? q.instructions : JSON.stringify(q.instructions),
    crit,
  }
}

export function renderOptions(q: any): string[] {
  if (q.t === 'choice') {
    return Object.entries(q.crit).map(([k, v]) => (v ? `${k}: ${v}` : k))
  }
  if (q.t === 'score') {
    const crit = Array.isArray(q.crit)
      ? q.crit
      : (q.crit ? Object.values(q.crit) : ['level 0', 'level 1', 'level 2', 'level 3'])
    return crit.map((c: any, i: number) => `level ${i}: ${c}`)
  }
  const c = q.crit ?? {}
  return [`false: ${c.false || 'no, the statement does not hold'}`, `true: ${c.true || 'yes, the statement holds'}`]
}

function pyJsonDumps(v: any): string {
  if (v === null || v === undefined)
    return 'null'
  if (typeof v === 'string')
    return JSON.stringify(v)
  if (typeof v === 'number')
    return Number.isInteger(v) ? String(v) : JSON.stringify(v)
  if (typeof v === 'boolean')
    return v ? 'true' : 'false'
  if (Array.isArray(v))
    return `[${v.map(pyJsonDumps).join(', ')}]`
  return `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${pyJsonDumps(x)}`).join(', ')}}`
}

export function serializeState(state: any): string {
  return typeof state === 'string' ? state : pyJsonDumps(state)
}

export function softmax(z: number[]): number[] {
  const zmax = Math.max(...z)
  const e = z.map(v => Math.exp(v - zmax))
  const sum = e.reduce((a, b) => a + b, 0)
  return e.map(v => v / sum)
}

export function confidenceFromProbs(p: number[]): number {
  const k = p.length
  if (k < 2)
    return 1
  let ent = 0
  for (const x of p)
    ent -= x * Math.log(Math.max(x, 1e-12))
  return 1 - ent / Math.log(k)
}

export const DEFAULT_TEMPERATURES: Record<string, number> = {
  'choice:2': 1.9063563346862793,
  'choice:3-5': 1.7601518630981445,
  'choice:6-10': 1.0000158548355103,
  'choice:11+': 0.10058280825614929,
  'score:3-5': 1.2514300346374512,
  'noul:2': 1.983399510383606,
}

export function tempBucket(qtype: string, k: number): string {
  const size = k <= 2 ? '2' : k <= 5 ? '3-5' : k <= 10 ? '6-10' : '11+'
  return `${qtype}:${size}`
}

const round4 = (x: number) => Math.round(x * 1e4) / 1e4

export function decodeAnswers(
  logits: Float32Array,
  items: Array<{ q: any, markers: number[], qtype: number }>,
  kMax: number,
  qids: string[],
): Record<string, any> {
  const answers: Record<string, any> = {}
  items.forEach((it, r) => {
    const qid = qids[r]
    const k = it.markers.length
    const slice = Array.from(logits.subarray(r * kMax, r * kMax + k))
    const temp = DEFAULT_TEMPERATURES[tempBucket(it.q.t, k)] ?? 1.0
    const p = softmax(slice.map(v => v / temp))
    const q = it.q

    if (q.t === 'choice') {
      const keys = Object.keys(q.crit)
      const best = p.indexOf(Math.max(...p))
      answers[qid] = {
        type: 'choice',
        choice: keys[best] || 'unknown',
        probabilities: Object.fromEntries(keys.map((kk, idx) => [kk, round4(p[idx] ?? 0)])),
        confidence: round4(confidenceFromProbs(p)),
      }
    }
    else if (q.t === 'score') {
      answers[qid] = {
        type: 'score',
        score: round4(p.reduce((s, v, idx) => s + idx * v, 0)),
        probabilities: Object.fromEntries(p.map((v, idx) => [String(idx), round4(v)])),
        confidence: round4(confidenceFromProbs(p)),
      }
    }
    else {
      answers[qid] = {
        type: 'noul',
        noul: round4(p[1] ?? 0),
        confidence: round4(confidenceFromProbs(p)),
      }
    }
  })
  return answers
}

export const OPENJEV_MAX_SUBSTANTIVE_CANDIDATES = 24
export const OPENJEV_INSUFFICIENT_EVIDENCE_ID = '__insufficient_evidence__'
export const OPENJEV_INSUFFICIENT_EVIDENCE_DESC = 'insufficient evidence'

export const OPENJEV_PER_K_TEMPERATURES: Record<number, number> = {
  2: 5.0069,
  3: 5.0069,
  4: 4.0314,
  5: 3.0560,
  6: 2.3898,
  7: 2.3898,
  9: 1.6668,
  11: 3.3919,
  17: 1.7200,
  25: 1.5144,
}
export const OPENJEV_DEFAULT_TEMPERATURE = 2.8039

export interface OpenJevPreparedItem {
  q: any
  prompt: string
  ids: string[]
  labels: string[]
  qtype: 'choice' | 'score' | 'noul'
  min?: number
  max?: number
  levelsCount?: number
}

export function prepareOpenJevItem(qInput: any, state: any): OpenJevPreparedItem {
  const qType = qInput.type || 'choice'
  const ins = typeof qInput.instructions === 'string' ? qInput.instructions : JSON.stringify(qInput.instructions || '')
  const context = serializeState(state)

  if (qType === 'choice') {
    let rawOptions: Array<{ id: string, desc: string }> = []
    if (Array.isArray(qInput.criteria)) {
      rawOptions = qInput.criteria.map((c: string) => ({ id: String(c), desc: String(c) }))
    }
    else if (qInput.criteria && typeof qInput.criteria === 'object') {
      rawOptions = Object.entries(qInput.criteria).map(([id, desc]) => ({
        id: String(id),
        desc: desc ? String(desc) : String(id),
      }))
    }

    if (rawOptions.length > OPENJEV_MAX_SUBSTANTIVE_CANDIDATES) {
      console.warn(`[OpenJev] Option count truncated from ${rawOptions.length} to ${OPENJEV_MAX_SUBSTANTIVE_CANDIDATES} candidates.`)
      rawOptions = rawOptions.slice(0, OPENJEV_MAX_SUBSTANTIVE_CANDIDATES)
    }

    const ids = rawOptions.map(o => o.id)
    const labels = rawOptions.map(o => o.desc)
    ids.push(OPENJEV_INSUFFICIENT_EVIDENCE_ID)
    labels.push(OPENJEV_INSUFFICIENT_EVIDENCE_DESC)

    const labelPrefix = labels.map(l => `<<LABEL>>${l}`).join('')
    const questionText = ins ? `Question: ${ins}\n\nContext:\n${context}` : context
    const prompt = `${labelPrefix}<<SEP>>${questionText}`

    return {
      q: qInput,
      prompt,
      ids,
      labels,
      qtype: 'choice',
    }
  }

  if (qType === 'score') {
    let crit = qInput.criteria
    if (!crit) {
      crit = ['level 0', 'level 1', 'level 2', 'level 3']
    }
    const rawLevels = Array.isArray(crit)
      ? crit
      : Object.entries(crit).map(([k, v]) => `${k}: ${v}`)

    const levels = rawLevels.slice(0, OPENJEV_MAX_SUBSTANTIVE_CANDIDATES)
    const ids = levels.map((_: any, i: number) => String(i))
    const labels = levels.map((lvl: any, i: number) => `${lvl} (Value: ${i})`)

    ids.push(OPENJEV_INSUFFICIENT_EVIDENCE_ID)
    labels.push(OPENJEV_INSUFFICIENT_EVIDENCE_DESC)

    const labelPrefix = labels.map(l => `<<LABEL>>${l}`).join('')
    const questionText = ins ? `Question: ${ins}\n\nContext:\n${context}` : context
    const prompt = `${labelPrefix}<<SEP>>${questionText}`

    return {
      q: qInput,
      prompt,
      ids,
      labels,
      qtype: 'score',
      min: typeof qInput.min === 'number' ? qInput.min : undefined,
      max: typeof qInput.max === 'number' ? qInput.max : undefined,
      levelsCount: levels.length,
    }
  }

  // noul
  const proposition = ins || context
  const labels = [`true: ${proposition}`, `false: not ${proposition}`, OPENJEV_INSUFFICIENT_EVIDENCE_DESC]
  const ids = ['true', 'false', OPENJEV_INSUFFICIENT_EVIDENCE_ID]

  const labelPrefix = labels.map(l => `<<LABEL>>${l}`).join('')
  const questionText = `Context:\n${context}\n\nEvaluate proposition: ${proposition}`
  const prompt = `${labelPrefix}<<SEP>>${questionText}`

  return {
    q: qInput,
    prompt,
    ids,
    labels,
    qtype: 'noul',
  }
}

export function decodeOpenJevAnswers(
  logits: Float32Array,
  items: OpenJevPreparedItem[],
  qids: string[],
): Record<string, any> {
  const answers: Record<string, any> = {}
  const outDim = Math.floor(logits.length / Math.max(1, items.length))

  items.forEach((it, r) => {
    const qid = qids[r]
    const k = it.ids.length
    const rowOffset = r * outDim
    const slice = Array.from(logits.subarray(rowOffset, rowOffset + k))
    const temp = OPENJEV_PER_K_TEMPERATURES[k] ?? OPENJEV_DEFAULT_TEMPERATURE
    const p = softmax(slice.map(v => v / temp))

    if (it.qtype === 'choice') {
      const bestIdx = p.indexOf(Math.max(...p))
      const choiceId = it.ids[bestIdx] || it.ids[0]

      answers[qid] = {
        type: 'choice',
        choice: choiceId,
        probabilities: Object.fromEntries(it.ids.map((id, idx) => [id, round4(p[idx] ?? 0)])),
        confidence: round4(confidenceFromProbs(p)),
      }
    }
    else if (it.qtype === 'score') {
      const count = it.levelsCount || (it.ids.length - 1)
      const subProbs = p.slice(0, count)
      const subSum = subProbs.reduce((a, b) => a + b, 0) || 1
      const norm = subProbs.map(v => v / subSum)

      let scoreVal: number
      if (it.min !== undefined && it.max !== undefined) {
        const ratio = norm.reduce((s, v, i) => s + (i / Math.max(1, count - 1)) * v, 0)
        scoreVal = it.min + ratio * (it.max - it.min)
      }
      else {
        scoreVal = norm.reduce((s, v, i) => s + i * v, 0)
      }

      answers[qid] = {
        type: 'score',
        score: round4(scoreVal),
        probabilities: Object.fromEntries(it.ids.map((id, idx) => [id, round4(p[idx] ?? 0)])),
        confidence: round4(confidenceFromProbs(p)),
      }
    }
    else {
      const pTrue = p[0] ?? 0
      const pFalse = p[1] ?? 0
      const cond = (pTrue + pFalse) > 0 ? pTrue / (pTrue + pFalse) : 0.5

      answers[qid] = {
        type: 'noul',
        noul: round4(cond),
        confidence: round4(confidenceFromProbs(p)),
        probabilities: Object.fromEntries(it.ids.map((id, idx) => [id, round4(p[idx] ?? 0)])),
      }
    }
  })

  return answers
}
