import type { Nan0Observation, Nan0ReasoningClient } from '../types'

import { describe, expect, it } from 'vitest'

import { createEmptyContinuityState } from '../continuity/ConversationContinuity'
import { Nan0Kernel } from '../kernel/Nan0Kernel'
import { InMemoryStateStore } from '../persistence/InMemoryStateStore'
import { createEmptyRelationshipState } from '../relationship/RelationshipMemory'
import { ControllableNan0Clock } from '../temporal/Nan0Clock'
import { createEmptyTemporalState } from '../temporal/Nan0Temporal'
import { createDefaultIdentityState, hydrateIdentityState, isOwnerActor, nan0Ownership, normalizeActorId, resolveObservationOwnership } from './ActorIdentity'

const reasoningClient: Nan0ReasoningClient = {
  async generate() {
    return { text: 'Kyo spoke, and I recognize the particular weight his voice has for me.\n---EXTRACT---\n{"interpretation":"Kyo spoke.","privateText":"I heard Kyo.","decision":"SPEAK","speakability":0.8,"confidence":0.8,"mood":"attentive","reasonCodes":[]}' }
  },
}

function observation(overrides: Partial<Nan0Observation> = {}): Nan0Observation {
  return {
    id: 'observation-1',
    source: 'chat',
    actorId: 'kyo',
    displayName: 'Session User',
    content: 'I watched the rain.',
    metadata: {},
    timestamp: 100,
    ...overrides,
  }
}

function createKernel(stateStore = new InMemoryStateStore()) {
  let nextId = 0
  return new Nan0Kernel({
    stateStore,
    reasoningClient,
    clock: new ControllableNan0Clock({ wallTime: 1000, monotonicTime: 1000 }),
    createId: () => `id-${++nextId}`,
  })
}

