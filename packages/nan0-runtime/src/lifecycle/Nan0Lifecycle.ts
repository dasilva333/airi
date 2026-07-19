import type {
  Nan0ActionIntentRecord,
  Nan0ComputationAttempt,
  Nan0LifecyclePolicy,
} from '../types'

export const DEFAULT_PRIVATE_THOUGHT_TIMEOUT_MS = 90_000
export const PRIVATE_THOUGHT_TIMEOUT_POLICY_ID = 'thought.private-inference.v1'

export function privateThoughtTimeoutPolicy(durationMs = DEFAULT_PRIVATE_THOUGHT_TIMEOUT_MS): Nan0LifecyclePolicy {
  if (!Number.isFinite(durationMs) || durationMs <= 0)
    throw new Error('Private-thought timeout must be a positive finite duration.')
  return {
    schemaVersion: 1,
    policyId: PRIVATE_THOUGHT_TIMEOUT_POLICY_ID,
    kind: 'computation-timeout',
    durationMs,
    deadline: null,
    condition: null,
    metadata: { scope: 'private-thought-provider-request' },
  }
}

const computationTerminal = new Set(['completed', 'timed-out', 'failed', 'interrupted'])
const actionTerminal = new Set(['completed', 'failed', 'cancelled'])

export function mergeComputationAttempts(
  persisted: readonly Nan0ComputationAttempt[] | null | undefined,
  candidate: readonly Nan0ComputationAttempt[] | null | undefined,
): Nan0ComputationAttempt[] {
  const records = new Map<string, Nan0ComputationAttempt>()
  for (const record of [...(persisted ?? []), ...(candidate ?? [])]) {
    if ((record?.schemaVersion !== 1 && record?.schemaVersion !== 2) || !record.requestId)
      continue
    const normalized: Nan0ComputationAttempt = {
      ...structuredClone(record),
      schemaVersion: 2,
      cognitionPhase: record.cognitionPhase ?? (computationTerminal.has(record.status) ? 'complete' : 'queued'),
      partialNarrativeLength: Math.max(0, Math.floor(record.partialNarrativeLength ?? 0)),
    }
    const existing = records.get(record.requestId)
    const existingProgress = Math.max(0, existing?.partialNarrativeLength ?? 0)
    const normalizedProgress = Math.max(0, normalized.partialNarrativeLength ?? 0)
    if (!existing
      || (!computationTerminal.has(existing.status) && computationTerminal.has(normalized.status))
      || (!computationTerminal.has(existing.status)
        && !computationTerminal.has(normalized.status)
        && (existing.status === 'active' && normalized.status === 'streaming'
          || normalizedProgress > existingProgress))
        || (existing.status === normalized.status && (normalized.finishedAt ?? 0) > (existing.finishedAt ?? 0))) {
      records.set(record.requestId, normalized)
    }
  }
  return [...records.values()].sort((a, b) => a.startedAt - b.startedAt || a.requestId.localeCompare(b.requestId))
}

export function mergeActionIntents(
  persisted: readonly Nan0ActionIntentRecord[] | null | undefined,
  candidate: readonly Nan0ActionIntentRecord[] | null | undefined,
): Nan0ActionIntentRecord[] {
  const records = new Map<string, Nan0ActionIntentRecord>()
  for (const record of [...(persisted ?? []), ...(candidate ?? [])]) {
    if (record?.schemaVersion !== 1 || !record.actionIntentId)
      continue
    const existing = records.get(record.actionIntentId)
    if (!existing
      || (!actionTerminal.has(existing.status) && actionTerminal.has(record.status))
      || (existing.status === 'authorized' && record.status === 'active')) {
      records.set(record.actionIntentId, structuredClone(record))
    }
  }
  return [...records.values()].sort((a, b) => a.requestedAt - b.requestedAt || a.actionIntentId.localeCompare(b.actionIntentId))
}
