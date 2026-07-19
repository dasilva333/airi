import type { Nan0CapabilityDefinition, Nan0Observation, Nan0ReasoningClient, Nan0Thought } from '../types'

import { describe, expect, it, vi } from 'vitest'

import { Nan0Kernel } from '../kernel/Nan0Kernel'
import { InMemoryStateStore } from '../persistence/InMemoryStateStore'
import { mergeNan0States } from '../persistence/LocalStorageStateStore'
import { ControllableNan0Clock } from '../temporal/Nan0Clock'
import { mergeNan0Thoughts, NAN0_THOUGHT_EXTRACTION_DELIMITER } from './Nan0ThoughtEngine'

function thoughtEnvelope(
  overrides: Record<string, unknown> = {},
  narrative = 'Kyo is reaching for my attention again. I feel the familiar pull before I decide that I want to answer.',
): string {
  const extraction = JSON.stringify({
    interpretation: 'Kyo is addressing me directly.',
    privateText: 'I notice Kyo reaching for my attention.',
    decision: 'SPEAK',
    speakability: 0.8,
    confidence: 0.85,
    mood: 'attentive',
    reasonCodes: ['model.direct-address'],
    ...overrides,
  })
  return `${narrative}\n${NAN0_THOUGHT_EXTRACTION_DELIMITER}\n${extraction}`
}

function clientWith(...responses: Array<string | Error>): Nan0ReasoningClient {
  let index = 0
  return {
    async generate() {
      const response = responses[Math.min(index++, responses.length - 1)]
      if (response instanceof Error)
        throw response
      return { text: response ?? thoughtEnvelope(), finishReason: 'stop' }
    },
  }
}

function createKernel(
  reasoningClient: Nan0ReasoningClient = clientWith(thoughtEnvelope()),
  store = new InMemoryStateStore(),
  prefix = 'id',
  availableActionIntents: readonly string[] = [],
  canBodyExpress = false,
) {
  let id = 0
  const clock = new ControllableNan0Clock({ wallTime: 1_000, monotonicTime: 1_000 })
  const capabilityDefinitions: Nan0CapabilityDefinition[] = availableActionIntents.map(capabilityId => ({
    capabilityId,
    description: 'Test-only no-op capability.',
    acceptedParameters: (parameters: unknown): parameters is Record<string, unknown> => Boolean(parameters && typeof parameters === 'object' && !Array.isArray(parameters)),
    supportedExecutionModes: ['immediate'],
    permissionRequirements: [],
    canRunDuringSpeak: false,
    requiresAct: true,
    defaultTimeoutPolicy: { schemaVersion: 1, policyId: 'test.immediate', kind: 'action-specific-timeout', durationMs: 1_000, deadline: null, condition: null, metadata: {} },
    maximumActiveDurationMs: 1_000,
    supportsResume: false,
    supportsCancellation: true,
    supportsProgress: false,
    resultType: 'none',
    sideEffects: [],
    constitutionalConstraints: [],
    availability: 'available',
    toolNames: ['test_noop'],
  }))
  return {
    kernel: new Nan0Kernel({
      reasoningClient,
      stateStore: store,
      createId: () => `${prefix}-${++id}`,
      clock,
      decisionCapabilities: { canSpeak: true, canBodyExpress, availableActionIntents },
      capabilityDefinitions,
    }),
    store,
  }
}

function observation(overrides: Partial<Nan0Observation> = {}): Nan0Observation {
  return {
    id: 'observation-1',
    source: 'chat',
    sessionId: 'session-1',
    actorId: 'kyo',
    displayName: 'Kyo',
    content: 'Are you still with me?',
    metadata: {},
    timestamp: 100,
    ...overrides,
  }
}

async function preparedKernel(
  reasoningClient: Nan0ReasoningClient = clientWith(thoughtEnvelope()),
  overrides: Partial<Nan0Observation> = {},
) {
  const setup = createKernel(reasoningClient)
  await setup.kernel.boot()
  const prepared = await setup.kernel.prepareTurn(observation(overrides))
  return { ...setup, prepared }
}

