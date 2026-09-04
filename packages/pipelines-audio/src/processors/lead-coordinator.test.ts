import type { TextSegment } from '../types'

import { describe, expect, it } from 'vitest'

import { createLeadCoordinatorStream, joinSentences } from './lead-coordinator'

function createMockSegment(text: string, special: string | null = null, actorId?: string): TextSegment {
  return {
    streamId: 'test-stream',
    intentId: 'test-intent',
    segmentId: `seg-${Math.random().toString(36).slice(2, 7)}`,
    text,
    special,
    actorId,
    reason: 'hard',
    createdAt: Date.now(),
  }
}

function streamFromArray<T>(items: T[]): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) {
        controller.enqueue(item)
      }
      controller.close()
    },
  })
}

async function collectStream<T>(stream: ReadableStream<T>): Promise<T[]> {
  const reader = stream.getReader()
  const results: T[] = []
  while (true) {
    const { value, done } = await reader.read()
    if (done)
      break
    if (value)
      results.push(value)
  }
  return results
}

describe('lead-coordinator', () => {
  describe('joinSentences', () => {
    it('joins Latin sentences with spaces', () => {
      const result = joinSentences(['First sentence.', 'Second sentence!'])
      expect(result).toBe('First sentence. Second sentence!')
    })

    it('joins CJK sentences without redundant spaces', () => {
      const result = joinSentences(['こんにちは。', 'お元気ですか？'])
      expect(result).toBe('こんにちは。お元気ですか？')
    })
  })

  describe('createLeadCoordinatorStream', () => {
    it('emits Slice 1 immediately without waiting for subsequent sentences', async () => {
      const seg1 = createMockSegment('Hello world.')
      const stream = streamFromArray([seg1])

      const coordinator = createLeadCoordinatorStream(stream)
      const results = await collectStream(coordinator)

      expect(results).toHaveLength(1)
      expect(results[0].text).toBe('Hello world.')
      expect(results[0].subSentences).toEqual(['Hello world.'])
    })

    it('batches subsequent sentences up to maxBatchSentences', async () => {
      const s1 = createMockSegment('Sentence one.')
      const s2 = createMockSegment('Sentence two.')
      const s3 = createMockSegment('Sentence three.')
      const s4 = createMockSegment('Sentence four.')

      // Buffer lead is high (10s)
      const stream = streamFromArray([s1, s2, s3, s4])
      const coordinator = createLeadCoordinatorStream(stream, {
        getBufferLead: () => 10,
        maxBatchSentences: 3,
      })

      const results = await collectStream(coordinator)

      // Expected:
      // Slice 1: s1
      // Batch 2: s2 + s3 + s4 (3 sentences)
      expect(results).toHaveLength(2)
      expect(results[0].text).toBe('Sentence one.')
      expect(results[0].subSentences).toEqual(['Sentence one.'])

      expect(results[1].text).toBe('Sentence two. Sentence three. Sentence four.')
      expect(results[1].subSentences).toEqual([
        'Sentence two.',
        'Sentence three.',
        'Sentence four.',
      ])
    })

    it('flushes pending sentences when the stream ends', async () => {
      const s1 = createMockSegment('Sentence one.')
      const s2 = createMockSegment('Sentence two.')

      const stream = streamFromArray([s1, s2])
      const coordinator = createLeadCoordinatorStream(stream, {
        getBufferLead: () => 10,
        maxBatchSentences: 3,
      })

      const results = await collectStream(coordinator)

      expect(results).toHaveLength(2)
      expect(results[0].text).toBe('Sentence one.')
      expect(results[1].text).toBe('Sentence two.')
      expect(results[1].subSentences).toEqual(['Sentence two.'])
    })

    it('flushes pending sentences immediately when an actor swap or special token arrives', async () => {
      const s1 = createMockSegment('Butter speaks first.', null, 'actor_butter')
      const s2 = createMockSegment('Butter continues here.', null, 'actor_butter')
      const special = createMockSegment('', '<|ACTOR:actor_airi|>', 'actor_airi')
      const s3 = createMockSegment('Airi takes over.', null, 'actor_airi')

      const stream = streamFromArray([s1, s2, special, s3])
      const coordinator = createLeadCoordinatorStream(stream, {
        getBufferLead: () => 10,
        maxBatchSentences: 3,
      })

      const results = await collectStream(coordinator)

      // Expected:
      // 1. Slice 1: Butter speaks first
      // 2. Butter continues here (flushed before special)
      // 3. Special token
      // 4. Airi takes over
      expect(results).toHaveLength(4)
      expect(results[0].text).toBe('Butter speaks first.')
      expect(results[1].text).toBe('Butter continues here.')
      expect(results[2].special).toBe('<|ACTOR:actor_airi|>')
      expect(results[3].text).toBe('Airi takes over.')
    })

    it('flushes pending sentences early when buffer lead is below threshold', async () => {
      const lead = 0.5 // Below 1.5s threshold

      const s1 = createMockSegment('Slice 1.')
      const s2 = createMockSegment('Slice 2.')
      const s3 = createMockSegment('Slice 3.')

      const stream = streamFromArray([s1, s2, s3])
      const coordinator = createLeadCoordinatorStream(stream, {
        getBufferLead: () => lead,
        leadThresholdSec: 1.5,
        maxBatchSentences: 5,
      })

      const results = await collectStream(coordinator)

      // Since lead is below 1.5s, sentences flush immediately to avoid starvation
      expect(results).toHaveLength(3)
      expect(results[0].text).toBe('Slice 1.')
      expect(results[1].text).toBe('Slice 2.')
      expect(results[2].text).toBe('Slice 3.')
    })
  })
})
