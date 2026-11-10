import type { ChatHistoryItem } from '../../types/chat'

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { needleClient } from '../../libs/inference/adapters/needle-client'
import { useDaydreamStore } from '../daydream'
import { useAiriCardStore } from '../modules/airi-card'
import { updateRecentTopics } from './recent-topics'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))

vi.mock('../../database/repos/echo-chips.repo', () => ({
  echoChipsRepo: {
    getAll: vi.fn(async () => []),
  },
}))

describe('updateRecentTopics (Domain 2: Toggle 4 & Subconscious Daydreaming)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    const cardStore = useAiriCardStore()
    cardStore.cardsLoading = false
  })

  it('bails early if groundingTopicsEnabled is disabled on card', async () => {
    const cardStore = useAiriCardStore()
    cardStore.cards.set('char-1', {
      id: 'char-1',
      data: { name: 'Airi' },
      extensions: {
        airi: {
          groundingTopicsEnabled: false,
        },
      },
    } as any)

    const extractSpy = vi.spyOn(needleClient, 'extractSubconsciousBeat')

    await updateRecentTopics('char-1', 'sess-1', 'user-1', [], [], 'global')

    expect(extractSpy).not.toHaveBeenCalled()
  })

  it('runs lexical fallback when Needle 3 is not ready', async () => {
    const cardStore = useAiriCardStore()
    cardStore.cards.set('char-1', {
      id: 'char-1',
      data: { name: 'Airi' },
      extensions: {
        airi: {
          groundingTopicsEnabled: true,
          recentTopics: [],
        },
      },
    } as any)

    vi.spyOn(needleClient, 'isReady').mockReturnValue(false)
    const extractSpy = vi.spyOn(needleClient, 'extractSubconsciousBeat')

    const messages: ChatHistoryItem[] = [
      { role: 'user', content: 'Let us bake strawberry cupcakes at the cafe tomorrow.' } as any,
      { role: 'assistant', content: 'Sounds delicious! We will bring sprinkles and frosting.' } as any,
    ]

    await updateRecentTopics('char-1', 'sess-1', 'user-1', messages, [], 'global')

    expect(extractSpy).not.toHaveBeenCalled()

    const updatedCard = cardStore.getCard('char-1')
    const topics = updatedCard?.extensions?.airi?.recentTopics || []
    expect(topics.length).toBeGreaterThan(0)
    // Check that strawberry or cupcakes was extracted via lexical n-grams
    expect(topics.some(t => t.topic.includes('strawberry') || t.topic.includes('cupcakes'))).toBe(true)
  })

  it('ingests multi-turn messages via Needle 3, populates DaydreamStore, and prioritizes active topics', async () => {
    const cardStore = useAiriCardStore()
    cardStore.cards.set('char-1', {
      id: 'char-1',
      data: { name: 'Airi' },
      extensions: {
        airi: {
          groundingTopicsEnabled: true,
          recentTopics: [],
        },
      },
    } as any)

    vi.spyOn(needleClient, 'isReady').mockReturnValue(true)
    vi.spyOn(needleClient, 'extractSubconsciousBeat').mockResolvedValueOnce({
      vibe: 'affectionate',
      inner_thought: 'A sweet afternoon together...',
      active_topics: [
        { topic: 'kitty corn bakery', weight: 0.95 },
        { topic: 'unicorn mythology', weight: 0.82 },
      ],
      daydream_chip: {
        text: 'Kitty corn bakery',
        type: 'flavor',
        salience_score: 0.88,
      },
    })

    const messages: ChatHistoryItem[] = [
      { role: 'user', content: 'Do you remember the secret kitty corn bakery we discovered?' } as any,
      { role: 'assistant', content: 'Yes, that bakery had the best unicorn treats!' } as any,
    ]

    await updateRecentTopics('char-1', 'sess-1', 'user-1', messages, [], 'global')

    // 1. DaydreamStore received beat
    const daydreamStore = useDaydreamStore()
    expect(daydreamStore.activeVibe).toBe('affectionate')
    expect(daydreamStore.latestInnerThought).toBe('A sweet afternoon together...')
    expect(daydreamStore.chips).toHaveLength(1)
    expect(daydreamStore.chips[0].text).toBe('Kitty corn bakery')

    // 2. Card recentTopics received Needle-extracted topics with high priority
    const updatedCard = cardStore.getCard('char-1')
    const topics = updatedCard?.extensions?.airi?.recentTopics || []
    expect(topics.length).toBeGreaterThan(0)

    const kittyCornTopic = topics.find(t => t.topic === 'kitty corn bakery')
    expect(kittyCornTopic).toBeDefined()
    expect(kittyCornTopic?.weight).toBeGreaterThanOrEqual(2.0) // 0.95 * 2.5 = 2.375
  })
})
