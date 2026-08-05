/**
 * Entry selection: the eligibility pipeline.
 *
 *   candidate entries
 *     → Type-1 guard filter (atomic; see ReactiveVarStore.applyAll is *not* used here so
 *       we can test guards without committing mutations)
 *     → Intimacy Min/Max gate (against persistent intimacy store)
 *     → TimeLimit gate (against the runtime clock / manipulated vars)
 *     → weighted-random pick by `Weight`
 *
 * Mutations for the *chosen* entry are applied by the interpreter after selection,
 * never during filtering.
 */

import type { DslEntry } from './types'
import type { ReactiveVarStore } from './var-store'

/** Minimal clock shape (matches IClock in ports.ts without importing the ports layer). */
export interface IClockLike {
  now: () => number
}

export interface SelectionContext {
  vars: ReactiveVarStore
  /** Persistent intimacy score (from IIntimacyStore). Defaults to 0. */
  intimacy: number
  /** Clock for TimeLimit month checks. */
  clock?: IClockLike
  /** RNG for weighted selection (defaults to Math.random). */
  random?: () => number
}

function passesGuards(entry: DslEntry, vars: ReactiveVarStore): boolean {
  if (!entry.VarFloats)
    return true
  return entry.VarFloats.every(v => v.Type !== 1 || vars.evaluateCondition(v))
}

function passesIntimacy(entry: DslEntry, intimacy: number): boolean {
  const bounds = entry.Intimacy
  if (!bounds)
    return true
  // `Intimacy: {}` carries no gate (no Min/Max) and no reward — e.g. gift/dislike
  // stubs; such entries are eligible. An explicit Min/Max gate clamps eligibility.
  if (bounds.Min !== undefined && intimacy < bounds.Min)
    return false
  if (bounds.Max !== undefined && intimacy > bounds.Max)
    return false
  return true
}

function passesTimeLimit(entry: DslEntry, clock?: IClockLike): boolean {
  const tl = entry.TimeLimit
  if (!tl || tl.Month === undefined)
    return true
  if (!clock)
    return true
  // Observed manifests tag each seasonal entry with the start month of its quarter
  // (3/6/9/12); the entry is active for that quarter [Month, Month+2], wrapping the
  // year boundary. Sustain is the model author's duration budget and doesn't gate here.
  const month = new Date(clock.now()).getMonth() + 1 // 1-12
  const seasonStart = tl.Month
  const seasonEnd = ((seasonStart + 2 - 1) % 12) + 1
  if (seasonStart <= seasonEnd)
    return month >= seasonStart && month <= seasonEnd
  return month >= seasonStart || month <= seasonEnd // wraps year boundary
}

/** Filter a group's entries to those currently eligible (guards + intimacy + time). */
export function filterEligibleEntries(entries: readonly DslEntry[], ctx: SelectionContext): DslEntry[] {
  return entries.filter(e =>
    passesGuards(e, ctx.vars)
    && passesIntimacy(e, ctx.intimacy)
    && passesTimeLimit(e, ctx.clock),
  )
}

/**
 * Weighted-random pick among already-eligible entries.
 * - Entries with `Weight` participate in the lottery; total = sum of weights.
 * - Entries with no `Weight` are excluded from the lottery (they are fallback/direct
 *   chain targets chosen via NextMtn, not random picks). If *no* entry has a Weight,
 *   selection is uniform among all eligible entries.
 */
export function weightedPick(eligible: readonly DslEntry[], random: () => number = Math.random): DslEntry | undefined {
  if (eligible.length === 0)
    return undefined

  const weighted = eligible.filter(e => typeof e.Weight === 'number' && (e.Weight as number) > 0)

  if (weighted.length === 0) {
    // No weights anywhere: uniform pick.
    return eligible[Math.min(eligible.length - 1, Math.floor(random() * eligible.length))]
  }

  const total = weighted.reduce((sum, e) => sum + (e.Weight as number), 0)
  let roll = random() * total
  for (const entry of weighted) {
    roll -= entry.Weight as number
    if (roll < 0)
      return entry
  }
  return weighted[weighted.length - 1]
}

/** Select one entry: filter → weighted pick. */
export function selectEntry(entries: readonly DslEntry[], ctx: SelectionContext): DslEntry | undefined {
  return weightedPick(filterEligibleEntries(entries, ctx), ctx.random)
}
