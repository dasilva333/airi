import type { Card, ccv3 } from '@proj-airi/ccc'

import type { VoiceProfile } from '../providers'

import { debug } from '@proj-airi/stage-shared'
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { useLive2d } from '@proj-airi/stage-ui-live2d'
import { useSpine } from '@proj-airi/stage-ui-spine'
import { useModelStore } from '@proj-airi/stage-ui-three'
import { until, useBroadcastChannel } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore, storeToRefs } from 'pinia'
import { safeParse } from 'valibot'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  DEFAULT_ACTING_MODEL_EXPRESSION_PROMPT,
  DEFAULT_ACTING_SPEECH_EXPRESSION_PROMPT,
  DEFAULT_ACTING_SPEECH_MANNERISM_PROMPT,
  DEFAULT_ARTISTRY_WIDGET_SPAWNING_PROMPT,
  DEFAULT_HEARTBEATS_PROMPT,
  DEFAULT_POST_HISTORY_INSTRUCTIONS,
  DEFAULT_TEXT_JOURNAL_WIDGET_INSTRUCTION,
  STARTER_CHARACTERS,
} from '../../constants/prompts/character-defaults'
import { storage } from '../../database/storage'
import { AiriCardSchema } from '../../types/card.schema'
import { useAuthStore } from '../auth'
import { useBackgroundStore } from '../background'
import { useChatSessionStore } from '../chat/session-store'
import { useDatingSimStore } from '../dating-sim'
import { DisplayModelFormat, useDisplayModelsStore } from '../display-models'
import { useShortTermMemoryStore } from '../memory-short-term'
import { useSettingsStageModel } from '../settings/stage-model'
import { useConsciousnessStore } from './consciousness'
import { useSpeechStore } from './speech'

export interface HeartbeatConfig {
  enabled: boolean
  intervalMinutes: number
  prompt: string
  injectIntoPrompt: boolean
  useAsLocalGate: boolean
  contextOptions?: {
    windowHistory: boolean
    systemLoad: boolean
    usageMetrics: boolean
  }
  schedule: {
    start: string // e.g., '09:00'
    end: string // e.g., '23:00'
  }
  respectSchedule: boolean
}

export interface DreamStateConfig {
  enabled: boolean
  strictAfkGating: boolean
  journalingThreshold: 'minimal' | 'balanced' | 'lush'
  maxSessionsPerDay: number
  sessionTimeoutMinutes: number
  afkThresholdMinutes: number
  minConversationTurns: number
  lastProcessedAt?: number
  dailyRunDate?: string
  dailyRunCount?: number
  injectDreamContext?: boolean
  pendingDreamChips?: string[]
  pendingDreamTimestamp?: number
  dreamIntrusionPrompt?: string
}

export interface ShortTermMemoryConfig {
  windowSize: number
  tokenBudgetPerDay: number
}

export interface ActingConfig {
  modelExpressionPrompt: string
  speechExpressionPrompt: string
  speechMannerismPrompt: string
  idleAnimations?: string[]

}

export interface AiriOutfit {
  id: string
  name: string
  icon: string
  type: 'base' | 'overlay'
  expressions: Record<string, number>
}

export interface CharacterGenerationConfig {
  enabled: boolean
  provider?: string
  model?: string
  known?: {
    maxTokens?: number
    temperature?: number
    topP?: number
    contextWidth?: number
    reasoningFallback?: boolean
    allowedTools?: string[]
  }
  advanced?: Record<string, any>
  compaction?: {
    strategy?: string
    minKeepTurns?: number
  }
  importedPresetMeta?: {
    source?: 'sillytavern' | 'manual' | 'unknown'
    originalKeys?: string[]
    importedAt?: string
  }
}

export interface AiriExtension {
  modules: {
    consciousness: {
      provider: string // Example: "openai"
      model: string // Example: "gpt-4o"
      moduleConfigs?: Record<string, any>
    }

    speech: {
      provider: string // Example: "elevenlabs"
      model: string // Example: "eleven_multilingual_v2"
      voice_id: string // Example: "alloy"

      pitch?: number
      rate?: number
      ssml?: boolean
      language?: string
    }

    vrm?: {
      source?: 'file' | 'url'
      file?: string // Example: "vrm/model.vrm"
      url?: string // Example: "https://example.com/vrm/model.vrm"
    }

    live2d?: {
      source?: 'file' | 'url'
      file?: string // Example: "live2d/model.json"
      url?: string // Example: "https://example.com/live2d/model.json"
      activeExpressions?: Record<string, number>
      modelParameters?: Record<string, number>
      motionMappings?: Record<string, string>
      hiddenMotions?: string[]
    }

    // ID from display-models store (e.g. 'preset-live2d-1', 'display-model-<nanoid>')
    displayModelId?: string
    // ID from unified background store
    activeBackgroundId?: string | null
    // Legacy key from older local card revisions. Read-only for migration.
    selectedModelId?: string
    // Unified manifestation expressions for VRM/Live2D
    active_expressions?: Record<string, number>
  }

  imageJournal?: {
    selfie: boolean
  }

  textJournal?: {
    widgetInstruction?: string
    injectJournalContext?: boolean
    journalIntrusionPrompt?: string
  }

  artistry?: {
    provider?: string
    model?: string
    promptPrefix?: string
    widgetInstruction?: string
    spawnMode?: 'bg' | 'widget' | 'inline' | 'bg_widget'
    options?: Record<string, any>
    autonomousEnabled?: boolean
    autonomousThreshold?: number
    autonomousTarget?: 'user' | 'assistant'
    autonomousMonitorEnabled?: boolean
    autonomousMonitorDiscordEnabled?: boolean
    autonomousHistoryDepth?: number
    autonomousModelMode?: 'inherit' | 'custom'
    autonomousProvider?: string
    autonomousModel?: string
    injectArtistryContext?: boolean
    artistryIntrusionPrompt?: string
  }

  generation?: CharacterGenerationConfig

  acting?: ActingConfig

  outfits?: AiriOutfit[]

  agents: {
    [key: string]: { // example: minecraft
      prompt: string
      enabled?: boolean
    }
  }

