import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { DEFAULT_STARTER_CARD_ID, getStarterCharacter, STARTER_CHARACTERS } from '../../constants/prompts/character-defaults'
import { storage } from '../../database/storage'
import { useAiriCardStore } from './airi-card'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@proj-airi/stage-ui-live2d', () => ({
  useLive2d: () => ({
    activeExpressions: null,
  }),
}))

vi.mock('@proj-airi/stage-ui-three', () => ({
  useModelStore: () => ({
    activeExpressions: null,
  }),
}))

vi.mock('@proj-airi/stage-ui-spine', () => ({
  useSpine: () => ({}),
}))

// ROOT CAUSE:
//
// In Alpha 4, the default companion was assigned the hardcoded ID 'default' instead
// of 'relu'. Over time, this created an architectural split where:
// 1. Starter seeding treated 'default' as a special snowflake.
// 2. Local database records keyed under 'default' lacked valid descriptions or
//    overrode freshly seeded metadata.
// 3. Components checked for 'default' with defensive fallbacks, causing
//    CardEditorForm and session stores to strip companion data or reset fields.
//
// FIXED BY:
// Decoupling ReLU completely from 'default'. The canonical starter ID is 'relu',
// seeded directly with id: 'relu', full descriptions, and creator: 'AIRI'. All
// 'default' shims have been completely eradicated.

describe('useAiriCardStore - Starter Seeding & Character Decoupling Invariants', () => {
  beforeEach(async () => {
    localStorage.clear()
    setActivePinia(createPinia())

    const keys = await storage.getKeys()
    for (const key of keys) {
      await storage.removeItem(key)
    }
  })

  afterEach(async () => {
    localStorage.clear()
    const keys = await storage.getKeys()
    for (const key of keys) {
      await storage.removeItem(key)
    }
  })

  it('safely accesses activeCard before initialization without TDZ errors', () => {
    const store = useAiriCardStore()
    // Invariant: must not throw "ReferenceError: Cannot access 'getCard' before initialization"
    expect(store.activeCard).toBeUndefined()
    expect(store.activeCardId).toBe(DEFAULT_STARTER_CARD_ID)
    expect(store.activeCardId).toBe('relu')
  })

  it('seeds ReLU, Aria, and Lupin on fresh boot with id: "relu" and non-empty description', async () => {
    const store = useAiriCardStore()
    await store.initialize()

    // Starter characters must be present
    expect(store.cards.size).toBeGreaterThanOrEqual(3)
    expect(store.cards.has('relu')).toBe(true)
    expect(store.cards.has('aria')).toBe(true)
    expect(store.cards.has('lupin')).toBe(true)

    // ReLU invariants
    const reluCard = store.getCard('relu')
    expect(reluCard).toBeDefined()
    expect(reluCard?.name).toBe('ReLU')
    expect(reluCard?.creator).toBe('AIRI')
    expect(reluCard?.description).toBeTruthy()
    expect(reluCard?.description?.length).toBeGreaterThan(10)
    expect(reluCard?.description).toBe(STARTER_CHARACTERS.relu.description)

    // Invariant: 'default' must NEVER be seeded as a card ID
    expect(store.cards.has('default')).toBe(false)
    expect(store.getCard('default')).toBeUndefined()

    // Active card must resolve to relu
    expect(store.activeCardId).toBe('relu')
    expect(store.activeCard).toBeDefined()
    expect(store.activeCard?.name).toBe('ReLU')
  })

  it('eradicates legacy "default" ID lookup and enforces exact card keying', async () => {
    const store = useAiriCardStore()
    await store.initialize()

    expect(store.getCard('relu')).toBeDefined()
    // Invariant: no shim or fallback alias should return ReLU for 'default'
    expect(store.getCard('default')).toBeUndefined()
    expect(store.getCard('nonexistent')).toBeUndefined()
  })

  it('updates companion fields and reactively reflects changes in activeCard and persistence', async () => {
    const store = useAiriCardStore()
    await store.initialize()

    const updatedDescription = 'A dedicated, highly observant AI soul mate tailored for deep companionship.'
    const success = await store.updateCard('relu', {
      description: updatedDescription,
    })

    expect(success).toBe(true)
    await nextTick()

    // In-memory map and computed activeCard must reflect change
    expect(store.getCard('relu')?.description).toBe(updatedDescription)
    expect(store.activeCard?.description).toBe(updatedDescription)

    // Persisted storage must contain the updated card under 'local:airi-cards'
    const persistedEntries = await storage.getItemRaw<[string, any][]>('local:airi-cards')
    expect(persistedEntries).toBeDefined()
    const reluEntry = persistedEntries?.find(([id]) => id === 'relu')
    expect(reluEntry).toBeDefined()
    expect(reluEntry?.[1]?.description).toBe(updatedDescription)
  })

  it('getStarterCharacter resolves to relu when ID is omitted or unknown', () => {
    expect(DEFAULT_STARTER_CARD_ID).toBe('relu')
    expect(getStarterCharacter().id).toBe('relu')
    expect(getStarterCharacter(undefined).id).toBe('relu')
    expect(getStarterCharacter('unknown_id').id).toBe('relu')
    expect(getStarterCharacter('relu').id).toBe('relu')
    expect(getStarterCharacter('aria').id).toBe('aria')
  })
})
