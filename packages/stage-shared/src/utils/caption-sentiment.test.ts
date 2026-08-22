import { describe, expect, it } from 'vitest'

import { analyzeCaptionSentence, subChunkText } from './caption-sentiment'

describe('caption-sentiment', () => {
  describe('explicit bracket tokens', () => {
    it('handles [flustered] token', () => {
      const res = analyzeCaptionSentence('[flustered] I did not expect that!')
      expect(res.ambient).toBe('blush')
      expect(res.accent).toBe('sweat-drop')
      expect(res.motion).toBe('wobble')
      expect(res.tailStyle).toBe('heart-curl')
    })

    it('handles [angry] token', () => {
      const res = analyzeCaptionSentence('[angry] How dare you!')
      expect(res.bodyStyle).toBe('jagged-starburst')
      expect(res.tailStyle).toBe('jagged-pointer')
      expect(res.accent).toBe('anger-mark')
      expect(res.motion).toBe('shake')
    })

    it('handles [thinking] token', () => {
      const res = analyzeCaptionSentence('[thinking] What could this be?')
      expect(res.bodyStyle).toBe('scalloped-cloud')
      expect(res.tailStyle).toBe('thought-dots')
      expect(res.accent).toBe('question-mark')
    })

    it('handles [gasp] token', () => {
      const res = analyzeCaptionSentence('[gasp] Is that really you?')
      expect(res.accent).toBe('flash-burst')
      expect(res.motion).toBe('bounce')
    })

    it('handles [sad] token', () => {
      const res = analyzeCaptionSentence('[sad] It hurts so much...')
      expect(res.ambient).toBe('rain')
      expect(res.tailStyle).toBe('droop')
    })

    it('handles [yandere] token', () => {
      const res = analyzeCaptionSentence('[yandere] You are mine forever.')
      expect(res.ambient).toBe('vignette')
      expect(res.rim).toBe('heartbeat-pulse')
    })

    it('handles [sleepy] token', () => {
      const res = analyzeCaptionSentence('[sleepy] So tired...')
      expect(res.ambient).toBe('fireflies')
      expect(res.motion).toBe('breath')
    })
  })

  describe('negation filtering', () => {
    it('suppresses anger when negated (e.g. "not angry")', () => {
      const res = analyzeCaptionSentence('I am not angry at all.')
      expect(res.accent).toBeNull()
      expect(res.bodyStyle).toBe('standard-rounded')
      expect(res.tailStyle).toBe('pointer')
    })

    it('suppresses sad when negated (e.g. "never cry")', () => {
      const res = analyzeCaptionSentence('I will never cry again.')
      expect(res.ambient).toBeNull()
      expect(res.tailStyle).toBe('pointer')
    })
  })

  describe('keyword and sentiment triggers', () => {
    it('triggers affection/hearts on "love you"', () => {
      const res = analyzeCaptionSentence('I love you so much!')
      expect(res.ambient).toBe('hearts')
      expect(res.tailStyle).toBe('heart-curl')
    })

    it('triggers flower bloom on gratitude/compliment', () => {
      const res = analyzeCaptionSentence('Thank you, you are so pretty and amazing!')
      expect(res.rim).toBe('flower-bloom')
      expect(res.ambient).toBe('stars')
    })

    it('triggers cat speech on "nya"', () => {
      const res = analyzeCaptionSentence('Good morning nya~')
      expect(res.tailStyle).toBe('wagging')
    })

    it('triggers cyber scanline on tech terms', () => {
      const res = analyzeCaptionSentence('Initiating system diagnostic and data analyze.')
      expect(res.ambient).toBe('scanline')
    })

    it('triggers sunbeams on cozy terms', () => {
      const res = analyzeCaptionSentence('Time to relax and have a cozy evening.')
      expect(res.ambient).toBe('sunbeam')
      expect(res.motion).toBe('breath')
    })

    it('triggers fear / fireflies / frost-rim on scary terms', () => {
      const res = analyzeCaptionSentence('That sound was creepy and cold.')
      expect(res.ambient).toBe('fireflies')
      expect(res.motion).toBe('wobble')
      expect(res.rim).toBe('frost-rim')
    })
  })

  describe('structural triggers', () => {
    it('triggers blush and wobble on stutters', () => {
      const res = analyzeCaptionSentence('U-um... w-wait a second!')
      expect(res.ambient).toBe('blush')
      expect(res.accent).toBe('sweat-drop')
      expect(res.motion).toBe('wobble')
    })

    it('triggers fireflies and breathing on ellipses', () => {
      const res = analyzeCaptionSentence('Just wondering...')
      expect(res.ambient).toBe('fireflies')
      expect(res.motion).toBe('breath')
    })

    it('triggers flash burst and bounce on double punctuation', () => {
      const res = analyzeCaptionSentence('Wait, what?!')
      expect(res.accent).toBe('flash-burst')
      expect(res.motion).toBe('bounce')
    })

    it('triggers scalloped thought cloud on parenthetical asides', () => {
      const res = analyzeCaptionSentence('(I hope they did not see that)')
      expect(res.bodyStyle).toBe('scalloped-cloud')
      expect(res.tailStyle).toBe('thought-dots')
    })

    it('triggers starburst on ALL CAPS', () => {
      const res = analyzeCaptionSentence('STOP RIGHT THERE!')
      expect(res.bodyStyle).toBe('jagged-starburst')
      expect(res.tailStyle).toBe('jagged-pointer')
      expect(res.motion).toBe('shake')
    })

    it('triggers stretch on elongated words', () => {
      const res = analyzeCaptionSentence('That is soooo cool')
      expect(res.motion).toBe('stretch')
    })
  })

  describe('subChunkText', () => {
    it('returns single chunk for short text', () => {
      const chunks = subChunkText('Hello world!')
      expect(chunks).toEqual(['Hello world!'])
    })

    it('splits on punctuation boundaries when length exceeds maxChars', () => {
      const longText = 'Hello there! This is a longer sentence that should naturally split at clause boundaries, allowing the micro-pacer to work smoothly.'
      const chunks = subChunkText(longText, 60)
      expect(chunks.length).toBeGreaterThan(1)
      expect(chunks.every(c => c.length <= 65)).toBe(true)
    })

    it('handles empty or whitespace strings', () => {
      expect(subChunkText('')).toEqual([])
      expect(subChunkText('   ')).toEqual([])
    })
  })
})
