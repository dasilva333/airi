import type {
  Nan0ConversationTurn,
  Nan0EntityLedgerAdapter,
  Nan0EpistemicFact,
  Nan0EpistemicGroundingContext,
  Nan0Observation,
  Nan0PreparedTurn,
  Nan0PrepareTurnOptions,
  Nan0ReasoningClient,
  Nan0ReasoningRequest,
  Nan0SystemOneProvider,
} from '@proj-airi/nan0-runtime'

import type { CoreMood, MoodState } from '../../types/mood'

import {
  deriveMood,
  InMemoryStateStore,
  LocalStorageStateStore,
  Nan0Kernel,
  Nan0SubconsciousShadowEngine,
  SystemNan0Clock,
} from '@proj-airi/nan0-runtime'
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { useBroadcastChannel } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { useEntityLedgerStore } from '../entity-ledger'
import { useLLM } from '../llm'
import { useTextJournalStore } from '../memory-text-journal'
import { useProvidersStore } from '../providers'
import { useSystemOneStore } from './system-one'

export function isMainWindow(): boolean {
  if (typeof window === 'undefined')
    return true
  if (!isStageTamagotchi())
    return true
  const hash = window.location.hash || ''
  return hash === '' || hash === '#/' || hash === '#' || hash === '#!/'
}

export interface Nan0ReflexInfo {
  group: string
  label: string
  confidence: number
  cluster: 'conflict' | 'relational' | 'system'
  icon: string
}

export interface Nan0StateSyncMessage {
  emotions: Record<string, number>
  lastReflex: Nan0ReflexInfo | null
  decision: 'SPEAK' | 'SILENCE' | 'WAIT'
  decisionReason: string
  innerMonologue: string
  isProcessing: boolean
}

export const NAN0_DEFAULT_EMOTIONS: Readonly<Record<string, number>> = {
  suspicion: 0.35,
  attachment: 0.8,
  pride: 0.65,
  smugness: 0.25,
  irritation: 0.15,
  rage: 0.05,
  curiosity: 0.55,
  amusement: 0.3,
  possessiveness: 0.4,
  warmth: 0.1,
  boredom: 0.2,
  fear: 0.15,
}

const REFLEX_META: Record<string, { label: string, cluster: 'conflict' | 'relational' | 'system', icon: string }> = {
  apology_repair: { label: 'Apology & Repair', cluster: 'conflict', icon: 'i-solar:hand-heart-bold-duotone' },
  affection_care: { label: 'Affection & Care', cluster: 'relational', icon: 'i-solar:heart-bold-duotone' },
  boundary_protection: { label: 'Boundary Protection', cluster: 'conflict', icon: 'i-solar:shield-bold-duotone' },
  hostility_insult: { label: 'Hostility & Insult', cluster: 'conflict', icon: 'i-solar:danger-triangle-bold-duotone' },
  dismissal_neglect: { label: 'Dismissal & Neglect', cluster: 'conflict', icon: 'i-solar:close-circle-bold-duotone' },
  persistence_threat: { label: 'Persistence & Threat', cluster: 'conflict', icon: 'i-solar:alarm-bold-duotone' },
  admitted_false_statement: { label: 'Admitted Falsehood', cluster: 'system', icon: 'i-solar:info-circle-bold-duotone' },
  commitment_pledge: { label: 'Commitment & Pledge', cluster: 'relational', icon: 'i-solar:medal-star-bold-duotone' },
  completed_repair: { label: 'Completed Repair', cluster: 'relational', icon: 'i-solar:check-circle-bold-duotone' },
  mystery_secret: { label: 'Mystery & Secret', cluster: 'relational', icon: 'i-solar:eye-closed-bold-duotone' },
  glitch_system: { label: 'System Anomaly', cluster: 'system', icon: 'i-solar:bug-bold-duotone' },
  roast_invitation: { label: 'Roast Invitation', cluster: 'conflict', icon: 'i-solar:flame-bold-duotone' },
}

export interface Nan0KernelConfig {
  providerId: string
  modelId: string
  headers?: Record<string, string>
}

