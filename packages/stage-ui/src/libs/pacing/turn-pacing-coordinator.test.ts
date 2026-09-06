import type { AsideCandidate, Clock, PacingPolicyConfig } from '../../types/pacing'

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
    expect(coordinator.metrics.handoffGapMs).toBe(0) // 2100 - 2100 (zero-gap handoff)
  })

  it('strictly clamps deadline to armMaxMs even when p10 sample exceeds it', () => {
    const clock = new VirtualClock()
    // 20 samples with 5000ms TTFT
    const slowSamples = Array.from({ length: 20 }, () => 5000)
    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-clamp',
      generation: 1,
      providerKey: 'slow-provider',
      policy: {
        ...defaultPolicy,
        armMinMs: 900,
        armMaxMs: 3500,
      },
      clock,
      historicalTtftSamples: slowSamples,
    })

    coordinator.dispatch()
    // Deadline must be clamped to armMaxMs (3500), not p10 (5000)
    expect(coordinator.metrics.deadlineMs).toBe(3500)
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
      policy: { ...defaultPolicy, maxFillersPerTurn: 1 },
      clock,
    })

    coordinator.dispatch()
    clock.advance(1800)
    expect(coordinator.state).toBe('FILLER_ARMED')

    coordinator.notifyCacheMiss()
    // Attempt 1 miss returns to STAGING with repeat interval scheduled so long deliberating turns can recover
    expect(coordinator.state).toBe('STAGING')
    expect(coordinator.metrics.fillerOutcome).toBe('cache-miss')
    expect(coordinator.metrics.committedCount).toBe(0)

    // Advance 15s to attempt 2
    clock.advance(15000)
    expect(coordinator.state).toBe('FILLER_ARMED')
    coordinator.notifyCacheMiss()
    // Max attempts (2 * 1 = 2) exhausted, degrades to ANSWER_READY
    expect(coordinator.state).toBe('ANSWER_READY')
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

  it('arms multiple fillers up to maxFillersPerTurn at pacingIntervalMs cadences during long CoT reasoning', () => {
    const clock = new VirtualClock()
    const onArmFiller = vi.fn()

    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-multi-cot',
      generation: 1,
      providerKey: 'deepseek-r1',
      policy: {
        ...defaultPolicy,
        maxFillersPerTurn: 3,
        pacingIntervalMs: 15000,
      },
      clock,
      onArmFiller,
    })

    coordinator.dispatch()

    // 1. Initial reasoning chunk: analytical keywords (calculate, solve)
    coordinator.onInferenceEvent({
      type: 'reasoning',
      text: 'Let us calculate and solve the optimal equation. ',
      visibility: 'hidden',
      at: clock.now(),
    })

    // Advance to deadline (1800ms)
    clock.advance(1800)
    expect(coordinator.state).toBe('FILLER_ARMED')
    expect(onArmFiller).toHaveBeenCalledTimes(1)
    expect(onArmFiller).toHaveBeenLastCalledWith('analytical', 1800)
    expect(coordinator.metrics.committedCount).toBe(1)
    expect(coordinator.metrics.categoriesSpoken).toEqual(['analytical'])

    // Filler 1 plays and finishes
    coordinator.notifyFillerAudioStarted(clock.now())
    expect(coordinator.metrics.fillersSpokenCount).toBe(1)
    clock.advance(1500)
    coordinator.notifyFillerAudioEnded(clock.now())
    // Should return to STAGING with interval timer scheduled
    expect(coordinator.state).toBe('STAGING')

    // 2. New reasoning arrives during extended CoT: memory keywords
    coordinator.onInferenceEvent({
      type: 'reasoning',
      text: 'Wait, let us remember and recall the historical logs. ',
      visibility: 'hidden',
      at: clock.now(),
    })

    // Advance by pacingIntervalMs (15000ms)
    clock.advance(15000)
    expect(coordinator.state).toBe('FILLER_ARMED')
    expect(onArmFiller).toHaveBeenCalledTimes(2)
    // Category 2 must be memory because analytical was already spoken
    expect(onArmFiller).toHaveBeenLastCalledWith('memory', 15000)
    expect(coordinator.metrics.committedCount).toBe(2)
    expect(coordinator.metrics.categoriesSpoken).toEqual(['analytical', 'memory'])

    // Filler 2 plays and finishes
    coordinator.notifyFillerAudioStarted(clock.now())
    expect(coordinator.metrics.fillersSpokenCount).toBe(2)
    clock.advance(1200)
    coordinator.notifyFillerAudioEnded(clock.now())
    expect(coordinator.state).toBe('STAGING')

    // 3. Advance another 15000ms without new semantic keywords -> should fall back to generic
    clock.advance(15000)
    expect(coordinator.state).toBe('FILLER_ARMED')
    expect(onArmFiller).toHaveBeenCalledTimes(3)
    expect(onArmFiller).toHaveBeenLastCalledWith('generic', 15000)
    expect(coordinator.metrics.committedCount).toBe(3)
    expect(coordinator.metrics.categoriesSpoken).toEqual(['analytical', 'memory', 'generic'])

    // Filler 3 plays and finishes (maxFillersPerTurn = 3 reached)
    coordinator.notifyFillerAudioStarted(clock.now())
    expect(coordinator.metrics.fillersSpokenCount).toBe(3)
    clock.advance(1000)
    coordinator.notifyFillerAudioEnded(clock.now())
    // Should transition to HANDOFF because fillersSpokenCount >= maxFillersPerTurn
    expect(coordinator.state).toBe('HANDOFF')

    // Advancing further should NOT trigger a 4th filler
    clock.advance(20000)
    expect(onArmFiller).toHaveBeenCalledTimes(3)
  })

  it('cancels scheduled interval timer when answer arrives during extended STAGING', () => {
    const clock = new VirtualClock()
    const onArmFiller = vi.fn()

    const coordinator = new TurnPacingCoordinator({
      turnId: 'turn-cancel-interval',
      generation: 1,
      providerKey: 'deepseek-r1',
      policy: {
        ...defaultPolicy,
        maxFillersPerTurn: 3,
        pacingIntervalMs: 15000,
      },
      clock,
      onArmFiller,
    })

    coordinator.dispatch()
    clock.advance(1800)
    expect(onArmFiller).toHaveBeenCalledTimes(1)

    // Filler 1 plays and finishes
    coordinator.notifyFillerAudioStarted(clock.now())
    clock.advance(1000)
    coordinator.notifyFillerAudioEnded(clock.now())
    expect(coordinator.state).toBe('STAGING')

    // 5 seconds into the 15s interval, the model finishes thinking and emits answer
    clock.advance(5000)
    coordinator.onInferenceEvent({ type: 'answer', text: 'Here is the result.', at: clock.now() })
    expect(coordinator.state).toBe('ANSWER_READY')

    // Advancing past the remaining 10s should NOT fire the interval flush
    clock.advance(15000)
    expect(onArmFiller).toHaveBeenCalledTimes(1)
    expect(coordinator.state).toBe('ANSWER_READY')
  })

  describe('phase 6: Turn lifecycle, pacingClosed latch, and dynamic aside candidate management', () => {
    it('latches pacingClosed permanently upon first answer literal and clears pending candidates', () => {
      const clock = new VirtualClock()
      const coordinator = new TurnPacingCoordinator({
        turnId: 'turn-phase6-latch',
        generation: 1,
        providerKey: 'test-provider',
        policy: defaultPolicy,
        clock,
      })

      coordinator.dispatch()
      expect(coordinator.pacingClosed).toBe(false)

      const candidate: AsideCandidate = {
        cueId: 'cue-1',
        turn: { turnId: 'turn-phase6-latch', generation: 1 },
        source: 'explicit',
        text: 'Let me double check.',
        phraseKey: 'let-me-double-check',
        collectedAtMs: 500,
        expiresAtMs: 20000,
      }
      coordinator.submitAsideCandidate(candidate)
      expect(coordinator.getPendingAsideCandidate()).toEqual(candidate)

      // Answer literal arrives
      clock.advance(600)
      coordinator.onInferenceEvent({ type: 'answer', text: 'Here is the result.', at: clock.now() })

      expect(coordinator.pacingClosed).toBe(true)
      expect(coordinator.metrics.pacingClosed).toBe(true)
      expect(coordinator.metrics.cutoffReason).toBe('answer-literal')
      expect(coordinator.getPendingAsideCandidate()).toBeNull()

      // Late candidates submitted after closure are rejected
      const lateCandidate: AsideCandidate = {
        cueId: 'cue-2',
        turn: { turnId: 'turn-phase6-latch', generation: 1 },
        source: 'explicit',
        text: 'Another aside.',
        phraseKey: 'another-aside',
        collectedAtMs: 700,
        expiresAtMs: 25000,
      }
      expect(coordinator.submitAsideCandidate(lateCandidate)).toBe(false)
    })

    it('latches pacingClosed permanently when commit budget is exhausted', () => {
      const clock = new VirtualClock()
      const onArmFiller = vi.fn()
      const coordinator = new TurnPacingCoordinator({
        turnId: 'turn-budget-exhaust',
        generation: 1,
        providerKey: 'test-provider',
        policy: {
          ...defaultPolicy,
          maxFillersPerTurn: 1, // Only 1 filler allowed
        },
        clock,
        onArmFiller,
      })

      coordinator.dispatch()
      clock.advance(1800)

      expect(onArmFiller).toHaveBeenCalledTimes(1)
      expect(coordinator.committedCount).toBe(1)
      expect(coordinator.pacingClosed).toBe(true)
      expect(coordinator.metrics.pacingClosed).toBe(true)

      // Even if filler finishes, no more repeat intervals are scheduled
      coordinator.notifyFillerAudioStarted(clock.now())
      clock.advance(1000)
      coordinator.notifyFillerAudioEnded(clock.now())

      expect(coordinator.state).toBe('HANDOFF')
      clock.advance(20000)
      expect(onArmFiller).toHaveBeenCalledTimes(1)
    })

    it('manages candidate expiry and replacement rules correctly', () => {
      const clock = new VirtualClock()
      const coordinator = new TurnPacingCoordinator({
        turnId: 'turn-cand-rules',
        generation: 1,
        providerKey: 'test-provider',
        policy: defaultPolicy,
        clock,
      })

      coordinator.dispatch()

      // 1. Submit explicit candidate at 100ms, expiring at 2000ms
      const cue1: AsideCandidate = {
        cueId: 'cue-1',
        turn: { turnId: 'turn-cand-rules', generation: 1 },
        source: 'explicit',
        text: 'Thinking through this.',
        phraseKey: 'thinking-through-this',
        collectedAtMs: 100,
        expiresAtMs: 2000,
      }
      expect(coordinator.submitAsideCandidate(cue1)).toBe(true)

      // 2. An organic cue at 500ms cannot displace the fresh explicit cue
      const organicCue: AsideCandidate = {
        cueId: 'cue-org-1',
        turn: { turnId: 'turn-cand-rules', generation: 1 },
        source: 'organic',
        text: 'Wait, actually...',
        phraseKey: 'wait-actually',
        collectedAtMs: 500,
        expiresAtMs: 15000,
      }
      expect(coordinator.submitAsideCandidate(organicCue)).toBe(false)
      expect(coordinator.getPendingAsideCandidate()?.cueId).toBe('cue-1')

      // 3. A newer explicit cue replaces the pending explicit cue
      const cue2: AsideCandidate = {
        cueId: 'cue-2',
        turn: { turnId: 'turn-cand-rules', generation: 1 },
        source: 'explicit',
        text: 'Let me re-examine the steps.',
        phraseKey: 'let-me-re-examine',
        collectedAtMs: 800,
        expiresAtMs: 10000,
      }
      expect(coordinator.submitAsideCandidate(cue2)).toBe(true)
      expect(coordinator.getPendingAsideCandidate()?.cueId).toBe('cue-2')

      // 4. Advance clock past expiry (10000ms)
      clock.advance(10500)
      expect(coordinator.getPendingAsideCandidate()).toBeNull()

      // 5. Submit candidate already expired
      const expiredCue: AsideCandidate = {
        cueId: 'cue-old',
        turn: { turnId: 'turn-cand-rules', generation: 1 },
        source: 'explicit',
        text: 'Too late.',
        phraseKey: 'too-late',
        collectedAtMs: 5000,
        expiresAtMs: 10000,
      }
      expect(coordinator.submitAsideCandidate(expiredCue)).toBe(false)
    })

    it('first opportunity is cached-only; second opportunity chooses dynamic aside when eligible', () => {
      const clock = new VirtualClock()
      const onArmFiller = vi.fn()
      const onArmDynamicAside = vi.fn()

      const coordinator = new TurnPacingCoordinator({
        turnId: 'turn-dynamic-pacing',
        generation: 1,
        providerKey: 'deepseek-r1',
        policy: {
          ...defaultPolicy,
          maxFillersPerTurn: 3,
          pacingIntervalMs: 15000,
          dynamicAsidesEnabled: true,
          dynamicAfterMs: 15000,
          maxSynthesisBudgetMs: 600,
        },
        clock,
        onArmFiller,
        onArmDynamicAside,
      })

      coordinator.dispatch()

      // Submit an explicit candidate during initial STAGING
      const earlyAside: AsideCandidate = {
        cueId: 'aside-early',
        turn: { turnId: 'turn-dynamic-pacing', generation: 1 },
        source: 'explicit',
        text: 'Checking the math.',
        phraseKey: 'checking-the-math',
        collectedAtMs: 1000,
        expiresAtMs: 30000,
      }
      coordinator.submitAsideCandidate(earlyAside)

      // Advance to initial deadline (1800ms).
      // SPEC §5.2: The first opportunity is CACHED-ONLY and must NOT consume the dynamic aside.
      clock.advance(1800)
      expect(onArmFiller).toHaveBeenCalledTimes(1)
      expect(onArmFiller).toHaveBeenLastCalledWith('generic', 1800)
      expect(onArmDynamicAside).not.toHaveBeenCalled()
      // Candidate should still be pending
      expect(coordinator.getPendingAsideCandidate()?.cueId).toBe('aside-early')

      // First filler plays and finishes
      coordinator.notifyFillerAudioStarted(clock.now())
      clock.advance(1200)
      coordinator.notifyFillerAudioEnded(clock.now())
      expect(coordinator.state).toBe('STAGING')

      // Submit a fresh explicit aside during extended thinking
      const liveAside: AsideCandidate = {
        cueId: 'aside-live',
        turn: { turnId: 'turn-dynamic-pacing', generation: 1 },
        source: 'explicit',
        text: 'This is taking a bit of computation.',
        phraseKey: 'taking-computation',
        collectedAtMs: 5000,
        expiresAtMs: 35000,
      }
      coordinator.submitAsideCandidate(liveAside)

      // Advance by 15000ms (clock reaches 18000ms total, which is > dynamicAfterMs = 15000)
      clock.advance(15000)
      expect(onArmDynamicAside).toHaveBeenCalledTimes(1)
      expect(onArmDynamicAside).toHaveBeenCalledWith(liveAside, 600)
      expect(coordinator.metrics.dynamicCueSource).toBe('explicit')
      // Candidate is consumed atomically upon selection
      expect(coordinator.getPendingAsideCandidate()).toBeNull()
    })

    it('enforces attempt ceiling maxAttemptsPerTurn = 2 * maxFillersPerTurn', () => {
      const clock = new VirtualClock()
      const onArmFiller = vi.fn()

      const coordinator = new TurnPacingCoordinator({
        turnId: 'turn-attempt-ceiling',
        generation: 1,
        providerKey: 'test-provider',
        policy: {
          ...defaultPolicy,
          maxFillersPerTurn: 1, // max attempts = 2
          pacingIntervalMs: 5000,
        },
        clock,
        onArmFiller,
      })

      coordinator.dispatch()
      // Attempt 1 at initial deadline
      clock.advance(1800)
      expect(onArmFiller).toHaveBeenCalledTimes(1)
      expect(coordinator.attemptsMade).toBe(1)
    })

    it('rotates recurring generic fillers across intervals during long deliberation without specialized keywords', () => {
      const clock = new VirtualClock()
      const onArmFiller = vi.fn()

      const coordinator = new TurnPacingCoordinator({
        turnId: 'turn-recurring-generic',
        generation: 1,
        providerKey: 'test-provider',
        policy: {
          ...defaultPolicy,
          maxFillersPerTurn: 3,
          pacingIntervalMs: 15000,
        },
        clock,
        onArmFiller,
      })

      coordinator.dispatch()

      // 1. Initial deadline (1800ms) arms generic filler 1
      clock.advance(1800)
      expect(coordinator.state).toBe('FILLER_ARMED')
      expect(onArmFiller).toHaveBeenCalledTimes(1)
      expect(onArmFiller).toHaveBeenLastCalledWith('generic', 1800)
      expect(coordinator.metrics.committedCount).toBe(1)

      // Filler 1 plays and finishes
      coordinator.notifyFillerAudioStarted(clock.now())
      clock.advance(1500)
      coordinator.notifyFillerAudioEnded(clock.now())
      expect(coordinator.state).toBe('STAGING')

      // 2. Advance 15s without any specialized category keywords -> arms generic filler 2
      clock.advance(15000)
      expect(coordinator.state).toBe('FILLER_ARMED')
      expect(onArmFiller).toHaveBeenCalledTimes(2)
      expect(onArmFiller).toHaveBeenLastCalledWith('generic', 15000)
      expect(coordinator.metrics.committedCount).toBe(2)

      // Filler 2 plays and finishes
      coordinator.notifyFillerAudioStarted(clock.now())
      clock.advance(1200)
      coordinator.notifyFillerAudioEnded(clock.now())
      expect(coordinator.state).toBe('STAGING')

      // 3. Advance another 15s -> arms generic filler 3 (max 3 reached)
      clock.advance(15000)
      expect(coordinator.state).toBe('FILLER_ARMED')
      expect(onArmFiller).toHaveBeenCalledTimes(3)
      expect(onArmFiller).toHaveBeenLastCalledWith('generic', 15000)
      expect(coordinator.metrics.committedCount).toBe(3)

      // Filler 3 plays and finishes
      coordinator.notifyFillerAudioStarted(clock.now())
      clock.advance(1000)
      coordinator.notifyFillerAudioEnded(clock.now())
      expect(coordinator.state).toBe('HANDOFF')
      expect(coordinator.pacingClosed).toBe(true)

      // Advancing further does not trigger filler 4
      clock.advance(20000)
      expect(onArmFiller).toHaveBeenCalledTimes(3)
    })

    it('re-arms interval timer on cache miss in extended reasoning without deadlocking and records stateLog', () => {
      const clock = new VirtualClock()
      const onArmFiller = vi.fn()
      const onStateChange = vi.fn()

      const coordinator = new TurnPacingCoordinator({
        turnId: 'turn-cache-miss-recovery',
        generation: 1,
        providerKey: 'deep-cot-provider',
        policy: {
          ...defaultPolicy,
          maxFillersPerTurn: 3,
          pacingIntervalMs: 15000,
        },
        clock,
        onArmFiller,
        onStateChange,
      })

      coordinator.dispatch()
      clock.advance(1800)
      expect(coordinator.state).toBe('FILLER_ARMED')
      expect(onArmFiller).toHaveBeenCalledTimes(1)

      // Simulate cache miss on filler 1
      coordinator.notifyCacheMiss()
      expect(coordinator.state).toBe('STAGING')
      expect(coordinator.metrics.pacingClosed).toBe(false)
      expect(coordinator.metrics.stateLog?.length).toBeGreaterThan(0)

      // Advance 15s - interval timer should fire and arm next opportunity without deadlocking
      clock.advance(15000)
      expect(coordinator.state).toBe('FILLER_ARMED')
      expect(onArmFiller).toHaveBeenCalledTimes(2)

      // Filler 2 plays and ends
      coordinator.notifyFillerAudioStarted(clock.now())
      clock.advance(1000)
      coordinator.notifyFillerAudioEnded(clock.now())
      expect(coordinator.state).toBe('STAGING')

      // Advance 15s - arms filler 2 (committedCount becomes 2)
      clock.advance(15000)
      expect(coordinator.state).toBe('FILLER_ARMED')
      expect(onArmFiller).toHaveBeenCalledTimes(3)

      // Filler 2 plays and ends
      coordinator.notifyFillerAudioStarted(clock.now())
      clock.advance(1000)
      coordinator.notifyFillerAudioEnded(clock.now())
      expect(coordinator.state).toBe('STAGING')

      // Advance 15s - arms filler 3 (committedCount becomes 3 = maxFillersPerTurn)
      clock.advance(15000)
      expect(coordinator.state).toBe('FILLER_ARMED')
      expect(onArmFiller).toHaveBeenCalledTimes(4)

      // Filler 3 plays and ends -> reaches maxFillersPerTurn (3)
      coordinator.notifyFillerAudioStarted(clock.now())
      clock.advance(1000)
      coordinator.notifyFillerAudioEnded(clock.now())
      expect(coordinator.state).toBe('HANDOFF')
      expect(coordinator.pacingClosed).toBe(true)

      // Verify stateLog contains chronological records
      const logs = coordinator.metrics.stateLog || []
      expect(logs.some(l => l.event.includes('Cache miss'))).toBe(true)
      expect(logs.some(l => l.event.includes('Filler playback started'))).toBe(true)
      expect(logs.some(l => l.event.includes('Handoff'))).toBe(true)
    })

    it('ensures notifyAnswerAudioScheduled is strictly idempotent across multi-chunk playback', () => {
      const clock = new VirtualClock()
      const onSettled = vi.fn()
      const coordinator = new TurnPacingCoordinator({
        turnId: 'turn-idempotency',
        generation: 1,
        providerKey: 'test-provider',
        policy: { ...defaultPolicy, pacingIntervalMs: 15000 },
        clock,
        onSettled,
      })

      coordinator.dispatch()
      clock.advance(1800)
      expect(coordinator.state).toBe('FILLER_ARMED')

      coordinator.notifyFillerAudioStarted(clock.now())
      clock.advance(1000)
      coordinator.notifyFillerAudioEnded(clock.now())
      expect(coordinator.state).toBe('STAGING')

      // Answer text arrives
      coordinator.onInferenceEvent({ type: 'answer', text: 'Sentence 1. Sentence 2. Sentence 3.', at: clock.now() })
      expect(coordinator.state).toBe('ANSWER_READY')

      // First answer audio chunk scheduled
      coordinator.notifyAnswerAudioScheduled(clock.now())
      const logCountAfterFirst = coordinator.metrics.stateLog?.length || 0

      // Subsequent 5 sentence chunks scheduled during playback
      coordinator.notifyAnswerAudioScheduled(clock.now() + 500)
      coordinator.notifyAnswerAudioScheduled(clock.now() + 1000)
      coordinator.notifyAnswerAudioScheduled(clock.now() + 1500)
      coordinator.notifyAnswerAudioScheduled(clock.now() + 2000)
      coordinator.notifyAnswerAudioScheduled(clock.now() + 2500)

      // Verify no extra logs were added to stateLog
      expect(coordinator.metrics.stateLog?.length).toBe(logCountAfterFirst)
      const scheduledLogs = coordinator.metrics.stateLog?.filter(l => l.event.includes('Answer audio scheduled')) || []
      expect(scheduledLogs.length).toBe(1)
    })

    it('uses adaptive 5s retry on initial cache miss instead of full 15s interval', () => {
      const clock = new VirtualClock()
      const onArmFiller = vi.fn()
      const coordinator = new TurnPacingCoordinator({
        turnId: 'turn-initial-miss',
        generation: 1,
        providerKey: 'test-provider',
        policy: { ...defaultPolicy, pacingIntervalMs: 15000 },
        clock,
        onArmFiller,
      })

      coordinator.dispatch()
      clock.advance(1800)
      expect(coordinator.state).toBe('FILLER_ARMED')
      expect(onArmFiller).toHaveBeenCalledTimes(1)

      // Initial filler suffers a cache miss
      coordinator.notifyCacheMiss()
      expect(coordinator.state).toBe('STAGING')

      // Verify log recorded adaptive retry
      const logs = coordinator.metrics.stateLog || []
      const missLog = logs.find(l => l.event.includes('Cache miss'))
      expect(missLog?.details).toBe('+5s')

      // Advance 4999ms - should still be staging
      clock.advance(4999)
      expect(coordinator.state).toBe('STAGING')
      expect(onArmFiller).toHaveBeenCalledTimes(1)

      // Advance remaining 1ms (total 5000ms from miss) - should fire second attempt
      clock.advance(1)
      expect(coordinator.state).toBe('FILLER_ARMED')
      expect(onArmFiller).toHaveBeenCalledTimes(2)
    })

    it('records granular failure details and elapsed times in notifyCacheMiss', () => {
      const clock = new VirtualClock()
      const coordinator = new TurnPacingCoordinator({
        turnId: 'turn-diag-miss',
        generation: 1,
        providerKey: 'test-provider',
        policy: { ...defaultPolicy, pacingIntervalMs: 15000 },
        clock,
      })

      coordinator.dispatch()
      clock.advance(1800)
      expect(coordinator.state).toBe('FILLER_ARMED')

      coordinator.notifyCacheMiss({
        reason: 'synthesis_timeout',
        error: 'Dynamic synthesis timed out after 2500ms',
        elapsedMs: 2500,
      })

      expect(coordinator.state).toBe('STAGING')
      expect(coordinator.metrics.fillerOutcome).toBe('cache-miss')
      expect(coordinator.metrics.cutoffReason).toBeUndefined()
      expect(coordinator.metrics.cacheMissReason).toBe('synthesis_timeout')
      expect(coordinator.metrics.cacheMissError).toBe('Dynamic synthesis timed out after 2500ms')

      const lastLog = coordinator.metrics.stateLog?.slice(-1)[0]
      expect(lastLog?.event).toContain('[synthesis_timeout · 2500ms]')
      expect(lastLog?.details).toContain('Dynamic synthesis timed out after 2500ms ➔ +5s')
    })
  })
})