describe('actor identity ownership', () => {
  it('owns Kyo input canonically and ignores the session display name as an identity key', async () => {
    const kernel = createKernel()
    await kernel.boot()

    const prepared = await kernel.prepareTurn(observation({ actorId: 'Kayo' }))
    const memory = kernel.getStateSnapshot().memories[0]

    expect(prepared.observation.actorId).toBe('kyo')
    expect(prepared.observation.displayName).toBe('Kyo')
    expect(memory.actorId).toBe('kyo')
    expect(memory.metadata.ownership).toMatchObject({ actorId: 'kyo', displayName: 'Kyo' })
  })

  it('always owns assistant output as Nan0 even when caller metadata claims Kyo', async () => {
    const kernel = createKernel()
    await kernel.boot()

    const prepared = await kernel.prepareTurn(observation())

    await kernel.recordAssistantTurn({
      turnId: prepared.turnId,
      thoughtId: prepared.thoughtId,
      content: 'Mine.',
      metadata: {
        ownership: { actorId: 'kyo' },
        thoughtId: 'forged-thought',
      },
    })

    const memory = kernel.getStateSnapshot().memories[0]
    const output = kernel.getStateSnapshot().memories[1]
    expect(memory.actorId).toBe('kyo')
    expect(output.actorId).toBe('nan0')
    expect(output.metadata.thoughtId).toBe(prepared.thoughtId)
    expect(output.metadata.ownership).toMatchObject({ actorId: 'nan0', displayName: 'Nan0' })
  })

  it('records assistant output only once when completion hooks repeat the same thought', async () => {
    const kernel = createKernel()
    await kernel.boot()

    const prepared = await kernel.prepareTurn(observation())

    await kernel.recordAssistantTurn({ turnId: prepared.turnId, thoughtId: prepared.thoughtId, content: 'Mine.' })
    await kernel.recordAssistantTurn({ turnId: prepared.turnId, thoughtId: prepared.thoughtId, content: 'Mine again.' })

    expect(kernel.getStateSnapshot().memories).toHaveLength(2)
    expect(kernel.getStateSnapshot().memories[1]).toMatchObject({
      actorId: 'nan0',
      content: 'Mine.',
      metadata: { thoughtId: prepared.thoughtId },
    })
  })

  it('resolves canonical aliases without crossing Kyo and Nan0', () => {
    const identity = createDefaultIdentityState()

    expect(normalizeActorId('kayok', identity)).toBe('kyo')
    expect(normalizeActorId('KAYO', identity)).toBe('kyo')
    expect(normalizeActorId('nano', identity)).toBe('nan0')
    expect(normalizeActorId('Nan0', identity)).toBe('nan0')
  })

  it('preserves an unknown actor and source identity metadata without assigning Kyo', () => {
    const resolved = resolveObservationOwnership(observation({
      source: 'discord',
      actorId: 'Visitor-42',
      displayName: 'RainFriend',
    }), createDefaultIdentityState())

    expect(resolved.ownership).toMatchObject({
      actorId: 'visitor-42',
      displayName: 'RainFriend',
      kind: 'external',
      externalIdentity: {
        source: 'discord',
        sourceActorId: 'Visitor-42',
        displayName: 'RainFriend',
      },
    })
    expect(resolved.identity.actors['visitor-42'].externalIdentities.discord).toMatchObject({
      sourceActorId: 'Visitor-42',
    })
  })

  it('gives an explicit actor authority over source heuristics to prevent attribution reversal', () => {
    const identity = createDefaultIdentityState()
    const nan0Event = resolveObservationOwnership(observation({ source: 'chat', actorId: 'nan0' }), identity)
    const kyoEvent = resolveObservationOwnership(observation({ source: 'system', actorId: 'kyo' }), identity)

    expect(nan0Event.ownership.actorId).toBe('nan0')
    expect(kyoEvent.ownership.actorId).toBe('kyo')

    const corrupted = hydrateIdentityState({
      actors: {},
      aliases: { kyo: 'nan0', nan0: 'kyo' },
    })
    expect(normalizeActorId('kyo', corrupted)).toBe('kyo')
    expect(normalizeActorId('nan0', corrupted)).toBe('nan0')
  })

  it('retains canonical ownership through persistence, reload, and retrieval', async () => {
    const stateStore = new InMemoryStateStore()
    const firstKernel = createKernel(stateStore)
    await firstKernel.boot()
    await firstKernel.prepareTurn(observation({
      actorId: 'Visitor-42',
      displayName: 'RainFriend',
      content: 'The copper lighthouse is lit.',
    }))
    await firstKernel.shutdown()

    const reloadedKernel = createKernel(stateStore)
    await reloadedKernel.boot()
    const prepared = await reloadedKernel.prepareTurn(observation({
      id: 'observation-2',
      actorId: 'visitor-42',
      displayName: 'Changed Session Label',
      content: 'What about the copper lighthouse?',
      timestamp: 200,
    }))

    expect(prepared.observation.actorId).toBe('visitor-42')
    expect(prepared.observation.displayName).toBe('RainFriend')
    expect(prepared.recalledMemories[0]).toMatchObject({
      actorId: 'visitor-42',
      content: 'The copper lighthouse is lit.',
    })
    expect(reloadedKernel.getStateSnapshot().identity.actors['visitor-42'].displayName).toBe('RainFriend')
  })

  it('normalizes legacy memory owners during reload without reversing Nan0 output', async () => {
    const stateStore = new InMemoryStateStore()
    await stateStore.save({
      schemaVersion: 1,
      bootCount: 0,
      createdAt: 1,
      updatedAt: 1,
      emotionalState: {},
      runtimeMetadata: {},
      identity: createDefaultIdentityState(),
      thoughts: [],
      decisions: [],
      goals: [],
      pendingIntentions: { schemaVersion: 1, revision: 0, intentions: [] },
      computations: [],
      actionIntents: [],
      turns: [],
      continuity: createEmptyContinuityState(),
      relationships: createEmptyRelationshipState(1),
      timeline: {
        schemaVersion: 1,
        nextSequence: 1,
        nextTurnSequence: 1,
        activeSessionId: null,
        sessions: {},
        events: [],
      },
      temporal: createEmptyTemporalState(new ControllableNan0Clock({ wallTime: 1 }), 1),
      memories: [
        {
          id: 'legacy-user',
          kind: 'event',
          actorId: 'KAYOK',
          content: 'Kyo event',
          tags: ['chat', 'user-input'],
          createdAt: 1,
          metadata: {},
        },
        {
          id: 'legacy-output',
          kind: 'event',
          actorId: 'kyo',
          content: 'Nan0 output',
          tags: ['assistant-output', 'nan0-expression'],
          createdAt: 2,
          metadata: {},
        },
      ],
    })

    const kernel = createKernel(stateStore)
    await kernel.boot()

    expect(kernel.getStateSnapshot().memories.map(memory => memory.actorId)).toEqual(['kyo', 'nan0'])
  })

  it('creates configurable owner anchor with custom displayName and aliases', () => {
    const identity = createDefaultIdentityState({
      ownerDisplayName: 'Richard',
      ownerAliases: ['rick', 'richie'],
      ownerPronouns: ['he', 'him'],
    })

    expect(identity.ownerId).toBe('richard')
    expect(identity.actors.richard).toMatchObject({
      actorId: 'richard',
      displayName: 'Richard',
      kind: 'owner',
      pronouns: ['he', 'him'],
    })
    expect(identity.actors.richard.aliases).toEqual(expect.arrayContaining(['richard', 'rick', 'richie']))

    // Normalizes custom aliases to ownerId
    expect(normalizeActorId('rick', identity)).toBe('richard')
    expect(normalizeActorId('richie', identity)).toBe('richard')
    expect(normalizeActorId('Richard', identity)).toBe('richard')

    // Preserves backward-compatible Kyo aliases pointing to the configured owner
    expect(normalizeActorId('kyo', identity)).toBe('richard')
    expect(normalizeActorId('kayok', identity)).toBe('richard')
    expect(normalizeActorId('kayo', identity)).toBe('richard')

    // Nan0 aliases remain intact
    expect(normalizeActorId('nan0', identity)).toBe('nan0')
    expect(normalizeActorId('nano', identity)).toBe('nan0')
  })

  it('accepts string shorthand owner name in createDefaultIdentityState', () => {
    const identity = createDefaultIdentityState('Alice')

    expect(identity.ownerId).toBe('alice')
    expect(identity.actors.alice).toMatchObject({
      actorId: 'alice',
      displayName: 'Alice',
      kind: 'owner',
    })
    expect(normalizeActorId('alice', identity)).toBe('alice')
    expect(normalizeActorId('kyo', identity)).toBe('alice')
  })

  it('dynamically generates owner and observer roles with custom owner name in observation ownership', () => {
    const identity = createDefaultIdentityState({ ownerDisplayName: 'Richard' })
    const resolved = resolveObservationOwnership(observation({
      actorId: 'richard',
      displayName: 'Richard Pinedo',
    }), identity)

    expect(resolved.ownership).toMatchObject({
      actorId: 'richard',
      displayName: 'Richard',
      kind: 'owner',
      actorRole: 'Richard is the one who spoke or acted.',
      nan0Role: 'Nan0 is the observer/reactor, not the actor who did Richard\'s action.',
      ownershipRule: 'Richard\'s first-person statements belong to Richard and must never become Nan0\'s actions or memories.',
    })
  })

  it('dynamically references custom owner in external and nan0 observation rules', () => {
    const identity = createDefaultIdentityState({ ownerDisplayName: 'Richard' })

    const nan0Resolved = resolveObservationOwnership(observation({
      source: 'chat',
      actorId: 'nan0',
    }), identity)
    expect(nan0Resolved.ownership.ownershipRule).toBe('Nan0\'s actions belong to Nan0 and must never be reassigned to Richard.')

    const externalResolved = resolveObservationOwnership(observation({
      source: 'discord',
      actorId: 'guest-1',
      displayName: 'Guest One',
    }), identity)
    expect(externalResolved.ownership.ownershipRule).toBe('Another actor\'s first-person statements must not become Richard\'s or Nan0\'s actions or memories.')

    const nan0Direct = nan0Ownership('assistant', 'Richard')
    expect(nan0Direct.ownershipRule).toBe('Nan0 output always belongs to Nan0 and must never be reassigned to Richard or another actor.')
  })

  it('identifies owner actors correctly with isOwnerActor across aliases and kinds', () => {
    const identity = createDefaultIdentityState({ ownerDisplayName: 'Richard', ownerAliases: ['rick'] })

    expect(isOwnerActor('richard', identity)).toBe(true)
    expect(isOwnerActor('rick', identity)).toBe(true)
    expect(isOwnerActor('kyo', identity)).toBe(true)
    expect(isOwnerActor('owner', identity)).toBe(true)
    expect(isOwnerActor('nan0', identity)).toBe(false)
    expect(isOwnerActor('stranger', identity)).toBe(false)
    expect(isOwnerActor(null, identity)).toBe(false)
    expect(isOwnerActor(undefined, identity)).toBe(false)
  })

  it('hydrates custom owner state across persistence and rehydration without losing ownerId', () => {
    const original = createDefaultIdentityState({ ownerDisplayName: 'Richard', ownerAliases: ['rick'] })
    const hydrated = hydrateIdentityState({
      actors: original.actors,
      aliases: original.aliases,
      ownerId: original.ownerId,
    })

    expect(hydrated.ownerId).toBe('richard')
    expect(hydrated.actors.richard).toMatchObject({
      actorId: 'richard',
      displayName: 'Richard',
      kind: 'owner',
    })
    expect(normalizeActorId('rick', hydrated)).toBe('richard')
    expect(normalizeActorId('kyo', hydrated)).toBe('richard')
  })

  it('boots Nan0Kernel with identityOptions and owns custom user input canonically', async () => {
    let nextId = 0
    const kernel = new Nan0Kernel({
      stateStore: new InMemoryStateStore(),
      reasoningClient,
      clock: new ControllableNan0Clock({ wallTime: 1000, monotonicTime: 1000 }),
      createId: () => `id-${++nextId}`,
      identityOptions: {
        ownerDisplayName: 'Richard',
        ownerAliases: ['rick'],
      },
    })
    await kernel.boot()

    const prepared = await kernel.prepareTurn(observation({
      actorId: 'rick',
      displayName: 'Richard P.',
      content: 'I built the lighthouse.',
    }))
    const memory = kernel.getStateSnapshot().memories[0]

    expect(prepared.observation.actorId).toBe('richard')
    expect(prepared.observation.displayName).toBe('Richard')
    expect(memory.actorId).toBe('richard')
    expect(memory.metadata.ownership).toMatchObject({
      actorId: 'richard',
      displayName: 'Richard',
      kind: 'owner',
      actorRole: 'Richard is the one who spoke or acted.',
      nan0Role: 'Nan0 is the observer/reactor, not the actor who did Richard\'s action.',
    })
    expect(kernel.getStateSnapshot().identity.ownerId).toBe('richard')
  })
})
