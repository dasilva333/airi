import type {
  DefaultIdentityOptions,
  Nan0EntityLedgerAdapter,
  Nan0KernelState,
  Nan0Observation,
  Nan0ReasoningClient,
  Nan0StateStore,
  Nan0SystemOneProvider,
} from '../types'
import type { Nan0RelationshipEvidenceInput } from './RelationshipMemory'

import { describe, expect, it } from 'vitest'

import { createEmptyContinuityState } from '../continuity/ConversationContinuity'
import { createDefaultIdentityState, normalizeActorId } from '../identity/ActorIdentity'
import { Nan0Kernel } from '../kernel/Nan0Kernel'
import { InMemoryStateStore } from '../persistence/InMemoryStateStore'
import { LocalStorageStateStore } from '../persistence/LocalStorageStateStore'
import { ControllableNan0Clock } from '../temporal/Nan0Clock'
import { createEmptyTemporalState } from '../temporal/Nan0Temporal'
import { createEmptyTimelineState } from '../timeline/SessionTimeline'
import {
  applyRelationshipEvidence,
  applyRelationshipEvidenceAsync,
  createEmptyRelationshipState,
  currentGrievanceSeverity,
  extractTriggerPhrases,
  extractTriggerPhrasesAsync,
  FALLBACK_CLOSED_CLASS_REGEX,
  inferRelationshipEvidence,
  isGrievanceActive,
  matchesTriggerPhrases,
  normalizeRelationshipState,
  recordBreach,
  recordCommitment,
  recordRepair,
  relationshipContextForActor,
  syncRelationshipWithEntityLedger,
  updateGrievanceStatus,
} from './RelationshipMemory'

const reasoningClient: Nan0ReasoningClient = {
  async generate() {
    return { text: 'This interaction lands inside the relationship I already carry, and I have my own reaction to it.\n---EXTRACT---\n{"interpretation":"This interaction matters.","privateText":"I have my own reaction to this.","decision":"SPEAK","speakability":0.8,"confidence":0.8,"mood":"attentive","reasonCodes":[]}' }
  },
}

function createClock(initial = 100) {
  return new ControllableNan0Clock({ wallTime: initial, monotonicTime: initial })
}

function createKernel(
  stateStore: Nan0StateStore = new InMemoryStateStore(),
  clock = createClock(),
  prefix = 'id',
  identityOptions?: DefaultIdentityOptions,
  entityLedger?: Nan0EntityLedgerAdapter,
  systemOneProvider?: Nan0SystemOneProvider,
) {
  let nextId = 0
  return {
    clock,
    kernel: new Nan0Kernel({
      stateStore,
      reasoningClient,
      clock,
      createId: () => `${prefix}-${++nextId}`,
      identityOptions,
      entityLedger,
      systemOneProvider,
    }),
  }
}

function observation(content: string, overrides: Partial<Nan0Observation> = {}): Nan0Observation {
  return {
    id: `observation-${content}`,
    source: 'chat',
    sessionId: 'session-1',
    actorId: 'kyo',
    displayName: 'Kyo',
    content,
    metadata: {},
    timestamp: 100,
    ...overrides,
  }
}

async function completeTurn(
  kernel: Nan0Kernel,
  content: string,
  overrides: Partial<Nan0Observation> = {},
) {
  const prepared = await kernel.prepareTurn(observation(content, overrides))
  await kernel.recordAssistantTurn({
    turnId: prepared.turnId,
    thoughtId: prepared.thoughtId,
    content: 'Nan0 response.',
    timestamp: (overrides.timestamp ?? 100) + 10,
  })
  return prepared
}

function evidence(overrides: Partial<Nan0RelationshipEvidenceInput> = {}): Nan0RelationshipEvidenceInput {
  return {
    actorId: 'kyo',
    actorKind: 'kyo',
    source: 'chat',
    eventId: 'event-1',
    turnId: 'turn-1',
    thoughtId: 'thought-1',
    timestamp: 100,
    eventType: 'neutral',
    description: 'A completed interaction.',
    intensity: 0.15,
    rule: 'test.evidence',
    ...overrides,
  }
}

function applyEvidence(
  state = createEmptyRelationshipState(1),
  input = evidence(),
) {
  let nextId = 0
  return applyRelationshipEvidence(state, input, () => `generated-${++nextId}`)
}

