import type { AcousticFeatures, PersonaArchetype } from '@proj-airi/motion-choreography'
import type {
  BeatSyncDetectorState,
  BeatSyncEnergyTier,
  BeatSyncVibe,
  BeatSyncVrmClipTiers,
} from '@proj-airi/stage-shared/beat-sync'

import type { AiriBeatSync } from '../../types/card.schema'

import { synthesizeDanceBrief } from '@proj-airi/motion-choreography'
import {
  BEAT_SYNC_ENERGY_TIERS,
  beatSyncEnergyTierFromNormalized,
  BUILTIN_BEAT_SYNC_DANCE_KEYS,
  computeBeatSyncVrmDanceSpeed,
  DEFAULT_BEAT_SYNC_VRM_CLIP_TIERS,
  formatBeatSyncClipLabel,
  getBeatSyncState,
  listenBeatSyncBeatSignal,
  listenBeatSyncStateChange,
  listenBeatSyncVibeSignal,
  selectBeatSyncVrmClipForEnergy,
  toggleBeatSync,
} from '@proj-airi/stage-shared/beat-sync'
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { useLive2d } from '@proj-airi/stage-ui-live2d'
import { useCustomVrmAnimationsStore, useModelStore } from '@proj-airi/stage-ui-three'
import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useSettingsStageModel } from '../settings/stage-model'
import { useAiriCardStore } from './airi-card'
import { useTextToMotionStore } from './text-to-motion'

export type BeatSyncLive2DStyle = 'punchy-v' | 'swing-lr' | 'sway-sine'
export type BeatSyncVrmMode = 'clips' | 'ai'
export type BeatSyncChoreoPersona = 'none' | 'idol' | 'gothic_maid' | 'cool_android'
export type BeatSyncActiveRenderer = 'live2d' | 'vrm' | 'mmd' | 'spine' | 'none'

export const BEAT_SYNC_PERSONA_ORDER: readonly BeatSyncChoreoPersona[] = [
  'none',
  'idol',
  'gothic_maid',
  'cool_android',
]

const DEFAULT_LIVE2D_CONFIG = {
  style: 'punchy-v' as BeatSyncLive2DStyle,
  strength: 0.65,
}

const DEFAULT_VRM_CONFIG = {
  mode: 'clips' as BeatSyncVrmMode,
  persona: 'idol' as BeatSyncChoreoPersona,
  cyclePersonas: true,
  barsPerPhrase: 16,
  autoBars: true,
  clipTiers: {
    calm: [] as string[],
    medium: [] as string[],
    intense: [] as string[],
  },
}

const TIER_SWITCH_DWELL_MS = 2500

function mapVibeTierToAcousticTier(tier: BeatSyncEnergyTier): AcousticFeatures['energyTier'] {
  if (tier === 'calm')
    return 'low'
  if (tier === 'medium')
    return 'moderate'
  return 'high'
}

