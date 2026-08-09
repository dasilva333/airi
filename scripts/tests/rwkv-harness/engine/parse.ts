/**
 * Phase 3 parse + repair ladder + schema validation.
 *
 * Measures how often a 0.1B RWKV model emits parseable Echo Chips JSON, and how
 * far down a 5-stage repair ladder we must go to recover it. The repair ladder
 * is instrumental (not the fix) — the headline metric is which stage succeeded.
 *
 * After JSON extraction we replay the SAME normalization + schema validation
 * production applies in `synthesizeForCharacter`:
 *   - alias mapping (pill/title/text→content, category/type→type, etc.)
 *   - `normalizeChipType` (mood/journal/event/flavor heuristics)
 *   - relevanceScore coercion + clamp to [0,1] (default 0.8)
 *   - evidence_indices filtered to finite integers
 *   - valibot `ArtifactsSchema` safeParse
 *
 * Valibot version is pinned to match the app catalog (1.2.0) so schema semantics
 * are identical to production.
 */

import * as v from 'valibot'

import { pillText } from './metrics.js'

/* -------------------------------------------------------------------------- */
/* Schema (valibot — exact shape of production `ChipSchema`/`ArtifactsSchema`) */
/* -------------------------------------------------------------------------- */

const ChipSchema = v.object({
  content: v.string(),
  type: v.picklist(['mood', 'flavor', 'journal_candidate']),
  relevanceScore: v.number(),
  evidence_indices: v.optional(v.array(v.number())),
})

const ArtifactsSchema = v.object({
  pills: v.array(ChipSchema),
})

export interface ValidatedPill {
  content: string
  type: 'mood' | 'flavor' | 'journal_candidate'
  relevanceScore: number
  evidence_indices: number[]
}

/* -------------------------------------------------------------------------- */
/* Production normalizeChipType (echo-chips.ts) — mirrored verbatim            */
/* -------------------------------------------------------------------------- */

function normalizeChipType(input: unknown): 'mood' | 'flavor' | 'journal_candidate' {
  const raw = String(input ?? '').toLowerCase().trim()
  if (!raw)
    return 'flavor'
  if (raw.includes('mood'))
    return 'mood'
  if (raw.includes('journal') || raw.includes('event'))
    return 'journal_candidate'
  return 'flavor'
}

/* -------------------------------------------------------------------------- */
/* Repair ladder                                                               */
/* -------------------------------------------------------------------------- */

export const REPAIR_STAGES = [
  '1-direct-json-parse',
  '2-brace-substring',
  '3-codefence-strip',
  '4-regex-pill-salvage',
  '5-schema-failure',
] as const

export type RepairStage = typeof REPAIR_STAGES[number]

export interface ParseOutcome {
  stage: RepairStage
  /** raw JSON-ish value recovered before normalization (null at stage 5) */
  recovered: unknown | null
  /** normalized + quantized pills ready for scoring */
  pills: ValidatedPill[]
  /** true once stage>=2 (output was not clean JSON on first try) */
  neededRepair: boolean
}

