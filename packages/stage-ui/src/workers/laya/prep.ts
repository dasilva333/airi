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
    return (q.crit as string[]).map((c: string, i: number) => `level ${i}: ${c}`)
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

/** Attention heads of the ModernBERT-large encoder behind Laya. */
const LAYA_ATTENTION_HEADS = 16

/**
 * Budget for the graph's `[batch, heads, L, L]` fp32 attention tensor.
 *
 * NOTICE: onnxruntime-web WebGPU fails once that single buffer passes the
 * adapter's `maxBufferSize` (2 GiB on the RX 9070 XT, the WebGPU default):
 * "Buffer size 2415919104 exceeds the max buffer size limit" at L = 6144, and an
 * integer overflow at L = 8192. Stay well under it; this is also why one
 * `session.run` over many long questions has to be split.
 */
export const LAYA_ATTENTION_BUDGET_BYTES = 1.5 * 2 ** 30

/**
 * Groups questions (by index, original order kept) into batches whose padded
 * attention tensor fits `budgetBytes`. A single over-budget question still gets
 * its own batch; the sequence cap keeps that case from happening.
 */
export function planLayaBatches(lengths: number[], budgetBytes = LAYA_ATTENTION_BUDGET_BYTES): number[][] {
  const batches: number[][] = []
  let current: number[] = []
  let longest = 0
  const bytes = (count: number, len: number) => count * LAYA_ATTENTION_HEADS * len * len * 4
  lengths.forEach((len, i) => {
    const nextLongest = Math.max(longest, len)
    if (current.length > 0 && bytes(current.length + 1, nextLongest) > budgetBytes) {
      batches.push(current)
      current = []
      longest = 0
    }
    current.push(i)
    longest = Math.max(longest, len)
  })
  if (current.length > 0)
    batches.push(current)
  return batches
}
