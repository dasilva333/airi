import type {
  Nan0ActorIdentity,
  Nan0ActorKind,
  Nan0ActorOwnership,
  Nan0ExternalIdentity,
  Nan0IdentityState,
  Nan0MemoryRecord,
  Nan0Observation,
} from '../types'

const KYO_ALIASES = ['kyo', 'kayok', 'kayo']
const NAN0_ALIASES = ['nan0', 'nano']

function normalizeKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function canonicalUnknownId(rawActorId: string): string {
  return normalizeKey(rawActorId) || 'unknown'
}

function createActor(
  actorId: string,
  displayName: string,
  kind: Nan0ActorKind,
  aliases: string[],
  pronouns: string[] = [],
): Nan0ActorIdentity {
  return {
    actorId,
    displayName,
    kind,
    aliases,
    pronouns,
    externalIdentities: {},
  }
}

export function createDefaultIdentityState(): Nan0IdentityState {
  const kyo = createActor('kyo', 'Kyo', 'kyo', KYO_ALIASES, ['she', 'her'])
  const nan0 = createActor('nan0', 'Nan0', 'nan0', NAN0_ALIASES, ['she', 'her'])

  return {
    actors: { kyo, nan0 },
    aliases: Object.fromEntries([
      ...KYO_ALIASES.map(alias => [alias, 'kyo']),
      ...NAN0_ALIASES.map(alias => [alias, 'nan0']),
    ]),
  }
}

export function hydrateIdentityState(state?: Partial<Nan0IdentityState>): Nan0IdentityState {
  const defaults = createDefaultIdentityState()
  const actors = structuredClone(state?.actors ?? {})

  for (const [actorId, defaultActor] of Object.entries(defaults.actors)) {
    actors[actorId] = {
      ...defaultActor,
      ...actors[actorId],
      actorId,
      displayName: defaultActor.displayName,
      kind: defaultActor.kind,
      aliases: Array.from(new Set([...defaultActor.aliases, ...(actors[actorId]?.aliases ?? [])])),
      externalIdentities: { ...defaultActor.externalIdentities, ...actors[actorId]?.externalIdentities },
    }
  }

  const aliases = { ...state?.aliases }
  for (const actor of Object.values(actors)) {
    aliases[normalizeKey(actor.actorId)] = actor.actorId
    for (const alias of actor.aliases)
      aliases[normalizeKey(alias)] = actor.actorId
  }

  Object.assign(aliases, defaults.aliases)

  return { actors, aliases }
}

export function normalizeMemoryOwnership(
  memory: Nan0MemoryRecord,
  identityState: Nan0IdentityState,
): { identity: Nan0IdentityState, memory: Nan0MemoryRecord } {
  if (memory.tags.includes('assistant-output') || memory.tags.includes('nan0-expression')) {
    const ownership = nan0Ownership(String(memory.metadata.source ?? 'assistant'))
    return {
      identity: hydrateIdentityState(identityState),
      memory: {
        ...memory,
        actorId: 'nan0',
        metadata: { ...memory.metadata, ownership },
      },
    }
  }

  const existingOwnership = memory.metadata.ownership as Partial<Nan0ActorOwnership> | undefined
  const source = String(existingOwnership?.source ?? memory.tags[0] ?? 'system')
  const resolved = resolveObservationOwnership({
    id: String(memory.metadata.observationId ?? memory.id),
    source: source as Nan0Observation['source'],
    actorId: memory.actorId,
    displayName: existingOwnership?.displayName,
    content: memory.content,
    metadata: memory.metadata,
    timestamp: memory.createdAt,
  }, identityState)

  return {
    identity: resolved.identity,
    memory: {
      ...memory,
      actorId: resolved.ownership.actorId,
      metadata: { ...memory.metadata, ownership: resolved.ownership },
    },
  }
}

export function normalizeActorId(
  actorId: unknown,
  identity: Nan0IdentityState,
  source = '',
  allowSourceInference = true,
): string {
  const raw = normalizeKey(actorId)
  const sourceKey = normalizeKey(source)

  if (raw)
    return identity.aliases[raw] ?? raw

  if (allowSourceInference && sourceKey.startsWith('kyo'))
    return 'kyo'

  if (allowSourceInference && ['boot', 'monologue', 'proactive', 'social_pressure', 'vision_pressure'].includes(sourceKey))
    return 'nan0'

  return 'unknown'
}

export function resolveObservationOwnership(
  observation: Nan0Observation,
  identityState: Nan0IdentityState,
): { identity: Nan0IdentityState, ownership: Nan0ActorOwnership } {
  const identity = hydrateIdentityState(identityState)
  const hasExplicitActor = !!normalizeKey(observation.actorId)
  const actorId = normalizeActorId(observation.actorId, identity, observation.source, !hasExplicitActor)
  const rawActorId = String(observation.actorId ?? '').trim() || undefined
  const suppliedDisplayName = String(observation.displayName ?? '').trim()
  const knownActor = identity.actors[actorId]
  const kind: Nan0ActorKind = knownActor?.kind
    ?? (actorId === 'unknown' ? 'unknown' : 'external')
  const displayName = knownActor?.displayName
    || suppliedDisplayName
    || rawActorId
    || 'Unknown'

  const externalIdentity: Nan0ExternalIdentity | undefined = kind === 'external' || kind === 'unknown'
    ? {
        source: observation.source,
        sourceActorId: rawActorId,
        displayName: suppliedDisplayName || undefined,
      }
    : undefined

  if (!knownActor) {
    identity.actors[actorId] = createActor(actorId, displayName, kind, rawActorId ? [rawActorId] : [])
  }

  if (externalIdentity) {
    identity.actors[actorId].externalIdentities[observation.source] = externalIdentity
  }

  const roles = actorId === 'kyo'
    ? {
        actorRole: 'Kyo is the one who spoke or acted.',
        nan0Role: 'Nan0 is the observer/reactor, not the actor who did Kyo\'s action.',
        ownershipRule: 'Kyo\'s first-person statements belong to Kyo and must never become Nan0\'s actions or memories.',
      }
    : actorId === 'nan0'
      ? {
          actorRole: 'Nan0 is the actor/source of this event.',
          nan0Role: 'Nan0 may use I/me for this event.',
          ownershipRule: 'Nan0\'s actions belong to Nan0 and must never be reassigned to Kyo.',
        }
      : {
          actorRole: 'This external or unknown actor spoke or acted.',
          nan0Role: 'Nan0 is the observer/reactor unless the event explicitly says Nan0 acted.',
          ownershipRule: 'Another actor\'s first-person statements must not become Kyo\'s or Nan0\'s actions or memories.',
        }

  return {
    identity,
    ownership: {
      actorId,
      displayName,
      kind,
      source: observation.source,
      rawActorId,
      externalIdentity,
      ...roles,
    },
  }
}

export function nan0Ownership(source = 'assistant'): Nan0ActorOwnership {
  return {
    actorId: 'nan0',
    displayName: 'Nan0',
    kind: 'nan0',
    source,
    rawActorId: 'nan0',
    actorRole: 'Nan0 is the actor/source of this event.',
    nan0Role: 'Nan0 may use I/me for this event.',
    ownershipRule: 'Nan0 output always belongs to Nan0 and must never be reassigned to Kyo or another actor.',
  }
}
