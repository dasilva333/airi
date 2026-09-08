import { describe, expect, it } from 'vitest'

import {
  formatArtistryPrompt,
  formatClimaxPrompt,
  formatDreamPrompt,
  formatJournalPrompt,
} from './intrusions'

describe('intrusions pure computational seams', () => {
  describe('formatClimaxPrompt', () => {
    it('returns empty string when dating sim is disabled or not goal-driven', () => {
      expect(formatClimaxPrompt({ enabled: false, gameMode: 'goal_driven' })).toBe('')
      expect(formatClimaxPrompt({ enabled: true, gameMode: 'free_play' })).toBe('')
    })

    it('returns empty string when scores and turns are below climax thresholds', () => {
      expect(formatClimaxPrompt({
        enabled: true,
        gameMode: 'goal_driven',
        positiveScore: 3,
        negativeScore: 2,
        maxScore: 10,
        maxTurns: 10,
        assistantTurnCount: 4,
      })).toBe('')
    })

    it('formats VICTORY prompt when positive score reaches maxScore', () => {
      const prompt = formatClimaxPrompt({
        enabled: true,
        gameMode: 'goal_driven',
        positiveScore: 10,
        negativeScore: 4,
        maxScore: 10,
        maxTurns: 15,
        assistantTurnCount: 5,
      })
      expect(prompt).toContain('[DATING SIM CLIMAX RESOLUTION]')
      expect(prompt).toContain('climax state: VICTORY')
      expect(prompt).toContain('Intimacy Connection: 10/10')
      expect(prompt).toContain('Tension/Friction: 4/10')
    })

    it('formats DEFEAT prompt when negative score reaches maxScore', () => {
      const prompt = formatClimaxPrompt({
        enabled: true,
        gameMode: 'goal_driven',
        positiveScore: 2,
        negativeScore: 10,
        maxScore: 10,
        maxTurns: 15,
        assistantTurnCount: 5,
      })
      expect(prompt).toContain('climax state: DEFEAT')
      expect(prompt).toContain('Tension/Friction: 10/10')
    })

    it('formats VICTORY prompt when turns reach maxTurns and positive score exceeds negative', () => {
      const prompt = formatClimaxPrompt({
        enabled: true,
        gameMode: 'goal_driven',
        positiveScore: 8,
        negativeScore: 4,
        maxScore: 10,
        maxTurns: 5,
        assistantTurnCount: 4, // turns + 1 === 5 === maxTurns
      })
      expect(prompt).toContain('climax state: VICTORY')
      expect(prompt).toContain('Turns Elapsed: 5/5')
    })

    it('formats DEFEAT prompt when turns reach maxTurns and scores are tied', () => {
      const prompt = formatClimaxPrompt({
        enabled: true,
        gameMode: 'goal_driven',
        positiveScore: 6,
        negativeScore: 6,
        maxScore: 10,
        maxTurns: 5,
        assistantTurnCount: 4, // turns + 1 === 5 === maxTurns, neg >= pos
      })
      expect(prompt).toContain('climax state: DEFEAT')
      expect(prompt).toContain('Turns Elapsed: 5/5')
    })
  })

  describe('formatDreamPrompt', () => {
    it('returns empty string when dream injection is disabled or chips are empty', () => {
      expect(formatDreamPrompt({ injectDreamContext: false, pendingDreamChips: ['stargazing'], nowMs: 1000 })).toBe('')
      expect(formatDreamPrompt({ injectDreamContext: true, pendingDreamChips: [], nowMs: 1000 })).toBe('')
      expect(formatDreamPrompt({ injectDreamContext: true, pendingDreamChips: undefined, nowMs: 1000 })).toBe('')
    })

    it('interpolates default dream template with elapsed minutes and chip list', () => {
      const now = 100000000
      const prompt = formatDreamPrompt({
        injectDreamContext: true,
        pendingDreamChips: ['midnight ocean', 'shooting star'],
        pendingDreamTimestamp: now - 300000, // 5 minutes ago
        nowMs: now,
      })
      expect(prompt).toContain('5 minutes ago')
      expect(prompt).toContain('midnight ocean, shooting star')
      expect(prompt).toContain('had a dream about:')
    })

    it('enforces minimum 1 elapsed minute for immediate dreams', () => {
      const now = 100000000
      const prompt = formatDreamPrompt({
        injectDreamContext: true,
        pendingDreamChips: ['digital sunrise'],
        pendingDreamTimestamp: now - 1000, // 1 second ago
        nowMs: now,
      })
      expect(prompt).toContain('1 minutes ago')
    })

    it('supports custom dream template substitution', () => {
      const prompt = formatDreamPrompt({
        injectDreamContext: true,
        pendingDreamChips: ['rainy cafe'],
        pendingDreamTimestamp: 1000,
        nowMs: 1000 + 120000,
        template: 'Custom dream prompt: {timeToDream}m ago about {insertEchoChips}.',
      })
      expect(prompt).toBe('Custom dream prompt: 2m ago about rainy cafe.')
    })
  })

  describe('formatJournalPrompt', () => {
    it('returns empty string when journal injection is disabled or entry is missing', () => {
      expect(formatJournalPrompt({ injectJournalContext: false, entryText: 'My thoughts', nowMs: 1000 })).toBe('')
      expect(formatJournalPrompt({ injectJournalContext: true, hasEntry: false, nowMs: 1000 })).toBe('')
      expect(formatJournalPrompt({ injectJournalContext: true, entryText: undefined, nowMs: 1000 })).toBe('')
    })

    it('formats template even for empty string entry when hasEntry is true (preserving baseline staging clear)', () => {
      const prompt = formatJournalPrompt({
        injectJournalContext: true,
        hasEntry: true,
        entryText: '',
        template: 'Reflect on: {journalEntryText}',
        nowMs: 1000,
      })
      expect(prompt).toBe('Reflect on: ')
    })

    it('interpolates default journal template with elapsed minutes and text', () => {
      const now = 100000000
      const prompt = formatJournalPrompt({
        injectJournalContext: true,
        entryText: 'Today was quiet and reflective.',
        timestamp: now - 600000, // 10 minutes ago
        nowMs: now,
      })
      expect(prompt).toContain('10 minutes ago')
      expect(prompt).toContain('"Today was quiet and reflective."')
      expect(prompt).toContain('find a natural way to reflect on this action')
    })

    it('supports custom journal template substitution', () => {
      const prompt = formatJournalPrompt({
        injectJournalContext: true,
        entryText: 'Special event',
        timestamp: 1000,
        nowMs: 1000 + 180000,
        template: 'Note from {timeSinceJournal}m: {journalEntryText}',
      })
      expect(prompt).toBe('Note from 3m: Special event')
    })
  })

  describe('formatArtistryPrompt', () => {
    it('returns empty string when artistry injection is disabled or prompt is missing', () => {
      expect(formatArtistryPrompt({ injectArtistryContext: false, prompt: 'A cozy fireplace' })).toBe('')
      expect(formatArtistryPrompt({ injectArtistryContext: true, hasEntry: false })).toBe('')
      expect(formatArtistryPrompt({ injectArtistryContext: true, prompt: undefined })).toBe('')
    })

    it('formats template even for empty string prompt when hasEntry is true', () => {
      const prompt = formatArtistryPrompt({
        injectArtistryContext: true,
        hasEntry: true,
        prompt: '',
        template: 'Art generated: {imagePrompt}',
      })
      expect(prompt).toBe('Art generated: ')
    })

    it('interpolates default artistry template with image prompt', () => {
      const prompt = formatArtistryPrompt({
        injectArtistryContext: true,
        prompt: 'A neon-lit cyberpunk alleyway',
      })
      expect(prompt).toContain('"A neon-lit cyberpunk alleyway"')
      expect(prompt).toContain('You just finished creating a new artwork of:')
    })

    it('supports custom artistry template substitution', () => {
      const prompt = formatArtistryPrompt({
        injectArtistryContext: true,
        prompt: 'Sunset over mountains',
        template: 'Art generated: {imagePrompt}',
      })
      expect(prompt).toBe('Art generated: Sunset over mountains')
    })
  })
})
