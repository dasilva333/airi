import type { TextJournalEntry } from '../types/text-journal'
import type { AiriCard } from './modules/airi-card'

import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTextJournalStore } from './memory-text-journal'

// Mock the database repo so tests don't touch IndexedDB
vi.mock('../database/repos/text-journal.repo', () => ({
  textJournalRepo: {
    getAll: vi.fn(async () => []),
    saveAll: vi.fn(async () => undefined),
  },
}))

// NOTICE: Pinia v3's storeToRefs iterates all keys and does `value.effect` before
// isRef/isReactive — it crashes on null/primitive values. The correct pattern is to
// return a `reactive()` object wrapping Vue refs so storeToRefs gets a Pinia-like
// proxy that auto-unwraps refs (reactive() unwraps nested refs on access).
//
// The vi.mock factories use async `import('vue')` — Vitest vi.mock factories support
// async imports. The reactive/ref state holders are created once per module load
// then mutated between tests through the `h` hoisted handles.

// Shared mutable state holders — initialised to null, filled by the mock factories.
// vi.hoisted ensures they exist before vi.mock factories run.
const h = vi.hoisted(() => ({
  userId: { r: null as null | { value: string | null } },
  activeCard: { r: null as null | { value: AiriCard | null } },
  activeCardId: { r: null as null | { value: string } },
  cards: { r: null as null | { value: Map<string, AiriCard> } },
}))

vi.mock('./auth', async () => {
  const { reactive, ref } = await import('vue')
  h.userId.r = ref<string | null>(null)
  return { useAuthStore: () => reactive({ userId: h.userId.r }) }
})

vi.mock('./modules/airi-card', async () => {
  const { reactive, ref } = await import('vue')
  h.activeCard.r = ref<AiriCard | null>(null)
  h.activeCardId.r = ref<string>('card-1')
  h.cards.r = ref<Map<string, AiriCard>>(new Map())
  const store = reactive({
    activeCard: h.activeCard.r,
    activeCardId: h.activeCardId.r,
    cards: h.cards.r,
  })
  return { useAiriCardStore: () => store }
})

// Import the repo AFTER mocks are registered to get the mocked version
const { textJournalRepo } = await import('../database/repos/text-journal.repo')

// Minimal card fixture — only the fields memory-text-journal.ts actually reads (name).
// Cast to avoid constructing the full AiriExtension required by the AiriCard type.
const mockCard = { name: 'TestChar', version: '1' } as unknown as AiriCard

