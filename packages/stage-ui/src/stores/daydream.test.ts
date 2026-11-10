import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useDaydreamStore } from './daydream'

describe('useDaydreamStore & Cadence Governor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('updates active vibe and inner thought on every recorded beat', () => {
    const store = useDaydreamStore()
    expect(store.activeVibe).toBe('routine')
    expect(store.latestInnerThought).toBeNull()

    store.recordBeat({
      vibe: 'affectionate',
      inner_thought: 'My heart feels warm...',
      active_topics: [{ topic: 'baking together', weight: 0.9 }],
    }, 'char-1')

    expect(store.activeVibe).toBe('affectionate')
    expect(store.latestInnerThought).toBe('My heart feels warm...')
    expect(store.chips).toHaveLength(0) // No daydream chip provided
  })

  it('drops low-salience daydream chips below 0.72 threshold', () => {
    const store = useDaydreamStore()

    const promoted = store.recordBeat({
      vibe: 'routine',
      active_topics: [{ topic: 'weather', weight: 0.5 }],
      daydream_chip: {
        text: 'Routine cloudy day',
        type: 'flavor',
        salience_score: 0.45,
      },
    }, 'char-1')

    expect(promoted).toBeNull()
    expect(store.chips).toHaveLength(0)
  })

  it('promotes high-salience chips (>=0.72) on initial turn', () => {
    const store = useDaydreamStore()

    const promoted = store.recordBeat({
      vibe: 'playful',
      active_topics: [{ topic: 'unicorn bakery', weight: 0.95 }],
      daydream_chip: {
        text: 'Unicorn bakery recipe',
        type: 'flavor',
        salience_score: 0.85,
      },
    }, 'char-1', 'universe-a', 'session-1')

    expect(promoted).not.toBeNull()
    expect(promoted?.text).toBe('Unicorn bakery recipe')
    expect(promoted?.salienceScore).toBe(0.85)
    expect(store.chips).toHaveLength(1)
  })

  it('enforces cadence pacer: enforces turn gap >= 2 between standard promotions', () => {
    const store = useDaydreamStore()

    // Turn 1: Promoted
    const chip1 = store.recordBeat({
      vibe: 'playful',
      active_topics: [{ topic: 'corn cupcakes', weight: 0.9 }],
      daydream_chip: {
        text: 'Corn cupcakes',
        type: 'flavor',
        salience_score: 0.82,
      },
    }, 'char-1')
    expect(chip1).not.toBeNull()
    expect(store.chips).toHaveLength(1)

    // Turn 2: Turn gap = 1 < 2 -> Suppressed by cadence pacer
    const chip2 = store.recordBeat({
      vibe: 'playful',
      active_topics: [{ topic: 'rainbow icing', weight: 0.88 }],
      daydream_chip: {
        text: 'Rainbow icing',
        type: 'flavor',
        salience_score: 0.84,
      },
    }, 'char-1')
    expect(chip2).toBeNull()
    expect(store.chips).toHaveLength(1)

    // Turn 3: Turn gap = 2 >= 2 -> Promoted!
    const chip3 = store.recordBeat({
      vibe: 'playful',
      active_topics: [{ topic: 'sugar sparkle', weight: 0.89 }],
      daydream_chip: {
        text: 'Sugar sparkle',
        type: 'flavor',
        salience_score: 0.86,
      },
    }, 'char-1')
    expect(chip3).not.toBeNull()
    expect(store.chips).toHaveLength(2)
  })

  it('allows breakthrough milestone chips (>=0.92) to bypass turn gap cadence', () => {
    const store = useDaydreamStore()

    // Turn 1: Promoted
    store.recordBeat({
      vibe: 'routine',
      active_topics: [{ topic: 'first topic', weight: 0.8 }],
      daydream_chip: {
        text: 'First topic',
        type: 'flavor',
        salience_score: 0.80,
      },
    }, 'char-1')
    expect(store.chips).toHaveLength(1)

    // Turn 2: Turn gap = 1, but salience_score = 0.95 (Breakthrough milestone!)
    const milestoneChip = store.recordBeat({
      vibe: 'affectionate',
      inner_thought: 'A sacred lifelong promise...',
      active_topics: [{ topic: 'stargazing oath', weight: 0.98 }],
      daydream_chip: {
        text: 'Stargazing sacred promise',
        type: 'milestone',
        salience_score: 0.95,
      },
    }, 'char-1')

    expect(milestoneChip).not.toBeNull()
    expect(milestoneChip?.type).toBe('milestone')
    expect(store.chips).toHaveLength(2)
  })

  it('deduplicates semantically similar chips and updates recency', () => {
    const store = useDaydreamStore()

    // Turn 1
    store.recordBeat({
      vibe: 'playful',
      active_topics: [{ topic: 'unicorn bakery', weight: 0.9 }],
      daydream_chip: {
        text: 'Unicorn bakery adventure',
        type: 'flavor',
        salience_score: 0.80,
      },
    }, 'char-1')
    expect(store.chips).toHaveLength(1)

    // Turn 2: Gap
    store.recordBeat({
      vibe: 'routine',
      active_topics: [],
    }, 'char-1')

    // Turn 3: Turn gap satisfied, but text has >60% word overlap with Turn 1
    const duplicate = store.recordBeat({
      vibe: 'playful',
      active_topics: [{ topic: 'bakery adventure', weight: 0.85 }],
      daydream_chip: {
        text: 'Unicorn bakery adventure special',
        type: 'flavor',
        salience_score: 0.88,
      },
    }, 'char-1')

    expect(duplicate).toBeNull()
    expect(store.chips).toHaveLength(1) // Not duplicated
    expect(store.chips[0].salienceScore).toBe(0.88) // Updated score
  })

  it('maintains sliding window max capacity of 12 chips', () => {
    const store = useDaydreamStore()

    const samplePhrases = [
      'crimson autumn leaves',
      'deep blue ocean',
      'golden desert sands',
      'emerald forest canopy',
      'silver starlight glimmer',
      'purple twilight haze',
      'bright sunrise horizon',
      'velvet night shadows',
      'frosty winter breeze',
      'warm summer meadow',
      'misty mountain peak',
      'gentle spring showers',
      'ancient stone ruins',
      'sparkling river waters',
      'cozy fireplace embers',
    ]
    for (let i = 0; i < samplePhrases.length; i++) {
      // Turn gap >= 2 by stepping turnCounter twice per iteration
      store.recordBeat({
        vibe: 'routine',
        active_topics: [],
      }, 'char-1')

      store.recordBeat({
        vibe: 'playful',
        active_topics: [{ topic: samplePhrases[i], weight: 0.9 }],
        daydream_chip: {
          text: samplePhrases[i],
          type: 'flavor',
          salience_score: 0.85,
        },
      }, 'char-1')
    }

    expect(store.chips.length).toBeLessThanOrEqual(12)
    expect(store.chips.some(c => c.text === 'cozy fireplace embers')).toBe(true)
  })

  it('filters session chips and clears state cleanly', () => {
    const store = useDaydreamStore()

    store.recordBeat({
      vibe: 'playful',
      active_topics: [{ topic: 'item 1', weight: 0.9 }],
      daydream_chip: { text: 'Item 1', type: 'flavor', salience_score: 0.85 },
    }, 'char-1', 'univ-1', 'sess-1')

    store.recordBeat({
      vibe: 'routine',
      active_topics: [],
    }, 'char-1')

    store.recordBeat({
      vibe: 'playful',
      active_topics: [{ topic: 'item 2', weight: 0.9 }],
      daydream_chip: { text: 'Item 2', type: 'flavor', salience_score: 0.85 },
    }, 'char-2', 'univ-2', 'sess-2')

    expect(store.getSessionChips('char-1', 'univ-1', 'sess-1')).toHaveLength(1)
    expect(store.getSessionChips('char-2', 'univ-2', 'sess-2')).toHaveLength(1)
    expect(store.getSessionChips('char-1', 'univ-2', 'sess-1')).toHaveLength(0)

    store.clear()
    expect(store.chips).toHaveLength(0)
    expect(store.activeVibe).toBe('routine')
    expect(store.latestInnerThought).toBeNull()
  })
})
