import { describe, expect, it, vi } from 'vitest'

import { evaluateCadenceSplits } from './classifier'

describe('evaluateCadenceSplits', () => {
  it('returns single bubble for text without newlines without calling System 1', async () => {
    const mockExecute = vi.fn()
    const result = await evaluateCadenceSplits('Hello there world!', {
      systemOneExecute: mockExecute,
    })

    expect(result.bubbles).toEqual(['Hello there world!'])
    expect(result.evaluations).toHaveLength(0)
    expect(result.pausesMs).toHaveLength(0)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('splits when score meets or exceeds default splitThreshold (0.45) and bundles choice rhythm question', async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      answers: {
        b_0: { type: 'noul', noul: 0.47 },
        c_0: {
          type: 'choice',
          choice: 'conversational_beat',
          probabilities: { rapid_burst: 0.2, conversational_beat: 0.7, thoughtful_pause: 0.1 },
        },
      },
    })

    const text = 'Wait really?\nI had no idea that happened!'
    const result = await evaluateCadenceSplits(text, {
      systemOneExecute: mockExecute,
    })

    expect(mockExecute).toHaveBeenCalledTimes(1)
    const callArgs = mockExecute.mock.calls[0]
    expect(callArgs[0]).toContain('You are splitting one outgoing text into casual chat bubbles.')
    expect(callArgs[1].b_0.instructions).toBe('Would a casual texter hit send after "Wait really?" and start a new bubble at "I had no idea that happened!"?')
    expect(callArgs[1].c_0.type).toBe('choice')
    expect(callArgs[1].c_0.criteria).toHaveProperty('rapid_burst')
    expect(callArgs[1].c_0.criteria).toHaveProperty('conversational_beat')
    expect(callArgs[1].c_0.criteria).toHaveProperty('thoughtful_pause')

    expect(result.bubbles).toEqual(['Wait really?', 'I had no idea that happened!'])
    expect(result.evaluations).toHaveLength(1)
    expect(result.evaluations[0].isSplit).toBe(true)
    expect(result.evaluations[0].score).toBe(0.47)
    expect(result.evaluations[0].rhythmCategory).toBe('conversational_beat')

    // Expected beat = 350*0.2 + 900*0.7 + 1800*0.1 = 70 + 630 + 180 = 880ms
    // Typing length = "I had no idea that happened!".length (28) * 35 = 980ms
    // Total delay = 880 + 980 = 1860ms
    expect(result.evaluations[0].expectedBeatMs).toBe(880)
    expect(result.evaluations[0].calculatedDelayMs).toBe(1860)
    expect(result.evaluations[0].textDelayMs).toBe(1860)
    expect(result.evaluations[0].beatMs).toBe(880)
    expect(result.pausesMs).toEqual([1860])
    expect(result.beatsMs).toEqual([880])
    expect(result.textDelaysMs).toEqual([1860])
    expect(result.bubbleRanges).toHaveLength(2)
  })

  it('keeps lines joined when score is below splitThreshold', async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      answers: {
        b_0: { type: 'noul', noul: 0.25 },
        c_0: { type: 'choice', choice: 'rapid_burst' },
      },
    })

    const text = '1. Item one\n2. Item two'
    const result = await evaluateCadenceSplits(text, {
      systemOneExecute: mockExecute,
    })

    expect(result.bubbles).toEqual(['1. Item one\n2. Item two'])
    expect(result.bubbleRanges).toHaveLength(1)
    expect(result.evaluations).toHaveLength(1)
    expect(result.evaluations[0].isSplit).toBe(false)
    expect(result.evaluations[0].score).toBe(0.25)
    expect(result.pausesMs).toHaveLength(0)
  })

  it('respects maxBubbles ceiling', async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      answers: {
        b_0: { type: 'noul', noul: 0.9 },
        b_1: { type: 'noul', noul: 0.9 },
      },
    })

    const text = 'Line 1\nLine 2\nLine 3'
    const result = await evaluateCadenceSplits(text, {
      splitThreshold: 0.65,
      maxBubbles: 2,
      systemOneExecute: mockExecute,
    })

    expect(result.bubbles).toHaveLength(2)
    expect(result.bubbles[0]).toBe('Line 1')
    expect(result.bubbles[1]).toBe('Line 2\nLine 3')
    expect(result.bubbleRanges).toHaveLength(2)
    expect(result.beatsMs).toHaveLength(1)
    expect(result.textDelaysMs).toEqual(result.pausesMs)
  })

  it('preserves source whitespace/CRLF verbatim via bubbleRanges slicing', async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      answers: {
        b_0: { type: 'noul', noul: 0.1 },
        b_1: { type: 'noul', noul: 0.12 },
      },
    })

    const text = 'Opener\r\n\r\n- bananas\r\n- pears'
    const result = await evaluateCadenceSplits(text, {
      dynamicPacing: false,
      systemOneExecute: mockExecute,
    })

    expect(result.bubbles).toHaveLength(1)
    expect(result.bubbleRanges).toHaveLength(1)
    expect(result.bubbles[0]).toBe(text.slice(result.bubbleRanges[0].start, result.bubbleRanges[0].end))
    expect(result.bubbles[0]).toContain('\r\n\r\n')
    expect(result.bubbles[0]).toContain('\r\n- bananas')
  })

  it('maps repeated identical lines by occurrence position, not value', async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      answers: {
        b_0: { type: 'noul', noul: 0.9 },
        b_1: { type: 'noul', noul: 0.9 },
      },
    })

    const text = 'hello\nhello\nbye'
    const result = await evaluateCadenceSplits(text, {
      dynamicPacing: false,
      systemOneExecute: mockExecute,
    })

    expect(result.bubbles).toEqual(['hello', 'hello', 'bye'])
    expect(result.bubbleRanges).toHaveLength(3)
    expect(text.slice(result.bubbleRanges[0].start, result.bubbleRanges[0].end)).toBe('hello')
    expect(text.slice(result.bubbleRanges[1].start, result.bubbleRanges[1].end)).toBe('hello')
    expect(result.bubbleRanges[0]).not.toEqual(result.bubbleRanges[1])
    expect(result.bubbleRanges[0].end).toBeLessThanOrEqual(result.bubbleRanges[1].start)
  })

  it('computes textDelay from the full next bubble, not just the next line', async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      answers: {
        b_0: { type: 'noul', noul: 0.9 },
        b_1: { type: 'noul', noul: 0.1 },
        b_2: { type: 'noul', noul: 0.1 },
        c_0: {
          type: 'choice',
          choice: 'rapid_burst',
          probabilities: { rapid_burst: 1, conversational_beat: 0, thoughtful_pause: 0 },
        },
      },
    })

    const text = 'Opener\nmake sure to bring\n-bananas\n-pears'
    const result = await evaluateCadenceSplits(text, {
      rapidBurstMs: 500,
      conversationalBeatMs: 500,
      thoughtfulPauseMs: 500,
      typingCadenceMsPerChar: 10,
      systemOneExecute: mockExecute,
    })

    expect(result.bubbles).toHaveLength(2)
    const nextBubble = result.bubbles[1]
    expect(nextBubble).toContain('\n-bananas')
    // Full next bubble: "make sure to bring\n-bananas\n-pears".length (34) * 10 + 500 = 840.
    // Old next-line-only math would give "make sure to bring".length (18) * 10 + 500 = 680.
    expect(result.beatsMs).toEqual([500])
    expect(result.textDelaysMs).toEqual([840])
    expect(result.pausesMs).toEqual([840])
    expect(result.evaluations[0].beatMs).toBe(500)
    expect(result.evaluations[0].textDelayMs).toBe(840)
  })

  it('keeps beatsMs unclamped while textDelaysMs honors the ceiling', async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      answers: {
        b_0: { type: 'noul', noul: 0.9 },
        b_1: { type: 'noul', noul: 0.1 },
        b_2: { type: 'noul', noul: 0.1 },
      },
    })

    const text = 'Opener\nmake sure to bring\n-bananas\n-pears'
    const result = await evaluateCadenceSplits(text, {
      rapidBurstMs: 500,
      conversationalBeatMs: 500,
      thoughtfulPauseMs: 500,
      typingCadenceMsPerChar: 10,
      maxDelayCeilingMs: 600,
      systemOneExecute: mockExecute,
    })

    // Unclamped text delay would be 840 (see above); ceiling clamps it to 600.
    expect(result.beatsMs).toEqual([500])
    expect(result.textDelaysMs).toEqual([600])
    expect(result.pausesMs).toEqual(result.textDelaysMs)
    expect(result.beatsMs[0]).not.toBe(result.pausesMs[0])
  })

  it('satisfies the slice invariant on the maxBubbles:1 fast path', async () => {
    const mockExecute = vi.fn()
    const text = 'Opener\n- bananas\n- pears'

    const result = await evaluateCadenceSplits(text, {
      maxBubbles: 1,
      systemOneExecute: mockExecute,
    })

    expect(mockExecute).not.toHaveBeenCalled()
    expect(result.bubbles).toHaveLength(1)
    expect(result.bubbleRanges).toHaveLength(1)
    expect(result.bubbles[0]).toBe(text.slice(result.bubbleRanges[0].start, result.bubbleRanges[0].end))
    expect(result.bubbles[0]).toBe(text)
  })

  it('satisfies the slice invariant for padded single-line input', async () => {
    const mockExecute = vi.fn()
    const text = '  hello  '

    const result = await evaluateCadenceSplits(text, {
      systemOneExecute: mockExecute,
    })

    expect(mockExecute).not.toHaveBeenCalled()
    expect(result.bubbles).toHaveLength(1)
    expect(result.bubbleRanges).toHaveLength(1)
    expect(result.bubbles[0]).toBe(text.slice(result.bubbleRanges[0].start, result.bubbleRanges[0].end))
  })

  it('satisfies the slice invariant on classifier failure', async () => {
    const mockExecute = vi.fn().mockRejectedValue(new Error('Network error'))
    const text = 'First line\nSecond line'

    const result = await evaluateCadenceSplits(text, {
      systemOneExecute: mockExecute,
    })

    expect(result.bubbles).toHaveLength(1)
    expect(result.bubbleRanges).toHaveLength(1)
    expect(result.bubbles[0]).toBe(text.slice(result.bubbleRanges[0].start, result.bubbleRanges[0].end))
    expect(result.bubbles[0]).toBe(text)
  })

  it('populates beats and text delays per split when dynamicPacing is false', async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      answers: {
        b_0: { type: 'noul', noul: 0.9 },
        b_1: { type: 'noul', noul: 0.1 },
      },
    })

    const text = 'Opener\nLine two\nLine three'
    const result = await evaluateCadenceSplits(text, {
      dynamicPacing: false,
      typingCadenceMsPerChar: 10,
      systemOneExecute: mockExecute,
    })

    expect(result.bubbles).toHaveLength(2)
    expect(result.beatsMs).toHaveLength(1)
    expect(result.textDelaysMs).toHaveLength(1)
    expect(result.pausesMs).toEqual(result.textDelaysMs)
    // Fixed pacing falls back to the conversational beat (default 900ms).
    expect(result.beatsMs[0]).toBe(900)
    expect(result.evaluations[0].beatMs).toBe(900)
    const expectedTyping = Math.round(result.bubbles[1].length * 10)
    expect(result.textDelaysMs[0]).toBe(Math.max(350, Math.min(3500, 900 + expectedTyping)))
  })

  it('returns single original message safely if System 1 throws', async () => {
    const mockExecute = vi.fn().mockRejectedValue(new Error('Network error'))
    const text = 'First line\nSecond line'

    const result = await evaluateCadenceSplits(text, {
      systemOneExecute: mockExecute,
    })

    expect(result.bubbles).toEqual([text])
    expect(result.evaluations).toHaveLength(0)
    expect(result.pausesMs).toHaveLength(0)
  })
})