describe('useTextJournalStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(textJournalRepo.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(textJournalRepo.saveAll as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    // Reset reactive mock state before each test
    h.activeCard.r!.value = mockCard
    h.activeCardId.r!.value = 'card-1'
    h.cards.r!.value = new Map([['card-1', mockCard]])

    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    setActivePinia(pinia)
  })

  // ── load ──────────────────────────────────────────────────────────────

  describe('load', () => {
    it('fetches entries from the repo and normalizes them', async () => {
      const raw: TextJournalEntry[] = [
        {
          id: '1',
          userId: 'local',
          characterId: 'card-1',
          characterName: 'TestChar',
          title: 'Hello',
          content: 'World',
          source: 'tool',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ]
      ;(textJournalRepo.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(raw)

      const store = useTextJournalStore()
      await store.load()

      expect(store.entries).toHaveLength(1)
      expect(store.entries[0].title).toBe('Hello')
    })

    it('does not call repo a second time when already initialized for the same userId', async () => {
      const store = useTextJournalStore()
      await store.load()
      await store.load()

      expect(textJournalRepo.getAll).toHaveBeenCalledTimes(1)
    })

    it('treats a null repo result as an empty array', async () => {
      ;(textJournalRepo.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const store = useTextJournalStore()
      await store.load()

      expect(store.entries).toHaveLength(0)
    })

    it('wraps repo errors with a text_journal prefix on createEntry', async () => {
      ;(textJournalRepo.getAll as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('IDB gone'))

      const store = useTextJournalStore()
      await expect(store.createEntry({ content: 'test' })).rejects.toThrow(
        'text_journal: failed to load entries before creating: IDB gone',
      )
    })
  })

  // ── createEntry ───────────────────────────────────────────────────────

  describe('createEntry', () => {
    it('creates an entry scoped to the active character', async () => {
      const store = useTextJournalStore()
      const entry = await store.createEntry({ title: 'My Day', content: 'Great day!' })

      expect(entry.characterId).toBe('card-1')
      expect(entry.characterName).toBe('TestChar')
      expect(entry.title).toBe('My Day')
      expect(entry.content).toBe('Great day!')
      expect(entry.source).toBe('tool')
      expect(typeof entry.createdAt).toBe('number')
    })

    it('falls back to "Journal Entry" when title is omitted', async () => {
      const store = useTextJournalStore()
      const entry = await store.createEntry({ content: 'No title provided' })
      expect(entry.title).toBe('Journal Entry')
    })

    it('resolves character by explicit characterId when provided', async () => {
      const altCard = { name: 'AltChar', version: '1' } as unknown as AiriCard
      h.cards.r!.value.set('card-2', altCard)

      const store = useTextJournalStore()
      const entry = await store.createEntry({ content: 'alt', characterId: 'card-2' })
      expect(entry.characterId).toBe('card-2')
      expect(entry.characterName).toBe('AltChar')
    })

    it('throws when no active card is available', async () => {
      h.activeCard.r!.value = null
      h.activeCardId.r!.value = ''

      const store = useTextJournalStore()
      await expect(store.createEntry({ content: 'orphan' })).rejects.toThrow(
        'No active character is available for text_journal.create.',
      )
    })

    it('throws when active card id is empty after resolution', async () => {
      h.activeCardId.r!.value = ''

      const store = useTextJournalStore()
      await expect(store.createEntry({ content: 'test' })).rejects.toThrow(
        'Active character could not be resolved for text journal entry creation.',
      )
    })

    it('wraps persist errors with a text_journal prefix', async () => {
      ;(textJournalRepo.saveAll as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('disk full'))

      const store = useTextJournalStore()
      await expect(store.createEntry({ title: 'Oops', content: 'fail' })).rejects.toThrow(
        'text_journal: failed to persist new entry "Oops": disk full',
      )
    })

    it('prepends the new entry so it appears first', async () => {
      const existing: TextJournalEntry = {
        id: 'old-1',
        userId: 'local',
        characterId: 'card-1',
        characterName: 'TestChar',
        title: 'Old',
        content: 'Old content',
        source: 'tool',
        createdAt: 1000,
        updatedAt: 1000,
      }
      ;(textJournalRepo.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([existing])

      const store = useTextJournalStore()
      await store.createEntry({ content: 'New content', title: 'New' })

      const saved = (textJournalRepo.saveAll as ReturnType<typeof vi.fn>).mock.calls[0][1] as TextJournalEntry[]
      expect(saved[0].title).toBe('New')
      expect(saved[1].id).toBe('old-1')
    })
  })

  // ── searchEntries ─────────────────────────────────────────────────────

  describe('searchEntries', () => {
    const makeEntry = (overrides: Partial<TextJournalEntry>): TextJournalEntry => ({
      id: overrides.id ?? 'e1',
      userId: 'local',
      characterId: overrides.characterId ?? 'card-1',
      characterName: 'TestChar',
      title: overrides.title ?? 'Untitled',
      content: overrides.content ?? '',
      source: 'tool',
      createdAt: overrides.createdAt ?? 1000,
      updatedAt: 1000,
    })

    beforeEach(() => {
      const entries = [
        makeEntry({ id: 'e1', title: 'apple diary', content: 'nothing special', createdAt: 1000 }),
        makeEntry({ id: 'e2', title: 'random', content: 'apple in content', createdAt: 2000 }),
        makeEntry({ id: 'e3', title: 'no match', content: 'completely different', createdAt: 3000 }),
        makeEntry({ id: 'e4', title: 'apple theme', content: 'apple appears here too', createdAt: 4000 }),
      ]
      ;(textJournalRepo.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(entries)
    })

    it('returns empty array for a blank query', async () => {
      const store = useTextJournalStore()
      const result = await store.searchEntries({ query: '  ' })
      expect(result).toHaveLength(0)
    })

    it('scores title matches higher than content matches', async () => {
      const store = useTextJournalStore()
      const result = await store.searchEntries({ query: 'apple', limit: 10 })

      // e4 has title+content (4+2=6), e1 has title only (4), e2 has content only (2)
      expect(result[0].id).toBe('e4')
      expect(result[1].id).toBe('e1')
      expect(result[2].id).toBe('e2')
    })

    it('excludes entries with no match', async () => {
      const store = useTextJournalStore()
      const result = await store.searchEntries({ query: 'apple', limit: 10 })
      expect(result.map(e => e.id)).not.toContain('e3')
    })

    it('respects the limit (capped at 10)', async () => {
      const manyEntries = Array.from({ length: 15 }, (_, i) =>
        makeEntry({ id: `e${i}`, title: `apple ${i}`, createdAt: i }))
      ;(textJournalRepo.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(manyEntries)

      const store = useTextJournalStore()
      const result = await store.searchEntries({ query: 'apple', limit: 20 })
      expect(result.length).toBeLessThanOrEqual(10)
    })

    it('returns at least 1 result even when limit is 0', async () => {
      const store = useTextJournalStore()
      const result = await store.searchEntries({ query: 'apple', limit: 0 })
      expect(result.length).toBeGreaterThanOrEqual(1)
    })

    it('scopes search to the given characterId', async () => {
      const entries = [
        makeEntry({ id: 'e1', title: 'apple', characterId: 'card-1' }),
        makeEntry({ id: 'alt-1', characterId: 'card-2', title: 'apple alt' }),
      ]
      ;(textJournalRepo.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(entries)

      const store = useTextJournalStore()
      const result = await store.searchEntries({ query: 'apple', characterId: 'card-2' })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('alt-1')
    })

    it('wraps load errors with a text_journal prefix', async () => {
      ;(textJournalRepo.getAll as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('IDB error'))

      const store = useTextJournalStore()
      await expect(store.searchEntries({ query: 'anything' })).rejects.toThrow(
        'text_journal: failed to load entries before searching: IDB error',
      )
    })
  })

  // ── entries sort order ────────────────────────────────────────────────

  describe('sortedEntries', () => {
    it('exposes entries sorted newest-first by createdAt', async () => {
      const entries: TextJournalEntry[] = [
        {
          id: 'a',
          userId: 'local',
          characterId: 'card-1',
          characterName: 'TestChar',
          title: 'Old',
          content: '',
          source: 'tool',
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: 'b',
          userId: 'local',
          characterId: 'card-1',
          characterName: 'TestChar',
          title: 'New',
          content: '',
          source: 'tool',
          createdAt: 9000,
          updatedAt: 9000,
        },
      ]
      ;(textJournalRepo.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(entries)

      const store = useTextJournalStore()
      await store.load()

      expect(store.entries[0].id).toBe('b')
      expect(store.entries[1].id).toBe('a')
    })
  })
})