  heartbeats?: HeartbeatConfig
  dreamState?: DreamStateConfig
  shortTermMemory?: ShortTermMemoryConfig
  groundingEnabled?: boolean
  groundingMemoryEnabled?: boolean
  groundingTopicsEnabled?: boolean
  groundingDirectorScratchpadEnabled?: boolean
  salienceGateEnabled?: boolean
  recentTopics?: Array<{ topic: string, weight: number }>
  visual_assets?: Record<string, {
    description: string
    prompt?: string
    isBase?: boolean
    artistry?: {
      provider?: string
      model?: string
      options?: Record<string, any>
    }
    manifestation?: {
      modelId?: string
      mood?: string
      backgroundId?: string
      active_expressions?: Record<string, number>
    }
    idleAnimations?: string[]
    textColor?: string
    speech?: {
      provider?: string
      model?: string
      voice_id?: string
    }
  }>
  eternal_record?: {
    relational_milestones?: string[]
    lore_bits?: string[]
  }
  proactivity_metrics?: {
    ttsCount: number
    sttCount: number
    chatCount: number
    totalTurns: number
  }
  active_concepts?: string[]
  active_state?: {
    displayModelId?: string
    activeBackgroundId?: string | null
    active_expressions?: Record<string, number>
  }
  voice_profiles?: VoiceProfile[]
}

export interface AiriCard extends Card {
  extensions: {
    airi: AiriExtension
  } & Card['extensions']
  updatedAt?: number
  createdAt?: number
}

