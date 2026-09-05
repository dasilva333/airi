import { describe, expect, it } from 'vitest'

import { BoundedCategoryClassifier } from './category-classifier'

describe('boundedCategoryClassifier', () => {
  it('classifies single category when positive keyword arrives', () => {
    const classifier = new BoundedCategoryClassifier()
    const result = classifier.consume('I need to calculate the value of x. ')

    expect(result.category).toBe('analytical')
    expect(result.scores.analytical.positive).toBe(1)
    expect(result.scores.analytical.net).toBe(1)
    expect(result.matchedTokens).toContain('calculate')
  })

  it('handles split chunks safely across token boundaries', () => {
    const classifier = new BoundedCategoryClassifier()

    // First chunk ends mid-word: "cal"
    const r1 = classifier.consume('Let us cal')
    // "cal" alone is held because it did not end on a delimiter and is not a full word
    expect(r1.category).toBe('generic')

    // Second chunk completes the word: "culate "
    const r2 = classifier.consume('culate the answer. ')
    expect(r2.category).toBe('analytical')
    expect(r2.matchedTokens).toContain('calculate')
  })

  it('suppresses keywords in the 3-token negation lookback window', () => {
    const classifier = new BoundedCategoryClassifier()

    // "not sound angry" -> angry is within 3 tokens of "not"
    const result = classifier.consume('I should not sound angry at all. ')
    expect(result.category).toBe('generic')
    expect(result.scores.emotional.positive).toBe(0)
    expect(result.scores.emotional.negated).toBe(1)
    expect(result.scores.emotional.net).toBe(-1)
  })

  it('allows positive keywords outside the 3-token negation window', () => {
    const classifier = new BoundedCategoryClassifier()

    // "not angry ... very happy" -> happy is > 3 tokens away from "not"
    const result = classifier.consume('I am not angry at this, but I feel genuinely happy now. ')
    expect(result.category).toBe('emotional')
    expect(result.scores.emotional.negated).toBe(1) // "angry" was negated
    expect(result.scores.emotional.positive).toBe(2) // "feel" and "happy" are positive
    expect(result.scores.emotional.net).toBe(1)
  })

  it('correctly classifies each supported category', () => {
    const classifier = new BoundedCategoryClassifier()

    classifier.reset()
    expect(classifier.consume('Let us recall the past history. ').category).toBe('memory')

    classifier.reset()
    expect(classifier.consume('I feel so much joy and affection! ').category).toBe('emotional')

    classifier.reset()
    expect(classifier.consume('I wonder if this is unclear and doubtful. ').category).toBe('uncertain')

    classifier.reset()
    expect(classifier.consume('The algorithm optimizes the calculation step. ').category).toBe('analytical')
  })

  it('respects higher categoryThreshold', () => {
    const classifier = new BoundedCategoryClassifier({ categoryThreshold: 2 })

    // 1 match for analytical
    const r1 = classifier.consume('Let us analyze this. ')
    expect(r1.category).toBe('generic')
    expect(r1.scores.analytical.net).toBe(1)

    // 2nd match for analytical
    const r2 = classifier.consume('We will compute the solution. ')
    expect(r2.category).toBe('analytical')
    expect(r2.scores.analytical.net).toBe(3) // analyze + compute + solution
  })

  it('flushes pending trailing token on flush()', () => {
    const classifier = new BoundedCategoryClassifier()

    // No trailing space or punctuation after "calculate"
    const r1 = classifier.consume('I will calculate')
    expect(r1.category).toBe('generic')

    // On flush (e.g. deadline elapsed), trailing token is evaluated
    const r2 = classifier.flush()
    expect(r2.category).toBe('analytical')
    expect(r2.matchedTokens).toContain('calculate')
  })

  it('caps buffer to maxReasoningChars sliding window', () => {
    const classifier = new BoundedCategoryClassifier({ maxReasoningChars: 30 })

    // Feed text that will be pushed out of the 30-char window
    classifier.consume('Let us calculate. ')
    expect(classifier.flush().category).toBe('analytical')

    // Feed >30 chars of unrelated text
    classifier.consume('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx wonder perhaps. ')
    const r = classifier.flush()
    expect(r.category).toBe('uncertain')
    expect(r.scores.analytical.positive).toBe(0) // pushed out of buffer
    expect(r.scores.uncertain.positive).toBe(2)
  })

  it('selects top category excluding previously spoken categories', () => {
    const classifier = new BoundedCategoryClassifier({ categoryThreshold: 1 })
    // Feed text with both analytical and memory keywords: "calculate solve remember recall"
    classifier.consume('We need to calculate and solve this formula, but also remember and recall previous conversations. ')

    // Both analytical (2) and memory (2) have matches
    const top1 = classifier.getTopCategoryExcluding(new Set())
    expect(['analytical', 'memory']).toContain(top1)

    // Exclude whichever won first
    const excluded = new Set([top1!])
    const top2 = classifier.getTopCategoryExcluding(excluded)
    expect(top2).not.toBe(top1)
    expect(['analytical', 'memory']).toContain(top2)

    // Exclude both
    excluded.add(top2!)
    const top3 = classifier.getTopCategoryExcluding(excluded)
    expect(top3).toBeNull()
  })

  it('clears accumulated buffer on resetWindow()', () => {
    const classifier = new BoundedCategoryClassifier()
    classifier.consume('Let us calculate the optimal strategy. ')
    expect(classifier.getTopCategoryExcluding(new Set())).toBe('analytical')

    classifier.resetWindow()
    // Buffer is now empty; without new tokens, getTopCategoryExcluding returns null
    expect(classifier.getTopCategoryExcluding(new Set())).toBeNull()
  })

  it('rejects weak runner-up below 0.5x of dominant category score', () => {
    const classifier = new BoundedCategoryClassifier({ categoryThreshold: 1 })
    // Analytical gets 4 tokens (calculate, compute, solve, optimize)
    // Memory gets 1 token (remember)
    classifier.consume('Let us calculate, compute, solve, and optimize this equation. Also remember the rule. ')

    // First selection: analytical wins with net score 4
    const top1 = classifier.getTopCategoryExcluding(new Set())
    expect(top1).toBe('analytical')

    // Exclude analytical: memory has score 1, but 0.5 * 4 = 2.
    // Memory score 1 < 2, so it fails the 0.5x runner-up guard!
    const top2 = classifier.getTopCategoryExcluding(new Set(['analytical']))
    expect(top2).toBeNull()
  })
})