export const useBeatSyncChoreographyStore = defineStore('beat-sync-choreography', () => {
  const airiCardStore = useAiriCardStore()
  const stageModelStore = useSettingsStageModel()
  const live2dStore = useLive2d()
  const modelStore = useModelStore()
  const customVrmAnimationsStore = useCustomVrmAnimationsStore()
  const textToMotionStore = useTextToMotionStore()

  const { activeCard, activeCardId } = storeToRefs(airiCardStore)
  const { stageModelRenderer } = storeToRefs(stageModelStore)
  const { customAnimations } = storeToRefs(customVrmAnimationsStore)
  const customAnimationsList = computed(() => Object.values(customAnimations.value))

  // --- Shared Sensor State ---
  const detectorState = ref<BeatSyncDetectorState>()
  const vibe = ref<BeatSyncVibe | null>(null)
  const lastBeatAt = ref<number>(0)
  const captureError = ref<string | null>(null)
  let listenersInitialized = false

  // --- Global Fallbacks (machine-level / cardless fallback) ---
  const globalAudioSourceLabel = useLocalStorageManualReset<string>('settings/beat-sync/audio-source-label', () => 'System audio')
  const globalClipTiers = useLocalStorageManualReset<BeatSyncVrmClipTiers>('settings/beat-sync/vrm-clip-tiers', () => ({
    calm: [...DEFAULT_BEAT_SYNC_VRM_CLIP_TIERS.calm],
    medium: [...DEFAULT_BEAT_SYNC_VRM_CLIP_TIERS.medium],
    intense: [...DEFAULT_BEAT_SYNC_VRM_CLIP_TIERS.intense],
  }))
  const cardlessBeatSyncFallback = ref<AiriBeatSync>({})

  // --- Runtime Playback State ---
  const nowPlayingClipKey = ref<string | null>(null)
  const activeClipTier = ref<BeatSyncEnergyTier | null>(null)
  const lastTierSwitchAt = ref<number>(0)

  const aiStatus = ref<'idle' | 'preparing' | 'dancing'>('idle')
  const aiError = ref<string | null>(null)
  const activeAiPersona = ref<BeatSyncChoreoPersona>('idol')
  const nextAiPersona = ref<BeatSyncChoreoPersona | null>(null)
  let aiSessionToken = 0
  let aiPhraseTimer: ReturnType<typeof setTimeout> | undefined
  const aiBlobCache = new Map<string, string>()

  // --- Derived Capabilities & Config ---
  const activeRenderer = computed<BeatSyncActiveRenderer>(() => {
    const r = stageModelRenderer.value
    if (r === 'live2d' || r === 'vrm' || r === 'mmd' || r === 'spine')
      return r
    return 'none'
  })

  const isRendererSupported = computed(() => activeRenderer.value === 'live2d' || activeRenderer.value === 'vrm')
  const isActive = computed(() => Boolean(detectorState.value?.isActive))
  const bpm = computed(() => (vibe.value?.bpm && vibe.value.bpm > 0) ? vibe.value.bpm : null)
  const bpmConfidence = computed(() => vibe.value?.bpmConfidence ?? 0)
  const energy = computed(() => vibe.value?.energy ?? 0)
  const energyTier = computed<BeatSyncEnergyTier>(() => beatSyncEnergyTierFromNormalized(energy.value))
  const danceSpeed = computed(() => computeBeatSyncVrmDanceSpeed(vibe.value?.bpm ?? 0))

  const rawCardBeatSync = computed<AiriBeatSync>(() => {
    return activeCard.value?.extensions?.airi?.beatSync ?? cardlessBeatSyncFallback.value
  })

  const live2dConfig = computed(() => ({
    style: rawCardBeatSync.value.live2d?.style ?? DEFAULT_LIVE2D_CONFIG.style,
    strength: rawCardBeatSync.value.live2d?.strength ?? DEFAULT_LIVE2D_CONFIG.strength,
  }))

  const vrmConfig = computed(() => ({
    mode: rawCardBeatSync.value.vrm?.mode ?? DEFAULT_VRM_CONFIG.mode,
    persona: rawCardBeatSync.value.vrm?.persona ?? DEFAULT_VRM_CONFIG.persona,
    cyclePersonas: rawCardBeatSync.value.vrm?.cyclePersonas ?? DEFAULT_VRM_CONFIG.cyclePersonas,
    barsPerPhrase: rawCardBeatSync.value.vrm?.barsPerPhrase ?? DEFAULT_VRM_CONFIG.barsPerPhrase,
    autoBars: rawCardBeatSync.value.vrm?.autoBars ?? DEFAULT_VRM_CONFIG.autoBars,
    clipTiers: {
      calm: rawCardBeatSync.value.vrm?.clipTiers?.calm ?? DEFAULT_VRM_CONFIG.clipTiers.calm,
      medium: rawCardBeatSync.value.vrm?.clipTiers?.medium ?? DEFAULT_VRM_CONFIG.clipTiers.medium,
      intense: rawCardBeatSync.value.vrm?.clipTiers?.intense ?? DEFAULT_VRM_CONFIG.clipTiers.intense,
    },
  }))

  const resolvedClipTiers = computed<BeatSyncVrmClipTiers>(() => {
    const cardTiers = vrmConfig.value.clipTiers
    const hasCardClips = BEAT_SYNC_ENERGY_TIERS.some(t => (cardTiers[t]?.length ?? 0) > 0)
    if (hasCardClips)
      return cardTiers

    const hasGlobalClips = BEAT_SYNC_ENERGY_TIERS.some(t => (globalClipTiers.value[t]?.length ?? 0) > 0)
    if (hasGlobalClips)
      return globalClipTiers.value

    return {
      calm: [...DEFAULT_BEAT_SYNC_VRM_CLIP_TIERS.calm],
      medium: [...DEFAULT_BEAT_SYNC_VRM_CLIP_TIERS.medium],
      intense: [...DEFAULT_BEAT_SYNC_VRM_CLIP_TIERS.intense],
    }
  })

  const availableDanceClips = computed(() => {
    const builtin = BUILTIN_BEAT_SYNC_DANCE_KEYS.map(key => ({
      key,
      label: formatBeatSyncClipLabel(key),
      source: 'builtin' as const,
    }))
    const custom = customAnimationsList.value.map(item => ({
      key: item.key,
      label: item.name,
      source: 'custom' as const,
    }))
    return [...custom, ...builtin]
  })

  const totalAssignedClips = computed(() => {
    return resolvedClipTiers.value.calm.length
      + resolvedClipTiers.value.medium.length
      + resolvedClipTiers.value.intense.length
  })

  const hasAnyDanceClips = computed(() => totalAssignedClips.value > 0 || availableDanceClips.value.length > 0)

  const nowPlayingClipName = computed(() => {
    const key = nowPlayingClipKey.value
    if (!key)
      return null
    const found = customAnimationsList.value.find(item => item.key === key)
    return found?.name ?? formatBeatSyncClipLabel(key)
  })

  // --- Persistence Helpers ---
  async function updateCharacterBeatSync(patch: Partial<AiriBeatSync>) {
    const current = rawCardBeatSync.value
    const existingVrm = current.vrm
    const next: AiriBeatSync = {
      ...current,
      ...patch,
      live2d: patch.live2d ? { ...current.live2d, ...patch.live2d } : current.live2d,
      vrm: patch.vrm
        ? {
            ...existingVrm,
            ...patch.vrm,
            clipTiers: patch.vrm.clipTiers
              ? { ...existingVrm?.clipTiers, ...patch.vrm.clipTiers }
              : existingVrm?.clipTiers,
          }
        : existingVrm,
    }

    if (activeCard.value && activeCardId.value) {
      await airiCardStore.updateCard(activeCardId.value, {
        extensions: {
          ...activeCard.value.extensions,
          airi: {
            ...activeCard.value.extensions?.airi,
            beatSync: next,
          },
        },
      })
    }
    else {
      cardlessBeatSyncFallback.value = next
    }
  }

  function setLive2dStyle(style: BeatSyncLive2DStyle) {
    live2dStore.setBeatSyncConfig({ style })
    void updateCharacterBeatSync({ live2d: { style } })
  }

  function setLive2dStrength(strength: number) {
    const clamped = Math.min(1, Math.max(0, strength))
    live2dStore.setBeatSyncConfig({ strength: clamped })
    void updateCharacterBeatSync({ live2d: { strength: clamped } })
  }

  function setVrmMode(mode: BeatSyncVrmMode) {
    const prevMode = vrmConfig.value.mode
    void updateCharacterBeatSync({ vrm: { mode } })
    if (isActive.value && activeRenderer.value === 'vrm' && prevMode !== mode) {
      clearAiPhraseTimer()
      aiSessionToken += 1
      if (mode === 'clips') {
        aiStatus.value = 'idle'
        triggerVrmClipForTier(energyTier.value, true)
      }
      else {
        nowPlayingClipKey.value = null
        void startAiChoreographyLoop()
      }
    }
  }

  function setVrmPersona(persona: BeatSyncChoreoPersona) {
    void updateCharacterBeatSync({ vrm: { persona } })
    activeAiPersona.value = persona
    if (isActive.value && activeRenderer.value === 'vrm' && vrmConfig.value.mode === 'ai') {
      clearAiPhraseTimer()
      aiSessionToken += 1
      void startAiChoreographyLoop()
    }
  }

  function setCyclePersonas(cyclePersonas: boolean) {
    void updateCharacterBeatSync({ vrm: { cyclePersonas } })
  }

  function setBarsPerPhrase(barsPerPhrase: number, autoBars = false) {
    void updateCharacterBeatSync({ vrm: { barsPerPhrase, autoBars } })
  }

  function setAutoBars(autoBars: boolean) {
    void updateCharacterBeatSync({ vrm: { autoBars } })
  }

  function setTierClips(tier: BeatSyncEnergyTier, clipKeys: string[]) {
    const next = {
      ...resolvedClipTiers.value,
      [tier]: [...clipKeys],
    }
    globalClipTiers.value = next
    if (activeCard.value && activeCardId.value) {
      void updateCharacterBeatSync({ vrm: { clipTiers: next } })
    }
  }

  function resetClipTiersToDefaults() {
    const defaults: BeatSyncVrmClipTiers = {
      calm: [...DEFAULT_BEAT_SYNC_VRM_CLIP_TIERS.calm],
      medium: [...DEFAULT_BEAT_SYNC_VRM_CLIP_TIERS.medium],
      intense: [...DEFAULT_BEAT_SYNC_VRM_CLIP_TIERS.intense],
    }
    globalClipTiers.value = defaults
    if (activeCard.value && activeCardId.value) {
      void updateCharacterBeatSync({ vrm: { clipTiers: defaults } })
    }
  }

  function previewClip(clipKey: string) {
    if (activeRenderer.value !== 'vrm')
      return
    nowPlayingClipKey.value = clipKey
    modelStore.triggerMotion(clipKey, {
      loop: true,
      fadeDuration: 0.4,
      timeScale: isActive.value ? danceSpeed.value : 1,
    })
  }

  async function importDanceClip(file: File, targetTier?: BeatSyncEnergyTier) {
    const key = await customVrmAnimationsStore.addCustomAnimation(file, { source: 'uploaded' })
    if (targetTier) {
      const current = resolvedClipTiers.value[targetTier]
      if (!current.includes(key)) {
        setTierClips(targetTier, [...current, key])
      }
    }
    return key
  }

  // --- VRM Clip Playback ---
  function getFallbackTierPool(): BeatSyncVrmClipTiers {
    if (totalAssignedClips.value > 0)
      return resolvedClipTiers.value

    // If no explicit tier assignments exist yet, distribute available custom VRMA clips evenly
    const allKeys = customAnimationsList.value.map(item => item.key)
    const fallback: BeatSyncVrmClipTiers = { calm: [], medium: [], intense: [] }
    allKeys.forEach((key, idx) => {
      const bucket = BEAT_SYNC_ENERGY_TIERS[idx % BEAT_SYNC_ENERGY_TIERS.length]
      fallback[bucket].push(key)
    })
    return fallback
  }

  function triggerVrmClipForTier(tier: BeatSyncEnergyTier, force = false) {
    if (activeRenderer.value !== 'vrm')
      return

    const now = Date.now()
    if (!force && activeClipTier.value === tier && nowPlayingClipKey.value)
      return
    if (!force && now - lastTierSwitchAt.value < TIER_SWITCH_DWELL_MS && nowPlayingClipKey.value)
      return

    const pool = getFallbackTierPool()
    const picked = selectBeatSyncVrmClipForEnergy({
      tier,
      clipsByTier: pool,
      currentClipKey: nowPlayingClipKey.value,
    })

    if (!picked.clipKey)
      return

    nowPlayingClipKey.value = picked.clipKey
    activeClipTier.value = picked.resolvedTier
    lastTierSwitchAt.value = now

    modelStore.triggerMotion(picked.clipKey, {
      loop: true,
      fadeDuration: 0.6,
      timeScale: danceSpeed.value,
    })
  }

  // --- VRM AI Choreography Playback ---
  function clearAiPhraseTimer() {
    if (aiPhraseTimer) {
      clearTimeout(aiPhraseTimer)
      aiPhraseTimer = undefined
    }
  }

  function pickNextPersona(current: BeatSyncChoreoPersona): BeatSyncChoreoPersona {
    if (!vrmConfig.value.cyclePersonas)
      return current
    const idx = BEAT_SYNC_PERSONA_ORDER.indexOf(current)
    return BEAT_SYNC_PERSONA_ORDER[(idx + 1) % BEAT_SYNC_PERSONA_ORDER.length]
  }

  async function synthesizePersonaDanceUrl(persona: BeatSyncChoreoPersona, targetBpm: number, tier: BeatSyncEnergyTier): Promise<string | null> {
    const bpmBucket = Math.round(targetBpm / 10) * 10
    const cacheKey = `${persona}:${bpmBucket}:${tier}`
    const cached = aiBlobCache.get(cacheKey)
    if (cached)
      return cached

    const features: AcousticFeatures = {
      bpm: targetBpm,
      confidence: bpmConfidence.value || 0.75,
      energyRms: energy.value || 0.5,
      energyTier: mapVibeTierToAcousticTier(tier),
      spectralCentroid: 1600,
      timbreBrightness: 'balanced',
      rhythmStructure: 'four_on_the_floor',
      durationSeconds: 8,
      beatTimestamps: [],
    }

    const brief = synthesizeDanceBrief(features, undefined, {
      archetype: persona as PersonaArchetype,
    })

    const result = await textToMotionStore.generateMotion(brief.choreographerPrompt, {
      engine: 'flowmdm',
      format: 'vrma',
      outputLength: 120,
      loop: true,
    })

    if (!result?.buffer)
      return null

    const blobPart = new Uint8Array(result.buffer)
    const blob = new Blob([blobPart.buffer], { type: 'model/gltf-binary' })
    const blobUrl = URL.createObjectURL(blob)
    aiBlobCache.set(cacheKey, blobUrl)
    return blobUrl
  }

  async function startAiChoreographyLoop() {
    const token = ++aiSessionToken
    clearAiPhraseTimer()
    aiError.value = null

    const startPersona = vrmConfig.value.persona
    activeAiPersona.value = startPersona
    nextAiPersona.value = vrmConfig.value.cyclePersonas ? pickNextPersona(startPersona) : null
    aiStatus.value = 'preparing'

    try {
      const effectiveBpm = bpm.value ?? 120
      const url = await synthesizePersonaDanceUrl(startPersona, effectiveBpm, energyTier.value)
      if (token !== aiSessionToken || !isActive.value || activeRenderer.value !== 'vrm' || vrmConfig.value.mode !== 'ai')
        return

      if (url) {
        aiStatus.value = 'dancing'
        modelStore.triggerMotion(url, {
          loop: true,
          fadeDuration: 0.8,
          timeScale: 1,
        })
        scheduleNextAiPhrase(token, startPersona)
      }
      else {
        aiStatus.value = 'idle'
      }
    }
    catch (err: any) {
      if (token !== aiSessionToken)
        return
      console.error('[BeatSyncChoreography] AI choreography failed:', err)
      aiError.value = err?.message || String(err)
      aiStatus.value = 'idle'
    }
  }

  function scheduleNextAiPhrase(token: number, currentPersona: BeatSyncChoreoPersona) {
    clearAiPhraseTimer()
    const bars = vrmConfig.value.autoBars ? 16 : vrmConfig.value.barsPerPhrase
    const effectiveBpm = Math.max(60, Math.min(200, bpm.value ?? 120))
    const phraseDurationMs = Math.max(6000, Math.round((bars * 4 * 60 / effectiveBpm) * 1000))

    const upcomingPersona = pickNextPersona(currentPersona)
    nextAiPersona.value = upcomingPersona

    aiPhraseTimer = setTimeout(async () => {
      if (token !== aiSessionToken || !isActive.value || activeRenderer.value !== 'vrm' || vrmConfig.value.mode !== 'ai')
        return

      aiStatus.value = 'preparing'
      try {
        const nextBpm = bpm.value ?? 120
        const url = await synthesizePersonaDanceUrl(upcomingPersona, nextBpm, energyTier.value)
        if (token !== aiSessionToken || !isActive.value || activeRenderer.value !== 'vrm' || vrmConfig.value.mode !== 'ai')
          return

        if (url) {
          activeAiPersona.value = upcomingPersona
          aiStatus.value = 'dancing'
          modelStore.triggerMotion(url, {
            loop: true,
            fadeDuration: 0.8,
            timeScale: 1,
          })
          scheduleNextAiPhrase(token, upcomingPersona)
        }
      }
      catch (err: any) {
        if (token !== aiSessionToken)
          return
        console.warn('[BeatSyncChoreography] Next phrase prep failed:', err)
        aiStatus.value = 'dancing'
        scheduleNextAiPhrase(token, currentPersona)
      }
    }, phraseDurationMs)
  }

  // --- Signal Handler ---
  function handleVibeUpdate(nextVibe: BeatSyncVibe) {
    if (!isActive.value || activeRenderer.value !== 'vrm')
      return

    if (vrmConfig.value.mode === 'clips') {
      const nextTier = beatSyncEnergyTierFromNormalized(nextVibe.energy)
      triggerVrmClipForTier(nextTier, !nowPlayingClipKey.value)
      if (nowPlayingClipKey.value) {
        modelStore.setMotionTimeScale(computeBeatSyncVrmDanceSpeed(nextVibe.bpm))
      }
    }
  }

  // --- Public Lifecycle Actions ---
  async function startDancing(): Promise<boolean> {
    initListeners()
    captureError.value = null
    if (!isRendererSupported.value)
      return false

    if (!isActive.value) {
      try {
        await toggleBeatSync(true)
      }
      catch (err: any) {
        captureError.value = err?.message || String(err)
        console.error('[BeatSyncChoreography] Failed to start audio capture:', err)
        return false
      }
    }

    if (activeRenderer.value === 'live2d') {
      live2dStore.setBeatSyncConfig({
        style: live2dConfig.value.style,
        strength: live2dConfig.value.strength,
      })
    }
    else if (activeRenderer.value === 'vrm') {
      if (vrmConfig.value.mode === 'clips') {
        triggerVrmClipForTier(energyTier.value, true)
      }
      else {
        void startAiChoreographyLoop()
      }
    }

    return true
  }

  async function stopDancing(): Promise<void> {
    aiSessionToken += 1
    clearAiPhraseTimer()
    aiStatus.value = 'idle'

    if (nowPlayingClipKey.value || activeRenderer.value === 'vrm') {
      modelStore.triggerMotion('__STOP__')
      nowPlayingClipKey.value = null
      activeClipTier.value = null
    }

    if (isActive.value) {
      await toggleBeatSync(false)
    }
  }

  async function toggleDancing(): Promise<boolean> {
    if (isActive.value) {
      await stopDancing()
      return false
    }
    return startDancing()
  }

  function initListeners() {
    if (listenersInitialized)
      return
    listenersInitialized = true

    void customVrmAnimationsStore.loadCustomAnimations()
    void getBeatSyncState().then((state) => {
      detectorState.value = state
    })
    listenBeatSyncStateChange((state) => {
      detectorState.value = state
    })
    listenBeatSyncBeatSignal(() => {
      lastBeatAt.value = Date.now()
    })
    listenBeatSyncVibeSignal((nextVibe) => {
      vibe.value = nextVibe
      handleVibeUpdate(nextVibe)
    })

    watch(activeRenderer, (next, prev) => {
      if (!isActive.value)
        return
      if (next !== 'live2d' && next !== 'vrm') {
        void stopDancing()
        return
      }
      if (prev === 'vrm' && next !== 'vrm') {
        aiSessionToken += 1
        clearAiPhraseTimer()
        aiStatus.value = 'idle'
        modelStore.triggerMotion('__STOP__')
        nowPlayingClipKey.value = null
      }
      else if (next === 'vrm') {
        if (vrmConfig.value.mode === 'clips')
          triggerVrmClipForTier(energyTier.value, true)
        else
          void startAiChoreographyLoop()
      }
    })
  }

  return {
    // State
    detectorState,
    vibe,
    lastBeatAt,
    captureError,
    globalAudioSourceLabel,
    globalClipTiers,
    nowPlayingClipKey,
    nowPlayingClipName,
    activeClipTier,
    aiStatus,
    aiError,
    activeAiPersona,
    nextAiPersona,

    // Computed
    activeRenderer,
    isRendererSupported,
    isActive,
    bpm,
    bpmConfidence,
    energy,
    energyTier,
    danceSpeed,
    live2dConfig,
    vrmConfig,
    resolvedClipTiers,
    availableDanceClips,
    totalAssignedClips,
    hasAnyDanceClips,

    // Actions
    initListeners,
    startDancing,
    stopDancing,
    toggleDancing,
    setLive2dStyle,
    setLive2dStrength,
    setVrmMode,
    setVrmPersona,
    setCyclePersonas,
    setBarsPerPhrase,
    setAutoBars,
    setTierClips,
    resetClipTiersToDefaults,
    previewClip,
    importDanceClip,
    triggerVrmClipForTier,
  }
})
