import type { PlaybackItem } from '@proj-airi/pipelines-audio'

import type { Clock, PacingPlaybackMeta, PacingPolicyConfig } from '../../types/pacing'
import type { ThinkingAudioFingerprintParams } from './pacing-cache'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { clearThinkingAudioCache, saveThinkingAudio } from './pacing-cache'
import { PacingPlaybackBridge, resolveFillerCandidate } from './pacing-playback-bridge'
import { TurnPacingCoordinator } from './turn-pacing-coordinator'

class VirtualClock implements Clock {
  public currentTime = 0
  private timers: { id: number, fn: () => void, triggerAt: number }[] = []
  private nextId = 1

  now = () => this.currentTime

  setTimeout = (fn: () => void, delayMs: number) => {
    const id = this.nextId++
    this.timers.push({ id, fn, triggerAt: this.currentTime + delayMs })
    return id
  }

  clearTimeout = (id: any) => {
    this.timers = this.timers.filter(t => t.id !== id)
  }

  advance(ms: number) {
    this.currentTime += ms
    while (true) {
      const readyIndex = this.timers.findIndex(t => t.triggerAt <= this.currentTime)
      if (readyIndex === -1)
        break
      const [timer] = this.timers.splice(readyIndex, 1)
      timer.fn()
    }
  }
}

const defaultPolicy: PacingPolicyConfig = {
  enabled: true,
  armMinMs: 900,
  armMaxMs: 3500,
  maxFillerDurationMs: 2200,
  reasoningWindowMs: 900,
  categoryThreshold: 2,
}

describe('pacing-playback-bridge (Phase 1)', () => {
  const voiceParams: ThinkingAudioFingerprintParams = {
    provider: 'elevenlabs',
    model: 'eleven_multilingual_v2',
    voiceId: 'voice-1',
    text: 'Hmm...',
  }

  beforeEach(async () => {
    await clearThinkingAudioCache()
  })

  it('handles cache hit: schedules filler audio and sets coordinator to FILLER_ACTIVE', async () => {
    // Pre-cache an audio snippet
    const mockAudio = new Uint8Array([10, 20, 30]).buffer
    await saveThinkingAudio(voiceParams, mockAudio, 1500)

    const clock = new VirtualClock()
    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-bridge-1',
      generation: 1,
      providerKey: 'elevenlabs',
      policy: defaultPolicy,
      clock,
    })

    const scheduledItems: (PlaybackItem<any> & { meta?: PacingPlaybackMeta })[] = []
    const playback = {
      schedule: vi.fn((item: PlaybackItem<any> & { meta?: PacingPlaybackMeta }) => {
        scheduledItems.push(item)
      }),
      getCurrentTime: () => clock.now() / 1000,
    }

    const bridge = new PacingPlaybackBridge({
      coordinator,
      playback,
      voiceParams,
      clock,
    })

    coordinator.dispatch()
    clock.advance(1800)
    expect(coordinator.state).toBe('FILLER_ARMED')

    const armedSuccess = await bridge.handleFillerArmed('generic')
    expect(armedSuccess).toBe(true)
    expect(playback.schedule).toHaveBeenCalledTimes(1)
    expect(scheduledItems[0].text).toBe('Hmm...')
    expect(scheduledItems[0].meta?.role).toBe('thinking-filler')
    expect(coordinator.state).toBe('FILLER_ACTIVE')
    expect(coordinator.metrics.fillerOutcome).toBe('played')

    // Filler ends
    clock.advance(1500)
    bridge.handleFillerEnded()
    expect(coordinator.state).toBe('HANDOFF')
  })

  it('handles cache miss: cleanly degrades to ANSWER_READY with 0 audio scheduled', async () => {
    const clock = new VirtualClock()
    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-bridge-2',
      generation: 1,
      providerKey: 'elevenlabs',
      policy: defaultPolicy,
      clock,
    })

    const playback = {
      schedule: vi.fn(),
    }

    const bridge = new PacingPlaybackBridge({
      coordinator,
      playback,
      voiceParams: { ...voiceParams, text: 'Uncached filler quote' },
      clock,
    })

    coordinator.dispatch()
    clock.advance(1800)
    expect(coordinator.state).toBe('FILLER_ARMED')

    const armedSuccess = await bridge.handleFillerArmed('generic')
    expect(armedSuccess).toBe(false)
    expect(playback.schedule).not.toHaveBeenCalled()
    expect(coordinator.state).toBe('ANSWER_READY')
    expect(coordinator.metrics.fillerOutcome).toBe('cache-miss')
  })

  it('handles answer audio scheduling and preemption', async () => {
    const clock = new VirtualClock()
    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-bridge-3',
      generation: 1,
      providerKey: 'elevenlabs',
      policy: defaultPolicy,
      clock,
    })

    const scheduledItems: PlaybackItem<any>[] = []
    const playback = {
      schedule: vi.fn((item: PlaybackItem<any>) => {
        scheduledItems.push(item)
      }),
    }

    const bridge = new PacingPlaybackBridge({
      coordinator,
      playback,
      voiceParams,
      clock,
    })

    coordinator.dispatch()
    clock.advance(1800)
    expect(coordinator.state).toBe('FILLER_ARMED')

    // Answer audio arrives before filler could start
    const answerItem: PlaybackItem<any> = {
      id: 'answer-1',
      streamId: 'stream-1',
      intentId: 'intent-turn-bridge-3',
      segmentId: 'seg-1',
      priority: 5,
      text: 'Final answer text',
      special: null,
      audio: new Uint8Array([99]).buffer,
      createdAt: clock.now(),
    }

    bridge.scheduleAnswerAudio(answerItem)
    expect(coordinator.state).toBe('ANSWER_READY')
    expect(coordinator.metrics.fillerOutcome).toBe('rejected')
    expect(scheduledItems.length).toBe(1)
    expect(scheduledItems[0].id).toBe('answer-1')
  })

  it('cancels active playback on barge-in', async () => {
    const clock = new VirtualClock()
    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-bridge-4',
      generation: 1,
      providerKey: 'elevenlabs',
      policy: defaultPolicy,
      clock,
    })

    const stopByIntentSpy = vi.fn()
    const playback = {
      schedule: vi.fn(),
      stopByIntent: stopByIntentSpy,
    }

    const bridge = new PacingPlaybackBridge({
      coordinator,
      playback,
      voiceParams,
      clock,
    })

    coordinator.dispatch()
    bridge.cancel('user-interrupted')

    expect(coordinator.state).toBe('SETTLED')
    expect(coordinator.metrics.interrupted).toBe(true)
  })

  it('uses customText for phrase retrieval and PlaybackItem text when provided', async () => {
    const customVoiceParams = {
      ...voiceParams,
      text: 'Let me think about that...',
    }
    const mockAudio = new Uint8Array([1, 2, 3]).buffer
    await saveThinkingAudio(customVoiceParams, mockAudio, 1200)

    const clock = new VirtualClock()
    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-bridge-custom',
      generation: 1,
      providerKey: 'elevenlabs',
      policy: defaultPolicy,
      clock,
    })

    const scheduledItems: PlaybackItem<any>[] = []
    const playback = {
      schedule: vi.fn((item: PlaybackItem<any>) => {
        scheduledItems.push(item)
      }),
      getCurrentTime: () => clock.now() / 1000,
    }

    const bridge = new PacingPlaybackBridge({
      coordinator,
      playback,
      voiceParams: { ...voiceParams, text: '' },
      clock,
    })

    coordinator.dispatch()
    clock.advance(1800)
    expect(coordinator.state).toBe('FILLER_ARMED')

    const armed = await bridge.handleFillerArmed('analytical', 'Let me think about that...')
    expect(armed).toBe(true)
    expect(scheduledItems.length).toBe(1)
    expect(scheduledItems[0].text).toBe('Let me think about that...')
  })
})

