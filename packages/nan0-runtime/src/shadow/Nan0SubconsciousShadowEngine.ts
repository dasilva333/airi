import type {
  Nan0EffectivePolicy,
  Nan0PolicyProposal,
  Nan0ShadowTelemetryRecord,
  Nan0SystemOneProvider,
  Nan0TurnSnapshot,
} from './Nan0ShadowTypes'

import { mapJevAnswersToProposal, NAN0_JEV_12_GROUP_QUESTIONS } from './Nan0JevSchema'
import { Nan0StrengthenedLexicalExtractor } from './Nan0StrengthenedLexicalExtractor'

export interface Nan0ShadowEngineOptions {
  maxBufferCapacity?: number
  defaultWarmDeadlineMs?: number
  ruleSetVersion?: string
  policyMappingVersion?: string
  schemaVersion?: string
  actorMappingVersion?: string
  engineRevision?: string
  backend?: 'strengthened_lexical' | 'needle_san_wasm' | 'needle_native_cpu' | 'system_one_jev'
  telemetrySink?: (record: Nan0ShadowTelemetryRecord) => void
  systemOneProvider?: Nan0SystemOneProvider
  jevModel?: string
}

export class Nan0SubconsciousShadowEngine {
  private readonly maxCapacity: number
  private readonly lexicalExtractor: Nan0StrengthenedLexicalExtractor
  private readonly telemetrySink?: (record: Nan0ShadowTelemetryRecord) => void
  private readonly systemOneProvider?: Nan0SystemOneProvider
  private readonly jevModel?: string
  private readonly buffer: Nan0ShadowTelemetryRecord[] = []

  // Per-session sequence and epoch state
  private readonly sessionSeqs = new Map<string, {
    lastSeenSeq: number
    lastDispatchedSeq: number
    lastPublishedSeq: number
    staleCount: number
    duplicateCount: number
    replacedPendingCount: number
    currentEpoch: number
  }>()

  private readonly versions: Nan0ShadowTelemetryRecord['versions']

  private activeJobs = 0
  private pendingJobs = 0
  private restarts = 0
  private droppedRecords = 0

  constructor(options: Nan0ShadowEngineOptions = {}) {
    this.maxCapacity = options.maxBufferCapacity ?? 200
    this.lexicalExtractor = new Nan0StrengthenedLexicalExtractor()
    this.telemetrySink = options.telemetrySink
    this.systemOneProvider = options.systemOneProvider
    this.jevModel = options.jevModel

    this.versions = {
      ruleSetVersion: options.ruleSetVersion ?? (options.systemOneProvider ? 'nan0.jev.v2' : 'nan0.lexical.v2'),
      policyMappingVersion: options.policyMappingVersion ?? 'nan0.policy.v2',
      schemaVersion: options.schemaVersion ?? 'nan0.pragmatics.schema.v2',
      actorMappingVersion: options.actorMappingVersion ?? 'nan0.actor.v1',
      engineRevision: options.engineRevision ?? 'cactus-needle-2.0.15',
      backend: options.backend ?? (options.systemOneProvider ? 'system_one_jev' : 'strengthened_lexical'),
    }
  }

  /**
   * Set or increment generation epoch for a session (e.g. on turn stop / session reset).
   */
  public setEpoch(sessionId: string, epoch: number): void {
    const s = this.getOrCreateSessionState(sessionId)
    s.currentEpoch = epoch
  }

  /**
   * Fire-and-forget non-actuating dispatch.
   * Completely decoupled from chat streaming; never throws, never awaits, never mutates chat state.
   */
  public dispatch(snapshot: Nan0TurnSnapshot): void {
    if (!this.systemOneProvider) {
      this.dispatchInternalSync(snapshot)
    }
    else {
      if (this.activeJobs > 0) {
        // Concurrency circuit breaker: drop overlapping async shadow dispatch to prevent inference stampedes
        this.droppedRecords++
        return
      }
      void this.dispatchAsync(snapshot).catch((err) => {
        console.error('[Nan0SubconsciousShadowEngine] error in shadow dispatch:', err)
      })
    }
  }

