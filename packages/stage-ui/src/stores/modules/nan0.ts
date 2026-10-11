import type {
  Nan0ConversationTurn,
  Nan0Decision,
  Nan0EntityLedgerAdapter,
  Nan0EpistemicFact,
  Nan0EpistemicGroundingContext,
  Nan0KernelState,
  Nan0Observation,
  Nan0PreparedTurn,
  Nan0PrepareTurnOptions,
  Nan0ReasoningClient,
  Nan0ReasoningRequest,
  Nan0StateStore,
  Nan0SystemOneProvider,
} from '@proj-airi/nan0-runtime'

import type { CoreMood, MoodState } from '../../types/mood'

import {
  deriveMood,
  formatSystemOnePromptState,
  InMemoryStateStore,
  LocalStorageStateStore,
  Nan0Kernel,
  Nan0SubconsciousShadowEngine,
  SystemNan0Clock,
} from '@proj-airi/nan0-runtime'
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { useBroadcastChannel } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, toRaw, watch } from 'vue'

import { useEntityLedgerStore } from '../entity-ledger'
import { useLLM } from '../llm'
import { useTextJournalStore } from '../memory-text-journal'
import { useProvidersStore } from '../providers'
import { useSettingsUserProfile } from '../settings/user-profile'
import { useAiriCardStore } from './airi-card'
import { useSystemOneStore } from './system-one'

// NOTICE: Architectural Invariant - Multi-Window Single-Leader Model (Pass 11 & Domain 5)
// In AIRI Electron desktop (stage-tamagotchi), only the Main Window (Control Strip / Stage at '#/' or '')
// is the orchestrator for sensory proactivity, speech, and Nan0Kernel execution.
// Secondary windows (like the Chatbox '#/chat' or Actor Stage '#/actor') are UI display mirrors.
// They MUST NEVER instantiate Nan0Kernel or execute prepareTurn(). Doing so causes split-brain state,
// duplicate shadow engines, and competing writes to localStorage ('nan0/kernel-state/*').
// Secondary windows hydrate via hydrateFromStorage() and receive live state over BroadcastChannel('airi:nan0:state-sync').
export function isMainWindow(): boolean {
  if (typeof window === 'undefined')
    return true
  if (!isStageTamagotchi())
    return true
  const hash = window.location.hash || ''
  return hash === '' || hash === '#/' || hash === '#' || hash === '#!/'
}

// NOTICE: write-throttle decorator for the kernel state store. Nan0Kernel
// issues a full load -> merge -> JSON.stringify -> localStorage.setItem cycle
// (plus structuredClones) on every internal step, so a single chat turn fans
// out to several synchronous multi-megabyte persistence cycles that stall the
// main thread and feed compressor/swap pressure. This collapses them: at most
// one disk write per 30s / 5 buffered saves, plus an explicit flush on SPEAK
// turns (the durability point — silence/proactive turns can safely lag).
// Single-writer only (leader window owns the kernel), so skipping intermediate
// merges is safe: the next real save unions by id and the candidate wins ties.
const KERNEL_SAVE_MIN_INTERVAL_MS = 30_000
const KERNEL_SAVE_MAX_BUFFERED = 5

class ThrottledNan0StateStore implements Nan0StateStore {
  private lastSaveAt = 0
  private bufferedSaves = 0
  private pendingState: Nan0KernelState | null = null

  constructor(private readonly inner: Nan0StateStore) {}

  load(): Promise<Nan0KernelState | null> {
    return this.inner.load()
  }

  async save(state: Nan0KernelState): Promise<Nan0KernelState> {
    const now = Date.now()
    const dueByTime = now - this.lastSaveAt >= KERNEL_SAVE_MIN_INTERVAL_MS
    const dueByCount = this.bufferedSaves >= KERNEL_SAVE_MAX_BUFFERED
    if (dueByTime || dueByCount)
      return this.writeThrough(state, now)
    this.bufferedSaves++
    this.pendingState = state
    return state
  }