describe('resolveFillerCandidate', () => {
  it('returns null when candidates list is empty', () => {
    expect(resolveFillerCandidate([], 'generic')).toBeNull()
  })

  it('returns null when all candidates are disabled', () => {
    const fillers = [
      { text: 'Hmm...', category: 'generic' as const, enabled: false },
      { text: 'Let me think...', category: 'analytical' as const, enabled: false },
    ]
    expect(resolveFillerCandidate(fillers, 'analytical')).toBeNull()
  })

  it('returns exact match for matching category', () => {
    const fillers = [
      { text: 'Hmm...', category: 'generic' as const, enabled: true },
      { text: 'Let me compute that...', category: 'analytical' as const, enabled: true },
    ]
    expect(resolveFillerCandidate(fillers, 'analytical')).toBe('Let me compute that...')
  })

  it('falls back to generic when requested category has no match', () => {
    const fillers = [
      { text: 'Hmm...', category: 'generic' as const, enabled: true },
      { text: 'Let me compute that...', category: 'analytical' as const, enabled: true },
    ]
    expect(resolveFillerCandidate(fillers, 'uncertain')).toBe('Hmm...')
  })

  it('falls back to any enabled filler when generic is also unavailable', () => {
    const fillers = [
      { text: 'Hmm...', category: 'generic' as const, enabled: false },
      { text: 'Let me compute that...', category: 'analytical' as const, enabled: true },
    ]
    expect(resolveFillerCandidate(fillers, 'uncertain')).toBe('Let me compute that...')
  })

  it('excludes phrases in usedPhrases to enforce per-turn deduplication', () => {
    const fillers = [
      { text: 'Let me compute that...', category: 'analytical' as const, enabled: true },
      { text: 'Analyzing variables...', category: 'analytical' as const, enabled: true },
      { text: 'Hmm...', category: 'generic' as const, enabled: true },
    ]
    const used = new Set<string>(['Let me compute that...'])

    // Should choose the second analytical phrase
    expect(resolveFillerCandidate(fillers, 'analytical', used)).toBe('Analyzing variables...')

    // If both analytical are used, should fall back to unused generic
    used.add('Analyzing variables...')
    expect(resolveFillerCandidate(fillers, 'analytical', used)).toBe('Hmm...')

    // If all are used, returns null
    used.add('Hmm...')
    expect(resolveFillerCandidate(fillers, 'analytical', used)).toBeNull()
  })
})
