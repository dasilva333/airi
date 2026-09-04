import { describe, expect, it } from 'vitest'

import { chunkTtsInput, TTS_SPECIAL_TOKEN } from './tts-chunker'

describe('tts-chunker', () => {
  it('should isolate special tokens from preceding text', async () => {
    const input = `Hello ${TTS_SPECIAL_TOKEN} how are you?`
    const chunks = []
    for await (const chunk of chunkTtsInput(input)) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(3)
    // The preceding text is yielded as limit/hard
    expect(chunks[0]).toEqual({
      text: 'Hello',
      words: 1,
      reason: 'limit',
    })
    // The special token is yielded as its own empty chunk
    expect(chunks[1]).toEqual({
      text: '',
      words: 0,
      reason: 'special',
    })
    // The rest of the text is yielded
    expect(chunks[2]).toEqual({
      text: 'how are you?',
      words: 3,
      reason: 'hard',
    })
  })

  it('should handle special token with no preceding text', async () => {
    const input = `${TTS_SPECIAL_TOKEN}Hi`
    const chunks = []
    for await (const chunk of chunkTtsInput(input)) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toEqual({
      text: '',
      words: 0,
      reason: 'special',
    })
    expect(chunks[1]).toEqual({
      text: 'Hi',
      words: 1,
      reason: 'flush',
    })
  })

  it('should handle consecutive special tokens cleanly', async () => {
    const input = `${TTS_SPECIAL_TOKEN}${TTS_SPECIAL_TOKEN}`
    const chunks = []
    for await (const chunk of chunkTtsInput(input)) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toEqual({
      text: '',
      words: 0,
      reason: 'special',
    })
    expect(chunks[1]).toEqual({
      text: '',
      words: 0,
      reason: 'special',
    })
  })

  it('should fast-path Slice 1 on soft punctuation only when minimumWords is satisfied', async () => {
    // "Well, to be honest with you," -> 6 words.
    // The first comma is after 1 word ("Well,"), which should NOT cut because words < minimumWords (4).
    // The second comma is after "you," (6 words total), which SHOULD cut as Slice 1 boost.
    const input = 'Well, to be honest with you, I did not think this would work. But look at us now!'
    const chunks = []
    for await (const chunk of chunkTtsInput(input, { boost: 1, minimumWords: 4 })) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(3)

    // Slice 1: Fast-path hook on the first comma meeting minimumWords (4)
    expect(chunks[0].text).toBe('Well, to be honest with you,')
    expect(chunks[0].reason).toBe('boost')

    // Slice 2: Rest of sentence 1 up to the period (hard punctuation)
    expect(chunks[1].text).toBe('I did not think this would work.')
    expect(chunks[1].reason).toBe('hard')

    // Slice 3: Sentence 2 up to the exclamation point
    expect(chunks[2].text).toBe('But look at us now!')
    expect(chunks[2].reason).toBe('hard')
  })

  it('should gate opening single-word commas and not produce 1-word micro-chunks', async () => {
    // "Oh, that is wonderful news!"
    // "Oh," is only 1 word, so it should not be cut as a micro-chunk; it should yield the whole sentence.
    const input = 'Oh, that is wonderful news!'
    const chunks = []
    for await (const chunk of chunkTtsInput(input, { boost: 1, minimumWords: 4 })) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(1)
    expect(chunks[0].text).toBe('Oh, that is wonderful news!')
    expect(chunks[0].reason).toBe('hard')
  })

  it('should preserve multiple intra-sentence commas after Slice 1 until hard punctuation', async () => {
    // First sentence yields as Slice 1.
    // Second sentence has multiple commas: "First, we plan, then we execute, and finally we succeed."
    // None of those commas should cause a split — the entire second sentence must stay contiguous!
    const input = 'Ready to go. First, we plan, then we execute, and finally we succeed!'
    const chunks = []
    for await (const chunk of chunkTtsInput(input, { boost: 1, minimumWords: 4 })) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(2)

    expect(chunks[0].text).toBe('Ready to go.')
    expect(chunks[0].reason).toBe('hard')

    expect(chunks[1].text).toBe('First, we plan, then we execute, and finally we succeed!')
    expect(chunks[1].reason).toBe('hard')
  })

  it('should handle CJK punctuation respecting full-width commas and periods', async () => {
    const input = '好的，没问题。我会帮你处理这个事情，请放心！'
    const chunks = []
    for await (const chunk of chunkTtsInput(input, { boost: 1, minimumWords: 4 })) {
      chunks.push(chunk)
    }

    // In CJK with boost: 1 and minimumWords: 4:
    // "好的，" has only 1 word/cluster -> does not cut on comma
    // "没问题。" has hard punctuation "。" -> cuts Sentence 1
    // Second sentence "我会帮你处理这个事情，请放心！" has a comma "，" after Slice 1, so comma is kept unbroken until "！"
    expect(chunks).toHaveLength(2)
    expect(chunks[0].text).toBe('好的，没问题。')
    expect(chunks[0].reason).toBe('hard')
    expect(chunks[1].text).toBe('我会帮你处理这个事情，请放心！')
    expect(chunks[1].reason).toBe('hard')
  })

  it('should respect emergency maximumWords limit on long run-on sentences with soft punctuation', async () => {
    // A long run-on sentence with commas, but no hard punctuation (no period).
    // After Slice 1, commas are normally ignored to preserve prosody — EXCEPT when accumulated words exceed maximumWords!
    const clauses = Array.from({ length: 8 }, (_, i) => `this is clause number ${i + 1}`)
    const input = clauses.join(', ')
    const chunks = []
    for await (const chunk of chunkTtsInput(input, { boost: 1, minimumWords: 4, maximumWords: 15 })) {
      chunks.push(chunk)
    }

    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks[0].reason).toBe('boost')
    const limitChunk = chunks.find(c => c.reason === 'limit')
    expect(limitChunk).toBeDefined()
  })
})