export const useAiriCardStore = defineStore('airi-card', () => {
  const { t } = useI18n()
  const defaultSystemPrompt = t('settings.pages.card.creation.defaults.systemprompt')
  const defaultPostHistoryInstructions = t('settings.pages.card.creation.defaults.posthistoryinstructions')

  // NOTICE: airi-cards can exceed 600KB with large collections and cannot fit in localStorage
  // (QuotaExceededError). We store it in IndexedDB under local:airi-cards so the sync engine
  // can sync it as a first-class key without the localStorage dump/restore bridge.
  const cards = ref<Map<string, AiriCard>>(new Map())
  const cardsLoading = ref(true)
  const activeCardId = useLocalStorageManualReset<string>('airi-card-active-id', 'default')

  // One-time migration: move legacy localStorage airi-cards → IndexedDB, then clear the old key
  async function migrateFromLocalStorage() {
    const legacyRaw = localStorage.getItem('airi-cards')
    if (!legacyRaw)
      return
    try {
      const entries = JSON.parse(legacyRaw) as [string, AiriCard][]
      if (Array.isArray(entries) && entries.length > 0) {
        const existing = await storage.getItemRaw<[string, AiriCard][]>('local:airi-cards')
        if (!existing || !Array.isArray(existing) || existing.length === 0) {
          await storage.setItemRaw('local:airi-cards', entries)
          debug(`[AiriCard] Migrated ${entries.length} cards from localStorage → IndexedDB`)
        }
      }
    }
    catch (e) {
      console.error('[AiriCard] Migration from localStorage failed:', e)
    }
    finally {
      // Always remove the oversized localStorage key to free quota
      localStorage.removeItem('airi-cards')
    }
  }

  async function loadCards(silent = false) {
    if (!silent)
      cardsLoading.value = true
    await migrateFromLocalStorage()
    try {
      const raw = await storage.getItemRaw<[string, AiriCard][]>('local:airi-cards')
      if (raw && Array.isArray(raw)) {
        cards.value = new Map(raw)
      }
    }
    catch (e) {
      console.error('[AiriCard] Failed to load cards from IndexedDB:', e)
    }
    finally {
      if (!silent)
        cardsLoading.value = false
    }
  }

  const { data: cardsSyncSignal, post: broadcastCardsSync } = useBroadcastChannel({ name: 'airi:cards-sync' })

  watch(cardsSyncSignal, (val) => {
    if (val) {
      debug('[AiriCard] Received cards sync signal, reloading from IndexedDB...')
      void loadCards(true)
    }
  })

  async function persistCards(nextCards: Map<string, AiriCard>) {
    cards.value = nextCards
    try {
      const cleanEntries = JSON.parse(JSON.stringify(Array.from(nextCards.entries())))
      await storage.setItemRaw('local:airi-cards', cleanEntries)
      broadcastCardsSync(Date.now())
    }
    catch (e) {
      console.error('[AiriCard] Failed to persist cards to IndexedDB:', e)
    }
  }

  // Kick off loading; consumers use cards.value reactively (starts empty, fills quickly)
  void loadCards()

  // Reload cards from IndexedDB whenever the sync engine signals that local:airi-cards was
  // merged/updated during a sync cycle. Without this, the in-memory ref stays stale after sync.
  if (typeof window !== 'undefined') {
    window.addEventListener('airi:idb-key-updated', (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail
      if (detail?.key === 'local:airi-cards') {
        debug('[AiriCard] Detected sync update for local:airi-cards — reloading from IndexedDB')
        void loadCards(true)
      }
    })
  }

  const activeCard = computed(() => cards.value.get(activeCardId.value))

  const consciousnessStore = useConsciousnessStore()
  const speechStore = useSpeechStore()
  const stageModelStore = useSettingsStageModel()
  const displayModelsStore = useDisplayModelsStore()
  const live2dStore = useLive2d()
  const vrmStore = useModelStore()
  const backgroundStore = useBackgroundStore()
  const isModelSyncPrevented = useLocalStorageManualReset<boolean>('airi-card/is-model-sync-prevented', false)

  // Production Watcher: Monitor concept stack for manifestation triggers
  watch(() => activeCard.value?.extensions?.airi?.active_concepts, (next, prev) => {
    if (JSON.stringify(next) !== JSON.stringify(prev)) {
      const topConceptId = next?.[next.length - 1]
      debug(`[AiriCard] Concept Stack changed. Top concept: "${topConceptId}". Syncing manifestation overrides...`, { stack: next })
      debug('[AiriCard Store] Concept Stack Watcher triggering syncCardState')
      void syncCardState(activeCard.value, true)
    }
  }, { deep: true })

  const {
    activeProvider: activeConsciousnessProvider,
    activeModel: activeConsciousnessModel,
  } = storeToRefs(consciousnessStore)

  const {
    activeSpeechProvider,
    activeSpeechVoiceId,
    activeSpeechModel,
  } = storeToRefs(speechStore)

  function stripEmbeddedBackgroundData(extension: AiriExtension): AiriExtension {
    const modulesCopy: any = { ...extension.modules }
    delete modulesCopy.preferredBackgroundDataUrl

    return {
      ...extension,
      modules: modulesCopy,
    }
  }

  function compactCard(card: AiriCard | Card | ccv3.CharacterCardV3) {
    return newAiriCard(card)
  }

  function compactAllCardsMap(source: Map<string, AiriCard>) {
    const normalizedCards = new Map<string, AiriCard>()
    for (const [id, card] of source.entries()) {
      normalizedCards.set(id, compactCard(card))
    }
    return normalizedCards
  }

  const addCard = async (card: AiriCard | Card | ccv3.CharacterCardV3) => {
    await until(cardsLoading).toBe(false)
    const newCardId = nanoid()

    // Extract embedded background before it gets stripped
    const ext = ('data' in card ? card.data?.extensions?.airi : card.extensions?.airi) as AiriExtension | undefined
    const modules = ext?.modules as any

    if (modules && modules.preferredBackgroundDataUrl && modules.preferredBackgroundName) {
      try {
        const res = await fetch(modules.preferredBackgroundDataUrl)
        const blob = await res.blob()
        const importedBackgroundId = await backgroundStore.addBackground('journal', blob, modules.preferredBackgroundName, undefined, newCardId)
        modules.activeBackgroundId = importedBackgroundId
      }
      catch (err) {
        console.error('[AiriCard] Failed to import embedded background', err)
      }
    }

    const nextCards = new Map(cards.value)
    nextCards.set(newCardId, compactCard(card))
    await persistCards(nextCards)
    return newCardId
  }

  const removeCard = async (id: string) => {
    await until(cardsLoading).toBe(false)
    const nextCards = new Map(cards.value)
    nextCards.delete(id)
    void persistCards(nextCards)
  }

  const updateCard = async (id: string, updates: Partial<AiriCard> | Partial<Card> | Partial<ccv3.CharacterCardV3>) => {
    await until(cardsLoading).toBe(false)
    const existingCard = cards.value.get(id)
    if (!existingCard)
      return false

    // Avoid redundant writes and loops if fields are deeply equal
    let hasChanges = false
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'updatedAt')
        continue
      if (JSON.stringify((existingCard as any)[key]) !== JSON.stringify(value)) {
        hasChanges = true
        break
      }
    }
    if (!hasChanges) {
      return true
    }

    const updatedCard = {
      ...existingCard,
      ...updates,
      updatedAt: Date.now(),
    }

    const nextCards = new Map(cards.value)
    nextCards.set(id, compactCard(updatedCard))
    void persistCards(nextCards)
    return true
  }

  const toggleGrounding = async (id: string) => {
    await until(cardsLoading).toBe(false)
    const card = cards.value.get(id)
    if (!card) {
      debug('[AiriCard] toggleGrounding: card not found for id', id)
      return
    }

    const current = card.extensions?.airi?.groundingEnabled ?? false
    debug('[AiriCard] toggleGrounding:', { id, current, next: !current })
    updateCard(id, {
      extensions: {
        ...card.extensions,
        airi: {
          ...card.extensions?.airi,
          groundingEnabled: !current,
        },
      },
    } as any)

    // Verify persistence
  }

  const toggleGroundingMemory = async (id: string) => {
    await until(cardsLoading).toBe(false)
    const card = cards.value.get(id)
    if (!card) {
      debug('[AiriCard] toggleGroundingMemory: card not found for id', id)
      return
    }

    const current = card.extensions?.airi?.groundingMemoryEnabled ?? false
    debug('[AiriCard] toggleGroundingMemory:', { id, current, next: !current })
    updateCard(id, {
      extensions: {
        ...card.extensions,
        airi: {
          ...card.extensions?.airi,
          groundingMemoryEnabled: !current,
        },
      },
    } as any)
  }

  const toggleGroundingTopics = async (id: string) => {
    // Resolve store instances synchronously before any await to preserve Vue setup context
    const sessionStore = useChatSessionStore()
    const stmStore = useShortTermMemoryStore()
    const authStore = useAuthStore()

    await until(cardsLoading).toBe(false)
    const card = cards.value.get(id)
    if (!card) {
      debug('[AiriCard] toggleGroundingTopics: card not found for id', id)
      return
    }

    const current = card.extensions?.airi?.groundingTopicsEnabled ?? false
    const next = !current
    debug('[AiriCard] toggleGroundingTopics:', { id, current, next })

    // First update the state so that the engine doesn't return early due to groundingTopicsEnabled being false
    await updateCard(id, {
      extensions: {
        ...card.extensions,
        airi: {
          ...card.extensions?.airi,
          groundingTopicsEnabled: next,
        },
      },
    } as any)

    if (next && sessionStore.activeSessionId) {
      const activeSessionId = sessionStore.activeSessionId
      const meta = sessionStore.getSessionMeta(activeSessionId)
      const universeId = meta?.universeId || 'global'
      const userId = authStore.userId || 'default_user'
      const messages = sessionStore.getSessionMessages(activeSessionId)
      const stmBlocks = stmStore.getCharacterBlocks(id)

      const { updateRecentTopics } = await import('../chat/recent-topics')
      void updateRecentTopics(id, activeSessionId, userId, messages, stmBlocks, universeId).catch((err) => {
        console.error('[AiriCard] Failed to compute initial recent topics:', err)
      })
    }
  }

  const toggleGroundingDirectorScratchpad = async (id: string) => {
    await until(cardsLoading).toBe(false)
    const card = cards.value.get(id)
    if (!card) {
      debug('[AiriCard] toggleGroundingDirectorScratchpad: card not found for id', id)
      return
    }

    const current = card.extensions?.airi?.groundingDirectorScratchpadEnabled ?? false
    debug('[AiriCard] toggleGroundingDirectorScratchpad:', { id, current, next: !current })
    updateCard(id, {
      extensions: {
        ...card.extensions,
        airi: {
          ...card.extensions?.airi,
          groundingDirectorScratchpadEnabled: !current,
        },
      },
    } as any)
  }

  const toggleSalienceGate = async (id: string) => {
    await until(cardsLoading).toBe(false)
    const card = cards.value.get(id)
    if (!card) {
      debug('[AiriCard] toggleSalienceGate: card not found for id', id)
      return
    }

    const current = card.extensions?.airi?.salienceGateEnabled ?? false
    debug('[AiriCard] toggleSalienceGate:', { id, current, next: !current })
    updateCard(id, {
      extensions: {
        ...card.extensions,
        airi: {
          ...card.extensions?.airi,
          salienceGateEnabled: !current,
        },
      },
    } as any)
  }

  const setAutonomousArtistry = async (id: string, enabled: boolean) => {
    await until(cardsLoading).toBe(false)
    const card = cards.value.get(id)
    if (!card)
      return

    updateCard(id, {
      extensions: {
        ...card.extensions,
        airi: {
          ...card.extensions?.airi,
          artistry: {
            ...card.extensions?.airi?.artistry,
            autonomousEnabled: enabled,
          },
        },
      },
    } as any)
  }

  const getCard = (id: string) => {
    return cards.value.get(id)
  }

  const getCardDisplayModelId = (id: string) => {
    const card = cards.value.get(id)
    if (!card)
      return undefined
    return resolveAiriExtension(card).modules?.displayModelId
  }

  let syncCardStateSequence = 0
  async function syncCardState(card: AiriCard | undefined, force = false) {
    const seq = ++syncCardStateSequence
    if (!card)
      return

    const extension = resolveAiriExtension(card)
    if (!extension)
      return

    debug('[AiriCard Store] syncCardState executed. Force:', force, 'Resolved displayModelId:', extension.active_state?.displayModelId ?? extension.modules?.displayModelId)

    // 1. Sync Consciousness with stability guards
    const nextConsciousnessProvider = extension.modules?.consciousness?.provider
    if (nextConsciousnessProvider && activeConsciousnessProvider.value !== nextConsciousnessProvider)
      activeConsciousnessProvider.value = nextConsciousnessProvider

    const nextConsciousnessModel = extension.modules?.consciousness?.model
    if (nextConsciousnessModel && activeConsciousnessModel.value !== nextConsciousnessModel)
      activeConsciousnessModel.value = nextConsciousnessModel

    // 3. Sync Models & Parameters.
    // NOTICE: `force` no longer bypasses the speech gate or forces a re-apply of the
    // same model id. Previously the concept-stack watcher called this with force=true,
    // so ANY active_concepts change (Director:runArtistTask, parser-level actor tokens)
    // force-swapped the physical model even mid-speech, bypassing isModelSyncPrevented.
    // The physical stage model is speaker-owned: it changes only when the resolved
    // displayModelId actually differs (written explicitly by activateConcept at playback,
    // or by the Director for Base-sourced outfit swaps). Card activation never needs
    // force here because it clears isModelSyncPrevented first, so a genuinely different
    // model applies via `modelChanged`. See docs/fix-actor-stage-desync.md (v4, Leg 2a).
    if (!isModelSyncPrevented.value) {
      const newModelId = extension.active_state?.displayModelId ?? extension.modules?.displayModelId
      const modelChanged = newModelId && newModelId !== stageModelStore.stageModelSelected

      if (newModelId && modelChanged) {
        stageModelStore.stageModelSelected = newModelId
        // updateStageModel has internal stability guards for blob URL creation
        await stageModelStore.updateStageModel()
        if (seq !== syncCardStateSequence)
          return
      }
    }

    // 3.5 Sync Manifestation Expressions (Unified for VRM/Live2D/Spine). Expressions are
    // per-model variant state (ACT-setter pattern), not the physical model swap, so they
    // stay on the force path: the concept watcher may refresh them even while the model
    // itself is speech-gated.
    if (!isModelSyncPrevented.value || force) {
      const nextExpressions = extension.active_state?.active_expressions || {}
      if (JSON.stringify(live2dStore.activeExpressions) !== JSON.stringify(nextExpressions)) {
        live2dStore.activeExpressions = { ...nextExpressions }
      }
      if (JSON.stringify(vrmStore.activeExpressions) !== JSON.stringify(nextExpressions)) {
        vrmStore.activeExpressions = { ...nextExpressions }
      }

      // Sync Spine variant and skin from active expressions
      try {
        const spineStore = useSpine()
        const activeExprNames = Object.keys(nextExpressions).filter(k => nextExpressions[k] > 0)
        for (const emotionName of activeExprNames) {
          const match = emotionName.match(/^(.+?)\s*\[(.+?)\]$/)
          if (match) {
            const variant = match[1].trim()
            const skin = match[2].trim()
            spineStore.selectVariantAndSkin(variant, skin)
          }
          else if (spineStore.availableVariants.some(v => v.name === emotionName)) {
            spineStore.selectVariantAndSkin(emotionName, 'default')
          }
        }
      }
      catch (e) {
        // Spine store might not be loaded in non-stage contexts
      }

      // Surgical sync of model-local parameters if they belong to the active model.
      // Gated on the (now change-only) model block having run: when the model is
      // speech-gated we still refresh these only if they belong to the current model.
      const selectedModel = await displayModelsStore.getDisplayModel(stageModelStore.stageModelSelected)
      if (seq !== syncCardStateSequence)
        return

      const newModelId = extension.active_state?.displayModelId ?? extension.modules?.displayModelId
      const modelChanged = newModelId && newModelId !== stageModelStore.stageModelSelected
      if (selectedModel) {
        if (selectedModel.format === DisplayModelFormat.Live2dZip) {
          live2dStore.emotionMappings = selectedModel.emotionMappings || {}
          if (selectedModel.favoriteExpressions && selectedModel.favoriteExpressions.length > 0) {
            // Restore active expression presets from model's favorites
            const fav = selectedModel.favoriteExpressions[0]
            if (fav && live2dStore.availableExpressions.some(e => e.fileName === fav)) {
              live2dStore.activeExpressions[fav] = 1
            }
          }
          if (force || modelChanged) {
            live2dStore.shouldUpdateView()
          }
        }
        else if (selectedModel.format === DisplayModelFormat.VRM) {
          vrmStore.emotionMappings = selectedModel.emotionMappings || {}
          if (selectedModel.favoriteExpressions && selectedModel.favoriteExpressions.length > 0) {
            vrmStore.favoriteExpression = selectedModel.favoriteExpressions[0] || ''
          }
          if (force || modelChanged) {
            vrmStore.shouldUpdateView()
          }
        }
        else if (selectedModel.format === DisplayModelFormat.PMXZip || selectedModel.format === DisplayModelFormat.PMD || selectedModel.format === DisplayModelFormat.PMXDirectory) {
          const mmdStore = await import('@proj-airi/stage-ui-mmd/stores/mmd').then(m => m.useMmd())
          mmdStore.morphMappings = selectedModel.emotionMappings || {}
          if (force || modelChanged) {
            mmdStore.shouldUpdateView()
          }
        }
      }
    }
  }

  async function activateCard(id: string, force = false) {
    await until(cardsLoading).toBe(false)
    isModelSyncPrevented.value = false
    activeCardId.value = id
    await syncCardState(cards.value.get(id), force)
  }

  function resolveAiriExtension(card: Card | ccv3.CharacterCardV3): AiriExtension {
    // Get existing extension if available
    const existingExtension = ('data' in card
      ? card.data?.extensions?.airi
      : card.extensions?.airi) as AiriExtension

    // Create default modules config
    const defaultModules = {
      consciousness: {
        provider: '',
        model: '',
      },
      speech: {
        provider: '',
        model: '',
        voice_id: '',
      },
      displayModelId: stageModelStore.stageModelSelected,
      activeBackgroundId: 'none',
    }

    const defaultHeartbeats: HeartbeatConfig = {
      enabled: false,
      intervalMinutes: 5,
      prompt: DEFAULT_HEARTBEATS_PROMPT,
      injectIntoPrompt: true,
      useAsLocalGate: true,
      contextOptions: {
        windowHistory: true,
        systemLoad: true,
        usageMetrics: true,
      },
      schedule: {
        start: '09:00',
        end: '22:00',
      },
      respectSchedule: true,
    }

    const defaultDreamState: DreamStateConfig = {
      enabled: false,
      strictAfkGating: true,
      journalingThreshold: 'balanced',
      maxSessionsPerDay: 4,
      sessionTimeoutMinutes: 60,
      afkThresholdMinutes: 5,
      minConversationTurns: 4,
      lastProcessedAt: undefined,
      dailyRunDate: undefined,
      dailyRunCount: 0,
    }

    const defaultShortTermMemory: ShortTermMemoryConfig = {
      windowSize: 3,
      tokenBudgetPerDay: 1000,
    }

    const defaultArtistry = {
      widgetInstruction: DEFAULT_ARTISTRY_WIDGET_SPAWNING_PROMPT,
      spawnMode: 'bg' as const,
      autonomousEnabled: false,
      autonomousThreshold: 49,
      autonomousTarget: 'assistant' as const,
      autonomousMonitorEnabled: true,
      autonomousMonitorDiscordEnabled: false,
      autonomousHistoryDepth: 3,
    }

    const defaultGeneration: CharacterGenerationConfig = {
      enabled: false,
      provider: activeConsciousnessProvider.value,
      model: activeConsciousnessModel.value,
      known: {
        contextWidth: undefined,
        reasoningFallback: true,
        allowedTools: undefined,
      },
      advanced: undefined,
      importedPresetMeta: undefined,
    }

    const defaultActing: ActingConfig = {
      modelExpressionPrompt: DEFAULT_ACTING_MODEL_EXPRESSION_PROMPT,
      speechExpressionPrompt: DEFAULT_ACTING_SPEECH_EXPRESSION_PROMPT,
      speechMannerismPrompt: DEFAULT_ACTING_SPEECH_MANNERISM_PROMPT,
      idleAnimations: [],

    }

    // Return default if no extension exists
    if (!existingExtension) {
      return {
        modules: defaultModules,
        acting: defaultActing,
        agents: {},
        heartbeats: defaultHeartbeats,
        dreamState: defaultDreamState,
        shortTermMemory: defaultShortTermMemory,
        artistry: defaultArtistry,
        generation: defaultGeneration,
        groundingEnabled: false,
        groundingMemoryEnabled: false,
        groundingTopicsEnabled: false,
        recentTopics: [],
        visual_assets: {},
        active_concepts: [],
        eternal_record: { relational_milestones: [], lore_bits: [] },
        imageJournal: { selfie: false },
      }
    }

    // Merge existing extension with defaults
    const resolvedDisplayModelId = existingExtension.modules?.displayModelId
      ?? existingExtension.modules?.selectedModelId
      ?? defaultModules.displayModelId

    // Resolve legacy preferredBackgroundId to new activeBackgroundId
    const existingModulesAny = existingExtension.modules as Record<string, any> | undefined
    const resolvedActiveBackgroundId = existingModulesAny?.activeBackgroundId
      ?? existingModulesAny?.preferredBackgroundId
      ?? defaultModules.activeBackgroundId

    return {
      ...existingExtension,
      modules: {
        ...existingExtension?.modules,
        consciousness: {
          ...existingExtension?.modules?.consciousness,
          provider: existingExtension?.modules?.consciousness?.provider || defaultModules.consciousness.provider,
          model: existingExtension?.modules?.consciousness?.model || defaultModules.consciousness.model,
        },
        speech: {
          ...existingExtension?.modules?.speech,
          provider: existingExtension?.modules?.speech?.provider || defaultModules.speech.provider,
          model: existingExtension?.modules?.speech?.model || defaultModules.speech.model,
          voice_id: existingExtension?.modules?.speech?.voice_id || defaultModules.speech.voice_id,
          pitch: existingExtension?.modules?.speech?.pitch,
          rate: existingExtension?.modules?.speech?.rate,
          ssml: existingExtension?.modules?.speech?.ssml,
          language: existingExtension?.modules?.speech?.language,
        },
        vrm: existingExtension?.modules?.vrm,
        live2d: existingExtension?.modules?.live2d,
        displayModelId: resolvedDisplayModelId,
        activeBackgroundId: resolvedActiveBackgroundId,
      },
      active_state: (() => {
        const activeConcepts = (existingExtension as any)?.active_concepts || []
        const visualAssets = (existingExtension as any)?.visual_assets || {}
        const autonomousEnabled = existingExtension?.artistry?.autonomousEnabled ?? false

        let foldedBackgroundId = resolvedActiveBackgroundId
        const foldedExpressions: Record<string, number> = {}

        // Iterate bottom-to-top: last override wins
        for (const conceptId of activeConcepts) {
          const concept = visualAssets[conceptId]
          if (!concept)
            continue

          // Background: last defined wins, but ONLY when Director is OFF
          if (!autonomousEnabled && concept.manifestation?.backgroundId && concept.manifestation.backgroundId !== 'inherit') {
            foldedBackgroundId = concept.manifestation.backgroundId
          }

          // Expressions: additive/merge (if concepts support expressions)
          const exprs = (concept as any).manifestation?.active_expressions || (concept as any).manifestation?.expressions
          if (exprs) {
            Object.assign(foldedExpressions, exprs)
          }
        }

        return {
          // NOTICE: The stage model is deliberately NOT folded from the concept stack.
          // modules.displayModelId is the single source of truth, written explicitly by
          // the actor pipeline (activateConcept), manual sync, or the Director (Base-
          // sourced modelIds only). Folding the scene stack here re-derived an arbitrary
          // actor's model whenever the Director reordered concepts mid-speech.
          // See docs/fix-actor-stage-desync.md (Rail 2).
          displayModelId: resolvedDisplayModelId,
          activeBackgroundId: foldedBackgroundId,
          active_expressions: foldedExpressions,
        }
      })(),
      artistry: {
        ...existingExtension?.artistry,
        widgetInstruction: existingExtension?.artistry?.widgetInstruction ?? defaultArtistry.widgetInstruction,
        spawnMode: existingExtension?.artistry?.spawnMode ?? 'bg',
        autonomousEnabled: existingExtension?.artistry?.autonomousEnabled ?? false,
        autonomousThreshold: existingExtension?.artistry?.autonomousThreshold ?? 49,
        autonomousTarget: existingExtension?.artistry?.autonomousTarget ?? 'assistant',
        autonomousMonitorEnabled: existingExtension?.artistry?.autonomousMonitorEnabled ?? true,
        autonomousMonitorDiscordEnabled: existingExtension?.artistry?.autonomousMonitorDiscordEnabled ?? false,
        autonomousHistoryDepth: existingExtension?.artistry?.autonomousHistoryDepth ?? 3,
      },
      generation: {
        ...existingExtension?.generation,
        enabled: existingExtension?.generation?.enabled ?? defaultGeneration.enabled,
        provider: existingExtension?.generation?.provider ?? defaultGeneration.provider,
        model: existingExtension?.generation?.model ?? defaultGeneration.model,
        known: {
          ...existingExtension?.generation?.known,
          maxTokens: existingExtension?.generation?.known?.maxTokens,
          temperature: existingExtension?.generation?.known?.temperature,
          topP: existingExtension?.generation?.known?.topP,
          contextWidth: existingExtension?.generation?.known?.contextWidth ?? defaultGeneration.known?.contextWidth,
          reasoningFallback: existingExtension?.generation?.known?.reasoningFallback ?? defaultGeneration.known?.reasoningFallback,
        },
        advanced: existingExtension?.generation?.advanced,
        compaction: {
          strategy: existingExtension?.generation?.compaction?.strategy ?? 'none',
          minKeepTurns: existingExtension?.generation?.compaction?.minKeepTurns ?? 15,
        },
        importedPresetMeta: existingExtension?.generation?.importedPresetMeta,
      },
      acting: {
        ...existingExtension?.acting,
        modelExpressionPrompt: existingExtension?.acting?.modelExpressionPrompt ?? defaultActing.modelExpressionPrompt,
        speechExpressionPrompt: existingExtension?.acting?.speechExpressionPrompt ?? defaultActing.speechExpressionPrompt,
        speechMannerismPrompt: existingExtension?.acting?.speechMannerismPrompt ?? defaultActing.speechMannerismPrompt,
        idleAnimations: existingExtension?.acting?.idleAnimations ?? defaultActing.idleAnimations,
      },
      outfits: existingExtension?.outfits ?? [],
      agents: existingExtension?.agents ?? {},
      heartbeats: {
        ...existingExtension?.heartbeats,
        enabled: existingExtension?.heartbeats?.enabled ?? defaultHeartbeats.enabled,
        intervalMinutes: existingExtension?.heartbeats?.intervalMinutes ?? defaultHeartbeats.intervalMinutes,
        prompt: existingExtension?.heartbeats?.prompt ?? defaultHeartbeats.prompt,
        injectIntoPrompt: existingExtension?.heartbeats?.injectIntoPrompt ?? defaultHeartbeats.injectIntoPrompt,
        useAsLocalGate: existingExtension?.heartbeats?.useAsLocalGate ?? defaultHeartbeats.useAsLocalGate,
        contextOptions: {
          ...existingExtension?.heartbeats?.contextOptions,
          windowHistory: existingExtension?.heartbeats?.contextOptions?.windowHistory ?? defaultHeartbeats.contextOptions!.windowHistory,
          systemLoad: existingExtension?.heartbeats?.contextOptions?.systemLoad ?? defaultHeartbeats.contextOptions!.systemLoad,
          usageMetrics: existingExtension?.heartbeats?.contextOptions?.usageMetrics ?? defaultHeartbeats.contextOptions!.usageMetrics,
        },
        schedule: {
          ...existingExtension?.heartbeats?.schedule,
          start: existingExtension?.heartbeats?.schedule?.start ?? defaultHeartbeats.schedule.start,
          end: existingExtension?.heartbeats?.schedule?.end ?? defaultHeartbeats.schedule.end,
        },
        respectSchedule: existingExtension?.heartbeats?.respectSchedule ?? defaultHeartbeats.respectSchedule,
      },
      dreamState: {
        ...existingExtension?.dreamState,
        enabled: existingExtension?.dreamState?.enabled ?? defaultDreamState.enabled,
        strictAfkGating: existingExtension?.dreamState?.strictAfkGating ?? defaultDreamState.strictAfkGating,
        journalingThreshold: existingExtension?.dreamState?.journalingThreshold ?? defaultDreamState.journalingThreshold,
        maxSessionsPerDay: existingExtension?.dreamState?.maxSessionsPerDay ?? defaultDreamState.maxSessionsPerDay,
        sessionTimeoutMinutes: existingExtension?.dreamState?.sessionTimeoutMinutes ?? defaultDreamState.sessionTimeoutMinutes,
        afkThresholdMinutes: existingExtension?.dreamState?.afkThresholdMinutes ?? defaultDreamState.afkThresholdMinutes,
        minConversationTurns: existingExtension?.dreamState?.minConversationTurns ?? defaultDreamState.minConversationTurns,
        lastProcessedAt: existingExtension?.dreamState?.lastProcessedAt ?? defaultDreamState.lastProcessedAt,
        dailyRunDate: existingExtension?.dreamState?.dailyRunDate ?? defaultDreamState.dailyRunDate,
        dailyRunCount: existingExtension?.dreamState?.dailyRunCount ?? defaultDreamState.dailyRunCount,
      },
      shortTermMemory: {
        windowSize: existingExtension?.shortTermMemory?.windowSize ?? defaultShortTermMemory.windowSize,
        tokenBudgetPerDay: existingExtension?.shortTermMemory?.tokenBudgetPerDay ?? defaultShortTermMemory.tokenBudgetPerDay,
      },
      proactivity_metrics: {
        ...existingExtension?.proactivity_metrics,
        ttsCount: existingExtension?.proactivity_metrics?.ttsCount ?? 0,
        sttCount: existingExtension?.proactivity_metrics?.sttCount ?? 0,
        chatCount: existingExtension?.proactivity_metrics?.chatCount ?? 0,
        totalTurns: existingExtension?.proactivity_metrics?.totalTurns ?? 0,
      },
      visual_assets: (existingExtension as any)?.visual_assets || {},
      eternal_record: (existingExtension as any)?.eternal_record || { relational_milestones: [], lore_bits: [] },
      active_concepts: (existingExtension as any)?.active_concepts ?? [],
      groundingEnabled: existingExtension?.groundingEnabled ?? false,
      groundingMemoryEnabled: existingExtension?.groundingMemoryEnabled ?? false,
      groundingTopicsEnabled: existingExtension?.groundingTopicsEnabled ?? false,
      recentTopics: existingExtension?.recentTopics ?? [],
      imageJournal: (existingExtension as any)?.imageJournal || { selfie: false },
    }
  }

  function newAiriCard(card: Card | ccv3.CharacterCardV3): AiriCard {
    const validation = safeParse(AiriCardSchema, card)
    if (!validation.success) {
      debug('[AiriCard] Validation issues found during normalization:', validation.issues)
    }

    const normalizeVersion = (version?: string | null) => {
      const normalized = version?.trim()
      return normalized || '1.0.0'
    }
    const normalizeRequiredText = (value: string | null | undefined, fallback: string) => {
      const normalized = value?.trim()
      return normalized || fallback
    }

    // Branch: Character Card V3 (standard format)
    if ('data' in card) {
      const ccv3Card = card as ccv3.CharacterCardV3
      return {
        name: ccv3Card.data.name || '',
        nickname: (ccv3Card.data as any).nickname || '',
        version: normalizeVersion(ccv3Card.data.character_version),
        description: ccv3Card.data.description ?? '',
        creator: ccv3Card.data.creator ?? '',
        notes: ccv3Card.data.creator_notes ?? '',
        notesMultilingual: ccv3Card.data.creator_notes_multilingual,
        personality: ccv3Card.data.personality ?? '',
        scenario: ccv3Card.data.scenario ?? '',
        greetings: [
          ccv3Card.data.first_mes,
          ...(ccv3Card.data.alternate_greetings ?? []),
        ].filter(Boolean),
        greetingsGroupOnly: ccv3Card.data.group_only_greetings ?? [],
        systemPrompt: normalizeRequiredText(ccv3Card.data.system_prompt, defaultSystemPrompt),
        postHistoryInstructions: normalizeRequiredText(ccv3Card.data.post_history_instructions, defaultPostHistoryInstructions),
        messageExample: ccv3Card.data.mes_example
          ? ccv3Card.data.mes_example
              .split('<START>\n')
              .filter(Boolean)
              .map(example => example.split('\n')
                .map((line) => {
                  if (line.startsWith('{{char}}:') || line.startsWith('{{user}}:'))
                    return line as `{{char}}: ${string}` | `{{user}}: ${string}`
                  throw new Error(`Invalid message example format: ${line}`)
                }))
          : [],
        tags: ccv3Card.data.tags ?? [],
        extensions: {
          ...ccv3Card.data.extensions,
          airi: stripEmbeddedBackgroundData(resolveAiriExtension(ccv3Card)),
        },
        updatedAt: (ccv3Card as any).updatedAt || (ccv3Card.data as any).updatedAt,
        createdAt: (ccv3Card as any).createdAt || (ccv3Card.data as any).createdAt,
      }
    }

    // Branch: Native AiriCard / Legacy Card (spread with overrides)
    const cardData = card as any
    return {
      name: cardData.name || '',
      nickname: cardData.nickname || '',
      version: normalizeVersion(cardData.version),
      description: cardData.description || '',
      personality: cardData.personality || '',
      scenario: cardData.scenario || '',
      greetings: cardData.greetings || [],
      messageExample: cardData.messageExample || [],
      systemPrompt: normalizeRequiredText(cardData.systemPrompt, defaultSystemPrompt),
      postHistoryInstructions: normalizeRequiredText(cardData.postHistoryInstructions, defaultPostHistoryInstructions),
      ...cardData, // Spread remaining properties (tags, etc.)
      extensions: {
        ...cardData.extensions,
        airi: stripEmbeddedBackgroundData(resolveAiriExtension(card)),
      },
    }
  }

  async function initialize() {
    await until(cardsLoading).toBe(false)
    // Compact and normalize all cards on startup and persist any changes back to IndexedDB
    const compacted = compactAllCardsMap(cards.value)
    const nextCards = new Map(compacted)
    let changed = false

    const seededStarters = Object.values(STARTER_CHARACTERS).filter(c => c.isSeeded)
    const USER_TOKEN_REGEX = /(?<!\{)\{user\}(?!\})/g

    for (const starter of seededStarters) {
      if (!nextCards.has(starter.id)) {
        nextCards.set(starter.id, compactCard({
          name: starter.name,
          creator: starter.id === 'default' ? undefined : 'AIRI',
          version: '1.0.0',
          description: starter.description,
          personality: starter.personality,
          scenario: starter.scenario.replace(USER_TOKEN_REGEX, 'Richard'),
          systemPrompt: starter.systemPrompt.replace(USER_TOKEN_REGEX, 'Richard'),
          postHistoryInstructions: DEFAULT_POST_HISTORY_INSTRUCTIONS,
          greetings: starter.greetings.map(g => g.replace(USER_TOKEN_REGEX, 'Richard')),
          messageExample: (starter.messageExample || []).map(([u, c]) => [
            u.replace(USER_TOKEN_REGEX, 'Richard'),
            c.replace(USER_TOKEN_REGEX, 'Richard'),
          ]),
          extensions: {
            airi: {
              modules: {
                displayModelId: starter.defaultDisplayModelId || '',
              },
              acting: {
                modelExpressionPrompt: DEFAULT_ACTING_MODEL_EXPRESSION_PROMPT,
                speechExpressionPrompt: DEFAULT_ACTING_SPEECH_EXPRESSION_PROMPT,
                speechMannerismPrompt: DEFAULT_ACTING_SPEECH_MANNERISM_PROMPT,
              },
              artistry: {
                promptPrefix: starter.artistryPromptPrefix || '',
                widgetInstruction: DEFAULT_ARTISTRY_WIDGET_SPAWNING_PROMPT,
              },
              heartbeats: {
                enabled: false,
                intervalMinutes: 30,
                prompt: DEFAULT_HEARTBEATS_PROMPT,
                injectIntoPrompt: true,
                useAsLocalGate: true,
                respectSchedule: true,
              },
            },
          },
        } as any))
        changed = true
      }
    }

    if (changed) {
      await persistCards(nextCards)
    }
    else {
      // Still update in-memory ref if compaction changed anything
      cards.value = compacted
    }

    if (!activeCardId.value)
      activeCardId.value = 'default'
  }

  async function seedDefaults(selectedId: string) {
    await until(cardsLoading).toBe(false)
    await initialize()

    if (selectedId && cards.value.has(selectedId)) {
      await activateCard(selectedId, true)
    }
    else {
      await activateCard('default', true)
    }
  }

  watch(activeCard, async (newCard: AiriCard | undefined) => {
    debug('[AiriCard Store] activeCard watcher triggered. Card Name:', newCard?.name, 'Active Concepts:', newCard?.extensions?.airi?.active_concepts)
    await syncCardState(newCard)
  })

  function resetState() {
    activeCardId.reset()
    // Reload cards from IndexedDB (cards is no longer a ManualResetRefReturn)
    void loadCards()
    isModelSyncPrevented.reset()
  }

  return {
    cards,
    activeCard,
    activeCardId,
    activateCard,
    addCard,
    removeCard,
    updateCard,
    getCard,
    toggleGrounding,
    toggleGroundingMemory,
    toggleGroundingTopics,
    toggleGroundingDirectorScratchpad,
    toggleSalienceGate,
    setAutonomousArtistry,
    getCardDisplayModelId,
    resetState,
    initialize,
    seedDefaults,
    isModelSyncPrevented,
    syncCardState,

    updateCardOutfits: (id: string, outfits: AiriOutfit[]) => {
      const card = cards.value.get(id)
      if (!card)
        return false

      return updateCard(id, {
        extensions: {
          ...card.extensions,
          airi: {
            ...card.extensions?.airi,
            outfits,
          },
        },
      } as any)
    },

    applyOutfit: async (outfitId: string) => {
      if (!activeCard.value)
        return

      const extension = resolveAiriExtension(activeCard.value)
      const outfit = extension.outfits?.find(o => o.id === outfitId)
      if (!outfit)
        return

      const nextExpressions = { ...vrmStore.activeExpressions }

      // Logic: If it's an overlay, check if it's already active to support toggling OFF
      if (outfit.type === 'overlay') {
        const isCurrentlyActive = Object.entries(outfit.expressions).every(([name, weight]) => {
          return Math.abs((nextExpressions[name] || 0) - weight) < 0.05
        })

        if (isCurrentlyActive) {
          // Toggle OFF: Zero out the expressions belonging to this overlay
          for (const name of Object.keys(outfit.expressions)) {
            nextExpressions[name] = 0
          }
          vrmStore.activeExpressions = nextExpressions
          vrmStore.shouldUpdateView('outfit-toggled-off')
          return
        }
      }

      // Logic: If Base, zero out other Base outfits' expressions
      if (outfit.type === 'base') {
        const otherBaseOutfits = (extension.outfits || []).filter(o => o.type === 'base' && o.id !== outfitId)
        for (const other of otherBaseOutfits) {
          for (const expr of Object.keys(other.expressions)) {
            nextExpressions[expr] = 0
          }
        }
      }

      // Apply new outfit weights
      for (const [name, weight] of Object.entries(outfit.expressions)) {
        nextExpressions[name] = weight
      }

      vrmStore.activeExpressions = nextExpressions
      vrmStore.shouldUpdateView('outfit-applied')
    },

    currentModels: computed<AiriExtension['modules']>(() => {
      return {
        consciousness: {
          provider: activeConsciousnessProvider.value,
          model: activeConsciousnessModel.value,
        },
        speech: {
          provider: activeSpeechProvider.value,
          model: activeSpeechModel.value,
          voice_id: activeSpeechVoiceId.value,
        },
        displayModelId: stageModelStore.stageModelSelected,
      }
    }),
    systemPrompt: computed(() => buildSystemPrompt(activeCard.value)),
  }
})

