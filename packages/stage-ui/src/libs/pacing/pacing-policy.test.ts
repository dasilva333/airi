import { safeParse } from 'valibot'
import { describe, expect, it } from 'vitest'

import { AiriPacingSchema } from '../../types/card.schema'
import { DEFAULT_PACING_POLICY } from '../../types/pacing'

describe('persisted pacing policy', () => {
  it('accepts the runtime default synthesis budget in a saved card', () => {
    expect(safeParse(AiriPacingSchema, DEFAULT_PACING_POLICY).success).toBe(true)
  })

  it.each([600, 2500, 5000])('accepts an explicit %ims synthesis budget', (budget) => {
    const parsed = safeParse(AiriPacingSchema, { enabled: true, maxSynthesisBudgetMs: 600, maxFillerSynthesisBudgetMs: budget })
    expect(parsed.success).toBe(true)
    if (!parsed.success)
      throw new Error('Pacing policy failed validation')
    expect(parsed.output.maxFillerSynthesisBudgetMs).toBe(budget)
    expect(parsed.output.maxSynthesisBudgetMs).toBe(600)
  })
})
