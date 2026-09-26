import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  appendChronoLogEntry,
  clearChronoLog,
  enrichChronoLogWithEntities,
  getChronoLogEntries,
} from './orchestrator'

// Mock useEntityLedgerStore
vi.mock('../../entity-ledger', () => ({
  useEntityLedgerStore: vi.fn(() => ({
    entities: [
      {
        label: 'Kyo',
        type: 'Person',
        attributes: { relationship: 'Collaborator and friend' },
        mentions: new Set(['kyosuke', 'kyo']),
      },
      {
        label: 'AIRI',
        type: 'Software',
        attributes: { summary: 'Autonomous AI companion' },
      },
    ],
    claims: [
      {
        subject: 'Kyo',
        predicate: 'collaborated on',
        object: 'AIRI PR #104',
      },
    ],
  })),
}))

describe('vision orchestrator chrono-log & semantic evidence', () => {
  beforeEach(() => {
    clearChronoLog()
  })

  describe('chrono-log ring buffer', () => {
    it('appends entries and maintains FIFO capacity of 5', () => {
      expect(getChronoLogEntries()).toHaveLength(0)

      for (let i = 1; i <= 7; i++) {
        appendChronoLogEntry({
          timestamp: 1000 * i,
          activeWindow: `Window ${i}`,
          caption: `Screen frame ${i}`,
        })
      }

      const entries = getChronoLogEntries()
      expect(entries).toHaveLength(5)
      expect(entries[0].caption).toBe('Screen frame 3')
      expect(entries[4].caption).toBe('Screen frame 7')
    })

    it('clears all entries when requested', () => {
      appendChronoLogEntry({
        timestamp: Date.now(),
        caption: 'A test caption',
      })
      expect(getChronoLogEntries()).toHaveLength(1)

      clearChronoLog()
      expect(getChronoLogEntries()).toHaveLength(0)
    })
  })

  describe('enrichChronoLogWithEntities', () => {
    it('extracts recognized entity matches and attaches claims as relational evidence', async () => {
      const now = Date.now()
      const entries = [
        {
          timestamp: now - 30_000,
          activeWindow: 'Code',
          caption: 'Editing files for AIRI release',
        },
        {
          timestamp: now - 5_000,
          activeWindow: 'Discord',
          caption: 'Chatting with Kyo about the pull request',
        },
      ]

      const { formattedHistory, attachedEvidence } = await enrichChronoLogWithEntities(entries)

      expect(formattedHistory).toContain('[App: Code] Editing files for AIRI release')
      expect(formattedHistory).toContain('[App: Discord] Chatting with Kyo about the pull request')

      expect(attachedEvidence.length).toBeGreaterThan(0)
      const evidenceText = attachedEvidence.join('\n')
      expect(evidenceText).toContain('Kyo')
      expect(evidenceText).toContain('Kyo collaborated on AIRI PR #104')
      expect(evidenceText).toContain('AIRI')
    })

    it('handles empty entries or no recognized entities gracefully', async () => {
      const { formattedHistory, attachedEvidence } = await enrichChronoLogWithEntities([])
      expect(formattedHistory).toBe('')
      expect(attachedEvidence).toHaveLength(0)
    })
  })
})
