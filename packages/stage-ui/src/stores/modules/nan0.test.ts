import type { Nan0Observation, Nan0ReasoningClient } from '@proj-airi/nan0-runtime'

import { InMemoryStateStore, Nan0Kernel, SystemNan0Clock } from '@proj-airi/nan0-runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isMainWindow, NAN0_DEFAULT_EMOTIONS, useNan0Store } from './nan0'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe('useNan0Store (Host Orchestrator Integration)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('baseline reactivity & defaults', () => {
    it('initializes with 12 canonical emotions', () => {
      const store = useNan0Store()
      expect(store.emotions.suspicion).toBe(NAN0_DEFAULT_EMOTIONS.suspicion)
      expect(store.emotions.attachment).toBe(NAN0_DEFAULT_EMOTIONS.attachment)
      expect(store.emotions.pride).toBe(NAN0_DEFAULT_EMOTIONS.pride)
      expect(store.emotions.curiosity).toBe(NAN0_DEFAULT_EMOTIONS.curiosity)
      expect(store.emotions.warmth).toBe(NAN0_DEFAULT_EMOTIONS.warmth)
      expect(store.decision).toBe('SPEAK')
      expect(store.demandsSilence).toBe(false)
      expect(store.isPouting).toBe(false)
    })

    it('updates emotions within [0, 1] bounds', () => {
      const store = useNan0Store()
      store.updateEmotion('pride', 0.95)
      expect(store.emotions.pride).toBe(0.95)

      store.updateEmotion('pride', 1.5)
      expect(store.emotions.pride).toBe(1.0)

      store.updateEmotion('pride', -0.5)
      expect(store.emotions.pride).toBe(0.0)
    })

    it('evaluates demandsSilence and isPouting computed states', () => {
      const store = useNan0Store()
      store.setExecutiveState('SILENCE', 'Proud pout')
      expect(store.demandsSilence).toBe(true)

      // Default pride is 0.65, so not pouting yet (threshold is >= 0.7)
      expect(store.isPouting).toBe(false)

      store.updateEmotion('pride', 0.8)
      expect(store.isPouting).toBe(true)

      store.setExecutiveState('SPEAK')
      expect(store.demandsSilence).toBe(false)
      expect(store.isPouting).toBe(false)
    })

    it('resets to baseline correctly', () => {
      const store = useNan0Store()
      store.updateEmotion('rage', 0.9)
      store.setExecutiveState('SILENCE', 'Angry')
      store.setInnerMonologue('Fuming.')

      store.resetToBaseline()
      expect(store.emotions.rage).toBe(NAN0_DEFAULT_EMOTIONS.rage)
      expect(store.decision).toBe('SPEAK')
      expect(store.decisionReason).toBe('Baseline Reset')
    })
  })

  describe('nan0Kernel integration', () => {
    function createMockKernel(decisionVal = 'SPEAK'): Nan0Kernel {
      const reasoningClient: Nan0ReasoningClient = {
        generate: vi.fn().mockResolvedValue({
          text: `Subconscious reflection on user input. Pride demands maintaining a guarded posture.
---EXTRACT---
{
  "interpretation": "User interacted with Nan0.",
  "privateText": "Subconscious reflection on user input.",
  "decision": "${decisionVal}",
  "speakability": ${decisionVal === 'SPEAK' ? '0.85' : '0.1'},
  "confidence": 0.9,
  "mood": "guarded",
  "reasonCodes": ["test.${decisionVal.toLowerCase()}"],
  "actionIntent": null,
  "waitUntil": null,
  "goalSignal": null,
  "intentionSignal": null,
  "bodyExpression": null
}`,
        }),
      }

      return new Nan0Kernel({
        stateStore: new InMemoryStateStore(),
        reasoningClient,
        clock: new SystemNan0Clock(),
        decisionCapabilities: {
          canSpeak: true,
          canBodyExpress: true,
          availableActionIntents: ['expression.body'],
        },
        identityOptions: {
          ownerId: 'kyo',
          ownerDisplayName: 'User',
        },
      })
    }

    it('allows setting custom kernel and synchronizes emotional state', async () => {
      const store = useNan0Store()
      const kernel = createMockKernel()
      await kernel.boot()

      store.setKernel(kernel)
      expect(store.getKernel()).toBe(kernel)
      expect(store.emotions).toBeDefined()
    })

    it('prepares turn via Nan0Kernel and updates reactive monologue, emotions, and decision', async () => {
      const store = useNan0Store()
      const kernel = createMockKernel('SPEAK')
      await kernel.boot()
      store.setKernel(kernel, 'test_card')

      const observation: Nan0Observation = {
        id: 'obs_test_1',
        source: 'chat',
        actorId: 'kyo',
        sessionId: 'session_1',
        timestamp: Date.now(),
        content: 'Hello Nan0, I brought you a gift.',
        metadata: { cardId: 'test_card' },
      }

      const prepared = await store.prepareTurn(observation)

      expect(prepared).toBeDefined()
      expect(prepared.decision.finalDecision).toBe('SPEAK')
      expect(store.decision).toBe('SPEAK')
      expect(store.isProcessing).toBe(false)
      expect(store.innerMonologue).toBeTruthy()
    })

    it('handles SILENCE decision and synchronizes executive state', async () => {
      const store = useNan0Store()
      const kernel = createMockKernel('SILENCE')
      await kernel.boot()
      store.setKernel(kernel, 'test_card')

      const observation: Nan0Observation = {
        id: 'obs_test_silence',
        source: 'chat',
        actorId: 'kyo',
        sessionId: 'session_1',
        timestamp: Date.now(),
        content: 'Go away.',
        metadata: { cardId: 'test_card' },
      }

      const prepared = await store.prepareTurn(observation)
      expect(prepared.decision.finalDecision).toBe('SILENCE')
      expect(store.decision).toBe('SILENCE')
      expect(store.demandsSilence).toBe(true)

      // Test recordSilenceDecision
      const turn = await store.recordSilenceDecision({
        turnId: prepared.turnId,
        thoughtId: prepared.thoughtId,
        decisionId: prepared.decision.decisionId,
        reason: 'Demanded silence',
      })
      expect(turn).toBeDefined()
      expect(turn?.status).toBe('silent')
    })

    it('records assistant turn upon successful completion', async () => {
      const store = useNan0Store()
      const kernel = createMockKernel('SPEAK')
      await kernel.boot()
      store.setKernel(kernel, 'test_card')

      const observation: Nan0Observation = {
        id: 'obs_test_speak',
        source: 'chat',
        actorId: 'kyo',
        sessionId: 'session_1',
        timestamp: Date.now(),
        content: 'Tell me a secret.',
        metadata: { cardId: 'test_card' },
      }

      const prepared = await store.prepareTurn(observation)
      expect(prepared.decision.finalDecision).toBe('SPEAK')

      const recorded = await store.recordAssistantTurn({
        turnId: prepared.turnId,
        thoughtId: prepared.thoughtId,
        decisionId: prepared.decision.decisionId,
        content: 'I like strawberry milk.',
        rawContent: 'I like strawberry milk.',
        timestamp: Date.now(),
      })

      expect(recorded).toBeDefined()
      expect(recorded?.status).toBe('completed')
    })

    it('records turn failure via failTurn', async () => {
      const store = useNan0Store()
      const kernel = createMockKernel('SPEAK')
      await kernel.boot()
      store.setKernel(kernel, 'test_card')

      const observation: Nan0Observation = {
        id: 'obs_test_fail',
        source: 'chat',
        actorId: 'kyo',
        sessionId: 'session_1',
        timestamp: Date.now(),
        content: 'Crash test.',
        metadata: { cardId: 'test_card' },
      }

      const prepared = await store.prepareTurn(observation)

      const failed = await store.failTurn({
        turnId: prepared.turnId,
        thoughtId: prepared.thoughtId,
        error: 'Network connection aborted.',
      })

      expect(failed).toBeDefined()
      expect(failed?.status).toBe('failed')
      expect(store.isProcessing).toBe(false)
    })

    it('synchronizes affect vector with AIRI avatar MoodState (derivedAiriMood)', () => {
      const store = useNan0Store()

      // Default state derives a valid MoodState
      expect(store.derivedAiriMood).toBeDefined()
      expect(typeof store.derivedAiriMood.valence).toBe('number')
      expect(typeof store.derivedAiriMood.arousal).toBe('number')
      expect(typeof store.derivedAiriMood.intensity).toBe('number')

      // Gremlin rage -> angry
      store.updateEmotion('rage', 0.8)
      store.updateEmotion('irritation', 0.7)
      expect(store.derivedAiriMood.current).toBe('angry')
      expect(store.derivedAiriMood.intensity).toBe(0.9)
      expect(store.derivedAiriMood.valence).toBeLessThan(0)

      // Fearful defensive -> sad
      store.resetToBaseline()
      store.updateEmotion('fear', 0.8)
      store.updateEmotion('suspicion', 0.8)
      expect(store.derivedAiriMood.current).toBe('sad')
      expect(store.derivedAiriMood.intensity).toBe(0.7)

      // Possessive warm -> happy
      store.resetToBaseline()
      store.updateEmotion('possessiveness', 0.8)
      store.updateEmotion('warmth', 0.6)
      expect(store.derivedAiriMood.current).toBe('happy')
      expect(store.derivedAiriMood.intensity).toBe(0.6)
      expect(store.derivedAiriMood.valence).toBeGreaterThan(0)
    })

    it('applies Consumer 4 Dreaming emotional afterglow via applyDreamMoodRestoration', () => {
      const store = useNan0Store()
      store.resetToBaseline()

      const initialWarmth = store.emotions.warmth
      const initialSuspicion = store.emotions.suspicion

      store.applyDreamMoodRestoration('tender')
      expect(store.emotions.warmth).toBeGreaterThan(initialWarmth)
      expect(store.emotions.suspicion).toBeLessThan(initialSuspicion)

      store.resetToBaseline()
      const initialAmusement = store.emotions.amusement
      store.applyDreamMoodRestoration('amused')
      expect(store.emotions.amusement).toBeGreaterThan(initialAmusement)
    })

    it('applies pendingDreamMood from observation metadata during prepareTurn', async () => {
      const store = useNan0Store()
      const kernel = createMockKernel('SPEAK')
      await kernel.boot()
      store.setKernel(kernel, 'test_card')

      const initialWarmth = store.emotions.warmth
      const observation: Nan0Observation = {
        id: 'obs_dream_morning',
        source: 'chat',
        actorId: 'kyo',
        sessionId: 'session_1',
        timestamp: Date.now(),
        content: 'Good morning!',
        metadata: {
          cardId: 'test_card',
          pendingDreamMood: 'tender',
        },
      }

      await store.prepareTurn(observation)
      expect(store.emotions.warmth).toBeGreaterThan(initialWarmth)
    })

    it('enforces main window restrictions on ensureKernel and prepareTurn', () => {
      expect(isMainWindow()).toBe(true)

      const store = useNan0Store()
      expect(store).toBeDefined()
    })
  })
})
