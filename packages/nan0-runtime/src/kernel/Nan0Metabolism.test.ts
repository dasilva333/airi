import type { Nan0KernelObservatory } from '../diagnostics/Nan0KernelObservatory'
import type { Nan0ReasoningRequest } from '../types'

import { describe, expect, it, vi } from 'vitest'

import { createNan0KernelObservatory } from '../diagnostics/Nan0KernelObservatory'
import { InMemoryStateStore } from '../persistence/InMemoryStateStore'
import { ControllableNan0Clock } from '../temporal/Nan0Clock'
import { Nan0Kernel } from './Nan0Kernel'

function privateSilence(): string {
  return `The idle interval reaches me as evidence, so I decide privately whether it deserves anything outward.
---EXTRACT---
${JSON.stringify({
  interpretation: 'A persisted internal temporal event became salient.',
  privateText: 'It is real, but I do not need to speak merely because time passed.',
  decision: 'SILENCE',
  speakability: 0.8,
  confidence: 0.9,
  mood: 'watchful',
  reasonCodes: ['metabolism.temporal'],
  actionIntent: null,
  waitUntil: null,
  goalSignal: null,
  intentionSignal: null,
})}`
}

function harness(observatory?: Nan0KernelObservatory) {
  const clock = new ControllableNan0Clock({ wallTime: 1_000, monotonicTime: 1_000 })
  let calls = 0
  let id = 0
  const kernel = new Nan0Kernel({
    stateStore: new InMemoryStateStore(),
    clock,
    createId: () => `metabolism-${++id}`,
    reasoningClient: {
      async generate(_request: Nan0ReasoningRequest) {
        calls++
        return { text: privateSilence() }
      },
    },
    observatory,
  })
  return { kernel, clock, calls: () => calls }
}

describe('nan0 metabolism integration', () => {
  it('is a no-op without a host session and never calls a provider directly', async () => {
    const subject = harness()
    await subject.kernel.boot()
    const result = await subject.kernel.evaluateMetabolism({ reason: 'interval', hostReady: true })
    expect(result.outcome).toBe('skipped')
    expect(result.terminal).toMatchObject({ result: 'NO_COGNITION', reasonCodes: ['heartbeat.session-unavailable'] })
    expect(subject.calls()).toBe(0)
    await subject.kernel.notifyExternalInputPresence({ at: 2_000, actorId: 'kyo' })
    expect(subject.kernel.getStateSnapshot()).toMatchObject({
      heartbeat: { lastExternalInputAt: 2_000, lastKyoInteractionAt: 2_000 },
      temporal: { engine: { lived: { lastExternalInputAt: 2_000 } } },
    })
  })

  it('routes an internal metabolism event through thought, decision, and terminal silence', async () => {
    const subject = harness()
    await subject.kernel.boot()
    const sessionId = await subject.kernel.openSession({ source: 'chat' })
    await subject.kernel.notifyExternalInputPresence({ at: subject.clock.utcNow(), actorId: 'kyo' })
    subject.clock.advance({ wallMs: 3 * 60 * 60_000, monotonicMs: 3 * 60 * 60_000 })

    const result = await subject.kernel.evaluateMetabolism({ reason: 'interval', hostReady: true, sessionId })
    const state = subject.kernel.getStateSnapshot()
    expect(result).toMatchObject({
      outcome: 'SILENCE',
      prepared: null,
      observationId: expect.any(String),
      terminal: {
        result: 'CHOSEN_SILENCE',
        thoughtId: expect.any(String),
        decisionId: expect.any(String),
        turnId: expect.any(String),
        source: 'internal:temporal',
        provenance: expect.objectContaining({ producer: 'temporal' }),
      },
    })
    expect(subject.calls()).toBe(1)
    expect(state.thoughts.at(-1)?.reasonCodes.some(code => code.startsWith('metabolism.'))).toBe(true)
    expect(state.decisions.at(-1)?.finalDecision).toBe('SILENCE')
    expect(state.internalObservations?.records.find(record => record.observation.id === result.observationId)?.status).toBe('handled')
    expect(state.memories.some(memory => memory.tags.includes('assistant-output'))).toBe(false)
  })

  it('continues cognition when the asynchronous diagnostic sink fails', async () => {
    const diagnosticConsole = { info: vi.fn(), error: vi.fn() }
    const observatory = createNan0KernelObservatory({
      configuration: { enabled: true },
      sink: { async write() { throw new Error('disk unavailable') } },
      console: diagnosticConsole,
    })
    const subject = harness(observatory)
    await subject.kernel.boot()
    const sessionId = await subject.kernel.openSession({ source: 'chat' })
    await subject.kernel.notifyExternalInputPresence({ at: subject.clock.utcNow(), actorId: 'kyo' })
    subject.clock.advance({ wallMs: 3 * 60 * 60_000, monotonicMs: 3 * 60 * 60_000 })

    const result = await subject.kernel.evaluateMetabolism({ reason: 'interval', hostReady: true, sessionId })
    await expect(observatory.flush()).resolves.toBeUndefined()
    expect(result.terminal.result).toBe('CHOSEN_SILENCE')
    expect(subject.calls()).toBe(1)
    expect(diagnosticConsole.error).toHaveBeenCalledOnce()
  })
})
