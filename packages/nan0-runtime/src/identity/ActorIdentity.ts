import type {
  DefaultIdentityOptions,
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

export function isOwnerActor(actorId: unknown, identity?: Nan0IdentityState): boolean {
  const key = normalizeKey(actorId)
  if (!key)
    return false

  if (identity?.ownerId && (key === normalizeKey(identity.ownerId) || normalizeKey(identity.aliases[key]) === normalizeKey(identity.ownerId)))
    return true

  if (identity?.actors[key]?.kind === 'owner' || identity?.actors[key]?.kind === 'kyo')
    return true

  return key === 'kyo' || key === 'owner'
}

export function createDefaultIdentityState(options?: string | DefaultIdentityOptions): Nan0IdentityState {
  const opts: DefaultIdentityOptions | undefined = typeof options === 'string'
    ? { ownerDisplayName: options }
    : options

  const ownerDisplayName = opts?.ownerDisplayName?.trim() || 'Kyo'
  const ownerId = normalizeKey(opts?.ownerId || (opts?.ownerDisplayName ? opts.ownerDisplayName : 'kyo')) || 'kyo'
  const isKyo = ownerId === 'kyo'
  const ownerAliases = isKyo
    ? Array.from(new Set([...KYO_ALIASES, ...(opts?.ownerAliases ?? [])]))
    : Array.from(new Set([ownerId, normalizeKey(ownerDisplayName), ...(opts?.ownerAliases?.map(normalizeKey) ?? [])]))
  const ownerPronouns = opts?.ownerPronouns ?? (isKyo ? ['she', 'her'] : ['they', 'them'])

  const owner = createActor(ownerId, ownerDisplayName, 'owner', ownerAliases, ownerPronouns)
  const nan0 = createActor('nan0', 'Nan0', 'nan0', NAN0_ALIASES, ['she', 'her'])

  const actors: Record<string, Nan0ActorIdentity> = {
    [ownerId]: owner,
    nan0,
  }

  // Preserve 'kyo' actor entry for backwards compatibility when owner has a different id
  if (!isKyo) {
    actors.kyo = createActor('kyo', 'Kyo', 'owner', KYO_ALIASES, ['she', 'her'])
  }

  const aliases: Record<string, string> = {
    ...Object.fromEntries(ownerAliases.map(alias => [alias, ownerId])),
    ...Object.fromEntries(NAN0_ALIASES.map(alias => [alias, 'nan0'])),
  }

  // Ensure 'kyo' aliases map to the owner
  for (const alias of KYO_ALIASES) {
    aliases[alias] = ownerId
  }

  return {
    actors,
    aliases,
    ownerId,
  }
}

export function hydrateIdentityState(
  state?: Partial<Nan0IdentityState>,
  options?: string | DefaultIdentityOptions,
): Nan0IdentityState {
  const defaults = createDefaultIdentityState(
    options ?? (state?.ownerId ? { ownerId: state.ownerId } : undefined),
  )
  const actors = structuredClone(state?.actors ?? {})
  const ownerId = state?.ownerId ?? defaults.ownerId ?? 'kyo'

  for (const [actorId, defaultActor] of Object.entries(defaults.actors)) {
    actors[actorId] = {
      ...defaultActor,
      ...actors[actorId],
      actorId,
      displayName: actors[actorId]?.displayName || defaultActor.displayName,
      kind: actors[actorId]?.kind || defaultActor.kind,
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

  return { actors, aliases, ownerId }
}

export function normalizeMemoryOwnership(
  memory: Nan0MemoryRecord,
  identityState: Nan0IdentityState,
): { identity: Nan0IdentityState, memory: Nan0MemoryRecord } {
  const identity = hydrateIdentityState(identityState)
  const ownerActor = identity.actors[identity.ownerId ?? 'kyo'] ?? identity.actors.kyo
  const ownerDisplayName = ownerActor?.displayName || 'Kyo'

  if (memory.tags.includes('assistant-output') || memory.tags.includes('nan0-expression')) {
    const ownership = nan0Ownership(String(memory.metadata.source ?? 'assistant'), ownerDisplayName)
    return {
      identity,
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
  }, identity)

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
  const ownerId = identity.ownerId || 'kyo'

  if (raw)
    return identity.aliases[raw] ?? raw

  if (allowSourceInference && (sourceKey.startsWith('kyo') || sourceKey.startsWith('owner') || sourceKey.startsWith('user')))
    return ownerId

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
  const isOwner = isOwnerActor(actorId, identity)
  const knownActor = identity.actors[actorId]
  const kind: Nan0ActorKind = knownActor?.kind
    ?? (actorId === 'unknown' ? 'unknown' : isOwner ? 'owner' : 'external')
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

  const ownerActor = identity.actors[identity.ownerId ?? 'kyo'] ?? identity.actors.kyo
  const ownerName = ownerActor?.displayName || 'Kyo'

  const roles = isOwner
    ? {
        actorRole: `${displayName} is the one who spoke or acted.`,
        nan0Role: `Nan0 is the observer/reactor, not the actor who did ${displayName}'s action.`,
        ownershipRule: `${displayName}'s first-person statements belong to ${displayName} and must never become Nan0's actions or memories.`,
      }
    : actorId === 'nan0'
      ? {
          actorRole: 'Nan0 is the actor/source of this event.',
          nan0Role: 'Nan0 may use I/me for this event.',
          ownershipRule: `Nan0's actions belong to Nan0 and must never be reassigned to ${ownerName}.`,
        }
      : {
          actorRole: 'This external or unknown actor spoke or acted.',
          nan0Role: 'Nan0 is the observer/reactor unless the event explicitly says Nan0 acted.',
          ownershipRule: `Another actor's first-person statements must not become ${ownerName}'s or Nan0's actions or memories.`,
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

export function nan0Ownership(source = 'assistant', ownerName = 'Kyo'): Nan0ActorOwnership {
  return {
    actorId: 'nan0',
    displayName: 'Nan0',
    kind: 'nan0',
    source,
    rawActorId: 'nan0',
    actorRole: 'Nan0 is the actor/source of this event.',
    nan0Role: 'Nan0 may use I/me for this event.',
    ownershipRule: `Nan0 output always belongs to Nan0 and must never be reassigned to ${ownerName} or another actor.`,
  }
}
