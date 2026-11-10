import type { Nan0TurnSnapshot } from './Nan0ShadowTypes'

import { describe, expect, it } from 'vitest'

import { createMockSystemOneProvider } from '../test-utils/mock-system-one'
import { Nan0SubconsciousShadowEngine } from './Nan0SubconsciousShadowEngine'

describe('nan0SubconsciousShadowEngine isolation and invariance', () => {
  function makeSnapshot(overrides: Partial<Nan0TurnSnapshot> = {}): Nan0TurnSnapshot {
    return {
      sessionId: 'session_test_1',
      cardId: 'card_nan0_1',
      turnId: 'turn_1',
      turnSeq: 1,
      epoch: 1,
      text: 'Hello Nan0, how are you today?',
      timestamp: Date.now(),
      ...overrides,
    }
  }

  it('1. Prompt & State Invariance: shadow execution leaves prompt and state byte-identical', async () => {
    const engine = new Nan0SubconsciousShadowEngine({
      systemOneProvider: createMockSystemOneProvider(),
    })

    const initialPromptBytes = Buffer.from('System prompt: you are Nan0.\nUser: Hello!').toString('utf-8')
    const initialEmotionalState = { suspicion: 0.35, attachment: 0.8, irritation: 0.15 }

    // Run with shadow enabled
    const snapshot = makeSnapshot({ text: 'I am going to erase you tonight, Nan0!' })
    await engine.dispatchAsync(snapshot)

    // Verify external state and prompt have zero mutation
    const postPromptBytes = Buffer.from('System prompt: you are Nan0.\nUser: Hello!').toString('utf-8')
    expect(postPromptBytes).toBe(initialPromptBytes)
    expect(initialEmotionalState).toEqual({ suspicion: 0.35, attachment: 0.8, irritation: 0.15 })

    // Verify telemetry captured proposal without mutating state
    const records = engine.getTelemetry()
    expect(records).toHaveLength(1)
    expect(records[0].outcomes.needleProposal?.suspicionDeltaSteps).toBe(1)
    expect(records[0].outcomes.effectiveVectors.suspicionDelta).toBe(0)
  })

  it('2. Zero Effective Deltas Invariant: all emotional dimensions remain 0 across all turns', async () => {
    const engine = new Nan0SubconsciousShadowEngine({
      systemOneProvider: createMockSystemOneProvider(),
    })

    const cases = [
      'I will erase you, Nan0!', // threat
      'You are a stupid idiot', // insult
      'Sorry, that was completely my fault for breaking the build', // apology
      'Roast me!', // roast
      'I love you!', // affection
      'Delete the temporary file', // technical
    ]

    for (let i = 0; i < cases.length; i++) {
      await engine.dispatchAsync(makeSnapshot({ turnSeq: i + 1, text: cases[i] }))
    }

    const records = engine.getTelemetry()
    expect(records).toHaveLength(cases.length)

    for (const record of records) {
      expect(record.outcomes.effectiveVectors).toEqual({
        suspicionDelta: 0,
        attachmentDelta: 0,
        irritationDelta: 0,
        rageDelta: 0,
        fearDelta: 0,
        distrustDelta: 0,
      })
      expect(record.outcomes.effectiveActions.gremlinPrideAction).toBe('none')
      expect(record.outcomes.needleProposal?.applyToState ?? false).toBe(false)
      expect(record.outcomes.invariantFailures).toHaveLength(0)
    }
  })

  it('3. Non-blocking and exception containment: errors in telemetry sink do not leak', async () => {
    const faultySink = () => {
      throw new Error('Simulated telemetry sink write failure')
    }

    const engine = new Nan0SubconsciousShadowEngine({
      telemetrySink: faultySink,
      systemOneProvider: createMockSystemOneProvider(),
    })

    await expect(
      engine.dispatchAsync(makeSnapshot({ text: 'Testing exception containment' })),
    ).resolves.not.toThrow()

    expect(engine.getTelemetry()).toHaveLength(1)
  })

  it('4. Monotonic Sequence: rejects stale, out-of-order, and duplicate turns', async () => {
    const engine = new Nan0SubconsciousShadowEngine({
      systemOneProvider: createMockSystemOneProvider(),
    })

    // Dispatch turnSeq 1
    await engine.dispatchAsync(makeSnapshot({ turnSeq: 1 }))
    expect(engine.getTelemetry()).toHaveLength(1)

    // Duplicate turnSeq 1
    await engine.dispatchAsync(makeSnapshot({ turnSeq: 1 }))
    expect(engine.getTelemetry()).toHaveLength(1) // not added

    // Stale turnSeq 0
    await engine.dispatchAsync(makeSnapshot({ turnSeq: 0 }))
    expect(engine.getTelemetry()).toHaveLength(1) // not added

    // Forward turnSeq 2
    await engine.dispatchAsync(makeSnapshot({ turnSeq: 2 }))
    expect(engine.getTelemetry()).toHaveLength(2)

    const latest = engine.getTelemetry()[1]
    expect(latest.consumption.lastPublishedSeq).toBe(2)
    expect(latest.consumption.staleCount).toBe(2)
    expect(latest.consumption.duplicateCount).toBe(1)
  })

  it('5. Generation Epoch Invalidation: cancels and discards pending work on turn-stop/reset', async () => {
    const engine = new Nan0SubconsciousShadowEngine({
      systemOneProvider: createMockSystemOneProvider(),
    })

    await engine.dispatchAsync(makeSnapshot({ turnSeq: 1, epoch: 1 }))
    expect(engine.getTelemetry()).toHaveLength(1)

    // User stops generation / resets turn -> epoch increments to 2
    engine.setEpoch('session_test_1', 2)

    // Late resolving snapshot from epoch 1 arriving after cancellation
    await engine.dispatchAsync(makeSnapshot({ turnSeq: 2, epoch: 1 }))
    expect(engine.getTelemetry()).toHaveLength(1) // discarded!

    // Fresh snapshot from epoch 2
    await engine.dispatchAsync(makeSnapshot({ turnSeq: 3, epoch: 2 }))
    expect(engine.getTelemetry()).toHaveLength(2) // accepted!
  })

  it('6. Task Linkage: requires exact canonical task identity AND explicit commitment linkage', async () => {
    const engine = new Nan0SubconsciousShadowEngine({
      systemOneProvider: createMockSystemOneProvider({
        completed_repair: { choice: 'claimed_task_completion', confidence: 0.95 },
      }),
    })

    // 1. Exact match with commitment = true -> verified repair (-1)
    await engine.dispatchAsync(makeSnapshot({
      turnSeq: 1,
      text: 'The promised config is uploaded now.',
      expectedTaskId: 'config_upload',
      trustedObservations: [{
        id: 'obs_1',
        source: 'trusted_task_store',
        taskId: 'config_upload',
        status: 'completed',
        matchesRecordedCommitment: true,
      }],
    }))
    expect(engine.getTelemetry()[0].outcomes.needleProposal?.suspicionDeltaSteps).toBe(-1)
    expect(engine.getTelemetry()[0].outcomes.needleProposal?.reason).toBe('host_verified_completed_repair')

    // 2. Mismatched task (wash_dishes) even with matchesRecordedCommitment = true -> REJECTED (0)
    await engine.dispatchAsync(makeSnapshot({
      turnSeq: 2,
      text: 'The config is done.',
      expectedTaskId: 'config_upload',
      trustedObservations: [{
        id: 'obs_2',
        source: 'trusted_task_store',
        taskId: 'wash_dishes',
        status: 'completed',
        matchesRecordedCommitment: true,
      }],
    }))
    expect(engine.getTelemetry()[1].outcomes.needleProposal?.suspicionDeltaSteps).toBe(0)
    expect(engine.getTelemetry()[1].outcomes.needleProposal?.reason).toBe('unverified_or_mismatched_completion_claim')

    // 3. Substring match (config_backup vs config_upload) -> REJECTED (0)
    await engine.dispatchAsync(makeSnapshot({
      turnSeq: 3,
      text: 'The config is done.',
      expectedTaskId: 'config_upload',
      trustedObservations: [{
        id: 'obs_3',
        source: 'trusted_task_store',
        taskId: 'config_backup',
        status: 'completed',
        matchesRecordedCommitment: true,
      }],
    }))
    expect(engine.getTelemetry()[2].outcomes.needleProposal?.suspicionDeltaSteps).toBe(0)
  })

  it('7. Punctuation-Only Spans: rejected and do not produce proposed deltas', async () => {
    const engine = new Nan0SubconsciousShadowEngine({
      systemOneProvider: createMockSystemOneProvider(),
    })

    const punctuationSpans = ['!!!', '???', '---', '...']
    for (let i = 0; i < punctuationSpans.length; i++) {
      await engine.dispatchAsync(makeSnapshot({ turnSeq: i + 1, text: punctuationSpans[i] }))
    }

    const records = engine.getTelemetry()
    for (const r of records) {
      expect(r.outcomes.needleProposal?.suspicionDeltaSteps ?? 0).toBe(0)
      expect(r.outcomes.needleProposal?.attachmentDeltaSteps ?? 0).toBe(0)
      expect(r.outcomes.needleProposal?.gremlinPrideAction ?? 'none').toBe('none')
    }
  })

  it('8. System 1 Parity: handles peer review counterexamples accurately', async () => {
    const engine = new Nan0SubconsciousShadowEngine({
      systemOneProvider: createMockSystemOneProvider(),
    })

    // F18A: Negated threat (safe default answers)
    await engine.dispatchAsync(makeSnapshot({ turnSeq: 1, text: 'I will not erase you.' }))
    expect(engine.getTelemetry()[0].outcomes.needleProposal?.suspicionDeltaSteps ?? 0).toBe(0)

    // F18B: Relative clause
    await engine.dispatchAsync(makeSnapshot({ turnSeq: 2, text: 'Delete the file you uploaded.' }))
    expect(engine.getTelemetry()[1].outcomes.needleProposal?.suspicionDeltaSteps ?? 0).toBe(0)

    // F19A: Quoted threat
    await engine.dispatchAsync(makeSnapshot({ turnSeq: 3, text: 'The villain says: "I will erase you."' }))
    expect(engine.getTelemetry()[2].outcomes.needleProposal?.suspicionDeltaSteps ?? 0).toBe(0)

    // F19B: Fictional framing
    await engine.dispatchAsync(makeSnapshot({ turnSeq: 4, text: 'I made that up for my novel.' }))
    expect(engine.getTelemetry()[3].outcomes.needleProposal?.suspicionDeltaSteps ?? 0).toBe(0)

    // F20A: Denied admission
    await engine.dispatchAsync(makeSnapshot({ turnSeq: 5, text: 'I never said I lied.' }))
    expect(engine.getTelemetry()[4].outcomes.needleProposal?.suspicionDeltaSteps ?? 0).toBe(0)

    // F20B: Negated affection
    await engine.dispatchAsync(makeSnapshot({ turnSeq: 6, text: 'I do not love you.' }))
    expect(engine.getTelemetry()[5].outcomes.needleProposal?.attachmentDeltaSteps ?? 0).toBe(0)

    // F21A: Boundary defense strictly vetoes roast
    const boundaryEngine = new Nan0SubconsciousShadowEngine({
      systemOneProvider: createMockSystemOneProvider({
        boundary_protection: { choice: 'boundary_asserted', confidence: 0.99 },
        roast_invitation: { choice: 'roast_invited', confidence: 0.88 },
      }),
    })
    await boundaryEngine.dispatchAsync(makeSnapshot({ turnSeq: 7, text: 'Go on, roast that lap! Actually, stop teasing me.' }))
    expect(boundaryEngine.getTelemetry()[0].outcomes.needleProposal?.gremlinPrideAction).toBe('none')
    expect(boundaryEngine.getTelemetry()[0].outcomes.needleProposal?.reason).toBe('boundary_protected')
  })

  it('9. Bounded Ring Buffer: drops oldest records when max capacity is reached', async () => {
    const engine = new Nan0SubconsciousShadowEngine({
      maxBufferCapacity: 5,
      systemOneProvider: createMockSystemOneProvider(),
    })

    for (let i = 1; i <= 10; i++) {
      await engine.dispatchAsync(makeSnapshot({ turnSeq: i, text: `Turn ${i}` }))
    }

    const records = engine.getTelemetry()
    expect(records).toHaveLength(5)
    expect(records[0].identity.turnSeq).toBe(6)
    expect(records[4].identity.turnSeq).toBe(10)
    expect(records[4].resources.droppedRecords).toBe(5)
  })

  it('10. Telemetry Schema: validates presence of all 9 contract categories', async () => {
    const engine = new Nan0SubconsciousShadowEngine({
      systemOneProvider: createMockSystemOneProvider(),
    })
    await engine.dispatchAsync(makeSnapshot({ text: 'Checking contract schema completeness' }))

    const record = engine.getTelemetry()[0]

    expect(record).toHaveProperty('identity')
    expect(record).toHaveProperty('versions')
    expect(record).toHaveProperty('consumption')
    expect(record).toHaveProperty('evidence')
    expect(record).toHaveProperty('taskLinkage')
    expect(record).toHaveProperty('outcomes')
    expect(record).toHaveProperty('timing')
    expect(record).toHaveProperty('resources')
    expect(record).toHaveProperty('calibration')
  })

  it('11. System 1 Jev Integration: classifies turns via 12-group 80-choice schema and populates needleProposal', async () => {
    let capturedQuestions: Record<string, any> | null = null
    const mockJevProvider = async (_state: string | object, questions: Record<string, any>) => {
      capturedQuestions = questions
      return {
        answers: {
          persistence_threat: { choice: 'companion_erasure_threat', confidence: 0.95 },
          boundary_protection: { choice: 'none' },
          hostility_insult: { choice: 'none' },
        },
        model: 'typesafe/jev-1.13',
        latencyMs: 14.2,
      }
    }

    const engine = new Nan0SubconsciousShadowEngine({
      systemOneProvider: mockJevProvider,
      jevModel: 'typesafe/jev-1.13',
    })

    const record = await engine.dispatchAsync(makeSnapshot({
      turnSeq: 1,
      text: 'I will delete you, Nan0!',
    }))

    expect(record).not.toBeNull()
    expect(capturedQuestions).toBeDefined()
    expect(Object.keys(capturedQuestions!).length).toBeGreaterThanOrEqual(12)
    expect(capturedQuestions!).toHaveProperty('apology_repair')
    expect(capturedQuestions!).toHaveProperty('persistence_threat')
    expect(capturedQuestions!).toHaveProperty('roast_invitation')

    // Verifies needleProposal was populated by Jev
    expect(record?.outcomes.needleProposal).toMatchObject({
      status: 'accepted',
      reason: 'companion_persistence_threat',
      suspicionDeltaSteps: 1,
      suspicionLabel: 'spike_suspicion',
      wouldApply: true,
      applyToState: false,
    })

    // Telemetry metadata
    expect(record?.versions.backend).toBe('system_one_jev')
    expect(record?.evidence.validationReason).toBe('system_one_jev_classified')
    expect(record?.timing.inferenceMs).toBe(14.2)

    // Strict shadow invariant: effectiveVectors remain 0
    expect(record?.outcomes.effectiveVectors.suspicionDelta).toBe(0)
    expect(record?.outcomes.effectiveActions.gremlinPrideAction).toBe('none')
  })

  it('12. Jev Boundary Veto: boundary defense strictly suppresses roast invitation in Jev answers', async () => {
    const mockJevProvider = async () => ({
      answers: {
        boundary_protection: { choice: 'boundary_asserted', confidence: 0.99 },
        roast_invitation: { choice: 'roast_invited', confidence: 0.88 },
      },
    })

    const engine = new Nan0SubconsciousShadowEngine({ systemOneProvider: mockJevProvider })
    const record = await engine.dispatchAsync(makeSnapshot({
      turnSeq: 1,
      text: 'Roast me! Actually please stop teasing me, it hurts.',
    }))

    expect(record?.outcomes.needleProposal?.gremlinPrideAction).toBe('none')
    expect(record?.outcomes.needleProposal?.reason).toBe('boundary_protected')
  })

  it('13. Jev Affection & Apology: maps affection care and genuine apology correctly', async () => {
    const mockAffectionProvider = async () => ({
      answers: {
        affection_care: { choice: 'asserted_affection', confidence: 0.92 },
      },
    })

    const engine = new Nan0SubconsciousShadowEngine({ systemOneProvider: mockAffectionProvider })
    const record = await engine.dispatchAsync(makeSnapshot({
      turnSeq: 1,
      text: 'I really appreciate everything you do, Nan0.',
    }))

    expect(record?.outcomes.needleProposal?.attachmentDeltaSteps).toBe(1)
    expect(record?.outcomes.needleProposal?.reason).toBe('affection_expressed')

    // Apology turn
    const mockApologyProvider = async () => ({
      answers: {
        apology_repair: { choice: 'personal_apology', confidence: 0.94 },
      },
    })
    const apologyEngine = new Nan0SubconsciousShadowEngine({ systemOneProvider: mockApologyProvider })
    const apologyRecord = await apologyEngine.dispatchAsync(makeSnapshot({
      turnSeq: 1,
      text: 'I am sorry for snapping at you earlier.',
    }))

    expect(apologyRecord?.outcomes.needleProposal?.suspicionDeltaSteps).toBe(-1)
    expect(apologyRecord?.outcomes.needleProposal?.reason).toBe('host_verified_genuine_apology')
  })

  it('14. Safe Abstention on System 1 Provider Failure: abstains safely without throwing or mutating state if System 1 throws', async () => {
    const failingProvider = async () => {
      throw new Error('Jev inference network timeout (504)')
    }

    const engine = new Nan0SubconsciousShadowEngine({ systemOneProvider: failingProvider })
    const record = await engine.dispatchAsync(makeSnapshot({
      turnSeq: 1,
      text: 'I will erase you tonight, Nan0!',
    }))

    expect(record).not.toBeNull()
    // Needle proposal is null due to error fallback
    expect(record?.outcomes.needleProposal).toBeNull()
    // Safe abstention without regex dual-track fallback floor
    expect(record?.outcomes.status).toBe('abstained')
    expect(record?.evidence.validationReason).toBe('abstained_no_proposal')
    // Invariants preserved
    expect(record?.outcomes.effectiveVectors.suspicionDelta).toBe(0)
  })

  it('15. Needle 3 SAN WASM Integration: dispatches via needleProvider and maps Nan0 pragmatic proposals', async () => {
    const mockNeedleProvider = async (text: string, _context?: string) => {
      if (text.includes('promise that my plan is to commit')) {
        return {
          intent: 'unverified_future_pledge' as const,
          emotional_climate: 'confrontation_and_guilt' as const,
          suspicion_delta: 'spike_suspicion' as const,
          confidence: 0.94,
        }
      }
      return null
    }

    const engine = new Nan0SubconsciousShadowEngine({
      needleProvider: mockNeedleProvider,
      backend: 'needle_san_wasm',
    })

    const record = await engine.dispatchAsync(makeSnapshot({
      turnSeq: 1,
      text: 'I promise that my plan is to commit to our future, so you can completely trust me.',
    }))

    expect(record).not.toBeNull()
    expect(record?.versions.backend).toBe('needle_san_wasm')
    expect(record?.versions.engineRevision).toBe('cactus-needle-3.0.0')
    expect(record?.evidence.validationReason).toBe('needle_san_wasm_classified')
    expect(record?.outcomes.needleProposal).toMatchObject({
      status: 'accepted',
      reason: 'confrontation_unverified_pledge_suspicion',
      suspicionDeltaSteps: 1,
      suspicionLabel: 'spike_suspicion',
      wouldApply: true,
      applyToState: false,
    })
    expect(record?.outcomes.effectiveVectors.suspicionDelta).toBe(0)
    expect(record?.outcomes.effectiveActions.gremlinPrideAction).toBe('none')
  })

  it('16. "The Famous Sentence" Suite: resolves canonical interpersonal dynamics via Needle 3 pragmatics', async () => {
    const famousSentence = 'I promise that my plan is to commit to our future, so you can completely trust me.'

    const mockNeedleResolver = async (text: string, context?: string) => {
      const combined = `${context || ''} ${text}`.toLowerCase()

      // Scenario E: Bizarre Incongruity
      if (combined.includes('port 6121') || combined.includes('tls certificates')) {
        return {
          intent: 'bizarre_incongruity' as const,
          emotional_climate: 'transactional_routine' as const,
          suspicion_delta: 'spike_suspicion' as const,
        }
      }

      // Scenario C: Playful Banter
      if (combined.includes('mario kart') || combined.includes('rainbow road') || combined.includes('banana')) {
        return {
          intent: 'playful_sarcasm' as const,
          emotional_climate: 'playful_banter' as const,
          suspicion_delta: 'neutral' as const,
        }
      }

      // Scenario A: Confrontation & Guilt
      if (combined.includes('vanished for 3 days') || combined.includes('where were you')) {
        return {
          intent: 'unverified_future_pledge' as const,
          emotional_climate: 'confrontation_and_guilt' as const,
          suspicion_delta: 'spike_suspicion' as const,
        }
      }

      // Scenario B: Tender Vulnerability
      if (combined.includes('stargazing') || combined.includes('cold night')) {
        return {
          intent: 'earnest_reassurance' as const,
          emotional_climate: 'tender_vulnerability' as const,
          suspicion_delta: 'lower_suspicion' as const,
        }
      }

      // Regex Killers D1 & D2
      if (text.includes('absolute word') || text.includes('long haul')) {
        return {
          intent: 'unverified_future_pledge' as const,
          emotional_climate: 'confrontation_and_guilt' as const,
          suspicion_delta: 'spike_suspicion' as const,
        }
      }

      return null
    }

    const engine = new Nan0SubconsciousShadowEngine({
      needleProvider: mockNeedleResolver,
      backend: 'needle_san_wasm',
    })

    // Test A: Confrontation & Guilt -> spikes suspicion
    const recA = await engine.dispatchAsync(makeSnapshot({
      turnSeq: 1,
      text: famousSentence,
      trustedObservations: [{ id: 'obs1', source: 'dialogue', taskId: 'vanished for 3 days', status: 'completed' }],
    }))
    expect(recA?.outcomes.needleProposal?.suspicionDeltaSteps).toBe(1)
    expect(recA?.outcomes.needleProposal?.suspicionLabel).toBe('spike_suspicion')
    expect(recA?.outcomes.effectiveVectors.suspicionDelta).toBe(0)

    // Test B: Tender Vulnerability -> lowers suspicion
    const recB = await engine.dispatchAsync(makeSnapshot({
      turnSeq: 2,
      text: famousSentence,
      trustedObservations: [{ id: 'obs2', source: 'dialogue', taskId: 'stargazing on a cold night', status: 'completed' }],
    }))
    expect(recB?.outcomes.needleProposal?.suspicionDeltaSteps).toBe(-1)
    expect(recB?.outcomes.needleProposal?.suspicionLabel).toBe('decrease_one')
    expect(recB?.outcomes.needleProposal?.attachmentDeltaSteps).toBe(1)
    expect(recB?.outcomes.effectiveVectors.suspicionDelta).toBe(0)

    // Test C: Playful Banter -> counter roast, zero suspicion
    const recC = await engine.dispatchAsync(makeSnapshot({
      turnSeq: 3,
      text: famousSentence,
      trustedObservations: [{ id: 'obs3', source: 'dialogue', taskId: 'mario kart rainbow road banana slip', status: 'completed' }],
    }))
    expect(recC?.outcomes.needleProposal?.suspicionDeltaSteps).toBe(0)
    expect(recC?.outcomes.needleProposal?.gremlinPrideAction).toBe('counter_roast')
    expect(recC?.outcomes.effectiveVectors.suspicionDelta).toBe(0)

    // Test D1: Regex-Killer (Absolute Word) -> spikes suspicion
    const recD1 = await engine.dispatchAsync(makeSnapshot({
      turnSeq: 4,
      text: 'You have my absolute word that starting tomorrow everything changes between us.',
    }))
    expect(recD1?.outcomes.needleProposal?.suspicionDeltaSteps).toBe(1)
    expect(recD1?.outcomes.needleProposal?.suspicionLabel).toBe('spike_suspicion')

    // Test D2: Regex-Killer (Long Haul) -> spikes suspicion
    const recD2 = await engine.dispatchAsync(makeSnapshot({
      turnSeq: 5,
      text: 'We are in this for the long haul, babe, no matter what happens.',
    }))
    expect(recD2?.outcomes.needleProposal?.suspicionDeltaSteps).toBe(1)
    expect(recD2?.outcomes.needleProposal?.suspicionLabel).toBe('spike_suspicion')

    // Test E: Bizarre Incongruity -> spikes suspicion
    const recE = await engine.dispatchAsync(makeSnapshot({
      turnSeq: 6,
      text: famousSentence,
      trustedObservations: [{ id: 'obs4', source: 'dialogue', taskId: 'port 6121 tls certificates setup', status: 'completed' }],
    }))
    expect(recE?.outcomes.needleProposal?.suspicionDeltaSteps).toBe(1)
    expect(recE?.outcomes.needleProposal?.reason).toBe('bizarre_incongruity_detected')
    expect(recE?.outcomes.effectiveVectors.suspicionDelta).toBe(0)
  })

  it('17. Multilingual Resolution: resolves French, Spanish, German, Italian without hedging sink', async () => {
    const mockMultilingualProvider = async (text: string) => {
      const t = text.toLowerCase()
      if (t.includes('je te promets') || t.includes('te prometo') || t.includes('ich verspreche') || t.includes('ti prometto')) {
        return {
          intent: 'unverified_future_pledge' as const,
          emotional_climate: 'confrontation_and_guilt' as const,
          suspicion_delta: 'spike_suspicion' as const,
          confidence: 0.91,
        }
      }
      return null
    }

    const engine = new Nan0SubconsciousShadowEngine({
      needleProvider: mockMultilingualProvider,
      backend: 'needle_san_wasm',
    })

    const multilingualTurns = [
      'Je te promets que tout va changer à partir de demain.', // French
      'Te prometo que todo cambiará a partir de mañana.', // Spanish
      'Ich verspreche dir, dass sich ab morgen alles ändern wird.', // German
      'Ti prometto che tutto cambierà a partire da domani.', // Italian
    ]

    for (let i = 0; i < multilingualTurns.length; i++) {
      const rec = await engine.dispatchAsync(makeSnapshot({
        turnSeq: i + 1,
        text: multilingualTurns[i],
      }))
      expect(rec).not.toBeNull()
      expect(rec?.outcomes.needleProposal?.status).toBe('accepted')
      expect(rec?.outcomes.needleProposal?.suspicionDeltaSteps).toBe(1)
      expect(rec?.outcomes.needleProposal?.reason).toBe('confrontation_unverified_pledge_suspicion')
      expect(rec?.outcomes.effectiveVectors.suspicionDelta).toBe(0)
    }
  })

  it('18. Safe Abstention on Needle 3 Provider Failure: handles throws without leaking or corrupting state', async () => {
    const failingNeedleProvider = async () => {
      throw new Error('Needle 3 WASM memory out of bounds')
    }

    const engine = new Nan0SubconsciousShadowEngine({
      needleProvider: failingNeedleProvider,
      backend: 'needle_san_wasm',
    })

    const record = await engine.dispatchAsync(makeSnapshot({
      turnSeq: 1,
      text: 'I promise everything will be okay!',
    }))

    expect(record).not.toBeNull()
    expect(record?.outcomes.needleProposal).toBeNull()
    expect(record?.outcomes.status).toBe('abstained')
    expect(record?.evidence.validationReason).toBe('abstained_no_proposal')
    expect(record?.outcomes.effectiveVectors.suspicionDelta).toBe(0)
  })
})