/** Strip ```code fences``` and stray leading/trailing prose lines. */
function stripFences(text: string): string {
  return text
    .replace(/```(?:json)?/gi, ' ')
    .trim()
}

/** Try JSON.parse; return parsed value or undefined. */
function tryParse(s: string): unknown | undefined {
  try {
    return JSON.parse(s)
  }
  catch {
    return undefined
  }
}

/** Coerce one raw pill object → ValidatedPill, or null if unusable. */
function coercePill(raw: unknown): ValidatedPill | null {
  if (!raw || typeof raw !== 'object')
    return null
  const o = raw as Record<string, unknown>
  const content = pillText(o).trim()
  if (!content)
    return null

  let relevance = Number(o.relevanceScore)
  if (!Number.isFinite(relevance)) {
    // Accept common alt keys produced by weak models.
    const alt = o.relevance ?? o.score ?? o.confidence
    if (typeof alt === 'string' && alt.trim().endsWith('%')) {
      const pct = Number(alt.trim().slice(0, -1))
      relevance = Number.isFinite(pct) ? pct / 100 : Number.NaN
    }
    else {
      relevance = Number(alt)
    }
  }
  if (!Number.isFinite(relevance))
    relevance = 0.8
  relevance = Math.min(1, Math.max(0, relevance))

  const evidenceRaw = Array.isArray(o.evidence_indices)
    ? o.evidence_indices
    : (Array.isArray(o.evidenceIndices) ? o.evidenceIndices : [])
  const evidence = (evidenceRaw as unknown[]).filter(
    (x): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0,
  )

  const type = normalizeChipType(o.type ?? o.category ?? (o.mood ? 'mood' : 'flavor'))

  const candidate = { content, type, relevanceScore: relevance, evidence_indices: evidence }
  const parsed = v.safeParse(ChipSchema, candidate)
  return parsed.success ? (parsed.output as ValidatedPill) : null
}

/**
 * Normalize whatever JSON-ish value was recovered into a pills array,
 * tolerating {pills:[]}, {chips:[]}, or a bare array of pill objects.
 */
function normalizeArtifacts(recovered: unknown): ValidatedPill[] {
  let arr: unknown[] = []
  if (Array.isArray(recovered)) {
    arr = recovered
  }
  else if (recovered && typeof recovered === 'object') {
    const o = recovered as Record<string, unknown>
    const list = o.pills ?? o.chips ?? o.echoChips ?? o.items ?? o.results
    if (Array.isArray(list))
      arr = list
  }
  const out: ValidatedPill[] = []
  for (const item of arr) {
    const p = coercePill(item)
    if (p)
      out.push(p)
  }
  // Validate the assembled artifacts object once for the record.
  const res = v.safeParse(ArtifactsSchema, { pills: out })
  return res.success ? (res.output.pills as ValidatedPill[]) : out
}

/** Salvage individual pill objects with a tolerant regex when JSON fails. */
function salvagePills(text: string): ValidatedPill[] {
  const stripped = stripFences(text)
  // Grab quoted "content" fields; infer type/score nearby if present.
  const re = /"content"\s*:\s*"([^"]{2,80})"/g
  const out: ValidatedPill[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(stripped))) {
    const content = m[1].trim()
    if (!content)
      continue
    const windowText = stripped.slice(Math.max(0, m.index - 160), m.index + m[0].length + 160)
    const typeM = /"type"\s*:\s*"([^"]+)"/.exec(windowText)
    const scoreM = /"relevanceScore"\s*:\s*(\d*\.?\d+)/.exec(windowText)
    const idxM = /"evidence_indices"\s*:\s*\[([^\]]*)\]/.exec(windowText)
    const evidence = idxM
      ? idxM[1].split(',').map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n >= 0)
      : []
    const candidate = {
      content,
      type: normalizeChipType(typeM?.[1]),
      relevanceScore: scoreM ? Math.min(1, Math.max(0, Number(scoreM[1]))) : 0.8,
      evidence_indices: evidence,
    }
    const parsed = v.safeParse(ChipSchema, candidate)
    if (parsed.success)
      out.push(parsed.output as ValidatedPill)
  }
  return out
}

/**
 * Run the full parse + repair ladder on raw model output.
 *
 * Stages:
 *  1. direct JSON.parse of the whole text
 *  2. first `{` → last `}` substring
 *  3. strip ``` fences, retry
 *  4. regex-salvage individual pill objects
 *  5. schema_failure
 */
export function parseEchoChips(rawOutput: string): ParseOutcome {
  const text = (rawOutput ?? '').trim()

  // Stage 1: direct parse.
  let recovered = text ? tryParse(text) : undefined
  if (recovered !== undefined) {
    const pills = normalizeArtifacts(recovered)
    if (pills.length > 0)
      return { stage: REPAIR_STAGES[0], recovered, pills, neededRepair: false }
  }

  // Stage 2: brace substring.
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last > first) {
    recovered = tryParse(text.slice(first, last + 1))
    if (recovered !== undefined) {
      const pills = normalizeArtifacts(recovered)
      if (pills.length > 0)
        return { stage: REPAIR_STAGES[1], recovered, pills, neededRepair: true }
    }
  }

  // Stage 3: code-fence strip + retry.
  const unfenced = stripFences(text)
  if (unfenced !== text) {
    recovered = tryParse(unfenced)
    if (recovered !== undefined) {
      const pills = normalizeArtifacts(recovered)
      if (pills.length > 0)
        return { stage: REPAIR_STAGES[2], recovered, pills, neededRepair: true }
    }
    // Also try brace-slice after unfencing.
    const f = unfenced.indexOf('{')
    const l = unfenced.lastIndexOf('}')
    if (f !== -1 && l > f) {
      recovered = tryParse(unfenced.slice(f, l + 1))
      if (recovered !== undefined) {
        const pills = normalizeArtifacts(recovered)
        if (pills.length > 0)
          return { stage: REPAIR_STAGES[2], recovered, pills, neededRepair: true }
      }
    }
  }

  // Stage 4: regex pill salvage.
  const salvaged = salvagePills(text)
  if (salvaged.length > 0)
    return { stage: REPAIR_STAGES[3], recovered: { pills: salvaged }, pills: salvaged, neededRepair: true }

  // Stage 5: failure.
  return { stage: REPAIR_STAGES[4], recovered: null, pills: [], neededRepair: true }
}
