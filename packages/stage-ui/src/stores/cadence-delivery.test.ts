import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCadenceDeliveryStore } from './cadence-delivery'

const ranges = [{ start: 0, end: 3 }, { start: 4, end: 7 }]

function armVoiced(store: ReturnType<typeof useCadenceDeliveryStore>, messageId = 'm1') {
  store.armTurn({ messageId, sessionId: 's1', intentId: 'i1', streamId: 'st1', mode: 'voiced' })
  store.recordSegment('i1', { segmentId: 'a', sourceStart: 0, sourceEnd: 3, special: null })
  store.recordSegment('i1', { segmentId: 'b', sourceStart: 4, sourceEnd: 7, special: null })
  store.resolvePlan(messageId, {
    bubbles: ['aaa', 'bbb'],
    ranges,
    beatsMs: [500],
    textDelaysMs: [1000],
    contentLength: 7,
    total: 2,
  })
}

describe('useCadenceDeliveryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('staggers voiced bubbles behind arrival plus beat', async () => {
    const store = useCadenceDeliveryStore()
    const signal = new AbortController().signal
    armVoiced(store)

    expect(store.revealedFor('m1')).toBe(0)

    await expect(store.gatePlaybackItem('i1', 'a', signal)).resolves.toBe('released')
    expect(store.revealedFor('m1')).toBe(1)

    const gated = store.gatePlaybackItem('i1', 'b', signal)
    expect(store.revealedFor('m1')).toBe(1)
    await vi.advanceTimersByTimeAsync(500)
    await expect(gated).resolves.toBe('released')
    // Done entries render statically.
    expect(store.revealedFor('m1')).toBeNull()
  })

  it('reveals text-mode bubbles on typing timers without gating audio', async () => {
    const store = useCadenceDeliveryStore()
    const signal = new AbortController().signal
    store.armTurn({ messageId: 'm1', sessionId: 's1', intentId: 'i1', streamId: 'st1', mode: 'text' })
    store.recordSegment('i1', { segmentId: 'a', sourceStart: 0, sourceEnd: 3, special: null })
    store.resolvePlan('m1', {
      bubbles: ['aaa', 'bbb'],
      ranges,
      beatsMs: [500],
      textDelaysMs: [1000],
      contentLength: 7,
      total: 2,
    })

    expect(store.revealedFor('m1')).toBe(1)
    await expect(store.gatePlaybackItem('i1', 'a', signal)).resolves.toBe('released')
    await vi.advanceTimersByTimeAsync(1000)
    expect(store.revealedFor('m1')).toBeNull()
  })

  it('fail-safes to reveal-all when segments cannot map', async () => {
    const store = useCadenceDeliveryStore()
    const signal = new AbortController().signal
    store.armTurn({ messageId: 'm1', sessionId: 's1', intentId: 'i1', streamId: 'st1', mode: 'voiced' })
    store.recordSegment('i1', { segmentId: 'a', sourceStart: 0, sourceEnd: 500, special: null })
    store.resolvePlan('m1', {
      bubbles: ['aaa', 'bbb'],
      ranges,
      beatsMs: [500],
      textDelaysMs: [1000],
      contentLength: 7,
      total: 2,
    })

    expect(store.revealedFor('m1')).toBeNull()
    await expect(store.gatePlaybackItem('i1', 'a', signal)).resolves.toBe('released')
  })

  it('lets unmapped audio (e.g. pacing fillers) through without revealing', async () => {
    const store = useCadenceDeliveryStore()
    const signal = new AbortController().signal
    armVoiced(store)

    await expect(store.gatePlaybackItem('i1', 'segment-filler-m1', signal)).resolves.toBe('released')
    expect(store.revealedFor('m1')).toBe(0)

    await expect(store.gatePlaybackItem('i1', 'a', signal)).resolves.toBe('released')
    expect(store.revealedFor('m1')).toBe(1)
  })

  it('releases the gate for single-bubble plans', async () => {
    const store = useCadenceDeliveryStore()
    const signal = new AbortController().signal
    store.armTurn({ messageId: 'm1', sessionId: 's1', intentId: 'i1', streamId: 'st1', mode: 'voiced' })
    store.resolvePlan('m1', null)

    expect(store.revealedFor('m1')).toBeNull()
    await expect(store.gatePlaybackItem('i1', 'a', signal)).resolves.toBe('released')
  })

  it('aborts pending gates and reveals the remainder on stop', async () => {
    const store = useCadenceDeliveryStore()
    const controller = new AbortController()
    armVoiced(store)

    await expect(store.gatePlaybackItem('i1', 'a', controller.signal)).resolves.toBe('released')
    const gated = store.gatePlaybackItem('i1', 'b', controller.signal)
    store.abortTurn('m1')
    await expect(gated).resolves.toBe('aborted')
    expect(store.revealedFor('m1')).toBeNull()
  })
})
