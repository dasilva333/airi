import type { PlaybackItem } from '@proj-airi/pipelines-audio'

import type { Clock, PacingPlaybackMeta, PacingPolicyConfig } from '../../types/pacing'
import type { ThinkingAudioFingerprintParams } from './pacing-cache'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { clearThinkingAudioCache, saveThinkingAudio } from './pacing-cache'
import { PacingPlaybackBridge } from './pacing-playback-bridge'
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
})