  /** Force the latest buffered state to disk (SPEAK turns, assistant records). */
  async flush(): Promise<void> {
    if (!this.pendingState)
      return
    const state = this.pendingState
    this.pendingState = null
    await this.writeThrough(state, Date.now())
  }

  private async writeThrough(state: Nan0KernelState, now: number): Promise<Nan0KernelState> {
    this.lastSaveAt = now
    this.bufferedSaves = 0
    this.pendingState = null
    return this.inner.save(state)
  }
}

// Retained per card so flush() reaches the wrapper after ensureKernel returns.
const throttledStores = new Map<string, ThrottledNan0StateStore>()

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
  decision: Nan0Decision
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
  const lastReflex = ref<Nan0ReflexInfo | null>(null)

  // Executive Decision State
  const decision = ref<Nan0Decision>('SPEAK')
  const decisionReason = ref<string>('Awaiting turn')

  // Inner Monologue
  const innerMonologue = ref<string>('')

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
      try {
        const cleanPayload: Nan0StateSyncMessage = JSON.parse(JSON.stringify({
          emotions: toRaw(emotions.value),
          lastReflex: toRaw(lastReflex.value),
          decision: decision.value,
          decisionReason: decisionReason.value,
          innerMonologue: innerMonologue.value,
          isProcessing: isProcessing.value,
        }))
        broadcastState(cleanPayload)
      }
      catch (err) {
        console.warn('[Nan0Store] Failed to broadcast state sync across window boundary:', err)
      }
    }
  }

  // Nan0Kernel & Shadow Engine references
  const kernel = shallowRef<Nan0Kernel | null>(null)
  const shadowEngine = shallowRef<Nan0SubconsciousShadowEngine | null>(null)
  const activeCardId = ref<string | null>(null)

  function updateEmotion(dimension: string, value: number, shouldBroadcast = true) {
    emotions.value[dimension] = Math.min(1, Math.max(0, value))
    if (shouldBroadcast)
      broadcastCurrentState()
  }

  function setEmotions(newEmotions: Record<string, number>, shouldBroadcast = true) {
    emotions.value = {
      ...emotions.value,
      ...newEmotions,
    }
    if (shouldBroadcast)
      broadcastCurrentState()
  }

  function setReflex(reflex: Nan0ReflexInfo | null, shouldBroadcast = true) {
    lastReflex.value = reflex
    if (typeof globalThis.localStorage !== 'undefined' && activeCardId.value) {
      try {
        if (reflex) {
          globalThis.localStorage.setItem(`nan0/last-reflex/${activeCardId.value}`, JSON.stringify(reflex))
        }
        else {
          globalThis.localStorage.removeItem(`nan0/last-reflex/${activeCardId.value}`)
        }
      }
      catch {}
    }
    if (shouldBroadcast)
      broadcastCurrentState()
  }

  function setExecutiveState(newDecision: Nan0Decision, reason = '', shouldBroadcast = true) {
    decision.value = newDecision
    if (reason)
      decisionReason.value = reason
    if (shouldBroadcast)
      broadcastCurrentState()
  }

  function setInnerMonologue(text: string, shouldBroadcast = true) {
    innerMonologue.value = text
    if (shouldBroadcast)
      broadcastCurrentState()
  }

  function setProcessing(processing: boolean, shouldBroadcast = true) {
    isProcessing.value = processing
    if (shouldBroadcast)
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

  function hydrateFromStorage(cardId?: string) {
    const targetCardId = cardId || activeCardId.value || 'default'
    activeCardId.value = targetCardId
    const key = `nan0/kernel-state/${targetCardId}`
    if (typeof globalThis.localStorage !== 'undefined') {
      try {
        const raw = globalThis.localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed === 'object') {
            if (parsed.emotionalState && typeof parsed.emotionalState === 'object') {
              emotions.value = { ...NAN0_DEFAULT_EMOTIONS, ...parsed.emotionalState }
            }
            const lastThought = Array.isArray(parsed.thoughts) && parsed.thoughts.length > 0
              ? parsed.thoughts[parsed.thoughts.length - 1]
              : parsed.thought
            if (lastThought?.narrative || lastThought?.privateText) {
              innerMonologue.value = lastThought.narrative || lastThought.privateText || ''
            }
            const lastDecision = Array.isArray(parsed.decisions) && parsed.decisions.length > 0
              ? parsed.decisions[parsed.decisions.length - 1]
              : parsed.decision
            if (lastDecision?.finalDecision) {
              decision.value = lastDecision.finalDecision
              decisionReason.value = lastDecision.suppressionReason
                || (lastDecision.reasonCodes?.length ? lastDecision.reasonCodes.join(', ') : 'Nan0 Decision')
            }
          }
        }

        const reflexRaw = globalThis.localStorage.getItem(`nan0/last-reflex/${targetCardId}`)
        if (reflexRaw) {
          try {
            lastReflex.value = JSON.parse(reflexRaw)
          }
          catch {}
        }
      }
      catch (e) {
        console.warn('[Nan0Store] Failed to hydrate from storage:', e)
      }
    }
  }

  // NOTICE: Secondary windows must never boot or orchestrate Nan0Kernel.
  // All kernel operations are strictly owned by the main stage window.
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

    let throttled = throttledStores.get(targetCardId)
    if (!throttled) {
      const inner = typeof globalThis.localStorage !== 'undefined'
        ? new LocalStorageStateStore(`nan0/kernel-state/${targetCardId}`)
        : new InMemoryStateStore()
      throttled = new ThrottledNan0StateStore(inner)
      throttledStores.set(targetCardId, throttled)
    }
    const stateStore = throttled

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
      if (!systemOneStore.configured) {
        throw new Error('System 1 provider is not configured')
      }
      const stateStr = typeof state === 'string'
        ? state
        : typeof (state as any)?.toPromptString === 'function'
          ? (state as any).toPromptString()
          : (state && typeof state === 'object' && 'target_turn' in state)
              ? formatSystemOnePromptState(state as any)
              : JSON.stringify(state)
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
    // NOTICE: single-flight is enforced inside searchEntries; keep Nan0's
    // default limit low (chat-tier RAG already fetched limit 6 for the same
    // user text) so concurrent internal Jev/memory calls cannot each embed +
    // rerank a wide candidate pool.
    const memoryRetriever = async (query: string, _actorId?: string, limit?: number): Promise<Nan0EpistemicGroundingContext | null> => {
      // NOTICE: abort on timeout instead of orphaning — the prior Promise.race
      // left the losing bge/Jev work running on WebGPU after the turn moved on.
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(new Error('Memory retrieval timed out (3000ms)')), 3000)
      try {
        const results = await textJournalStore.searchEntries({
          query,
          limit: Math.min(limit ?? 3, 3),
          characterId: targetCardId,
          signal: controller.signal,
        })
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
      finally {
        clearTimeout(timer)
      }
    }

    const userProfileStore = useSettingsUserProfile()
    const airiCardStore = useAiriCardStore()
    const currentCard = airiCardStore.cards.get(targetCardId) || airiCardStore.activeCard
    const cardAnchor = (currentCard as any)?.extensions?.airi?.cognition?.affect?.companionAnchorOverride?.trim()
    const globalName = userProfileStore.name?.trim()
    const effectiveOwnerName = cardAnchor || globalName || 'User'

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
        ownerId: 'owner',
        ownerDisplayName: effectiveOwnerName,
      },
    })

    await instance.boot()
    kernel.value = instance

    // Sync loaded state to UI
    const snapshot = instance.getStateSnapshot()
    if (snapshot.emotionalState) {
      setEmotions(snapshot.emotionalState)
    }
    const lastThought = snapshot.thoughts?.length ? snapshot.thoughts[snapshot.thoughts.length - 1] : undefined
    if (lastThought?.narrative || lastThought?.privateText) {
      innerMonologue.value = lastThought.narrative || lastThought.privateText || ''
    }
    const lastDecision = snapshot.decisions?.length ? snapshot.decisions[snapshot.decisions.length - 1] : undefined
    if (lastDecision?.finalDecision) {
      decision.value = lastDecision.finalDecision
      decisionReason.value = lastDecision.suppressionReason
        || (lastDecision.reasonCodes?.length ? lastDecision.reasonCodes.join(', ') : 'Nan0 Decision')
    }

    // Initialize shadow engine for reflex observation
    shadowEngine.value = new Nan0SubconsciousShadowEngine({
      systemOneProvider,
      jevModel: systemOneStore.activeModel || undefined,
      telemetrySink: (record) => {
        const proposal = record.outcomes?.needleProposal
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

  // NOTICE: prepareTurn must strictly execute within the main stage window.
  // In secondary windows (#/chat), user input is relayed over 'airi-chat-input-bridge'
  // to the main window, where performSend() executes prepareTurn() as the single leader.
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

      // Connect Consumer 4 Dreaming emotional afterglow to Nan0 morning restoration deltas
      const dreamMood = observation.metadata?.pendingDreamMood as string | undefined
      if (dreamMood && typeof dreamMood === 'string' && dreamMood.trim()) {
        applyDreamMoodRestoration(dreamMood)
      }

      const prepared = await k.prepareTurn(observation, options)

      // Synchronize reflex badge from inline System 1 / reflex decision (skip broadcast until trailing)
      if (prepared.reflexOutcome) {
        const group = prepared.reflexOutcome.group
        if (group && group !== 'none') {
          const meta = REFLEX_META[group] ?? {
            label: group,
            cluster: 'relational',
            icon: 'i-solar:target-bold-duotone',
          }
          setReflex({
            group,
            label: meta.label,
            confidence: prepared.reflexOutcome.confidence ?? (prepared.reflexOutcome.source === 'system_one_jev' ? 0.95 : 0.8),
            cluster: meta.cluster,
            icon: meta.icon,
          }, false)
        }
      }

      // Synchronize reactive state for UI (coalesced into single trailing broadcast)
      setInnerMonologue(prepared.thought.narrative || prepared.thought.privateText || prepared.thought.interpretation || '', false)

      const snapshot = k.getStateSnapshot()
      if (snapshot.emotionalState) {
        setEmotions(snapshot.emotionalState, false)
      }

      const finalDecision = prepared.decision.finalDecision
      const allowed = prepared.decision.allowed
      const reason = prepared.decision.suppressionReason
        || (prepared.decision.reasonCodes.length > 0 ? prepared.decision.reasonCodes.join(', ') : 'Nan0 Decision')

      setExecutiveState(
        finalDecision === 'SPEAK' && allowed ? 'SPEAK' : finalDecision === 'SILENCE' ? 'SILENCE' : 'WAIT',
        reason,
        false,
      )

      // Durability point: SPEAK turns always reach disk; silence/proactive
      // turns ride the write throttle (30s / 5 buffered saves).
      if (finalDecision === 'SPEAK' && allowed) {
        try {
          const targetCardId = (observation.metadata?.cardId as string | undefined) || activeCardId.value || 'default'
          await throttledStores.get(targetCardId)?.flush()
        }
        catch (err) {
          console.warn('[Nan0Store] Post-SPEAK state flush failed (throttled saves continue):', err)
        }
      }

      return prepared
    }
    finally {
      // Single trailing broadcast sync for the completed turn
      setProcessing(false, true)
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
    // Assistant turns are spoken output — always durable, bypassing the throttle.
    try {
      const targetCardId = activeCardId.value || 'default'
      await throttledStores.get(targetCardId)?.flush()
    }
    catch (err) {
      console.warn('[Nan0Store] Assistant-turn state flush failed (throttled saves continue):', err)
    }
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
    hydrateFromStorage,
    prepareTurn,
    recordAssistantTurn,
    recordSilenceDecision,
    recordNonSpeechDecision,
    failTurn,
  }
})
