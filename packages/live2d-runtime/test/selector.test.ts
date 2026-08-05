import type { DslEntry } from '../src/dsl/types'

import { describe, expect, it } from 'vitest'

import { filterEligibleEntries, selectEntry, weightedPick } from '../src/dsl/selector'
import { ReactiveVarStore } from '../src/dsl/var-store'

const vars = () => new ReactiveVarStore()

describe('filterEligibleEntries — intimacy gate', () => {
  // Flandre Tapbody ladder (docs 2262182171): Min gates progressive unlocks.
  const tapbody: DslEntry[] = [
    { Command: 'start_mtn B40', Intimacy: { Bonus: 1 }, Weight: 1 }, // no Min — always available
    { Command: 'start_mtn B20', Intimacy: { Min: 40, Bonus: 1 } },
    { Command: 'start_mtn B50', Intimacy: { Min: 60, Bonus: 1 } },
    { Command: 'start_mtn B40', Intimacy: { Min: 80, Bonus: 1 } },
    { Command: 'start_mtn B50', Intimacy: { Min: 100, Bonus: 1 } },
    { Text: '好感度大于20解锁', Intimacy: { Max: 19 } }, // locked-out message below 20
  ]

  it('admits entries whose Min is satisfied, rejects higher-Min entries', () => {
    const eligible = filterEligibleEntries(tapbody, { vars: vars(), intimacy: 0 })
    expect(eligible).toHaveLength(2) // the always-available entry + the Max:19 locked-message entry
    expect(eligible.some(e => e.Intimacy?.Min === 40)).toBe(false)

    const at40 = filterEligibleEntries(tapbody, { vars: vars(), intimacy: 40 })
    expect(at40.some(e => e.Intimacy?.Min === 40)).toBe(true)
    expect(at40.some(e => e.Intimacy?.Min === 100)).toBe(false)
  })

  it('reward-only Intimacy ({Bonus}) without Min/Max is always eligible', () => {
    const entries: DslEntry[] = [{ Intimacy: { Bonus: 1 } }]
    expect(filterEligibleEntries(entries, { vars: vars(), intimacy: 0 })).toHaveLength(1)
  })

  it('empty Intimacy {} (gift/dislike stub) is eligible and gates nothing', () => {
    const entries: DslEntry[] = [{ Intimacy: {}, NextMtn: '礼物:礼物-讨厌' }]
    expect(filterEligibleEntries(entries, { vars: vars(), intimacy: 5000 })).toHaveLength(1)
  })

  it('intimacyVI ladder (Update7#98) maps a score to exactly one tier', () => {
    // A representative slice of the 1..50 ladder.
    const ladder: DslEntry[] = [
      { Intimacy: { Min: 0, Max: 99 }, VarFloats: [{ Name: 'IntimacyVI', Type: 2, Code: 'assign 1' }] },
      { Intimacy: { Min: 100, Max: 219 }, VarFloats: [{ Name: 'IntimacyVI', Type: 2, Code: 'assign 2' }] },
      { Intimacy: { Min: 6350, Max: 6969 }, VarFloats: [{ Name: 'IntimacyVI', Type: 2, Code: 'assign 21' }] },
      { Intimacy: { Min: 73850 }, VarFloats: [{ Name: 'IntimacyVI', Type: 2, Code: 'assign 50' }] },
    ]
    expect(selectEntry(ladder, { vars: vars(), intimacy: 0 })?.VarFloats?.[0].Code).toBe('assign 1')
    expect(selectEntry(ladder, { vars: vars(), intimacy: 150 })?.VarFloats?.[0].Code).toBe('assign 2')
    expect(selectEntry(ladder, { vars: vars(), intimacy: 6500 })?.VarFloats?.[0].Code).toBe('assign 21')
    expect(selectEntry(ladder, { vars: vars(), intimacy: 100000 })?.VarFloats?.[0].Code).toBe('assign 50')
    // In a gap (e.g. 220..6349 absent in this slice) there is no match.
    expect(filterEligibleEntries(ladder, { vars: vars(), intimacy: 500 })).toHaveLength(0)
  })
})

describe('filterEligibleEntries — guards and TimeLimit', () => {
  it('guard failing excludes the entry', () => {
    const v = vars()
    v.set('DateFlag', 2) // less than 4
    const entries: DslEntry[] = [
      { VarFloats: [{ Name: 'DateFlag', Type: 1, Code: 'greater_equal 4' }], Weight: 6 },
    ]
    expect(filterEligibleEntries(entries, { vars: v, intimacy: 0 })).toHaveLength(0)
  })

  it('timeLimit month-quarter gate includes only the active season (wraps year)', () => {
    // March-quarter and December-quarter entries.
    const spring: DslEntry = { TimeLimit: { Month: 3, Sustain: 92160 } }
    const winter: DslEntry = { TimeLimit: { Month: 12, Sustain: 92160 } }
    // April 14, 2026 -> month 4 (spring quarter 3,4,5).
    const clock = { now: () => new Date(2026, 3, 14).getTime() }
    const eligible = filterEligibleEntries([spring, winter], { vars: vars(), intimacy: 0, clock })
    expect(eligible).toEqual([spring])
    // January -> winter quarter (12,1,2 wraps).
    const janClock = { now: () => new Date(2026, 0, 10).getTime() }
    expect(filterEligibleEntries([spring, winter], { vars: vars(), intimacy: 0, clock: janClock })).toEqual([winter])
  })
})

describe('weightedPick', () => {
  const entries: DslEntry[] = [
    { Weight: 4, Command: 'A' },
    { Weight: 6, Command: 'B' },
    { Weight: 8, Command: 'C' },
  ]

  it('picks proportionally across many rolls', () => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0 }
    for (let i = 0; i < 6000; i++) {
      const e = weightedPick(entries)!
      counts[e.Command!]++
    }
    // Expect roughly 4:6:8 of 18 total. Allow generous tolerance.
    expect(counts.A / 6000).toBeGreaterThan(0.14)
    expect(counts.A / 6000).toBeLessThan(0.31)
    expect(counts.C / 6000).toBeGreaterThan(0.36)
    expect(counts.C / 6000).toBeLessThan(0.53)
  })

  it('unweighted entries fall back to uniform when no weights exist', () => {
    const plain: DslEntry[] = [{ Command: 'a' }, { Command: 'b' }, { Command: 'c' }]
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++)
      seen.add(weightedPick(plain)!.Command!)
    expect(seen.size).toBe(3)
  })

  it('returns undefined for an empty pool', () => {
    expect(weightedPick([])).toBeUndefined()
  })

  it('a single eligible entry is always chosen regardless of weight', () => {
    const solo = [{ Weight: 999, Command: 'only' }]
    expect(weightedPick(solo, () => 0)!.Command).toBe('only')
    expect(weightedPick(solo, () => 0.9999)!.Command).toBe('only')
  })
})
