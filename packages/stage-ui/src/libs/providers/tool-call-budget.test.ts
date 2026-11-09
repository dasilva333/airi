/**
 * Tests for the tool-call step budget wrapper around xsai `Tool`s.
 *
 * Contract under test (from the NOTICE on `ANSWER_ROUNDS`):
 * - Tools are called at most `maxToolSteps` times per reply; rounds beyond
 *   the budget return a refusal string so the model can still answer.
 * - `@xsai` runs one round's parallel calls against the same `messages`
 *   array, so calls within a round share its length and rounds are keyed by
 *   that length — two calls with the same length count as one round.
 * - `maxSteps` (the loop cap handed back to the caller) is the budget plus
 *   three answer rounds; the budget is clamped to >= 1.
 * - Tools without `execute` pass through untouched behavior-wise.
 */
import { describe, expect, it } from 'vitest'

import { DEFAULT_MAX_TOOL_STEPS, toolStepLimitMessage, withToolStepBudget } from './tool-call-budget'

function makeTool(name: string, impl?: (input: unknown) => unknown) {
  return {
    name,
    description: `tool ${name}`,
    execute: impl ? async (input: unknown) => impl(input) : async () => `ran ${name}`,
  }
}

function optionsWithMessages(count: number): any {
  return { messages: Array.from({ length: count }, (_, i) => ({ id: i })) }
}

describe('withToolStepBudget', () => {
  it('reports DEFAULT_MAX_TOOL_STEPS and the +3 answer-rounds loop cap', () => {
    expect(DEFAULT_MAX_TOOL_STEPS).toBe(20)
    const { maxSteps } = withToolStepBudget([makeTool('a') as any], 10)
    expect(maxSteps).toBe(13)
  })

  it('clamps a zero or negative budget to one step', () => {
    expect(withToolStepBudget([makeTool('a') as any], 0).maxSteps).toBe(4)
    expect(withToolStepBudget([makeTool('a') as any], -3).maxSteps).toBe(4)
    expect(withToolStepBudget([makeTool('a') as any], 2.9).maxSteps).toBe(5) // floored
  })

  it('passes undefined and empty tool lists through with the loop cap', () => {
    expect(withToolStepBudget(undefined, 5)).toEqual({ tools: undefined, maxSteps: 8 })
    expect(withToolStepBudget([], 5)).toEqual({ tools: [], maxSteps: 8 })
  })

  it('counts parallel calls in the same round (same messages length) as one round', async () => {
    const tool = makeTool('a')
    const { tools } = withToolStepBudget([tool as any], 1)
    const execute = tools![0].execute!

    // Two parallel calls in round 0 (same messages array) both execute.
    await expect(execute({}, optionsWithMessages(4) as any)).resolves.toBe('ran a')
    await expect(execute({}, optionsWithMessages(4) as any)).resolves.toBe('ran a')
    // Round 1 exceeds budget=1 -> refusal.
    await expect(execute({}, optionsWithMessages(5) as any)).resolves.toBe(toolStepLimitMessage(1))
  })

  it('allows exactly `limit` rounds, then refuses in the refusal string', async () => {
    const tool = makeTool('a')
    const { tools } = withToolStepBudget([tool as any], 2)
    const execute = tools![0].execute!

    await expect(execute({}, optionsWithMessages(1) as any)).resolves.toBe('ran a')
    await expect(execute({}, optionsWithMessages(2) as any)).resolves.toBe('ran a')
    const refusal = (await execute({}, optionsWithMessages(3) as any)) as string
    expect(refusal).toBe(toolStepLimitMessage(2))
    expect(refusal).toContain('answer the user now')
  })

  it('applies the budget per wrapped call set, shared across tools in the set', async () => {
    const { tools } = withToolStepBudget([makeTool('a') as any, makeTool('b') as any], 1)
    const [a, b] = tools!

    // a and b called in the same round -> both execute.
    await expect(a.execute!({}, optionsWithMessages(7) as any)).resolves.toBe('ran a')
    await expect(b.execute!({}, optionsWithMessages(7) as any)).resolves.toBe('ran b')
    // Next round exceeds the shared budget.
    await expect(a.execute!({}, optionsWithMessages(8) as any)).resolves.toBe(toolStepLimitMessage(1))
  })

  it('returns undefined for tools without execute when within budget', async () => {
    const { tools } = withToolStepBudget([{ name: 'bare', description: 'no impl' } as any], 3)
    await expect(tools![0].execute!({}, optionsWithMessages(1) as any)).resolves.toBeUndefined()
  })
})
