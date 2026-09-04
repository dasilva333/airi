import { describe, expect, it } from 'vitest'

import { createPlaybackManager } from './managers/playback-manager'
import { createSpeechPipeline } from './speech-pipeline'

describe('speechPipeline concurrency with ttsStream', () => {
  it('runs up to 5 TTS synthesis requests concurrently while maintaining sequential playback', async () => {
    let currentConcurrentTts = 0
    let maxConcurrentTts = 0
    const playbackOrder: string[] = []

    const playbackManager = createPlaybackManager<string>({
      play: async (item) => {
        playbackOrder.push(`start:${item.text}`)
        // Simulate 40ms of playback duration
        await new Promise(resolve => setTimeout(resolve, 40))
        playbackOrder.push(`end:${item.text}`)
      },
      maxVoices: 1,
      maxVoicesPerOwner: 1,
      overflowPolicy: 'queue',
      ownerOverflowPolicy: 'steal-oldest',
    })

    const pipeline = createSpeechPipeline<string>({
      tts: async () => 'buffered-dummy',
      ttsStream: async (request, _signal, onAudio) => {
        currentConcurrentTts++
        maxConcurrentTts = Math.max(maxConcurrentTts, currentConcurrentTts)
        // Simulate 30ms of network latency for TTS generation
        await new Promise(resolve => setTimeout(resolve, 30))
        onAudio(`audio:${request.text}`)
        currentConcurrentTts--
      },
      playback: playbackManager,
    })

    const intent = pipeline.openIntent({ ownerId: 'test-owner' })

    // Feed three sentences in quick succession (like LLM streaming)
    intent.writeLiteral('First sentence here.')
    intent.writeLiteral(' Second sentence following.')
    intent.writeLiteral(' Third sentence concluding.')
    intent.writeFlush()
    intent.end()

    // Wait for the intent to complete
    await new Promise<void>((resolve) => {
      pipeline.on('onIntentEnd', () => resolve())
    })

    // Concurrency verification: all 3 sentences should have synthesized concurrently!
    expect(maxConcurrentTts).toBe(3)

    // Playback order verification: strictly sequential
    expect(playbackOrder).toEqual([
      'start:First sentence here.',
      'end:First sentence here.',
      'start:Second sentence following.',
      'end:Second sentence following.',
      'start:Third sentence concluding.',
      'end:Third sentence concluding.',
    ])
  })
})

it('caps concurrent synthesis at 5 active slots and drains when slots free up', async () => {
  let currentConcurrent = 0
  let maxConcurrent = 0

  const playbackManager = createPlaybackManager<string>({
    play: async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
    },
    maxVoices: 1,
    maxVoicesPerOwner: 1,
    overflowPolicy: 'queue',
  })

  const pipeline = createSpeechPipeline<string>({
    tts: async () => 'dummy',
    ttsStream: async (_req, _sig, onAudio) => {
      currentConcurrent++
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
      await new Promise(resolve => setTimeout(resolve, 30))
      onAudio('audio')
      currentConcurrent--
    },
    playback: playbackManager,
  })

  const intent = pipeline.openIntent({ ownerId: 'test-owner' })
  for (let i = 1; i <= 7; i++) {
    intent.writeLiteral(`Sentence number ${i}.`)
  }
  intent.writeFlush()
  intent.end()

  await new Promise<void>((resolve) => {
    pipeline.on('onIntentEnd', () => resolve())
  })

  expect(maxConcurrent).toBe(5)
})
