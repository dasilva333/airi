import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createTextJournalTool,
  executeCreateTextJournalEntry,
  executeSearchTextJournalEntries,
  executeTextJournalAction,
  textJournalParams,
} from '../modules/tools/text-journal'

// Mock stores
const mockCreateEntry = vi.fn()
const mockSearchEntries = vi.fn()
const mockSearchBlocks = vi.fn()
const mockLoadLongTerm = vi.fn()
const mockLoadShortTerm = vi.fn()

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (k: string) => k,
    d: (d: any) => d,
  }),
}))

vi.mock('../modules/airi-card', () => ({
  useAiriCardStore: () => ({
    activeCard: { name: 'Asuka Langley' },
    activeCardId: 'card-1',
  }),
}))

vi.mock('../memory-text-journal', () => ({
  useTextJournalStore: () => ({
    load: mockLoadLongTerm,
    createEntry: mockCreateEntry,
    searchEntries: mockSearchEntries,
  }),
}))

vi.mock('../memory-short-term', () => ({
  useShortTermMemoryStore: () => ({
    load: mockLoadShortTerm,
    searchBlocks: mockSearchBlocks,
  }),
}))

describe('text_journal tool (Consumer 3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockLoadLongTerm.mockResolvedValue(undefined)
    mockLoadShortTerm.mockResolvedValue(undefined)
  })

  describe('schema validation (textJournalParams)', () => {
    it('accepts search action with only query provided (omitted optional fields)', () => {
      const res = textJournalParams.safeParse({
        action: 'search',
        query: 'door access pin code',
      })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.action).toBe('search')
        expect(res.data.query).toBe('door access pin code')
        expect(res.data.limit).toBeUndefined()
        expect(res.data.title).toBeUndefined()
        expect(res.data.content).toBeUndefined()
      }
    })

    it('accepts explicit null values for optional fields', () => {
      const res = textJournalParams.safeParse({
        action: 'search',
        query: 'cafeteria heist',
        title: null,
        content: null,
        limit: null,
      })
      expect(res.success).toBe(true)
    })

    it('accepts create action with title and content', () => {
      const res = textJournalParams.safeParse({
        action: 'create',
        title: 'Secret Ramen Cache',
        content: 'Hid three packs of tonkotsu ramen under the desk.',
      })
      expect(res.success).toBe(true)
    })

    it('rejects invalid action', () => {
      const res = textJournalParams.safeParse({
        action: 'delete',
        query: 'something',
      })
      expect(res.success).toBe(false)
    })

    it('clamps or validates limit bounds', () => {
      expect(textJournalParams.safeParse({ action: 'search', query: 'test', limit: 0 }).success).toBe(false)
      expect(textJournalParams.safeParse({ action: 'search', query: 'test', limit: 15 }).success).toBe(false)
      expect(textJournalParams.safeParse({ action: 'search', query: 'test', limit: 5 }).success).toBe(true)
    })
  })

  describe('executeCreateTextJournalEntry', () => {
    it('returns error when content is empty or whitespace', async () => {
      const res1 = await executeCreateTextJournalEntry({ content: '' })
      expect(res1).toContain('Error: content is required')

      const res2 = await executeCreateTextJournalEntry({ content: '   ' })
      expect(res2).toContain('Error: content is required')
      expect(mockCreateEntry).not.toHaveBeenCalled()
    })

    it('calls store.createEntry and returns confirmation message', async () => {
      mockCreateEntry.mockResolvedValueOnce({
        title: 'EVA Unit 02 Maintenance',
        characterName: 'Asuka Langley',
      })

      const res = await executeCreateTextJournalEntry({
        title: 'EVA Unit 02 Maintenance',
        content: 'Synchronized power couplings.',
      })

      expect(mockCreateEntry).toHaveBeenCalledWith({
        title: 'EVA Unit 02 Maintenance',
        content: 'Synchronized power couplings.',
        source: 'tool',
      })
      expect(res).toBe('Saved text journal entry "EVA Unit 02 Maintenance" for Asuka Langley.')
    })
  })

  describe('executeSearchTextJournalEntries', () => {
    it('returns error when query is empty or whitespace', async () => {
      const res = await executeSearchTextJournalEntries({ query: '   ' })
      expect(res).toContain('Error: query is required')
      expect(mockSearchEntries).not.toHaveBeenCalled()
    })

    it('maps multi-layer entries into structured Level 1 evidence objects', async () => {
      mockSearchEntries.mockResolvedValueOnce([
        {
          id: 'claim-1',
          kind: 'kg_claim',
          isKgClaim: true,
          subject: 'Asuka',
          predicate: 'pilots',
          object: 'EVA-02',
          content: 'Asuka pilots Evangelion Unit-02.',
          dateInfo: { timestamp: '2026-06-01T12:00:00.000Z' },
          score: 0.9523,
        },
        {
          id: 'msg-345',
          kind: 'raw',
          content: 'The door code for cafeteria storage was 3-3-9-0.',
          timestamp: '2026-06-05T14:30:00.000Z',
          title: '[RAW] Memory',
          score: 0.8876,
        },
        {
          id: 'stmm-2',
          kind: 'stmm',
          content: 'Yesterday we had lunch at the rooftop and planned the prank.',
          timestamp: '2026-06-04',
          title: 'Daily Summary',
          score: 0.7612,
        },
        {
          id: 'journal-8',
          kind: 'ltmm',
          content: 'A deep reflection on what happened in Tokyo-3.',
          createdAt: new Date('2026-05-30T10:00:00.000Z').getTime(),
          title: 'Private Journal',
          score: 0.6999,
        },
      ])

      const rawResult = await executeSearchTextJournalEntries({
        query: 'door code EVA Asuka',
        limit: 5,
      })

      expect(mockLoadLongTerm).toHaveBeenCalled()
      expect(mockSearchEntries).toHaveBeenCalledWith({
        query: 'door code EVA Asuka',
        limit: 5,
      })

      const evidence = JSON.parse(rawResult)
      expect(Array.isArray(evidence)).toBe(true)
      expect(evidence).toHaveLength(4)

      // Knowledge Graph Claim
      expect(evidence[0]).toEqual({
        id: 'claim-1',
        layer: 'knowledge-graph',
        date: '2026-06-01',
        subject: 'Asuka',
        fact: 'Asuka pilots EVA-02',
        observed_text: 'Asuka pilots Evangelion Unit-02.',
        relevanceScore: 0.952,
      })

      // Raw Dialogue Turn
      expect(evidence[1]).toEqual({
        id: 'msg-345',
        layer: 'dialogue',
        date: '2026-06-05',
        subject: 'Memory',
        fact: 'Memory',
        observed_text: 'The door code for cafeteria storage was 3-3-9-0.',
        relevanceScore: 0.888,
      })

      // Short-Term Memory Recap
      expect(evidence[2]).toEqual({
        id: 'stmm-2',
        layer: 'short-term',
        date: '2026-06-04',
        subject: 'Daily Summary',
        fact: 'Daily Summary',
        observed_text: 'Yesterday we had lunch at the rooftop and planned the prank.',
        relevanceScore: 0.761,
      })

      // Long-Term Journal Entry
      expect(evidence[3]).toEqual({
        id: 'journal-8',
        layer: 'long-term',
        date: '2026-05-30',
        subject: 'Private Journal',
        fact: 'Private Journal',
        observed_text: 'A deep reflection on what happened in Tokyo-3.',
        relevanceScore: 0.7,
      })
    })

    it('falls back to shortTermStore if layered search returns no items', async () => {
      mockSearchEntries.mockResolvedValueOnce([])
      mockSearchBlocks.mockReturnValueOnce([
        {
          id: 'block-9',
          date: '2026-06-03',
          summary: 'Met Shinji near the convenience store.',
        },
      ])

      const rawResult = await executeSearchTextJournalEntries({
        query: 'convenience store',
      })

      expect(mockLoadShortTerm).toHaveBeenCalled()
      expect(mockSearchBlocks).toHaveBeenCalledWith({
        query: 'convenience store',
        limit: 5,
      })

      const evidence = JSON.parse(rawResult)
      expect(evidence).toHaveLength(1)
      expect(evidence[0]).toEqual({
        id: 'block-9',
        layer: 'short-term',
        date: '2026-06-03',
        subject: 'Recap: 2026-06-03',
        fact: 'Met Shinji near the convenience store.',
        observed_text: 'Met Shinji near the convenience store.',
      })
    })

    it('returns empty array string when both long-term and short-term yield 0 matches', async () => {
      mockSearchEntries.mockResolvedValueOnce([])
      mockSearchBlocks.mockReturnValueOnce([])

      const rawResult = await executeSearchTextJournalEntries({
        query: 'nonexistent alien spaceship',
      })

      expect(rawResult).toBe('[]')
    })
  })

  describe('executeTextJournalAction router', () => {
    it('routes "create" action properly', async () => {
      mockCreateEntry.mockResolvedValueOnce({
        title: 'Note',
        characterName: 'Asuka',
      })

      const res = await executeTextJournalAction({
        action: 'create',
        title: 'Note',
        content: 'Testing create action router.',
      })

      expect(res).toContain('Saved text journal entry "Note"')
    })

    it('routes "search" action properly', async () => {
      mockSearchEntries.mockResolvedValueOnce([])
      mockSearchBlocks.mockReturnValueOnce([])

      const res = await executeTextJournalAction({
        action: 'search',
        query: 'testing query',
      })

      expect(res).toBe('[]')
    })
  })

  describe('createTextJournalTool factory', () => {
    it('creates an xsai tool named text_journal with parameters and execute function', async () => {
      const toolDef = await createTextJournalTool()
      expect((toolDef as any).name || (toolDef as any).function?.name).toBe('text_journal')
      expect(typeof (toolDef as any).execute).toBe('function')
    })
  })
})
