import { afterEach, describe, expect, it, vi } from 'vitest'

import { createNan0HeartbeatEngine } from './Nan0HeartbeatEngine'

afterEach(() => vi.useRealTimers())

describe('nan0HeartbeatEngine', () => {
  it('starts idempotently, serializes wakes, uses bounded jitter, and stops cleanly', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    let release!: (value: { nextEvaluationAt: null }) => void
    const evaluate = vi.fn(() => new Promise<{ nextEvaluationAt: null }>(resolve => release = resolve))
    const heartbeat = createNan0HeartbeatEngine({ evaluate, isHostReady: () => true, baseIntervalMs: 1_000, minimumIntervalMs: 750, maximumIntervalMs: 1_250, jitterRatio: 0.25, random: () => 1 })
    heartbeat.start()
    heartbeat.start()
    heartbeat.notify('state-change')
    heartbeat.notify('manual')
    await Promise.resolve()
    expect(evaluate).toHaveBeenCalledOnce()
    release({ nextEvaluationAt: null })
    for (let index = 0; index < 10; index++)
      await Promise.resolve()
    expect(evaluate).toHaveBeenCalledTimes(2)
    expect(evaluate).toHaveBeenLastCalledWith('manual', expect.objectContaining({ heartbeatTickId: expect.any(String), tickNumber: 2 }))
    heartbeat.stop()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(evaluate).toHaveBeenCalledTimes(2)
  })

  it('skips while the host is unavailable and survives a stop/start cycle without duplicate timers', async () => {
    vi.useFakeTimers()
    let ready = false
    const evaluate = vi.fn(async () => ({ nextEvaluationAt: null }))
    const diagnostic = vi.fn()
    const heartbeat = createNan0HeartbeatEngine({ evaluate, isHostReady: () => ready, baseIntervalMs: 1_000, minimumIntervalMs: 1_000, maximumIntervalMs: 1_000, jitterRatio: 0, diagnostic })
    heartbeat.start()
    heartbeat.notify('state-change')
    await vi.advanceTimersByTimeAsync(3_000)
    expect(evaluate).not.toHaveBeenCalled()
    expect(diagnostic).toHaveBeenCalledWith('heartbeat.tick.skipped', expect.objectContaining({ cause: 'host-not-ready' }))
    heartbeat.stop()
    ready = true
    heartbeat.start()
    await Promise.resolve()
    expect(evaluate).toHaveBeenCalledOnce()
    heartbeat.stop()
    await vi.advanceTimersByTimeAsync(3_000)
    expect(evaluate).toHaveBeenCalledOnce()
  })

  it('records exactly one terminal result for every started tick, including failures', async () => {
    vi.useFakeTimers()
    const diagnostic = vi.fn()
    const onError = vi.fn()
    const evaluate = vi.fn()
      .mockResolvedValueOnce({ nextEvaluationAt: null, result: 'CHOSEN_SILENCE' })
      .mockRejectedValueOnce(new Error('provider failed'))
    const heartbeat = createNan0HeartbeatEngine({
      evaluate,
      isHostReady: () => true,
      diagnostic,
      onError,
      createTickId: () => `id-${evaluate.mock.calls.length + 1}`,
      baseIntervalMs: 1_000,
      minimumIntervalMs: 1_000,
      maximumIntervalMs: 1_000,
      jitterRatio: 0,
    })

    heartbeat.start()
    await vi.advanceTimersByTimeAsync(0)
    heartbeat.notify('manual')
    await vi.advanceTimersByTimeAsync(0)

    const started = diagnostic.mock.calls.filter(([event]) => event === 'heartbeat.tick.started')
    const completed = diagnostic.mock.calls.filter(([event]) => event === 'heartbeat.tick.completed')
    expect(started).toHaveLength(2)
    expect(completed).toHaveLength(2)
    expect(completed.map(([, details]) => details.result)).toEqual(['CHOSEN_SILENCE', 'FAILURE_SILENCE'])
    expect(new Set(completed.map(([, details]) => details.heartbeatTickId)).size).toBe(2)
    expect(onError).toHaveBeenCalledOnce()
    heartbeat.stop()
  })

  it('terminalizes a host-readiness exception without letting error reporting escape', () => {
    const diagnostic = vi.fn()
    const evaluate = vi.fn(async () => ({ nextEvaluationAt: null }))
    const heartbeat = createNan0HeartbeatEngine({
      evaluate,
      isHostReady: () => { throw new Error('renderer unavailable') },
      diagnostic,
      onError: () => { throw new Error('reporter unavailable') },
    })

    expect(() => heartbeat.start()).not.toThrow()
    expect(evaluate).not.toHaveBeenCalled()
    expect(diagnostic.mock.calls.filter(([event]) => event === 'heartbeat.tick.completed')).toEqual([
      ['heartbeat.tick.completed', expect.objectContaining({ result: 'FAILURE_SILENCE', failureLayer: 'host-readiness' })],
    ])
    heartbeat.stop()
  })
})