export const useNan0Store = defineStore('nan0-cognition', () => {
  // 12 Canonical Emotional Dimensions
  const emotions = ref<Record<string, number>>({ ...NAN0_DEFAULT_EMOTIONS })

  // Last Reflex Trigger
  const lastReflex = ref<Nan0ReflexInfo | null>({
    group: 'apology_repair',
    label: 'Apology & Repair',
    confidence: 0.98,
    cluster: 'conflict',
    icon: 'i-solar:hand-heart-bold-duotone',
  })

  // Executive Decision State
  const decision = ref<'SPEAK' | 'SILENCE' | 'WAIT'>('SPEAK')
  const decisionReason = ref<string>('Balanced Affect')

  // Inner Monologue
  const innerMonologue = ref<string>(
    'User expressed an apology. Suspicion reduced slightly, but pride demands maintaining a guarded posture.',
  )

  // 1st-Hop Execution State
  const isProcessing = ref<boolean>(false)

  // Computed Helpers
  const demandsSilence = computed(() => decision.value === 'SILENCE')
  const isPouting = computed(() => demandsSilence.value && (emotions.value.pride ?? 0) >= 0.7)

  // AIRI Avatar MoodState Synchrony (Pass 11 & Domain 5)
  const derivedAiriMood = computed<MoodState>(() => {
    const profile = deriveMood(emotions.value)
    let current: CoreMood = 'neutral'
    let intensity = 0.5
    switch (profile.primary) {
      case 'gremlin-rage':
        current = 'angry'
        intensity = 0.9
        break
      case 'fearful-defensive':
        current = 'sad'
        intensity = 0.7
        break
      case 'suspicious-bored':
        current = 'thinking'
        intensity = 0.5
        break
      case 'possessive-warm':
        current = 'happy'
        intensity = 0.6
        break
      case 'curious-smug':
      case 'machine-proud':
        current = 'cool'
        intensity = 0.65
        break
      case 'irritable-curious':
        current = 'thinking'
        intensity = 0.5
        break
      case 'attached-wary':
        current = 'relaxed'
        intensity = 0.4
        break
      default:
        current = 'neutral'
        intensity = 0.2
        break
    }
    return {
      current,
      intensity,
      valence: profile.valence,
      arousal: profile.arousal,
      lastUpdate: Date.now(),
    }
  })

  // Cross-window BroadcastChannel synchronization
  const isLeader = isMainWindow()
  const { post: broadcastState, data: incomingState } = useBroadcastChannel<Nan0StateSyncMessage, Nan0StateSyncMessage>({
    name: 'airi:nan0:state-sync',
  })

  // In secondary windows, listen for synchronized Nan0 state from the main stage window
  if (typeof window !== 'undefined' && !isLeader) {
    watch(incomingState, (msg) => {
      if (!msg)
        return
      if (msg.emotions)
        emotions.value = msg.emotions
      if (msg.lastReflex !== undefined)
        lastReflex.value = msg.lastReflex
      if (msg.decision)
        decision.value = msg.decision
      if (msg.decisionReason !== undefined)
        decisionReason.value = msg.decisionReason
      if (msg.innerMonologue !== undefined)
        innerMonologue.value = msg.innerMonologue
      if (msg.isProcessing !== undefined)
        isProcessing.value = msg.isProcessing
    }, { immediate: true })
  }

  function broadcastCurrentState() {
    if (isLeader && typeof window !== 'undefined') {
      broadcastState({
        emotions: emotions.value,
        lastReflex: lastReflex.value,
        decision: decision.value,
        decisionReason: decisionReason.value,
        innerMonologue: innerMonologue.value,
        isProcessing: isProcessing.value,
      })
    }
  }

  // Nan0Kernel & Shadow Engine references
  const kernel = shallowRef<Nan0Kernel | null>(null)
  const shadowEngine = shallowRef<Nan0SubconsciousShadowEngine | null>(null)
  const activeCardId = ref<string | null>(null)

  function updateEmotion(dimension: string, value: number) {
    emotions.value[dimension] = Math.min(1, Math.max(0, value))
    broadcastCurrentState()
  }

  function setEmotions(newEmotions: Record<string, number>) {
    emotions.value = {
      ...emotions.value,
      ...newEmotions,
    }
    broadcastCurrentState()
  }

  function setReflex(reflex: Nan0ReflexInfo | null) {
    lastReflex.value = reflex
    broadcastCurrentState()
  }

  function setExecutiveState(newDecision: 'SPEAK' | 'SILENCE' | 'WAIT', reason = '') {
    decision.value = newDecision
    if (reason)
      decisionReason.value = reason
    broadcastCurrentState()
  }

  function setInnerMonologue(text: string) {
    innerMonologue.value = text
    broadcastCurrentState()
  }

  function setProcessing(processing: boolean) {
    isProcessing.value = processing
    broadcastCurrentState()
  }

  function resetToBaseline() {
    emotions.value = { ...NAN0_DEFAULT_EMOTIONS }
    decision.value = 'SPEAK'
    decisionReason.value = 'Baseline Reset'
    broadcastCurrentState()
  }

  function applyDreamMoodRestoration(dreamMood: string) {
    const mood = dreamMood.toLowerCase().trim()
    const impact: Record<string, number> = {}
    if (mood.includes('tender') || mood.includes('warm') || mood.includes('fond')) {
      impact.warmth = 0.15
      impact.attachment = 0.1
      impact.suspicion = -0.1
    }
    else if (mood.includes('amused') || mood.includes('playful') || mood.includes('giggle')) {
      impact.amusement = 0.2
      impact.smugness = 0.1
      impact.irritation = -0.1
    }
    else if (mood.includes('wistful') || mood.includes('melancholy') || mood.includes('pensive')) {
      impact.attachment = 0.1
      impact.boredom = 0.05
      impact.pride = -0.05
    }
    else if (mood.includes('flustered') || mood.includes('shy') || mood.includes('blush')) {
      impact.irritation = 0.1
      impact.warmth = 0.15
      impact.pride = -0.1
    }
    else {
      // Reflective / calm afterglow: gently reduce high negative spikes
      impact.rage = -0.05
      impact.irritation = -0.05
    }

    for (const [dim, delta] of Object.entries(impact)) {
      updateEmotion(dim, (emotions.value[dim] ?? 0.5) + delta)
    }

    if (kernel.value) {
      kernel.value.applyEmotionalImpact(impact, `dream-afterglow:${dreamMood}`, 'dreaming')
    }
  }

  function setKernel(customKernel: Nan0Kernel | null, cardId?: string) {
    kernel.value = customKernel
    if (cardId) {
      activeCardId.value = cardId
    }
    if (customKernel) {
      const snap = customKernel.getStateSnapshot()
      if (snap.emotionalState) {
        setEmotions(snap.emotionalState)
      }
    }
  }

  function getKernel(): Nan0Kernel | null {
    return kernel.value
  }

  async function ensureKernel(cardId?: string, config?: Nan0KernelConfig): Promise<Nan0Kernel> {
    if (!isMainWindow()) {
      console.warn('[Nan0Store] Secondary renderer window detected. Nan0Kernel orchestration is restricted to the main stage window.')
      return kernel.value as any
    }

    const targetCardId = cardId || activeCardId.value || 'default'
    if (kernel.value && (activeCardId.value === targetCardId || !cardId) && kernel.value.isBooted) {
      return kernel.value
    }

    activeCardId.value = targetCardId

    const stateStore = typeof globalThis.localStorage !== 'undefined'
      ? new LocalStorageStateStore(`nan0/kernel-state/${targetCardId}`)
      : new InMemoryStateStore()

    const reasoningClient: Nan0ReasoningClient = {
      generate: async (request: Nan0ReasoningRequest) => {
        const llmStore = useLLM()
        const providersStore = useProvidersStore()
        const pId = config?.providerId || 'openrouter'
        const mId = config?.modelId || 'auto'
        const provider = await providersStore.getProviderInstance(pId)
        const providerCfg = providersStore.getProviderConfig(pId)
        const headers = {
          ...(providerCfg?.headers as Record<string, string> | undefined),
          ...config?.headers,
        }

        const res = await llmStore.generate(
          mId,
          provider as any,
          [
            { role: 'system', content: request.system },
            ...request.messages.map(m => ({ role: m.role as any, content: m.content })),
          ],
          {
            headers,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens,
            abortSignal: request.signal,
          },
        )
        return {
          text: res.text || '',
          finishReason: res.finishReason,
        }
      },
    }

    const systemOneStore = useSystemOneStore()
    const systemOneProvider: Nan0SystemOneProvider = async (state, questions, model) => {
      const stateStr = typeof state === 'string' ? state : JSON.stringify(state)
      const res = await systemOneStore.execute(stateStr, questions, model)
      const normalizedAnswers: Record<string, { choice: string, confidence?: number, probabilities?: Record<string, number> }> = {}
      for (const [k, ans] of Object.entries(res.answers || {})) {
        normalizedAnswers[k] = {
          choice: ans.choice || '',
          confidence: ans.confidence,
          probabilities: ans.probabilities,
        }
      }
      return {
        answers: normalizedAnswers,
        model: systemOneStore.activeModel || model,
        latencyMs: systemOneStore.lastLatencyMs || undefined,
      }
    }

    const entityLedgerStore = useEntityLedgerStore()
    const entityLedger: Nan0EntityLedgerAdapter = {
      getOrCreateEntity: (label, type, attrs) => entityLedgerStore.activeLedger.getOrCreateEntity(label, type as any, attrs),
      applyPCLClaim: claim => entityLedgerStore.activeLedger.applyPCLClaim(claim as any),
      queryClaims: (subject, predicate, currentOnly) => entityLedgerStore.activeLedger.queryClaims(subject, predicate, currentOnly),
    }

    const textJournalStore = useTextJournalStore()
    const memoryRetriever = async (query: string, _actorId?: string, limit?: number): Promise<Nan0EpistemicGroundingContext | null> => {
      try {
        const searchPromise = textJournalStore.searchEntries({
          query,
          limit: limit ?? 5,
          characterId: targetCardId,
        })
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Memory retrieval timed out (3000ms)')), 3000),
        )
        const results = await Promise.race([searchPromise, timeoutPromise])
        const facts: Nan0EpistemicFact[] = results.map(res => ({
          source: (res as any).isKgClaim ? 'entity_ledger' : (res as any).kind === 'stmm_summary' ? 'stmm' : 'journal',
          title: res.title,
          content: res.content,
          relevance: res.score,
          subject: (res as any).subject,
          predicate: (res as any).predicate,
          object: (res as any).object,
          date: res.createdAt ? new Date(res.createdAt).toISOString() : undefined,
        }))
        return { facts }
      }
      catch (err) {
        console.warn('[Nan0Store] Epistemic memory retrieval failed or timed out:', err)
        return null
      }
    }

    const instance = new Nan0Kernel({
      stateStore,
      reasoningClient,
      systemOneProvider,
      entityLedger,
      memoryRetriever,
      jevModel: systemOneStore.activeModel || undefined,
      clock: new SystemNan0Clock(),
      decisionCapabilities: {
        canSpeak: true,
        canBodyExpress: true,
        availableActionIntents: ['expression.body', 'memory.revisit', 'intention.form'],
      },
      identityOptions: {
        ownerId: 'kyo',
        ownerDisplayName: 'User',
      },
    })

    await instance.boot()
    kernel.value = instance

    // Sync loaded state to UI
    const snapshot = instance.getStateSnapshot()
    if (snapshot.emotionalState) {
      setEmotions(snapshot.emotionalState)
    }

    // Initialize shadow engine for reflex observation
    shadowEngine.value = new Nan0SubconsciousShadowEngine({
      systemOneProvider,
      jevModel: systemOneStore.activeModel || undefined,
      telemetrySink: (record) => {
        const proposal = record.outcomes?.needleProposal || record.outcomes?.lexicalProposal
        const group = proposal?.evidence?.[0]?.group
        if (group && group !== 'none') {
          const meta = REFLEX_META[group] ?? {
            label: group,
            cluster: 'relational',
            icon: 'i-solar:target-bold-duotone',
          }
          setReflex({
            group,
            label: meta.label,
            confidence: proposal.status === 'accepted' ? 0.95 : 0.8,
            cluster: meta.cluster,
            icon: meta.icon,
          })
        }
      },
    })

    return instance
  }

  async function prepareTurn(
    observation: Nan0Observation,
    options?: Nan0PrepareTurnOptions,
    kernelConfig?: Nan0KernelConfig,
  ): Promise<Nan0PreparedTurn> {
    if (!isMainWindow()) {
      throw new Error('[Nan0Store] prepareTurn must be orchestrated from the main stage window.')
    }

    setProcessing(true)
    try {
      const cardId = observation.metadata?.cardId as string | undefined
      const k = await ensureKernel(cardId, kernelConfig)

      // Dispatch non-blocking telemetry to shadow engine
      if (shadowEngine.value) {
        shadowEngine.value.dispatch({
          sessionId: observation.sessionId || 'default',
          cardId: cardId || 'default',
          turnId: `turn_${Date.now()}`,
          turnSeq: 1,
          epoch: 1,
          text: typeof observation.content === 'string' ? observation.content : JSON.stringify(observation.content),
          timestamp: observation.timestamp || Date.now(),
        })
      }

      // Connect Consumer 4 Dreaming emotional afterglow to Nan0 morning restoration deltas
      const dreamMood = observation.metadata?.pendingDreamMood as string | undefined
      if (dreamMood && typeof dreamMood === 'string' && dreamMood.trim()) {
        applyDreamMoodRestoration(dreamMood)
      }

      const prepared = await k.prepareTurn(observation, options)

      // Synchronize reactive state for UI
      setInnerMonologue(prepared.thought.narrative || prepared.thought.privateText || prepared.thought.interpretation || '')

      const snapshot = k.getStateSnapshot()
      if (snapshot.emotionalState) {
        setEmotions(snapshot.emotionalState)
      }

      const finalDecision = prepared.decision.finalDecision
      const allowed = prepared.decision.allowed
      const reason = prepared.decision.suppressionReason
        || (prepared.decision.reasonCodes.length > 0 ? prepared.decision.reasonCodes.join(', ') : 'Nan0 Decision')

      setExecutiveState(
        finalDecision === 'SPEAK' && allowed ? 'SPEAK' : finalDecision === 'SILENCE' ? 'SILENCE' : 'WAIT',
        reason,
      )

      broadcastCurrentState()

      return prepared
    }
    finally {
      setProcessing(false)
    }
  }

  async function recordAssistantTurn(input: {
    turnId: string
    thoughtId: string
    decisionId?: string
    content: string
    rawContent?: string
    timestamp?: number
    metadata?: Record<string, unknown>
  }): Promise<Nan0ConversationTurn | null> {
    if (!kernel.value)
      return null
    const res = await kernel.value.recordAssistantTurn(input)
    const snapshot = kernel.value.getStateSnapshot()
    if (snapshot.emotionalState) {
      setEmotions(snapshot.emotionalState)
    }
    broadcastCurrentState()
    return res
  }

  async function recordSilenceDecision(input: {
    turnId: string
    thoughtId: string
    decisionId?: string
    reason?: string
    timestamp?: number
    metadata?: Record<string, unknown>
  }): Promise<Nan0ConversationTurn | null> {
    if (!kernel.value)
      return null
    const res = await kernel.value.recordSilenceDecision(input)
    const snapshot = kernel.value.getStateSnapshot()
    if (snapshot.emotionalState) {
      setEmotions(snapshot.emotionalState)
    }
    broadcastCurrentState()
    return res
  }

  async function recordNonSpeechDecision(input: {
    turnId: string
    thoughtId: string
    decisionId?: string
    decision: 'ACT' | 'WAIT' | 'BODY_EXPRESSION'
    reason?: string
    timestamp?: number
    metadata?: Record<string, unknown>
  }): Promise<Nan0ConversationTurn | null> {
    if (!kernel.value)
      return null
    const res = await kernel.value.recordNonSpeechDecision(input)
    const snapshot = kernel.value.getStateSnapshot()
    if (snapshot.emotionalState) {
      setEmotions(snapshot.emotionalState)
    }
    broadcastCurrentState()
    return res
  }

  async function failTurn(input: {
    turnId: string
    thoughtId: string
    error: string
    timestamp?: number
    metadata?: Record<string, unknown>
  }): Promise<Nan0ConversationTurn | null> {
    setProcessing(false)
    if (!kernel.value)
      return null
    const res = await kernel.value.failTurn(input)
    broadcastCurrentState()
    return res
  }

  return {
    emotions,
    lastReflex,
    decision,
    decisionReason,
    innerMonologue,
    isProcessing,
    demandsSilence,
    isPouting,
    derivedAiriMood,
    updateEmotion,
    setEmotions,
    setReflex,
    setExecutiveState,
    setInnerMonologue,
    setProcessing,
    resetToBaseline,
    applyDreamMoodRestoration,
    setKernel,
    getKernel,
    ensureKernel,
    prepareTurn,
    recordAssistantTurn,
    recordSilenceDecision,
    recordNonSpeechDecision,
    failTurn,
  }
})