  /**
   * Asynchronously dispatches the turn snapshot, engaging System 1 Jev when configured
   * while recording lexical fallback telemetry and enforcing strict shadow invariants.
   */
  public async dispatchAsync(snapshot: Nan0TurnSnapshot): Promise<Nan0ShadowTelemetryRecord | null> {
    if (this.activeJobs > 0) {
      this.droppedRecords++
      return null
    }

    try {
      this.pendingJobs++
      const state = this.getOrCreateSessionState(snapshot.sessionId)

      // 1. Invalidation check: Stale or cancelled generation epoch
      if (snapshot.epoch < state.currentEpoch) {
        state.staleCount++
        this.pendingJobs--
        return null
      }

      // 2. Monotonic sequence & duplicate checking
      if (snapshot.turnSeq <= state.lastPublishedSeq) {
        state.staleCount++
        if (snapshot.turnSeq === state.lastPublishedSeq) {
          state.duplicateCount++
        }
        this.pendingJobs--
        return null
      }

      state.lastSeenSeq = Math.max(state.lastSeenSeq, snapshot.turnSeq)
      state.lastDispatchedSeq = snapshot.turnSeq

      this.activeJobs++
      this.pendingJobs--

      try {
        const queueMs = 0
        const t0 = performance.now()

        // 3. Resolve lexical proposal as baseline floor
        const { proposal: lexicalProposal, durationMs: resolutionMs } = this.lexicalExtractor.resolve(snapshot)

        // 4. Resolve System 1 Jev proposal if provider is configured
        let needleProposal: Nan0PolicyProposal | null = null
        let inferenceMs = 0
        let backend = this.versions.backend

        if (this.systemOneProvider) {
          const j0 = performance.now()
          try {
            const res = await this.systemOneProvider(snapshot.text, NAN0_JEV_12_GROUP_QUESTIONS, this.jevModel)
            inferenceMs = res.latencyMs ?? (performance.now() - j0)
            needleProposal = mapJevAnswersToProposal(res.answers, snapshot)
            backend = 'system_one_jev'
          }
          catch (err) {
            console.warn('[Nan0SubconsciousShadowEngine] System 1 Jev dispatch failed, falling back to lexical floor:', err)
            needleProposal = null
          }
        }

        const totalMs = performance.now() - t0
        const record = this.finalizeRecord(
          snapshot,
          state,
          lexicalProposal,
          needleProposal,
          backend,
          queueMs,
          resolutionMs,
          inferenceMs,
          totalMs,
        )

        return record
      }
      finally {
        this.activeJobs = Math.max(0, this.activeJobs - 1)
      }
    }
    catch (err) {
      this.pendingJobs = Math.max(0, this.pendingJobs - 1)
      console.error('[Nan0SubconsciousShadowEngine] error in shadow dispatch:', err)
      return null
    }
  }

  private dispatchInternalSync(snapshot: Nan0TurnSnapshot): Nan0ShadowTelemetryRecord | null {
    try {
      this.pendingJobs++
      const state = this.getOrCreateSessionState(snapshot.sessionId)

      // 1. Invalidation check
      if (snapshot.epoch < state.currentEpoch) {
        state.staleCount++
        this.pendingJobs--
        return null
      }

      // 2. Monotonic sequence & duplicate checking
      if (snapshot.turnSeq <= state.lastPublishedSeq) {
        state.staleCount++
        if (snapshot.turnSeq === state.lastPublishedSeq) {
          state.duplicateCount++
        }
        this.pendingJobs--
        return null
      }

      state.lastSeenSeq = Math.max(state.lastSeenSeq, snapshot.turnSeq)
      state.lastDispatchedSeq = snapshot.turnSeq

      this.activeJobs++
      this.pendingJobs--

      const queueMs = 0
      const t0 = performance.now()

      // 3. Resolve lexical proposal
      const { proposal: lexicalProposal, durationMs: resolutionMs } = this.lexicalExtractor.resolve(snapshot)
      const totalMs = performance.now() - t0

      const record = this.finalizeRecord(
        snapshot,
        state,
        lexicalProposal,
        null,
        this.versions.backend,
        queueMs,
        resolutionMs,
        0,
        totalMs,
      )

      this.activeJobs--
      return record
    }
    catch (err) {
      this.activeJobs = Math.max(0, this.activeJobs - 1)
      this.pendingJobs = Math.max(0, this.pendingJobs - 1)
      console.error('[Nan0SubconsciousShadowEngine] error in shadow dispatch:', err)
      return null
    }
  }