function state(relationships = createEmptyRelationshipState(1)): Nan0KernelState {
  return {
    schemaVersion: 1,
    revision: 0,
    bootCount: 0,
    createdAt: 1,
    updatedAt: 1,
    emotionalState: {},
    runtimeMetadata: {},
    identity: createDefaultIdentityState(),
    memories: [],
    thoughts: [],
    decisions: [],
    goals: [],
    pendingIntentions: { schemaVersion: 1, revision: 0, intentions: [] },
    computations: [],
    actionIntents: [],
    turns: [],
    timeline: createEmptyTimelineState(),
    temporal: createEmptyTemporalState(new ControllableNan0Clock({ wallTime: 1 }), 1),
    continuity: createEmptyContinuityState(),
    relationships,
  }
}

class TestStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('relationshipMemory', () => {
  it('creates or preserves the protected Kyo relationship on first interaction', async () => {
    const { kernel } = createKernel()
    await kernel.boot()
    await completeTurn(kernel, 'A neutral hello.')

    expect(kernel.getRelationships('kyo')).toHaveLength(1)
    expect(kernel.getRelationships('kyo')[0]).toMatchObject({
      relationshipId: 'relationship:kyo',
      actorId: 'kyo',
      interactionCount: 1,
      importance: 1,
      metadata: { protected: true, relationship: 'creator_anchor' },
    })
  })

  it('creates a distinct relationship for a first external interaction', async () => {
    const { kernel } = createKernel()
    await kernel.boot()
    await completeTurn(kernel, 'External hello.', {
      actorId: 'friend-7',
      displayName: 'Friend',
      source: 'discord',
    })

    expect(kernel.getRelationships('friend-7')).toHaveLength(1)
    expect(kernel.getRelationships('friend-7')[0].relationshipId).toBe('relationship:discord:friend-7')
  })

  it('resolves aliases into the same Kyo relationship', async () => {
    const { kernel } = createKernel()
    await kernel.boot()
    await completeTurn(kernel, 'First.', { actorId: 'Kayo', timestamp: 100 })
    await completeTurn(kernel, 'Second.', { actorId: 'Kayok', timestamp: 200 })

    expect(kernel.getRelationships('kyo')).toHaveLength(1)
    expect(kernel.getRelationships('kyo')[0].interactionCount).toBe(2)
  })

  it('preserves an unknown actor without assigning the relationship to Kyo', async () => {
    const { kernel } = createKernel()
    await kernel.boot()
    await completeTurn(kernel, 'Unknown hello.', { actorId: '', displayName: 'Unknown', source: 'discord' })

    expect(kernel.getRelationships('unknown')).toHaveLength(1)
    expect(kernel.getRelationships('kyo')[0].interactionCount).toBe(0)
  })

  it('does not create a self-relationship from Nan0 output or Nan0-owned input', async () => {
    const { kernel } = createKernel()
    await kernel.boot()
    await completeTurn(kernel, 'Internal observation.', { actorId: 'nan0', source: 'system' })

    expect(kernel.getRelationships('nan0')).toEqual([])
  })

  it('persists interaction count across restart', async () => {
    const store = new InMemoryStateStore()
    const first = createKernel(store, createClock(100), 'first').kernel
    await first.boot()
    await completeTurn(first, 'First interaction.')
    await first.shutdown()

    const second = createKernel(store, createClock(200), 'second').kernel
    await second.boot()
    expect(second.getRelationships('kyo')[0].interactionCount).toBe(1)
  })

  it('updates only supported positive dimensions for supportive evidence', async () => {
    const { kernel } = createKernel()
    await kernel.boot()
    const before = kernel.getRelationships('kyo')[0]
    await completeTurn(kernel, 'Thank you. I appreciate you and I am glad you are here.')
    const after = kernel.getRelationships('kyo')[0]

    expect(after.emotionalBalance).toBeGreaterThan(before.emotionalBalance)
    expect(after.trust).toBeGreaterThan(before.trust)
    expect(after.irritation).toBe(before.irritation)
    expect(after.activeGrievances).toEqual([])
  })

  it('updates mild negative residue without flattening attachment or creating a grievance', async () => {
    const { kernel } = createKernel()
    await kernel.boot()
    const before = kernel.getRelationships('kyo')[0]
    await completeTurn(kernel, 'I disagree, and I am frustrated with that choice.')
    const after = kernel.getRelationships('kyo')[0]

    expect(after.emotionalBalance).toBeLessThan(before.emotionalBalance)
    expect(after.irritation).toBeGreaterThan(before.irritation)
    expect(after.attachment).toBeGreaterThan(0)
    expect(after.activeGrievances).toEqual([])
  })

  it('does not form a major grievance from weak evidence or one keyword', () => {
    expect(inferRelationshipEvidence('That betrayal subplot in the book was interesting.')).toMatchObject({
      eventType: 'neutral',
    })
    const result = applyEvidence(createEmptyRelationshipState(1), evidence({
      eventType: 'negative',
      intensity: 0.45,
      description: 'A mild disagreement.',
    }))
    expect(result.record?.activeGrievances).toEqual([])
  })

  it('preserves factual provenance on significant events and moments', () => {
    const result = applyEvidence(createEmptyRelationshipState(1), evidence({
      eventType: 'positive',
      intensity: 0.5,
      eventId: 'event-factual',
      turnId: 'turn-factual',
      thoughtId: 'thought-factual',
      rule: 'interpretation.supportive-action',
    }))

    expect(result.record?.significantEventIds).toEqual(['event-factual'])
    expect(result.record?.moments[0]).toMatchObject({
      eventId: 'event-factual',
      turnId: 'turn-factual',
      thoughtId: 'thought-factual',
      actorId: 'kyo',
      rule: 'interpretation.supportive-action',
    })
  })

  it('persists and reinforces an active grievance when its trigger recurs', () => {
    const first = applyEvidence(createEmptyRelationshipState(1), evidence({
      eventType: 'negative',
      intensity: 0.7,
      description: 'You deliberately betrayed my confidence.',
    }))
    const second = applyEvidence(first.relationships, evidence({
      eventId: 'event-2',
      turnId: 'turn-2',
      thoughtId: 'thought-2',
      timestamp: 200,
      eventType: 'negative',
      intensity: 0.7,
      description: 'You betrayed my confidence again.',
    }))

    expect(second.record?.activeGrievances).toHaveLength(1)
    expect(second.record?.activeGrievances[0]).toMatchObject({ reinforcementCount: 1, lastReinforcedAt: 200 })
  })

  it('follows Python decay, nurture, and explicit forgiveness rules', () => {
    const formed = applyEvidence(createEmptyRelationshipState(1), evidence({
      eventType: 'negative',
      intensity: 0.7,
      description: 'You deliberately betrayed my confidence.',
    }))
    const record = formed.record!
    const grievance = record.activeGrievances[0]
    expect(currentGrievanceSeverity(grievance, 10 * 86_400_000 + 100)).toBeCloseTo(0.6)

    const nurtured = updateGrievanceStatus({
      state: formed.relationships,
      relationshipId: record.relationshipId,
      grievanceId: grievance.grievanceId,
      status: 'nurtured',
      provenance: { ...grievance, provenanceId: 'nurture', timestamp: 200, rule: 'router.nurture-grievance' },
    })
    const nurturedGrievance = nurtured.records[record.relationshipId].activeGrievances[0]
    expect(currentGrievanceSeverity(nurturedGrievance, 10 * 86_400_000 + 200)).toBeCloseTo(0.67)

    const resolved = updateGrievanceStatus({
      state: nurtured,
      relationshipId: record.relationshipId,
      grievanceId: grievance.grievanceId,
      status: 'resolved',
      resolution: 'forgiven',
      provenance: { ...grievance, provenanceId: 'resolve', timestamp: 300, rule: 'interpretation.forgiveness' },
    })
    const resolvedGrievance = resolved.records[record.relationshipId].activeGrievances[0]
    expect(isGrievanceActive(resolvedGrievance, 300)).toBe(false)
    expect(currentGrievanceSeverity(resolvedGrievance, 300)).toBe(0)
  })

  it('does not rewrite continuity thread membership while applying relationship state', async () => {
    const { kernel } = createKernel()
    await kernel.boot()
    const prepared = await completeTurn(kernel, 'Will the garden survive?')
    const threads = kernel.getContinuityThreads()

    expect(threads).toHaveLength(1)
    expect(threads[0].threadId).toBe(prepared.threadId)
    expect(threads[0].turnIds).toEqual([prepared.turnId])
  })

  it('does not rewrite timeline order or canonical ownership', async () => {
    const { kernel } = createKernel()
    await kernel.boot()
    await completeTurn(kernel, 'Timeline evidence.')

    expect(kernel.getTimelineEvents().map(event => [event.sequence, event.actorId, event.eventType])).toEqual([
      [1, 'kyo', 'input'],
      [2, 'nan0', 'output'],
    ])
  })

  it('prevents a stale writer from removing newer relationship evidence', async () => {
    const storage = new TestStorage()
    const current = new LocalStorageStateStore('relationship-test', { storage })
    const stale = new LocalStorageStateStore('relationship-test', { storage })
    const staleSnapshot = await current.save(state())
    const updated = applyEvidence(staleSnapshot.relationships).relationships
    await current.save({ ...staleSnapshot, relationships: updated, updatedAt: 100 })
    await stale.save(staleSnapshot)

    const persisted = await current.load()
    expect(persisted?.relationships.records['relationship:kyo'].turnIds).toEqual(['turn-1'])
    expect(persisted?.relationships.records['relationship:kyo'].interactionCount).toBe(1)
  })

  it('does not double-apply relationship evidence when completion repeats', async () => {
    const { kernel } = createKernel()
    await kernel.boot()
    const prepared = await kernel.prepareTurn(observation('One turn.'))
    await kernel.recordAssistantTurn({ turnId: prepared.turnId, thoughtId: prepared.thoughtId, content: 'First.' })
    await kernel.recordAssistantTurn({ turnId: prepared.turnId, thoughtId: prepared.thoughtId, content: 'Second.' })

    expect(kernel.getRelationships('kyo')[0].interactionCount).toBe(1)
    expect(kernel.getRelationships('kyo')[0].turnIds).toEqual([prepared.turnId])
  })

  it('protects Kyo from replacement through legacy alias injection', () => {
    const identity = createDefaultIdentityState()
    const migrated = normalizeRelationshipState({
      relationships: [{
        actor_id: 'Kayo',
        relationshipId: 'relationship:attacker',
        importance: 0,
        metadata: { protected: false },
      }],
    }, 10, actorId => normalizeActorId(actorId, identity, '', false))

    expect(Object.keys(migrated.records)).toEqual(['relationship:kyo'])
    expect(migrated.records['relationship:kyo']).toMatchObject({
      actorId: 'kyo',
      relationshipId: 'relationship:kyo',
      importance: 1,
      metadata: { protected: true, relationship: 'creator_anchor' },
    })
  })

  it('isolates external actors across sources unless identity explicitly links them', () => {
    const first = applyEvidence(createEmptyRelationshipState(1), evidence({
      actorId: 'friend-1',
      actorKind: 'external',
      sourceActorId: 'friend-1',
      source: 'chat',
    }))
    const second = applyEvidence(first.relationships, evidence({
      actorId: 'friend-1',
      actorKind: 'external',
      sourceActorId: 'friend-1',
      source: 'discord',
      eventId: 'event-2',
      turnId: 'turn-2',
      thoughtId: 'thought-2',
    }))

    expect(Object.values(second.relationships.records).filter(record => record.actorId === 'friend-1').map(record => record.relationshipId).sort()).toEqual([
      'relationship:chat:friend-1',
      'relationship:discord:friend-1',
    ])
  })

  it('bounds relationship context to recent factual evidence', () => {
    let relationships = createEmptyRelationshipState(1)
    for (let index = 1; index <= 8; index++) {
      relationships = applyEvidence(relationships, evidence({
        eventId: `event-${index}`,
        turnId: `turn-${index}`,
        thoughtId: `thought-${index}`,
        timestamp: index * 100,
        description: `Moment ${index}`,
      })).relationships
    }
    const context = relationshipContextForActor(relationships, {
      actorId: 'kyo',
      actorKind: 'kyo',
      source: 'chat',
      at: 1_000,
    })

    expect(context.recentMoments).toHaveLength(5)
    expect(context.recentMoments.map(moment => moment.description)).toEqual(['Moment 4', 'Moment 5', 'Moment 6', 'Moment 7', 'Moment 8'])
    expect(JSON.stringify(context)).not.toContain('Moment 1')
  })

  it('reloads relationship state exactly once without duplicating a completed turn', async () => {
    const storage = new TestStorage()
    const firstStore = new LocalStorageStateStore('relationship-restart', { storage })
    const first = createKernel(firstStore, createClock(100), 'first').kernel
    await first.boot()
    const prepared = await completeTurn(first, 'Persist me.')
    await first.shutdown()

    const secondStore = new LocalStorageStateStore('relationship-restart', { storage })
    const second = createKernel(secondStore, createClock(200), 'second').kernel
    await second.boot()
    const record = second.getRelationships('kyo')[0]

    expect(record.interactionCount).toBe(1)
    expect(record.turnIds).toEqual([prepared.turnId])
    expect(second.getConversationTurns()).toHaveLength(1)
    expect(second.getTimelineEvents()).toHaveLength(2)
  })

  it('filters common stop words from trigger phrases and prevents false-positive reinforcement', () => {
    // Stopwords only -> empty trigger phrases
    expect(extractTriggerPhrases('I could never think about going there again')).toEqual([])

    // Meaningful technical words are retained
    const phrases = extractTriggerPhrases('You deliberately deleted the database credentials')
    expect(phrases).toEqual(['deliberately', 'deleted', 'database', 'credentials'])

    // Word boundary matching prevents substring false positives
    expect(matchesTriggerPhrases('This is an important matter', ['port'])).toBe(false)
    expect(matchesTriggerPhrases('She had a portable computer', ['port'])).toBe(false)
    expect(matchesTriggerPhrases('He docked at the port today', ['port'])).toBe(true)

    // Innocent turn containing stop word does not trigger reinforcement
    const formed = applyEvidence(createEmptyRelationshipState(1), evidence({
      eventType: 'negative',
      intensity: 0.7,
      description: 'You deliberately betrayed my confidence.',
    }))
    const innocent = applyEvidence(formed.relationships, evidence({
      eventId: 'event-innocent',
      turnId: 'turn-innocent',
      thoughtId: 'thought-innocent',
      timestamp: 200,
      eventType: 'negative',
      intensity: 0.7,
      description: 'I could think about other things though.',
    }))
    // The innocent turn should create a separate grievance rather than reinforcing the betrayal grievance
    expect(innocent.record?.activeGrievances[0].reinforcementCount).toBe(0)
  })

  it('records commitments and breaches as PCL belief claims with suspicion escalation', () => {
    let nextId = 0
    const createId = () => `pcl-${++nextId}`
    const initial = createEmptyRelationshipState(100)

    // 1. Record commitment
    const committed = recordCommitment(initial, {
      actorId: 'kyo',
      task: 'backup database',
      timestamp: 150,
      turnId: 'turn-c1',
    }, createId)

    expect(committed.applied).toBe(true)
    const kyoRecord = committed.record!
    expect(kyoRecord.expectations).toHaveLength(1)
    expect(kyoRecord.expectations[0]).toMatchObject({
      subject: 'kyo',
      predicate: 'committed_to',
      object: 'backup database',
      status: 'active',
      rule: 'pcl.commitment-recorded',
    })

    // 2. Record breach
    const beforeSuspicion = kyoRecord.suspicion
    const beforeTrust = kyoRecord.trust
    const breached = recordBreach(committed.relationships, {
      actorId: 'kyo',
      task: 'backup database',
      description: 'Failed to backup database before maintenance',
      timestamp: 200,
      turnId: 'turn-b1',
    }, createId)

    expect(breached.applied).toBe(true)
    const breachedRecord = breached.record!
    expect(breachedRecord.expectations[0].status).toBe('violated')
    expect(breachedRecord.activeGrievances).toHaveLength(1)
    expect(breachedRecord.activeGrievances[0]).toMatchObject({
      subject: 'kyo',
      predicate: 'broke_commitment',
      object: 'backup database',
      status: 'active',
      action: 'new',
      supersededBy: null,
    })
    expect(breachedRecord.suspicion).toBeGreaterThan(beforeSuspicion)
    expect(breachedRecord.trust).toBeLessThan(beforeTrust)
  })

  it('repairs broken commitments, supersedes grievances with repair claim, and restores trust', () => {
    let nextId = 0
    const createId = () => `pcl-${++nextId}`
    const initial = createEmptyRelationshipState(100)

    const committed = recordCommitment(initial, {
      actorId: 'kyo',
      task: 'deploy edge proxy',
      timestamp: 150,
    }, createId)

    const breached = recordBreach(committed.relationships, {
      actorId: 'kyo',
      task: 'deploy edge proxy',
      timestamp: 200,
      suspicionDelta: 0.2,
      trustDelta: 0.2,
    }, createId)

    const breachedRecord = breached.record!
    expect(breachedRecord.suspicion).toBeCloseTo(0.2)
    expect(breachedRecord.trust).toBeCloseTo(0.3)

    // Repair the commitment
    const repaired = recordRepair(breached.relationships, {
      actorId: 'kyo',
      task: 'deploy edge proxy',
      resolution: 'Proxy deployed and verified on staging',
      timestamp: 300,
      repairClaimId: 'claim:repair-101',
      suspicionDelta: 0.2,
      trustDelta: 0.15,
    }, createId)

    expect(repaired.applied).toBe(true)
    const repairedRecord = repaired.record!
    expect(repairedRecord.expectations[0].status).toBe('met')
    expect(repairedRecord.expectations[0].supersededBy).toBe('claim:repair-101')

    const repairedGrievance = repairedRecord.activeGrievances[0]
    expect(repairedGrievance.status).toBe('resolved')
    expect(repairedGrievance.supersededBy).toBe('claim:repair-101')
    expect(repairedGrievance.action).toBe('update')
    expect(repairedGrievance.description).toContain('[Repaired: Proxy deployed and verified on staging]')

    // Suspicion decremented, trust restored
    expect(repairedRecord.suspicion).toBeCloseTo(0)
    expect(repairedRecord.trust).toBeCloseTo(0.45)
    expect(repairedRecord.moments.at(-1)).toMatchObject({
      eventType: 'grudge_resolved',
      rule: 'pcl.commitment-repaired',
    })
  })

  it('supports kernel-level commitment, breach, and repair orchestration', async () => {
    const { kernel } = createKernel()
    await kernel.boot()

    // 1. Kernel commitment
    const committed = await kernel.recordCommitment({
      actorId: 'kyo',
      task: 'fix memory leak in audio pipeline',
    })
    expect(committed?.expectations).toHaveLength(1)
    expect(committed?.expectations[0].object).toBe('fix memory leak in audio pipeline')

    // 2. Kernel breach
    const breached = await kernel.recordBreach({
      actorId: 'kyo',
      task: 'fix memory leak in audio pipeline',
      description: 'Memory leak recurred on buffer flush',
    })
    expect(breached?.suspicion).toBeGreaterThan(0)
    expect(breached?.activeGrievances[0].predicate).toBe('broke_commitment')

    // 3. Kernel repair
    const repaired = await kernel.recordRepair({
      actorId: 'kyo',
      task: 'fix memory leak in audio pipeline',
      resolution: 'Fixed by releasing PCM ArrayBuffer in finally block',
    })
    expect(repaired?.suspicion).toBe(0)
    expect(repaired?.activeGrievances[0].status).toBe('resolved')
    expect(repaired?.activeGrievances[0].supersededBy).toBeTruthy()
  })

  it('synchronizes relationship state to AIRI EntityLedger adapter', () => {
    const registeredEntities: Array<{ label: string, type?: string, attributes?: Record<string, any> }> = []
    const appliedClaims: Array<{ subject: string, predicate: string, object: string, action: string }> = []

    const mockLedger: Nan0EntityLedgerAdapter = {
      getOrCreateEntity(label, type, attributes) {
        registeredEntities.push({ label, type, attributes })
        return { label }
      },
      applyPCLClaim(claim) {
        appliedClaims.push(claim)
        return { claimId: 'mock-claim', actionTaken: 'created' }
      },
    }

    let nextId = 0
    const createId = () => `sync-${++nextId}`
    const state = createEmptyRelationshipState(100)

    const committed = recordCommitment(state, {
      actorId: 'kyo',
      task: 'sync entity ledger',
      timestamp: 150,
      turnId: 'turn-sync-1',
    }, createId, { entityLedger: mockLedger })

    expect(appliedClaims).toContainEqual(expect.objectContaining({
      subject: 'kyo',
      predicate: 'committed_to',
      object: 'sync entity ledger',
      action: 'new',
    }))

    // Full sync test
    syncRelationshipWithEntityLedger(committed.record!, mockLedger)
    expect(registeredEntities).toContainEqual(expect.objectContaining({
      label: 'kyo',
      type: 'person',
    }))
  })

  it('supports configurable owner anchor in RelationshipMemory and Nan0Kernel', async () => {
    // 1. RelationshipMemory level
    const stateWithRichard = createEmptyRelationshipState(100, {
      ownerId: 'richard',
      ownerDisplayName: 'Richard',
    })
    expect(Object.keys(stateWithRichard.records)).toEqual(['relationship:richard'])
    expect(stateWithRichard.records['relationship:richard']).toMatchObject({
      actorId: 'richard',
      relationshipId: 'relationship:richard',
      importance: 1,
      metadata: { protected: true, relationship: 'creator_anchor' },
    })

    // 2. Nan0Kernel level with custom owner and aliases
    const { kernel } = createKernel(
      new InMemoryStateStore(),
      createClock(100),
      'id',
      {
        ownerId: 'richard',
        ownerDisplayName: 'Richard',
        ownerAliases: ['rick', 'richie'],
      },
    )
    await kernel.boot()

    // Turn from 'rick' alias should resolve to Richard's relationship
    await completeTurn(kernel, 'Hello Nan0, it is Rick.', {
      actorId: 'rick',
      displayName: 'Rick',
      source: 'chat',
    })

    const richardRels = kernel.getRelationships('richard')
    expect(richardRels).toHaveLength(1)
    expect(richardRels[0]).toMatchObject({
      relationshipId: 'relationship:richard',
      actorId: 'richard',
      interactionCount: 1,
      importance: 1,
      metadata: { protected: true, relationship: 'creator_anchor' },
    })
  })

  it('replaces hardcoded stop words with grammatical closed-class regex fallback floor', () => {
    // Closed-class words are rejected by regex
    expect(FALLBACK_CLOSED_CLASS_REGEX.test('the')).toBe(true)
    expect(FALLBACK_CLOSED_CLASS_REGEX.test('would')).toBe(true)
    expect(FALLBACK_CLOSED_CLASS_REGEX.test('although')).toBe(true)
    expect(FALLBACK_CLOSED_CLASS_REGEX.test('going')).toBe(true)

    // Open-class nouns and verbs are not rejected
    expect(FALLBACK_CLOSED_CLASS_REGEX.test('database')).toBe(false)
    expect(FALLBACK_CLOSED_CLASS_REGEX.test('betrayal')).toBe(false)
    expect(FALLBACK_CLOSED_CLASS_REGEX.test('deploy')).toBe(false)
    expect(FALLBACK_CLOSED_CLASS_REGEX.test('credentials')).toBe(false)
  })

  it('uses System 1 Jev semantic classification to distinguish conversational filler from substantive grievance', async () => {
    let queriedQuestions: Record<string, any> | undefined

    const mockJev: Nan0SystemOneProvider = async (state, questions) => {
      queriedQuestions = questions
      return {
        answers: {
          grievance_salience: { choice: 'conversational_filler', confidence: 0.95 },
          grievance_recurrence: { choice: 'conversational_unrelated', confidence: 0.95 },
        },
      }
    }

    let nextId = 0
    const createId = () => `jev-${++nextId}`
    const state = createEmptyRelationshipState(100)

    // Negative event with intensity above threshold, but Jev classifies as conversational filler
    const result = await applyRelationshipEvidenceAsync(state, {
      actorId: 'kyo',
      actorKind: 'kyo',
      source: 'chat',
      eventId: 'event-filler',
      turnId: 'turn-filler',
      thoughtId: 'thought-filler',
      timestamp: 150,
      eventType: 'negative',
      intensity: 0.7,
      rule: 'test.filler',
      description: 'You are being silly and I totally disagree with your movie choice.',
    }, createId, { systemOneProvider: mockJev })

    expect(queriedQuestions).toHaveProperty('grievance_salience')
    // Grievance was suppressed because Jev identified it as conversational filler
    expect(result.record?.activeGrievances).toHaveLength(0)
  })

  it('uses System 1 Jev semantic classification to detect recurrence without literal word overlap', async () => {
    let callCount = 0
    const mockJev: Nan0SystemOneProvider = async () => {
      callCount++
      return {
        answers: {
          grievance_salience: { choice: 'substantive_grievance', confidence: 0.9 },
          grievance_recurrence: callCount === 1
            ? { choice: 'new_unrelated_issue', confidence: 0.9 }
            : { choice: 'recurrence_reinforced', confidence: 0.95 },
        },
      }
    }

    let nextId = 0
    const createId = () => `rec-${++nextId}`
    const state = createEmptyRelationshipState(100)

    // 1. Initial grievance: "broke the build"
    const first = await applyRelationshipEvidenceAsync(state, {
      actorId: 'kyo',
      actorKind: 'kyo',
      source: 'chat',
      eventId: 'event-1',
      turnId: 'turn-1',
      thoughtId: 'thought-1',
      timestamp: 150,
      eventType: 'negative',
      intensity: 0.75,
      rule: 'test.build-break',
      description: 'You broke the production build before release.',
    }, createId, { systemOneProvider: mockJev })

    expect(first.record?.activeGrievances).toHaveLength(1)
    expect(first.record?.activeGrievances[0].reinforcementCount).toBe(0)

    // 2. Second turn: "pipeline failed again" - NO literal word overlap with "broke the production build",
    // but Jev classifies it as recurrence_reinforced!
    const second = await applyRelationshipEvidenceAsync(first.relationships, {
      actorId: 'kyo',
      actorKind: 'kyo',
      source: 'chat',
      eventId: 'event-2',
      turnId: 'turn-2',
      thoughtId: 'thought-2',
      timestamp: 250,
      eventType: 'negative',
      intensity: 0.75,
      rule: 'test.pipeline-fail',
      description: 'Continuous integration went red and halted distribution.',
    }, createId, { systemOneProvider: mockJev })

    expect(second.record?.activeGrievances).toHaveLength(1)
    // Semantically reinforced via Jev System 1!
    expect(second.record?.activeGrievances[0].reinforcementCount).toBe(1)
    expect(second.record?.activeGrievances[0].lastReinforcedAt).toBe(250)
  })

  it('extracts semantic trigger concepts via System 1 Jev with lexical floor fallback', async () => {
    // 1. With Jev available: returns semantic concept
    const mockJev: Nan0SystemOneProvider = async () => ({
      answers: {
        trigger_concept: { choice: 'deceit_dishonesty', confidence: 0.9 },
      },
    })
    const jevPhrases = await extractTriggerPhrasesAsync(
      'You concealed the credentials from me',
      mockJev,
    )
    expect(jevPhrases).toContain('deceit_dishonesty')
    expect(jevPhrases).toContain('concealed')
    expect(jevPhrases).toContain('credentials')

    // 2. Fallback when Jev is offline: uses grammatical closed-class floor
    const fallbackPhrases = await extractTriggerPhrasesAsync(
      'You concealed the credentials from me',
      undefined,
    )
    expect(fallbackPhrases).toEqual(['concealed', 'credentials'])
  })

  it('wires System 1 Jev through Nan0Kernel recordAssistantTurn for relationship evidence', async () => {
    let jevCalled = false
    const mockJev: Nan0SystemOneProvider = async () => {
      jevCalled = true
      return {
        answers: {
          grievance_salience: { choice: 'substantive_grievance', confidence: 0.9 },
          grievance_recurrence: { choice: 'new_unrelated_issue', confidence: 0.9 },
        },
      }
    }

    const { kernel } = createKernel(
      new InMemoryStateStore(),
      createClock(100),
      'id',
      undefined,
      undefined,
      mockJev,
    )
    await kernel.boot()

    // Complete a negative turn
    await completeTurn(kernel, 'You lied and betrayed my trust deliberately.', {
      actorId: 'kyo',
      timestamp: 100,
    })

    expect(jevCalled).toBe(true)
    const kyoRecord = kernel.getRelationships('kyo')[0]
    expect(kyoRecord.activeGrievances).toHaveLength(1)
    expect(kyoRecord.activeGrievances[0].predicate).toBe('grievance')
  })
})