export function buildSystemPrompt(card: AiriCard | undefined) {
  if (!card)
    return ''

  let isDatingSimActive = false
  let story: any = null
  let premise = ''

  try {
    const datingSimStore = useDatingSimStore()
    if (datingSimStore.enabled && datingSimStore.activeStoryline) {
      isDatingSimActive = true
      story = datingSimStore.activeStoryline
      premise = datingSimStore.customPremise || story.premise || ''
    }
  }
  catch (e) {
    // Ignore store initialization exceptions outside of Pinia
  }

  const components = [
    card.systemPrompt,
    card.nickname ? `Nickname: ${card.nickname}` : '',
    card.description,
    card.personality,
    isDatingSimActive ? '' : card.scenario,
    card.greetings && card.greetings.length > 0
      ? `Greetings / Dialog Starters:\n${card.greetings.map(g => `- ${g}`).join('\n')}`
      : '',
  ].filter(Boolean)

  const acting = card.extensions?.airi?.acting
  if (acting) {
    if (acting.modelExpressionPrompt && acting.modelExpressionPrompt.trim() !== '') {
      components.push(acting.modelExpressionPrompt)
    }
    if (acting.speechExpressionPrompt && acting.speechExpressionPrompt.trim() !== '') {
      components.push(acting.speechExpressionPrompt)
    }
    if (acting.speechMannerismPrompt && acting.speechMannerismPrompt.trim() !== '') {
      components.push(acting.speechMannerismPrompt)
    }
  }

  const artistry = card.extensions?.airi?.artistry
  const generation = card.extensions?.airi?.generation
  const isImageJournalAllowed = !generation?.known?.allowedTools || generation.known.allowedTools.includes('image_journal')

  if (isImageJournalAllowed && artistry?.provider && artistry.provider !== 'none' && artistry.widgetInstruction && !artistry.autonomousEnabled) {
    if (artistry.widgetInstruction && artistry.widgetInstruction.trim() !== '') {
      components.push(artistry.widgetInstruction)
    }
  }

  const textJournal = card.extensions?.airi?.textJournal
  const isTextJournalAllowed = !generation?.known?.allowedTools || generation.known.allowedTools.includes('text_journal')
  if (isTextJournalAllowed) {
    const textJournalInstruction = textJournal?.widgetInstruction || DEFAULT_TEXT_JOURNAL_WIDGET_INSTRUCTION
    if (textJournalInstruction && textJournalInstruction.trim() !== '') {
      components.push(textJournalInstruction)
    }
  }

  if (isDatingSimActive && story) {
    if (premise) {
      components.push(`The user wants to customize or tweak the premise of this encounter, please adjust to the text below: ${premise}`)
    }
    if (story.appearances) {
      components.push(`This is what your appearance is for this story. Try to make it work with your known appearance; you're free to modify or adjust as needed: ${story.appearances}`)
    }
    if (story.scene) {
      components.push(`The setting and location for this encounter is: ${story.scene}`)
    }
  }

  return components.join('\n')
}
