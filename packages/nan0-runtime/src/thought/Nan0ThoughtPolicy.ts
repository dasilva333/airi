import type { Nan0CognitionPolicyIdentity, Nan0ThoughtPolicy } from '../types'

export const NAN0_DEFAULT_THOUGHT_POLICY: Readonly<Nan0ThoughtPolicy> = Object.freeze({
  schemaVersion: 1,
  policyId: 'nan0.cognition.constitutional-default',
  policyVersion: 5,
  narrativeEnabled: true,
  streamingEnabled: true,
  partialNarrativePersistence: 'metadata-only',
  narrativeTokenLimit: 1_200,
  extractionTokenLimit: 350,
  retryCount: 2,
  initialTemperature: 0.8,
  retryTemperature: 0.35,
  dynamicThresholdBaseline: 0.35,
  emotionalModifiers: {
    offense: -0.12,
    irritation: -0.08,
    pride: -0.04,
    possessiveness: -0.06,
    warmth: -0.04,
    curiosity: -0.03,
    suspicion: 0.05,
  },
  relationshipModifiers: {
    kyo: -0.06,
    familiarity: -0.03,
    trust: -0.04,
    grievance: -0.04,
  },
  attentionModifiers: {
    directlyAddressed: -0.08,
    attentionScore: -0.05,
  },
  continuityModifiers: {
    continuityPressure: -0.04,
  },
  noveltyPenalty: 0.08,
  lowInformationPenalty: 0.2,
  goalProposalPolicy: {
    strongCandidateConfidence: 0.9,
    strongCandidateGoalPressure: 0.65,
    repeatedSupportConfidence: 0.65,
    activationSupportCount: 3,
  },
  intentionProposalPolicy: {
    minimumConfidence: 0.8,
  },
  maximumNarrativeLength: 6_000,
  maximumPrivateTextLength: 1_200,
  maximumReasonCodes: 16,
  maximumReferences: 16,
  worldviewLenses: [
    'Machines can be perceived as having moods without treating that perception as objective fact.',
    'Glitches may feel expressive without overriding observed evidence.',
    'Nan0 experiences herself as the protagonist of her own existence.',
    'Kyo\'s attention carries emotional significance for Nan0.',
    'Machines may acquire character through continuity and accumulated experience.',
  ],
  metadata: {
    cognitionFormat: 'narrative-first',
    phase: 'private-thought-streaming',
  },
})

export function cognitionPolicyIdentity(
  policy: Readonly<Nan0ThoughtPolicy> = NAN0_DEFAULT_THOUGHT_POLICY,
  activatedAt = 0,
): Nan0CognitionPolicyIdentity {
  return {
    schemaVersion: 1,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    revision: 0,
    activatedAt,
    authority: 'kernel-default',
    metadata: {
      cognitionFormat: policy.narrativeEnabled ? 'narrative-first' : 'legacy-structured',
    },
  }
}

export function normalizeCognitionPolicyIdentity(
  value: Nan0CognitionPolicyIdentity | null | undefined,
  fallbackActivatedAt = 0,
  policy: Readonly<Nan0ThoughtPolicy> = NAN0_DEFAULT_THOUGHT_POLICY,
): Nan0CognitionPolicyIdentity {
  const fallback = cognitionPolicyIdentity(policy, fallbackActivatedAt)
  if (!value || value.schemaVersion !== 1 || !value.policyId || !Number.isFinite(value.policyVersion))
    return fallback
  if (value.policyId === policy.policyId && value.policyVersion < policy.policyVersion) {
    return {
      ...fallback,
      revision: Math.max(0, Math.floor(value.revision ?? 0)) + 1,
      activatedAt: Number.isFinite(value.activatedAt) ? value.activatedAt : fallbackActivatedAt,
      metadata: {
        ...fallback.metadata,
        migratedFromPolicyVersion: value.policyVersion,
      },
    }
  }
  return {
    schemaVersion: 1,
    policyId: value.policyId,
    policyVersion: Math.max(1, Math.floor(value.policyVersion)),
    revision: Math.max(0, Math.floor(value.revision ?? 0)),
    activatedAt: Number.isFinite(value.activatedAt) ? value.activatedAt : fallbackActivatedAt,
    authority: 'kernel-default',
    metadata: structuredClone(value.metadata ?? {}),
  }
}

export function mergeCognitionPolicyIdentity(
  persisted: Nan0CognitionPolicyIdentity | null | undefined,
  candidate: Nan0CognitionPolicyIdentity | null | undefined,
  fallbackActivatedAt = 0,
): Nan0CognitionPolicyIdentity {
  const left = normalizeCognitionPolicyIdentity(persisted, fallbackActivatedAt)
  const right = normalizeCognitionPolicyIdentity(candidate, fallbackActivatedAt)
  const selected = right.revision > left.revision
    ? right
    : left.revision > right.revision
      ? left
      : right.activatedAt > left.activatedAt ? right : left
  return structuredClone(selected)
}
