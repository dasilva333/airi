import { describe, expect, it } from 'vitest'

import { planLayaBatches } from './prep'

const GIB = 2 ** 30

describe('planLayaBatches', () => {
  it('keeps a short triage fan-out in one batch', () => {
    // 29 questions of ~210 tokens: 29 * 16 * 210^2 * 4 bytes is ~80 MB.
    const plan = planLayaBatches(Array.from({ length: 29 }, () => 210))
    expect(plan).toEqual([Array.from({ length: 29 }, (_, i) => i)])
  })

  it('splits when the padded attention tensor would exceed the budget', () => {
    // Each 1100-token question needs 16 * 1100^2 * 4 = ~77 MB, so 1 GiB fits 13.
    const lengths = Array.from({ length: 29 }, () => 1100)
    const plan = planLayaBatches(lengths, 1 * GIB)
    expect(plan.length).toBeGreaterThan(1)
    expect(plan.flat()).toEqual(lengths.map((_, i) => i))
    for (const batch of plan)
      expect(batch.length * 16 * 1100 * 1100 * 4).toBeLessThanOrEqual(1 * GIB)
  })

  it('accounts for padding to the longest member of the batch', () => {
    const plan = planLayaBatches([100, 100, 4000, 100], 1 * GIB)
    // The 4000-token question alone needs ~1 GiB, so it cannot share a batch.
    expect(plan).toEqual([[0, 1], [2], [3]])
  })

  it('gives an over-budget question its own batch instead of dropping it', () => {
    expect(planLayaBatches([5000, 5000], 1 * GIB)).toEqual([[0], [1]])
  })

  it('returns no batches for no questions', () => {
    expect(planLayaBatches([])).toEqual([])
  })
})