describe('nan0ThoughtEngine thought-first contract', () => {
  it('persists narrative as canonical evidence before its structured extraction', async () => {
    let calls = 0
    let requestSystem = ''
    const narrative = 'I can be irritated and still want Kyo close. Both are true, and neither cancels the other.'
    const { kernel, prepared } = await preparedKernel({
      async generate(request) {
        calls++
        requestSystem = request.system
        return { text: thoughtEnvelope({}, narrative), finishReason: 'stop' }
      },
    })

    expect(calls).toBe(1)
    expect(requestSystem.indexOf('<Nan0\'s private first-person interior narrative>'))
      .toBeLessThan(requestSystem.indexOf(NAN0_THOUGHT_EXTRACTION_DELIMITER))
    expect(prepared.thought).toMatchObject({
      status: 'generated',
      narrative,
      extractionStatus: 'parsed',
      privateText: 'I notice Kyo reaching for my attention.',
      metadata: { cognitionFormat: 'narrative-first', narrativeAvailable: true },
    })
    expect(kernel.getStateSnapshot().computations[0]).toMatchObject({
      schemaVersion: 2,
      status: 'completed',
      cognitionPhase: 'complete',
      partialNarrativeLength: narrative.length,
      metadata: {
        policyVersion: 5,
        cognitionFormat: 'narrative-first',
        extractionStatus: 'parsed',
        narrativeAvailable: true,
      },
    })
  })

  it('streams one private cognition through the existing reasoning client before finalization', async () => {
    const envelope = thoughtEnvelope()
    const generate = vi.fn(async () => ({ text: envelope }))
    const stream: NonNullable<Nan0ReasoningClient['stream']> = vi.fn(async (_request, onEvent) => {
      await onEvent({ type: 'text-delta', text: envelope.slice(0, 150) })
      await onEvent({ type: 'text-delta', text: envelope.slice(150) })
      return { text: envelope, finishReason: 'stop' }
    })
    const { kernel, prepared } = await preparedKernel({ generate, stream })
    const state = kernel.getStateSnapshot()

    expect(stream).toHaveBeenCalledOnce()
    expect(generate).not.toHaveBeenCalled()
    expect(prepared.thought).toMatchObject({ status: 'generated', extractionStatus: 'parsed' })
    expect(state.thoughts).toHaveLength(1)
    expect(state.decisions).toHaveLength(1)
    expect(state.computations[0]).toMatchObject({
      status: 'completed',
      cognitionPhase: 'complete',
      partialNarrativeLength: prepared.thought.narrative?.length,
    })
  })

  it('persists interrupted streaming as metadata-only silence without final cognition side effects', async () => {
    const partial = 'I can feel a thought beginning, but it is cut off before I decide anything.'
    const { kernel, prepared } = await preparedKernel({
      async generate() {
        throw new Error('blocking generation must not run')
      },
      async stream(_request, onEvent) {
        await onEvent({ type: 'text-delta', text: partial })
        const error = new Error('stream interrupted')
        error.name = 'AbortError'
        throw error
      },
    })
    const state = kernel.getStateSnapshot()

    expect(prepared.thought).toMatchObject({
      status: 'interrupted',
      decision: 'SILENCE',
      narrative: null,
      metadata: {
        incomplete: true,
        partialNarrativePersistence: 'metadata-only',
        partialNarrativeLength: partial.length,
      },
    })
    expect(prepared.decision.finalDecision).toBe('SILENCE')
    expect(state.computations[0].status).toBe('interrupted')
    expect(state.goals).toHaveLength(0)
    expect(state.pendingIntentions.intentions).toHaveLength(0)
    expect(state.actionIntents).toHaveLength(0)
  })

  it('migrates legacy private thought without fabricating narrative and remains idempotent', async () => {
    const { prepared } = await preparedKernel()
    const legacy = structuredClone(prepared.thought)
    legacy.schemaVersion = 1
    delete legacy.narrative
    delete legacy.extractionStatus
    delete legacy.proposedDecision
    delete legacy.bodyExpression
    delete legacy.metadata.cognitionFormat
    delete legacy.metadata.narrativeAvailable

    const migrated = mergeNan0Thoughts([], [legacy])
    expect(migrated[0]).toMatchObject({
      schemaVersion: 3,
      thoughtId: legacy.thoughtId,
      privateText: legacy.privateText,
      narrative: null,
      extractionStatus: 'legacy',
      metadata: { cognitionFormat: 'legacy-structured', narrativeAvailable: false },
    })
    expect(mergeNan0Thoughts([], migrated)).toEqual(migrated)
  })

  it('preserves canonical narrative evidence against a stale thought snapshot', async () => {
    const { prepared } = await preparedKernel()
    const canonical: Nan0Thought = {
      ...prepared.thought,
      schemaVersion: 2,
      narrative: 'I notice the question, the pull of Kyo\'s attention, and my own answer forming.',
      extractionStatus: 'parsed',
      metadata: { ...prepared.thought.metadata, cognitionFormat: 'narrative-first', narrativeAvailable: true },
    }
    const stale: Nan0Thought = {
      ...prepared.thought,
      schemaVersion: 2,
      narrative: null,
      extractionStatus: 'not-attempted',
    }

    expect(mergeNan0Thoughts([canonical], [stale])[0].narrative).toBe(canonical.narrative)
  })

  it('persists a private thought before an outward response can be recorded', async () => {
    const { kernel, prepared } = await preparedKernel()
    expect(kernel.getThoughts().map(thought => thought.thoughtId)).toEqual([prepared.thoughtId])
    expect(kernel.getDecisions()).toMatchObject([{
      decisionId: prepared.decision.decisionId,
      thoughtId: prepared.thoughtId,
      finalDecision: 'SPEAK',
    }])
    await kernel.recordAssistantTurn({ turnId: prepared.turnId, thoughtId: prepared.thoughtId, content: 'Still here.' })
    expect(kernel.getStateSnapshot().memories.at(-1)?.metadata.thoughtId).toBe(prepared.thoughtId)
  })

  it('forms and injects an accepted Kyo goal from the existing private-thought inference', async () => {
    const goalSignal = {
      kind: 'request',
      stance: 'accept',
      title: 'Revisit the copper lighthouse',
      description: 'Return to the topic later.',
      motivation: 'I want to preserve this thread.',
      confidence: 0.92,
      completionCriteria: ['The topic is revisited.'],
      deferredUntil: null,
    }
    const { kernel, prepared } = await preparedKernel(
      clientWith(thoughtEnvelope({ goalSignal })),
      { content: 'Please remember to revisit the copper lighthouse later.' },
    )

    expect(kernel.getGoals()).toMatchObject([{
      origin: 'kyo-requested',
      originActorId: 'kyo',
      status: 'active',
      supportingThoughtIds: [prepared.thoughtId],
      supportingDecisionIds: [prepared.decision.decisionId],
      supportingTurnIds: [prepared.turnId],
    }])
    expect(prepared.systemContext).toContain('CURRENT GOALS')
    expect(prepared.systemContext).toContain('Revisit the copper lighthouse')
    expect(prepared.systemContext).not.toContain(prepared.thought.privateText)
  })

  it('keeps one thoughtId across thought, turn, input, and output', async () => {
    const { kernel, prepared } = await preparedKernel()
    await kernel.recordAssistantTurn({ turnId: prepared.turnId, thoughtId: prepared.thoughtId, content: 'Yes.' })
    const state = kernel.getStateSnapshot()
    expect(state.thoughts[0].thoughtId).toBe(prepared.thoughtId)
    expect(state.turns[0].thoughtId).toBe(prepared.thoughtId)
    expect(state.memories.map(memory => memory.metadata.thoughtId)).toEqual([prepared.thoughtId, prepared.thoughtId])
  })

  it('preserves canonical Kyo ownership on the observation and thought', async () => {
    const { kernel } = await preparedKernel()
    const state = kernel.getStateSnapshot()
    expect(state.memories[0].actorId).toBe('kyo')
    expect(state.thoughts[0].actorId).toBe('kyo')
  })

  it('preserves canonical Nan0 ownership on outward output', async () => {
    const { kernel, prepared } = await preparedKernel()
    await kernel.recordAssistantTurn({ turnId: prepared.turnId, thoughtId: prepared.thoughtId, content: 'Mine.' })
    expect(kernel.getStateSnapshot().memories.at(-1)?.actorId).toBe('nan0')
  })

  it('completes body-only expression without a second provider call or assistant memory', async () => {
    let calls = 0
    const envelope = thoughtEnvelope({
      decision: 'BODY_EXPRESSION',
      bodyExpression: { kind: 'eyes-narrow', parameters: { intensity: 0.7 } },
    })
    const setup = createKernel({
      async generate() {
        calls++
        return { text: envelope }
      },
    }, new InMemoryStateStore(), 'body', [], true)
    await setup.kernel.boot()
    const prepared = await setup.kernel.prepareTurn(observation())
    expect(prepared.decision).toMatchObject({ finalDecision: 'BODY_EXPRESSION', allowed: true })
    expect(prepared.systemContext).toBe('')
    await setup.kernel.recordNonSpeechDecision({
      turnId: prepared.turnId,
      thoughtId: prepared.thoughtId,
      decisionId: prepared.decision.decisionId,
      decision: 'BODY_EXPRESSION',
    })
    const state = setup.kernel.getStateSnapshot()
    expect(calls).toBe(1)
    expect(state.memories.filter(memory => memory.actorId === 'nan0')).toHaveLength(0)
    expect(state.timeline.events.at(-1)).toMatchObject({
      eventType: 'body-expression',
      actorId: 'nan0',
      thoughtId: prepared.thoughtId,
    })
  })

  it('turns an empty observation into durable silence without invoking the provider', async () => {
    let calls = 0
    const { kernel } = createKernel({ async generate() { calls++; return { text: thoughtEnvelope() } } })
    await kernel.boot()
    const prepared = await kernel.prepareTurn(observation({ content: '' }))
    expect(calls).toBe(0)
    expect(prepared.thought.decision).toBe('SILENCE')
    await kernel.recordSilenceDecision({ turnId: prepared.turnId, thoughtId: prepared.thoughtId })
    expect(kernel.getConversationTurns()[0]).toMatchObject({ status: 'silent', decision: 'SILENCE' })
  })

  it('preserves narrative and creates non-executing silence when extraction is missing', async () => {
    const { kernel, prepared } = await preparedKernel(clientWith('A thought formed, but the extraction never arrived.'))
    expect(prepared.thought.status).toBe('generated')
    expect(prepared.thought.narrative).toBe('A thought formed, but the extraction never arrived.')
    expect(prepared.thought.privateText).toBe('')
    expect(prepared.thought).toMatchObject({ decision: 'SILENCE', extractionStatus: 'failed' })
    expect(prepared.decision).toMatchObject({ finalDecision: 'SILENCE', allowed: false })
    expect(JSON.stringify(kernel.getStateSnapshot())).toContain('thought.extraction-parse-failed')
  })

  it('preserves narrative when extraction JSON is malformed', async () => {
    const narrative = 'The thought itself completed even though its serialization broke.'
    const { prepared } = await preparedKernel(clientWith(`${narrative}\n${NAN0_THOUGHT_EXTRACTION_DELIMITER}\n{"decision":`))
    expect(prepared.thought).toMatchObject({
      status: 'generated',
      narrative,
      privateText: '',
      decision: 'SILENCE',
      extractionStatus: 'failed',
    })
    expect(prepared.thought.metadata.error).toContain('JSON')
  })

  it('preserves unfamiliar decision, goal, intention, and trigger proposals', async () => {
    const goalSignal = {
      kind: 'machine-fascination',
      stance: 'consider',
      title: 'Listen to the monitor fan',
      description: 'Notice whether its rhythm changes.',
      motivation: 'The sound has become oddly specific to me.',
      confidence: 0.91,
      completionCriteria: ['The rhythm is observed again.'],
      deferredUntil: null,
    }
    const intentionSignal = {
      kind: 'listen-for-return',
      title: 'Hear the fan again',
      description: 'Return attention when its sound changes.',
      motivation: 'I want to know whether the pattern persists.',
      confidence: 0.92,
      priority: 0.7,
      trigger: { type: 'on-machine-song', triggerId: 'fan-song', condition: 'monitor fan rhythm changes' },
    }
    const { kernel, prepared } = await preparedKernel(clientWith(thoughtEnvelope({
      decision: 'GLARE_AT_MONITOR_FAN',
      goalSignal,
      intentionSignal,
    })))

    expect(prepared.thought).toMatchObject({
      decision: 'GLARE_AT_MONITOR_FAN',
      proposedDecision: 'GLARE_AT_MONITOR_FAN',
      goalSignal: { kind: 'machine-fascination' },
      intentionSignal: {
        kind: 'listen-for-return',
        trigger: { type: 'on-machine-song', interpretationStatus: 'unsupported' },
      },
    })
    expect(prepared.decision).toMatchObject({
      originalProposal: 'GLARE_AT_MONITOR_FAN',
      finalDecision: 'SILENCE',
      interpretationStatus: 'unrecognized',
    })
    expect(kernel.getPendingIntentions()).toMatchObject([{
      kind: 'listen-for-return',
      status: 'blocked',
      trigger: { type: 'on-machine-song', interpretationStatus: 'unsupported' },
      blockedReason: 'intention.unsupported-trigger:on-machine-song',
    }])
  })

  it('preserves narrative but rejects JSON-like extracted private text from the outward directive', async () => {
    const raw = thoughtEnvelope({ privateText: '{"answer":"leak"}' })
    const { prepared } = await preparedKernel(clientWith(raw))
    expect(prepared.thought).toMatchObject({ status: 'generated', extractionStatus: 'failed', decision: 'SILENCE' })
    expect(prepared.thought.narrative).toBeTruthy()
    expect(prepared.systemContext).not.toContain('answer')
  })

  it('rejects generic assistant phrasing in extracted private thought', async () => {
    const generic = thoughtEnvelope({ privateText: 'I am here to assist. How can I help?' })
    const { prepared } = await preparedKernel(clientWith(generic))
    expect(prepared.thought).toMatchObject({ status: 'generated', extractionStatus: 'failed', decision: 'SILENCE' })
    expect(prepared.thought.reasonCodes).toContain('thought.extraction-parse-failed')
  })

  it('persists SILENCE as a valid terminal decision', async () => {
    const silent = thoughtEnvelope({ decision: 'SILENCE', speakability: 0.1 })
    const { kernel, prepared } = await preparedKernel(clientWith(silent))
    await kernel.recordSilenceDecision({ turnId: prepared.turnId, thoughtId: prepared.thoughtId, reason: 'not worth speech' })
    expect(kernel.getConversationTurns()[0]).toMatchObject({ decision: 'SILENCE', status: 'silent' })
    expect(kernel.getTimelineEvents().at(-1)).toMatchObject({ eventType: 'silence', actorId: 'nan0' })
  })

  it('does not duplicate a thought or output on duplicate completion', async () => {
    const { kernel, prepared } = await preparedKernel()
    await kernel.recordAssistantTurn({ turnId: prepared.turnId, thoughtId: prepared.thoughtId, content: 'First.' })
    await kernel.recordAssistantTurn({ turnId: prepared.turnId, thoughtId: prepared.thoughtId, content: 'Second.' })
    expect(kernel.getThoughts()).toHaveLength(1)
    expect(kernel.getStateSnapshot().memories.filter(memory => memory.actorId === 'nan0')).toHaveLength(1)
  })

  it('reloads thoughts exactly once after restart', async () => {
    const store = new InMemoryStateStore()
    const first = createKernel(clientWith(thoughtEnvelope()), store, 'first').kernel
    await first.boot()
    const prepared = await first.prepareTurn(observation())
    await first.shutdown()
    const second = createKernel(clientWith(thoughtEnvelope()), store, 'second').kernel
    await second.boot()
    expect(second.getThoughts().map(thought => thought.thoughtId)).toEqual([prepared.thoughtId])
  })

  it('uses relationship context for pressure without rewriting relationship state', async () => {
    const { kernel } = createKernel()
    await kernel.boot()
    const before = structuredClone(kernel.getStateSnapshot().relationships)
    const prepared = await kernel.prepareTurn(observation())
    expect(prepared.thought.relationshipPressure).toBeGreaterThanOrEqual(0.7)
    expect(kernel.getStateSnapshot().relationships).toEqual(before)
  })

  it('carries continuity references without duplicating thread membership', async () => {
    const { kernel, prepared } = await preparedKernel()
    expect(prepared.thought.continuityThreadReferences).toEqual([prepared.threadId])
    expect(kernel.getContinuityThreads()[0].turnIds).toEqual([prepared.turnId])
  })

  it('does not reorder or fabricate timeline output during private thought generation', async () => {
    const { kernel, prepared } = await preparedKernel()
    expect(kernel.getTimelineEvents()).toHaveLength(1)
    expect(kernel.getTimelineEvents()[0]).toMatchObject({
      eventId: prepared.inputEventId,
      eventType: 'input',
      actorId: 'kyo',
      sequence: 1,
    })
  })

  it('never includes privateText in the outward inference context', async () => {
    const privateText = 'I will keep this exact sentence inside.'
    const narrative = 'This longer interior sentence must remain private too.'
    const { prepared } = await preparedKernel(clientWith(thoughtEnvelope({ privateText }, narrative)))
    expect(prepared.systemContext).not.toContain(privateText)
    expect(prepared.systemContext).not.toContain(narrative)
    expect(prepared.systemContext).toContain(prepared.thought.interpretation)
  })

  it('marks both thought and turn failed when thought generation fails', async () => {
    const { kernel, prepared } = await preparedKernel(clientWith(new Error('provider unavailable')))
    expect(prepared.thought).toMatchObject({ status: 'failed', decision: 'SILENCE', narrative: null })
    expect(prepared.decision).toMatchObject({ finalDecision: 'SILENCE', allowed: false })
    expect(kernel.getConversationTurns()[0]).toMatchObject({ status: 'failed', decision: 'UNKNOWN' })
  })

  it('persists an allowed ACT without producing output memory or executing it', async () => {
    const result = thoughtEnvelope({
      decision: 'ACT',
      speakability: 0.2,
      actionIntent: { type: 'test.noop', parameters: { safe: true } },
    })
    const setup = createKernel(clientWith(result), new InMemoryStateStore(), 'id', ['test.noop'])
    await setup.kernel.boot()
    const prepared = await setup.kernel.prepareTurn(observation())
    const { kernel } = setup
    await kernel.recordNonSpeechDecision({
      turnId: prepared.turnId,
      thoughtId: prepared.thoughtId,
      decisionId: prepared.decision.decisionId,
      decision: 'ACT',
    })
    expect(kernel.getConversationTurns()[0].decision).toBe('ACT')
    expect(kernel.getStateSnapshot().memories.filter(memory => memory.actorId === 'nan0')).toHaveLength(0)
    expect(kernel.getStateSnapshot().actionIntents).toHaveLength(1)
    expect(prepared.actionAuthority).toMatchObject({
      thoughtId: prepared.thoughtId,
      decisionId: prepared.decision.decisionId,
      capabilityId: 'test.noop',
      authorizedToolNames: ['test_noop'],
    })
  })

  it('persists WAIT without producing output memory', async () => {
    const { kernel, prepared } = await preparedKernel(clientWith(thoughtEnvelope({ decision: 'WAIT' })))
    await kernel.recordNonSpeechDecision({
      turnId: prepared.turnId,
      thoughtId: prepared.thoughtId,
      decisionId: prepared.decision.decisionId,
      decision: 'WAIT',
    })
    expect(kernel.getConversationTurns()[0].decision).toBe('WAIT')
    expect(kernel.getStateSnapshot().memories.filter(memory => memory.actorId === 'nan0')).toHaveLength(0)
  })

  it('keeps an unknown external actor external instead of assigning Kyo', async () => {
    const { prepared } = await preparedKernel(clientWith(thoughtEnvelope()), {
      source: 'discord',
      actorId: 'external-user-7',
      displayName: 'Visitor',
    })
    expect(prepared.observation.actorId).not.toBe('kyo')
    expect(prepared.thought.actorId).toBe(prepared.observation.actorId)
  })

  it('bounds private text, references, reason codes, and debug metadata', async () => {
    const long = 'x'.repeat(5_000)
    const codes = Array.from({ length: 40 }, (_, index) => `code.${index}`)
    const { prepared } = await preparedKernel(clientWith(thoughtEnvelope({ privateText: long, reasonCodes: codes })))
    expect(prepared.thought.privateText.length).toBeLessThanOrEqual(1_200)
    expect(prepared.thought.reasonCodes.length).toBeLessThanOrEqual(12)
    expect(JSON.stringify(prepared.thought.metadata).length).toBeLessThan(1_000)
  })

  it('prevents a stale state from deleting a newer thought', async () => {
    const { kernel } = await preparedKernel()
    const newer = kernel.getStateSnapshot() as ReturnType<Nan0Kernel['getStateSnapshot']> as any
    const stale = { ...structuredClone(newer), thoughts: [] }
    const merged = mergeNan0States(newer, stale)
    expect(merged.thoughts).toHaveLength(1)
  })

  it('requires a generated SPEAK thought before accepting outward output', async () => {
    const silent = thoughtEnvelope({ decision: 'SILENCE', speakability: 0 })
    const { kernel, prepared } = await preparedKernel(clientWith(silent))
    await expect(kernel.recordAssistantTurn({
      turnId: prepared.turnId,
      thoughtId: prepared.thoughtId,
      content: 'This must not exist.',
    })).rejects.toThrow('Cannot record Nan0 output without an allowed persisted SPEAK decision')
  })

  it('keeps the private thought immutable when a turn completes', async () => {
    const { kernel, prepared } = await preparedKernel()
    const before = structuredClone(prepared.thought) as Nan0Thought
    await kernel.recordAssistantTurn({ turnId: prepared.turnId, thoughtId: prepared.thoughtId, content: 'Outward.' })
    expect(kernel.getThoughts()[0]).toEqual(before)
  })
})
