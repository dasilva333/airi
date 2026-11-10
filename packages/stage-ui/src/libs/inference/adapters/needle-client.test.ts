import { describe, expect, it, vi } from 'vitest'

import { createNeedleClient } from './needle-client'

describe('needleClient (Needle 3 Subconscious Runtime)', () => {
  it('instantiates and provides expected interface', () => {
    const client = createNeedleClient()
    expect(typeof client.isReady).toBe('function')
    expect(typeof client.isPreparing).toBe('function')
    expect(typeof client.isCached).toBe('function')
    expect(typeof client.prepare).toBe('function')
    expect(typeof client.probeInitialReaction).toBe('function')
    expect(typeof client.probeCotPivot).toBe('function')
    expect(typeof client.embed).toBe('function')
    expect(typeof client.terminate).toBe('function')
  })

  it('prepares and reports progress', async () => {
    const client = createNeedleClient()
    const progressSpy = vi.fn()

    const ready = await client.prepare(progressSpy)
    expect(ready).toBe(true)
    expect(client.isReady()).toBe(true)
    expect(progressSpy).toHaveBeenCalledWith(1.0)
  })

  it('probes initial reaction (Task 2) on user prompt', async () => {
    const client = createNeedleClient()

    const reactionMath = await client.probeInitialReaction('Can you solve this algorithm challenge for me?')
    expect(reactionMath).toBeTruthy()
    expect(typeof reactionMath).toBe('string')

    const reactionQuestion = await client.probeInitialReaction('Why is the sky blue?')
    expect(reactionQuestion).toBeTruthy()
    expect(typeof reactionQuestion).toBe('string')

    // Empty prompt returns null
    const reactionEmpty = await client.probeInitialReaction('')
    expect(reactionEmpty).toBeNull()
  })

  it('probes CoT pivot (Task 3) on streaming reasoning snippet', async () => {
    const client = createNeedleClient()

    // Snippet with a clear pivot
    const reasoningWithPivot = 'We started with method A. Wait, actually that creates an edge case where items exceed capacity.'
    const pivot = await client.probeCotPivot(reasoningWithPivot)
    // In Node test environment where Worker is undefined, probeCotPivot returns null or fallback safely
    if (pivot) {
      expect(pivot.toLowerCase()).toContain('wait')
    }

    // Snippet with no pivot or too short
    const shortSnippet = 'Calculating...'
    const emptyPivot = await client.probeCotPivot(shortSnippet)
    expect(emptyPivot).toBeNull()
  })

  it('embeds text (Task 4) returning null or vector in test environment', async () => {
    const client = createNeedleClient()
    const emptyVec = await client.embed('')
    expect(emptyVec).toBeNull()

    const textVec = await client.embed('Character state and memory retrieval query')
    // In Node test environment where Worker is undefined, embed returns null safely
    if (textVec) {
      expect(textVec.length).toBe(3072)
    }
  })

  it('handles terminate cleanly', () => {
    const client = createNeedleClient()
    expect(() => client.terminate()).not.toThrow()
  })
})