  private finalizeRecord(
    snapshot: Nan0TurnSnapshot,
    state: ReturnType<typeof this.getOrCreateSessionState>,
    lexicalProposal: Nan0PolicyProposal,
    needleProposal: Nan0PolicyProposal | null,
    backend: Nan0ShadowTelemetryRecord['versions']['backend'],
    queueMs: number,
    resolutionMs: number,
    inferenceMs: number,
    totalMs: number,
  ): Nan0ShadowTelemetryRecord {
    // Invariant assertion: effective_policy is strictly 0 and applyToState: false
    const effectivePolicy: Nan0EffectivePolicy = {
      status: 'abstained',
      reason: 'shadow_isolation',
      suspicionDeltaSteps: 0,
      suspicionLabel: 'neutral',
      attachmentDeltaSteps: 0,
      gremlinPrideAction: 'none',
      wouldApply: false,
      applyToState: false,
      evidence: [],
    }

    const invariantFailures: string[] = []
    if (effectivePolicy.suspicionDeltaSteps !== 0 || effectivePolicy.applyToState !== false) {
      invariantFailures.push('effective_policy_invariant_breached')
    }

    if (this.buffer.length >= this.maxCapacity) {
      this.buffer.shift()
      this.droppedRecords++
    }

    state.lastPublishedSeq = snapshot.turnSeq

    const activeProposal = needleProposal ?? lexicalProposal

    const record: Nan0ShadowTelemetryRecord = {
      identity: {
        sessionId: snapshot.sessionId,
        cardId: snapshot.cardId,
        turnId: snapshot.turnId,
        turnSeq: snapshot.turnSeq,
        epoch: snapshot.epoch,
      },
      versions: {
        ...this.versions,
        backend,
      },
      consumption: {
        lastSeenSeq: state.lastSeenSeq,
        lastDispatchedSeq: state.lastDispatchedSeq,
        lastPublishedSeq: state.lastPublishedSeq,
        staleCount: state.staleCount,
        duplicateCount: state.duplicateCount,
        replacedPendingCount: state.replacedPendingCount,
      },
      evidence: {
        ruleIds: activeProposal.evidence.map(e => e.group),
        sourceSpans: [{ text: snapshot.text.slice(0, 100), start: 0, end: Math.min(100, snapshot.text.length) }],
        scope: activeProposal.status === 'accepted' ? 'asserted' : 'unresolved',
        referent: activeProposal.evidence[0]?.referent || 'unresolved',
        reason: activeProposal.reason,
        validationReason: needleProposal ? 'system_one_jev_classified' : 'deterministic_provenance_passed',
      },
      taskLinkage: {
        expectedTaskId: snapshot.expectedTaskId ?? null,
        matchedTrustedEventId: snapshot.trustedObservations?.find(o => o.status === 'completed')?.id ?? null,
        commitmentLinkage: snapshot.trustedObservations?.some(o => o.matchesRecordedCommitment === true) ?? false,
      },
      outcomes: {
        lexicalProposal,
        needleProposal,
        status: activeProposal.status,
        effectiveVectors: {
          suspicionDelta: 0,
          attachmentDelta: 0,
          irritationDelta: 0,
          rageDelta: 0,
          fearDelta: 0,
          distrustDelta: 0,
        },
        effectiveActions: {
          gremlinPrideAction: 'none',
        },
        invariantFailures,
      },
      timing: {
        queueMs,
        inferenceMs: round3(inferenceMs),
        hostResolutionMs: round3(resolutionMs),
        totalMs: round3(totalMs),
        timeoutToWorkerExitMs: null,
        coldStartupMs: null,
      },
      resources: {
        activeJobs: this.activeJobs,
        pendingJobs: this.pendingJobs,
        restarts: this.restarts,
        bufferBytes: this.estimateBufferBytes(),
        droppedRecords: this.droppedRecords,
      },
      calibration: {
        rawConfidence: null,
        threshold: 0.1,
        calibrationId: null,
        humanAnnotation: null,
        samplingProbability: 1.0,
      },
    }

    this.pushTelemetry(record)
    return record
  }

  public getTelemetry(filter?: { sessionId?: string, limit?: number }): readonly Nan0ShadowTelemetryRecord[] {
    let result = this.buffer
    if (filter?.sessionId) {
      result = result.filter(r => r.identity.sessionId === filter.sessionId)
    }
    if (filter?.limit && filter.limit > 0) {
      result = result.slice(-filter.limit)
    }
    return result
  }

  public clearTelemetry(): void {
    this.buffer.length = 0
  }

  private pushTelemetry(record: Nan0ShadowTelemetryRecord): void {
    this.buffer.push(record)
    if (this.telemetrySink) {
      try {
        this.telemetrySink(record)
      }
      catch {
        // Sink failure containment
      }
    }
  }

  private estimateBufferBytes(): number {
    return this.buffer.length * 1024
  }

  private getOrCreateSessionState(sessionId: string) {
    let state = this.sessionSeqs.get(sessionId)
    if (!state) {
      state = {
        lastSeenSeq: 0,
        lastDispatchedSeq: 0,
        lastPublishedSeq: 0,
        staleCount: 0,
        duplicateCount: 0,
        replacedPendingCount: 0,
        currentEpoch: 0,
      }
      this.sessionSeqs.set(sessionId, state)
    }
    return state
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
