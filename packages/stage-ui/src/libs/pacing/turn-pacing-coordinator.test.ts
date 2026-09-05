import type { Clock, PacingPolicyConfig } from '../../types/pacing'

import { describe, expect, it, vi } from 'vitest'

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
    // Execute all timers that triggered up to currentTime in order
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

describe('turnPacingCoordinator (Phase 0)', () => {
  it('suppresses filler on fast direct answer (200ms)', () => {
    const clock = new VirtualClock()
    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-1',
      generation: 1,
      providerKey: 'fast-provider',
      policy: defaultPolicy,
      clock,
    })

    coordinator.dispatch()
    expect(coordinator.state).toBe('STAGING')

    clock.advance(200)
    coordinator.onInferenceEvent({ type: 'answer', text: 'Hello!', at: clock.now() })

    expect(coordinator.state).toBe('ANSWER_READY')
    expect(coordinator.metrics.ttftMs).toBe(200)
    expect(coordinator.metrics.fillerOutcome).toBe('none')

    // Even if clock advances past 1800ms, no filler should arm
    clock.advance(2000)
    expect(coordinator.state).toBe('ANSWER_READY')
  })

  it('arms filler when adaptive deadline elapses in silent turn', () => {
    const clock = new VirtualClock()
    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-2',
      generation: 1,
      providerKey: 'slow-provider',
      policy: defaultPolicy,
      clock,
    })

    coordinator.dispatch()
    expect(coordinator.state).toBe('STAGING')

    // Advance to 1800ms (default cold deadline)
    clock.advance(1800)
    expect(coordinator.state).toBe('FILLER_ARMED')
    expect(coordinator.metrics.fillerCandidate).toBe('generic')
  })

  it('handles the 1200ms vs 1400ms race: answer arrives while filler is armed (before playback)', () => {
    const clock = new VirtualClock()
    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-3',
      generation: 1,
      providerKey: 'test-provider',
      policy: defaultPolicy,
      clock,
      historicalTtftSamples: [1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200], // Will produce deadline around 1200ms
    })

    coordinator.dispatch()
    clock.advance(1200)
    expect(coordinator.state).toBe('FILLER_ARMED')

    // At 1400ms, answer text arrives before filler audio could start
    clock.advance(200)
    coordinator.onInferenceEvent({ type: 'answer', text: 'Here is your answer', at: clock.now() })

    expect(coordinator.state).toBe('ANSWER_READY')
    expect(coordinator.metrics.fillerOutcome).toBe('canceled')
  })

  it('handles the 1200ms vs 1400ms race: filler starts at 1300ms, answer arrives at 1400ms', () => {
    const clock = new VirtualClock()
    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-4',
      generation: 1,
      providerKey: 'test-provider',
      policy: defaultPolicy,
      clock,
      historicalTtftSamples: [1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200],
    })

    coordinator.dispatch()
    clock.advance(1200)
    expect(coordinator.state).toBe('FILLER_ARMED')

    // Filler audio starts at 1300ms
    clock.advance(100)
    coordinator.notifyFillerAudioStarted(clock.now())
    expect(coordinator.state).toBe('FILLER_ACTIVE')
    expect(coordinator.metrics.fillerStartMs).toBe(1300)
    expect(coordinator.metrics.fillerOutcome).toBe('played')

    // Answer text arrives at 1400ms while filler is speaking
    clock.advance(100)
    coordinator.onInferenceEvent({ type: 'answer', text: 'Here is your answer', at: clock.now() })
    expect(coordinator.state).toBe('FILLER_ACTIVE') // Stays active

    // Filler ends at 2100ms
    clock.advance(700)
    coordinator.notifyFillerAudioEnded(clock.now())
    expect(coordinator.state).toBe('HANDOFF')

    // Main answer audio scheduled at 2100ms
    coordinator.notifyAnswerAudioScheduled(clock.now())
    expect(coordinator.metrics.handoffGapMs).toBe(800) // 2100 - 1300
  })

  it('rejects filler when answer audio is scheduled before filler audio starts', () => {
    const clock = new VirtualClock()
    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-5',
      generation: 1,
      providerKey: 'test-provider',
      policy: defaultPolicy,
      clock,
    })

    coordinator.dispatch()
    clock.advance(1800)
    expect(coordinator.state).toBe('FILLER_ARMED')

    // Answer audio was already decoded and scheduled before filler starts
    coordinator.notifyAnswerAudioScheduled(clock.now())
    expect(coordinator.state).toBe('ANSWER_READY')
    expect(coordinator.metrics.fillerOutcome).toBe('rejected')
  })

  it('gracefully degrades to ordinary answer on cache miss', () => {
    const clock = new VirtualClock()
    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-6',
      generation: 1,
      providerKey: 'test-provider',
      policy: defaultPolicy,
      clock,
    })

    coordinator.dispatch()
    clock.advance(1800)
    expect(coordinator.state).toBe('FILLER_ARMED')

    coordinator.notifyCacheMiss()
    expect(coordinator.state).toBe('ANSWER_READY')
    expect(coordinator.metrics.fillerOutcome).toBe('cache-miss')
  })

  it('handles barge-in / cancellation idempotently', () => {
    const clock = new VirtualClock()
    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-7',
      generation: 1,
      providerKey: 'test-provider',
      policy: defaultPolicy,
      clock,
    })

    coordinator.dispatch()
    clock.advance(500)

    coordinator.cancel('user-barge-in')
    expect(coordinator.state).toBe('SETTLED')
    expect(coordinator.metrics.interrupted).toBe(true)

    // Late events are ignored
    clock.advance(2000)
    coordinator.onInferenceEvent({ type: 'answer', text: 'Late text', at: clock.now() })
    expect(coordinator.state).toBe('SETTLED')
  })

  it('ignores events from stale generations', () => {
    const clock = new VirtualClock()
    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-8',
      generation: 2,
      providerKey: 'test-provider',
      policy: defaultPolicy,
      clock,
    })

    coordinator.dispatch()
    clock.advance(300)

    // Stale generation 1 event arrives
    coordinator.onInferenceEvent({ type: 'answer', text: 'Old gen text', at: clock.now() }, 1)
    expect(coordinator.state).toBe('STAGING') // Not changed to ANSWER_READY
  })

  it('automatically disables filler policy for ultra-fast models (p90 <= 700ms)', () => {
    const clock = new VirtualClock()
    const ultraFastSamples = [200, 250, 300, 350, 400, 450, 500, 550, 600, 650]
    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-9',
      generation: 1,
      providerKey: 'groq-llama',
      policy: defaultPolicy,
      clock,
      historicalTtftSamples: ultraFastSamples,
    })

    coordinator.dispatch()
    expect(coordinator.state).toBe('STAGING')

    // Even if it takes long for some reason, deadline is disabled (-1) so no filler arms
    clock.advance(5000)
    expect(coordinator.state).toBe('STAGING')
  })

  it('refines fillerCandidate when reasoning events arrive during STAGING', () => {
    const clock = new VirtualClock()
    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-10',
      generation: 1,
      providerKey: 'test-provider',
      policy: defaultPolicy,
      clock,
    })

    coordinator.dispatch()
    expect(coordinator.state).toBe('STAGING')

    // Reasoning arrives with analytical keywords
    coordinator.onInferenceEvent({
      type: 'reasoning',
      text: 'I should calculate the optimal step. ',
      visibility: 'hidden',
      at: clock.now(),
    })

    clock.advance(1800)
    expect(coordinator.state).toBe('FILLER_ARMED')
    expect(coordinator.metrics.fillerCandidate).toBe('analytical')
  })

  it('invokes onArmFiller, onCancelFiller, and onSettled callbacks appropriately', async () => {
    const clock = new VirtualClock()
    const onArmFiller = vi.fn()
    const onCancelFiller = vi.fn()
    const onSettled = vi.fn()

    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-callbacks',
      generation: 1,
      providerKey: 'test-provider',
      policy: defaultPolicy,
      clock,
      onArmFiller,
      onCancelFiller,
      onSettled,
    })

    coordinator.dispatch()
    clock.advance(1800)
    expect(onArmFiller).toHaveBeenCalledTimes(1)
    expect(onArmFiller).toHaveBeenCalledWith('generic', 1800)

    // Answer arrives while filler is armed -> onCancelFiller('answer-arrived')
    coordinator.onInferenceEvent({ type: 'answer', text: 'Hello', at: clock.now() })
    expect(onCancelFiller).toHaveBeenCalledWith('answer-arrived')

    // Assistant end settles turn -> onSettled
    await coordinator.onAssistantEnd()
    expect(onSettled).toHaveBeenCalledTimes(1)
    expect(onSettled).toHaveBeenCalledWith(expect.objectContaining({ turnId: 'turn-callbacks' }))
  })
})
