<script setup lang="ts">
import type { CuratedExpressionItem } from '../../../composables/use-expression-curation'

import { useLive2d } from '@proj-airi/stage-ui-live2d/stores'
import { useMmd } from '@proj-airi/stage-ui-mmd'
import { useSpine } from '@proj-airi/stage-ui-spine'
import { useCustomVrmAnimationsStore, useModelStore } from '@proj-airi/stage-ui-three'
import { storeToRefs } from 'pinia'
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import RendererStage from '../../scenes/RendererStage.vue'
import BrainModelPicker from '../chat/BrainModelPicker.vue'
import ExpressionCurationModal from '../dialogs/ExpressionCurationModal.vue'

import { useExpressionCuration } from '../../../composables/use-expression-curation'
import { DisplayModelFormat, useDisplayModelsStore } from '../../../stores/display-models'
import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../../stores/modules/consciousness'
import { useSystemOneStore } from '../../../stores/modules/system-one'
import { useProvidersStore } from '../../../stores/providers'
import { useSettings } from '../../../stores/settings'

export interface CueAllowlist {
  version: 1
  emotions: Record<string, { rawKey: string, label: string }>
}

export type CompiledWhitelist = CueAllowlist

export interface EmotionStudioSyncPayload {
  emotionsCurated: boolean
  expressionMappings: Record<string, string>
  actingModelExpressionPrompt: string
  cueAllowlist: CueAllowlist
  compiledWhitelist: CueAllowlist
}

const props = withDefaults(defineProps<{
  modelId: string
  initialMappings?: Record<string, string>
  initialDirectives?: string
  initialCalibrated?: boolean
  companionName?: string
  personaPersonality?: string
  personaDescription?: string
  personaScenario?: string
  autoCalibrateOnMount?: boolean
  stageUpdateReason?: string
  startGuided?: boolean
  demoModelId?: string
  allowModelSwitch?: boolean
  contentHeightClass?: string
  /** Character voice source for Enhance: card systemPrompt on the route, '' in onboarding (persona fields stand in). */
  personaSystemPrompt?: string
  /** Finish handoff variant: onboarding advances the wizard, standalone lands back in the cockpit. */
  finishContext?: 'standalone' | 'onboarding'
}>(), {
  initialMappings: () => ({}),
  initialDirectives: '',
  initialCalibrated: false,
  companionName: 'Companion',
  personaPersonality: '',
  personaDescription: '',
  personaScenario: '',
  autoCalibrateOnMount: true,
  stageUpdateReason: 'emotion-studio',
  startGuided: true,
  demoModelId: 'preset-vrm-2',
  allowModelSwitch: false,
  contentHeightClass: 'min-h-[450px]',
  personaSystemPrompt: '',
  finishContext: 'standalone',
})

const emit = defineEmits<{
  (e: 'sync', payload: EmotionStudioSyncPayload): void
  (e: 'applied'): void
  (e: 'request-model', modelId: string): void
  (e: 'finish'): void
}>()

const settingsStore = useSettings()
const displayModelsStore = useDisplayModelsStore()
const airiCardStore = useAiriCardStore()
const systemOneStore = useSystemOneStore()
const providersStore = useProvidersStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)
const { stageModelRenderer } = storeToRefs(settingsStore)

const live2dStore = useLive2d()
const modelStore = useModelStore()
const customVrmAnimationsStore = useCustomVrmAnimationsStore()
const mmdStore = useMmd()
const spineStore = useSpine()

const {
  curateExpressions,
  isCurating,
  curationError,
  generateActingPrompt,
  generateDefaultActingPrompt,
  isGeneratingPrompt,
} = useExpressionCuration()

const consciousnessStore = useConsciousnessStore()

// --- Local Asset Fallback Previews ---
const presetLive2dPreview = new URL('../../../assets/live2d/models/hiyori/preview.png', import.meta.url).href
const presetVrmAvatarAPreview = new URL('../../../assets/vrm/models/AvatarSample-A/preview.png', import.meta.url).href
const presetVrmAvatarBPreview = new URL('../../../assets/vrm/models/AvatarSample-B/preview.png', import.meta.url).href

// --- 1. Active Model & Vessel Resolution ---
const currentModel = computed(() => {
  return displayModelsStore.displayModels.find(m => m.id === props.modelId)
})

const modelType = computed<'live2d' | 'vrm' | 'mmd' | 'spine' | 'unknown'>(() => {
  if (stageModelRenderer.value && stageModelRenderer.value !== 'disabled')
    return stageModelRenderer.value

  if (!currentModel.value) {
    if (props.modelId.includes('live2d'))
      return 'live2d'
    if (props.modelId.includes('vrm'))
      return 'vrm'
    return 'vrm'
  }
  const fmt = currentModel.value.format
  if (fmt === DisplayModelFormat.Live2dZip || fmt === DisplayModelFormat.Live2dDirectory)
    return 'live2d'
  if (fmt === DisplayModelFormat.VRM)
    return 'vrm'
  if (fmt === DisplayModelFormat.PMXZip || fmt === DisplayModelFormat.PMXDirectory || fmt === DisplayModelFormat.PMD)
    return 'mmd'
  if (fmt === DisplayModelFormat.SpineZip)
    return 'spine'
  return 'unknown'
})

const modelFormatLabel = computed(() => {
  const type = modelType.value
  const name = currentModel.value?.name
    || (props.modelId === 'preset-live2d-2' ? 'Hiyori' : props.modelId === 'preset-vrm-2' ? 'Seed Girl' : 'AvatarSample_A')
  if (type === 'vrm')
    return `VRM (3D) - ${name}`
  if (type === 'live2d')
    return `Live2D (2D) - ${name}`
  return `${type.toUpperCase()} - ${name}`
})

const avatarPreviewUrl = computed(() => {
  if (currentModel.value && 'previewImage' in currentModel.value && currentModel.value.previewImage)
    return currentModel.value.previewImage
  if (props.modelId === 'preset-live2d-2')
    return presetLive2dPreview
  if (props.modelId === 'preset-vrm-2')
    return presetVrmAvatarBPreview
  if (props.modelId === 'preset-vrm-1')
    return presetVrmAvatarAPreview
  return ''
})

// --- Stage Model Live Mounting ---
const stageModelReady = ref(false)
// Mirrors the RendererStage v-if below: false means the viewport is showing the
// static fallback image and no preview can visibly fire in this window.
const isLiveCanvas = computed(() => stageModelReady.value
  && Boolean(stageModelRenderer.value)
  && stageModelRenderer.value !== 'disabled'
  && (settingsStore.stageModelSelected === props.modelId
    || settingsStore.stageModelSelectedDisplayModel?.id === props.modelId))
const isLoadingModel = ref(false)
const stageState = ref<'pending' | 'loading' | 'mounted'>('pending')
const previewXOffset = ref(0)
const previewYOffset = ref(0)
const previewScale = ref(1)

function resetPreviewPosition() {
  previewXOffset.value = 0
  previewYOffset.value = 0
  previewScale.value = 1
  faceFramed.value = false
}

// Face-level framing preset (VRM): zoom in and lift the head into frame so
// expression test-fires are visible. Starting values — tune live if the head
// sits high/low on a given rig. Any manual drag keeps custom values.
const faceFramed = ref(false)

function toggleFaceFrame() {
  if (faceFramed.value) {
    resetPreviewPosition()
    return
  }
  previewScale.value = 0.55
  previewYOffset.value = -30
  faceFramed.value = true
}

function handleViewportDrag() {
  // Manual framing wins; preset no longer describes the view
  faceFramed.value = false
}

async function initializeStageRenderer() {
  isLoadingModel.value = true
  try {
    if (props.modelId) {
      settingsStore.stageModelSelected = props.modelId
      await settingsStore.updateStageModel(props.stageUpdateReason)
    }
    stageModelReady.value = true
  }
  catch (err) {
    console.warn('[EmotionCalibrationStudio] updateStageModel encountered error:', err)
  }
  finally {
    isLoadingModel.value = false
  }
}

// --- 2. Expressions Extraction & Noise Filtering ---
const rawExpressions = ref<string[]>([])
const candidateExpressions = ref<string[]>([])
const rawMotions = ref<string[]>([])
const isLoadingExpressions = ref(false)

async function loadModelCapabilities() {
  isLoadingExpressions.value = true
  try {
    const caps = await displayModelsStore.getOrLoadModelCapabilities(props.modelId)
    const expCaps = caps.expressionCapabilities || []
    const motCaps = caps.motionCapabilities || []
    rawMotions.value = motCaps.length > 0 ? motCaps.map(m => m.rawKey) : []
    if (expCaps.length > 0) {
      rawExpressions.value = expCaps.map(e => e.rawKey)
      const usable = expCaps.filter(e => e.usable).map(e => e.rawKey)
      candidateExpressions.value = usable.length > 0 ? usable : expCaps.map(e => e.rawKey)
    }
    else {
      // Fallback candidate vocabulary for uninstantiated or remote models
      rawMotions.value = []
      if (modelType.value === 'live2d') {
        const fallbackLive2D = ['exp_01', 'exp_02', 'exp_03', 'exp_04', 'exp_05', 'exp_06', 'f01', 'f02', 'f03', 'f04', 'f05']
        rawExpressions.value = fallbackLive2D
        candidateExpressions.value = fallbackLive2D
      }
      else {
        const fallbackVRM = ['happy', 'surprised', 'angry', 'relaxed', 'sad', 'neutral', 'blink', 'blink_l', 'blink_r', 'wink', 'shy', 'joy']
        rawExpressions.value = fallbackVRM
        candidateExpressions.value = fallbackVRM
      }
    }
  }
  catch (e) {
    console.warn('[EmotionCalibrationStudio] Failed to load model capabilities:', e)
    const fallback = ['happy', 'surprised', 'angry', 'relaxed', 'sad', 'neutral', 'blink', 'wink']
    rawExpressions.value = fallback
    candidateExpressions.value = fallback
    rawMotions.value = []
  }
  finally {
    isLoadingExpressions.value = false
  }
}

// --- 3. Canonical Emotion Slots & Definitions ---
export interface CanonicalEmotionSlot {
  id: string
  name: string
  emoji: string
  actToken: string
  matchRegex: RegExp
}

const CANONICAL_EMOTIONS: CanonicalEmotionSlot[] = [
  { id: 'smile', name: 'Smile', emoji: '😊', actToken: 'smile', matchRegex: /happy|joy|smile|fun|laugh|exp_01|f01/i },
  { id: 'blush', name: 'Blush', emoji: '😳', actToken: 'blush', matchRegex: /relaxed|blush|dere|shy|joy|exp_02|f02/i },
  { id: 'pout', name: 'Pout', emoji: '😠', actToken: 'pout', matchRegex: /angry|pout|rage|irritated|displeased|exp_03|f03/i },
  { id: 'surprise', name: 'Surprise', emoji: '😲', actToken: 'surprise', matchRegex: /surprised|surprise|shock|wide_eye|exp_04|f04/i },
  { id: 'wink', name: 'Wink', emoji: '😉', actToken: 'wink', matchRegex: /wink|blink_l|blink_r|wink_l|wink_r|exp_05|f05/i },
  { id: 'shy', name: 'Shy', emoji: '🙈', actToken: 'shy', matchRegex: /shy|sad|sorrow|troubled|down|cry|tear|exp_06|f06/i },
]

// Built-in starter models hand-tuned semantic maps (100% verified working out of the box)
const BUILTIN_MODEL_PRESETS: Record<string, Record<string, string>> = {
  // Built-in VRM Avatars (VRoid standard blendshapes: Fun, Joy, Angry, Surprised, Blink_L, Sorrow)
  'preset-vrm-1': {
    smile: 'Fun',
    blush: 'Joy',
    pout: 'Angry',
    surprise: 'Surprised',
    wink: 'Blink_L',
    shy: 'Sorrow',
  },
  'preset-vrm-2': {
    smile: 'Fun',
    blush: 'Joy',
    pout: 'Angry',
    surprise: 'Surprised',
    wink: 'Blink_L',
    shy: 'Sorrow',
  },
  // Built-in Live2D (Hiyori standard expression files)
  'preset-live2d-1': {
    smile: 'exp_01',
    blush: 'exp_02',
    pout: 'exp_03',
    surprise: 'exp_04',
    wink: 'exp_05',
    shy: 'exp_06',
  },
  'preset-live2d-2': {
    smile: 'exp_01',
    blush: 'exp_02',
    pout: 'exp_03',
    surprise: 'exp_04',
    wink: 'exp_05',
    shy: 'exp_06',
  },
}

// --- 4. Emotion Mappings & Studio State ---
const expressionMappings = ref<Record<string, string>>({
  ...props.initialMappings,
})
const isCalibrated = ref<boolean>(props.initialCalibrated)
const activePlayingEmotion = ref<string>('neutral')
const activePlayingBlendshape = ref<string>('')

// Soundboard triggers
const SOUNDBOARD_EMOTIONS = [
  { id: 'smile', label: 'Smile', emoji: '😊' },
  { id: 'blush', label: 'Blush', emoji: '😳' },
  { id: 'pout', label: 'Pout', emoji: '😠' },
  { id: 'surprise', label: 'Surprise', emoji: '😲' },
  { id: 'wink', label: 'Wink', emoji: '😉' },
  { id: 'neutral', label: 'Neutral', emoji: '😐' },
]

function triggerModelEmotion(type: string, key: string) {
  // Diagnostic: proves which driver a preview went to (check devtools when a click visibly does nothing)

  console.info('[EmotionCalibrationStudio] trigger', { driver: type, key, liveCanvas: isLiveCanvas.value })
  try {
    if (type === 'live2d') {
      live2dStore.triggerEmotion(key, 1.0)
    }
    else if (type === 'vrm') {
      modelStore.triggerEmotion(key, 1.0)
    }
    else if (type === 'mmd') {
      mmdStore.previewExpression = key
      setTimeout(() => {
        if (mmdStore.previewExpression === key)
          mmdStore.previewExpression = null
      }, 2000)
    }
    else if (type === 'spine') {
      const match = key.match(/^(.+?)\s*\[(.+?)\]$/)
      if (match)
        spineStore.selectVariantAndSkin(match[1].trim(), match[2].trim())
      else
        spineStore.selectVariantAndSkin(key, 'default')
    }
  }
  catch (err) {
    console.error('[EmotionCalibrationStudio] triggerModelEmotion failed:', err)
  }
}

function triggerPreview(emotionId: string) {
  // Re-fire guarantee: the VRM driver no-ops a repeat of the current emotion,
  // which makes rapid vetting clicks feel dead. Bounce through neutral first.
  if (emotionId !== 'neutral' && activePlayingEmotion.value === emotionId) {
    triggerModelEmotion(modelType.value, 'neutral')
    activePlayingEmotion.value = 'neutral'
    activePlayingBlendshape.value = 'neutral'
    window.setTimeout(() => triggerPreview(emotionId), 350)
    return
  }

  activePlayingEmotion.value = emotionId
  if (emotionId === 'neutral') {
    activePlayingBlendshape.value = 'neutral'
    triggerModelEmotion(modelType.value, 'neutral')
    toast.info('Model reset to neutral pose')
    return
  }

  const mappedKey = expressionMappings.value[emotionId]
  const keyToTrigger = mappedKey || emotionId
  activePlayingBlendshape.value = keyToTrigger
  triggerModelEmotion(modelType.value, keyToTrigger)
  toast.success(`Previewing ${emotionId}${mappedKey ? ` (${mappedKey})` : ''}`)
}

function handleResetNeutral() {
  triggerPreview('neutral')
}

// --- 5. Auto-Calibration Pipeline ---
function buildDefaultActingDirectives(tokens: string[]): string {
  const companionName = props.companionName || 'Companion'
  const defaultPrompt = generateDefaultActingPrompt(tokens)
  return `You are ${companionName}. ${defaultPrompt}`
}

const actingDirectivesPrompt = ref<string>(
  props.initialDirectives || '',
)

const mappedSlotsCount = computed(() => {
  return CANONICAL_EMOTIONS.filter(slot => Boolean(expressionMappings.value[slot.id])).length
})

const isGuidanceReady = computed(() => {
  return Boolean(actingDirectivesPrompt.value && actingDirectivesPrompt.value.trim().length > 0)
})

function shouldAutoCalibrate(): boolean {
  if (!isCalibrated.value || mappedSlotsCount.value < 4)
    return true

  const candidates = candidateExpressions.value.length > 0 ? candidateExpressions.value : rawExpressions.value
  if (candidates.length === 0)
    return false

  // If any mapped slot references a blendshape that doesn't exist in candidates, auto-calibrate
  for (const slot of CANONICAL_EMOTIONS) {
    const val = expressionMappings.value[slot.id]
    if (val && !candidates.includes(val))
      return true
  }

  return false
}

function runAutoCalibration(silent = false, force = false) {
  const candidates = candidateExpressions.value.length > 0 ? candidateExpressions.value : rawExpressions.value
  if (candidates.length === 0)
    return

  const newMappings: Record<string, string> = {}

  // 1. Check if current model is one of the built-in presets
  const preset = BUILTIN_MODEL_PRESETS[props.modelId]
  if (preset) {
    for (const slot of CANONICAL_EMOTIONS) {
      const target = preset[slot.id]
      if (target && (candidates.includes(target) || rawExpressions.value.includes(target))) {
        newMappings[slot.id] = target
      }
    }
  }

  // 2. Map remaining slots via valid existing selections (if not force) or regex / unused candidates
  for (const slot of CANONICAL_EMOTIONS) {
    if (newMappings[slot.id])
      continue

    // Preserve valid existing mapping if not forced
    if (!force) {
      const existingVal = expressionMappings.value[slot.id]
      if (existingVal && candidates.includes(existingVal)) {
        newMappings[slot.id] = existingVal
        continue
      }
    }

    // Try regex match against candidates
    const match = candidates.find(c => slot.matchRegex.test(c))
    if (match) {
      newMappings[slot.id] = match
    }
    else {
      // Pick first unused candidate if available, else first candidate
      const unused = candidates.find(c => !Object.values(newMappings).includes(c))
      newMappings[slot.id] = unused || candidates[0]
    }
  }

  expressionMappings.value = newMappings
  isCalibrated.value = true

  // If guidance is empty, synthesize default directives
  if (!actingDirectivesPrompt.value.trim()) {
    const validTokens = CANONICAL_EMOTIONS.map(s => s.actToken)
    actingDirectivesPrompt.value = buildDefaultActingDirectives(validTokens)
  }

  emitSync()
  if (!silent) {
    toast.success('Auto-calibrated canonical expressions and generated acting directives!')
  }
}

// --- 6. Acting Directives Full-Span Modal ---
const isDirectivesModalOpen = ref(false)
const tempDirectivesText = ref('')

// Live template: derives ONLY from currently mapped slots, so unmapped cues
// (e.g. wink with nothing bound) are never taught. Re-rendered on mapping
// changes and Remaps entry — unless the text went bespoke this session
// (hand-saved or Enhanced), which locks it against accidental clobbering.
// Anything else (including a pre-existing card prompt) is diverged text, so
// mounting never touches it.
const sessionBespoke = ref(false)
const lastRenderedTemplate = ref('')

const templatedDirectives = computed(() => {
  return buildDefaultActingDirectives(templateTokens.value)
})

// Template vocabulary: keys of the compiled whitelist (single source —
// template and classifier can never disagree on the vocabulary again).
const templateTokens = computed(() => Object.keys(buildCompiledWhitelist().emotions))

function refreshTemplatedDirectives() {
  actingDirectivesPrompt.value = templatedDirectives.value
  lastRenderedTemplate.value = templatedDirectives.value
  emitSync()
}

function openDirectivesModal() {
  tempDirectivesText.value = actingDirectivesPrompt.value.trim()
    || buildDefaultActingDirectives(CANONICAL_EMOTIONS.map(s => s.actToken))
  isDirectivesModalOpen.value = true
}

function saveDirectivesModal() {
  actingDirectivesPrompt.value = tempDirectivesText.value
  sessionBespoke.value = true
  emitSync()
  isDirectivesModalOpen.value = false
  toast.success('Acting directives saved!')
}

function restoreDefaultDirectives() {
  const validTokens = CANONICAL_EMOTIONS.map(s => s.actToken)
  tempDirectivesText.value = buildDefaultActingDirectives(validTokens)
  toast.info('Restored default acting template.')
}

async function handleEnhanceWithAI() {
  const companionName = props.companionName || 'Companion'
  toast.info('Generating character-tailored acting guidance...')
  try {
    // Prefer the verified keeper whitelist; fall back to slot-derived items
    // when Enhance runs outside the guided flow (no curation yet).
    const keepers = curationItems.value.filter(i => !i.shouldSkip && i.actToken && i.actToken.trim())
    const curatedItems: CuratedExpressionItem[] = keepers.length > 0
      ? keepers.map(i => ({ ...i }))
      : CANONICAL_EMOTIONS.map(s => ({
          rawKey: expressionMappings.value[s.id] || s.id,
          label: s.name,
          actToken: s.actToken,
          category: 'emotes',
          shouldSkip: false,
        }))
    const enhanced = await generateActingPrompt(
      {
        name: companionName,
        personality: props.personaPersonality || 'Warm, attentive, and expressive companion',
        description: props.personaDescription || '',
        scenario: props.personaScenario || '',
        systemPrompt: props.personaSystemPrompt || undefined,
      },
      curatedItems,
    )
    if (enhanced) {
      actingDirectivesPrompt.value = enhanced
      sessionBespoke.value = true
      emitSync()
      toast.success('Enhanced acting guidance successfully generated!')
    }
  }
  catch (e) {
    console.warn('[EmotionCalibrationStudio] AI enhancement fallback:', e)
    const validTokens = CANONICAL_EMOTIONS.map(s => s.actToken)
    actingDirectivesPrompt.value = buildDefaultActingDirectives(validTokens)
    sessionBespoke.value = true
    emitSync()
    toast.success('Applied standard acting directives template.')
  }
}

// --- 7. Advanced Token Curation Modal Bridge ---
const isCurationModalOpen = ref(false)

const allUnifiedExpressions = computed(() => {
  return rawExpressions.value.map(k => ({
    key: k,
    displayName: expressionMappings.value[k] || k,
    isActive: activePlayingBlendshape.value === k,
    isFavorite: false,
    isVisible: true,
  }))
})

const visibleUnifiedExpressions = computed(() => {
  return candidateExpressions.value.map(k => ({
    key: k,
    displayName: expressionMappings.value[k] || k,
    isActive: activePlayingBlendshape.value === k,
    isFavorite: false,
    isVisible: true,
  }))
})

function handleAdvancedCurationApplied() {
  void loadModelCapabilities()
  emitSync()
  emit('applied')
  toast.success('Advanced token curation applied!')
}

// --- 8. State Synchronization (parent owns persistence) ---
function buildCompiledWhitelist(): CompiledWhitelist {
  const emotions: Record<string, { rawKey: string, label: string }> = {}
  for (const item of curationItems.value) {
    const token = (item.actToken || '').trim()
    if (!item.shouldSkip && token && !emotions[token]) {
      emotions[token] = { rawKey: item.rawKey, label: item.label || item.rawKey }
    }
  }
  for (const slot of CANONICAL_EMOTIONS) {
    const rawKey = expressionMappings.value[slot.id]
    if (rawKey && !emotions[slot.actToken]) {
      emotions[slot.actToken] = { rawKey, label: slot.name }
    }
  }
  return { version: 1, emotions }
}

function emitSync() {
  const allowlist = buildCompiledWhitelist()
  emit('sync', {
    emotionsCurated: isCalibrated.value,
    expressionMappings: { ...expressionMappings.value },
    actingModelExpressionPrompt: actingDirectivesPrompt.value,
    cueAllowlist: allowlist,
    compiledWhitelist: allowlist,
  })
}

// --- 10. Name step: stats, AI gate, curation trigger ---
const curationItems = ref<CuratedExpressionItem[]>([])
const curationDone = ref(false)

const rawCount = computed(() => rawExpressions.value.length)
const candidateCount = computed(() => candidateExpressions.value.length)
const noiseCount = computed(() => Math.max(0, rawCount.value - candidateCount.value))
// Body motions inventory: Live2D/Spine queried from the model file,
// MMD/VRM always ship built-in (+ custom) animation sets.
const motionCount = computed(() => {
  const type = modelType.value
  if (type === 'mmd') {
    return (mmdStore.availableMotions?.length || 0) + (mmdStore.customMotions?.length || 0)
  }
  if (type === 'vrm') {
    return customVrmAnimationsStore.animationOptions?.length || 0
  }
  return rawMotions.value.length
})
// Incompatible rig: nothing survived the noise filter, so there is nothing to
// name. (Raw morphs may exist, but none are usable expressions.)
const zeroExpressions = computed(() => candidateCount.value === 0)

const directorLabel = computed(() => {
  if (!directorProvider.value || !directorModel.value)
    return ''
  return `${directorProvider.value} · ${directorModelShort.value}`
})

const directorModelShort = computed(() => directorModel.value?.split('/').pop() || directorModel.value)

// Step-scoped director override: snapshot of the global consciousness pair at
// setup. Picking here never touches the global store — it only affects this step.
const directorProvider = ref(consciousnessStore.activeProvider || '')
const directorModel = ref(consciousnessStore.activeModel || '')

const directorIsGlobal = computed(() => directorProvider.value === (consciousnessStore.activeProvider || '')
  && directorModel.value === (consciousnessStore.activeModel || ''))

function resetDirectorToGlobal() {
  directorProvider.value = consciousnessStore.activeProvider || ''
  directorModel.value = consciousnessStore.activeModel || ''
}

const canCurate = computed(() => candidateCount.value > 0 && Boolean(directorLabel.value) && !isCurating.value)

async function handleNameTrigger() {
  const items = candidateExpressions.value.map(key => ({
    key,
    currentLabel: expressionMappings.value[key] || key,
    isCustomRenamed: Boolean(expressionMappings.value[key]) && expressionMappings.value[key] !== key,
    isFavorite: false,
    category: undefined as string | undefined,
  }))

  const result = await curateExpressions(
    props.modelId,
    modelType.value,
    items,
    {
      characterName: props.companionName,
      personality: props.personaPersonality,
      description: props.personaDescription,
      scenario: props.personaScenario,
      providerId: directorProvider.value || undefined,
      model: directorModel.value || undefined,
    },
  )

  if (result && Array.isArray(result.items)) {
    curationItems.value = JSON.parse(JSON.stringify(result.items))
    curationDone.value = true
    toast.success(`Curated ${curationItems.value.filter(i => !i.shouldSkip).length} keepers out of ${curationItems.value.length}!`)
  }
}

function resetCuration() {
  curationItems.value = []
  curationDone.value = false
  remapsAutoApplied.value = false
}

// --- 12. Remaps step: keeper-constrained dropdowns + one-shot auto-apply ---
// Dropdown source: verified keeper rawKeys. Falls back to noise-filtered
// candidates when Remaps is reached with zero keepers (all hidden / legacy).
const remapOptions = computed(() => {
  const keepers = curationItems.value.filter(i => !i.shouldSkip).map(i => i.rawKey)
  if (curationDone.value && keepers.length > 0) {
    return keepers
  }
  return candidateExpressions.value.length > 0 ? candidateExpressions.value : rawExpressions.value
})

const remapsAutoApplied = ref(false)

function autoApplyKeepersToSlots() {
  if (!curationDone.value || remapsAutoApplied.value) {
    return
  }
  const keepers = curationItems.value.filter(i => !i.shouldSkip)
  if (keepers.length === 0) {
    return
  }
  let filled = 0
  for (const slot of CANONICAL_EMOTIONS) {
    if (expressionMappings.value[slot.id]) {
      continue
    }
    const match = keepers.find(k => slot.matchRegex.test(k.actToken || '') || slot.matchRegex.test(k.label || '') || slot.matchRegex.test(k.rawKey))
    if (match) {
      expressionMappings.value[slot.id] = match.rawKey
      filled += 1
    }
  }
  remapsAutoApplied.value = true
  if (filled > 0) {
    emitSync()
    toast.success(`Auto-mapped ${filled} keeper${filled === 1 ? '' : 's'} onto preset cues — adjust freely.`)
  }
}

// --- 11. Verify step: per-key test-fire + hide (whitelist shaping) ---
const lastPreviewKey = ref('')
let previewResetTimer: number | undefined

const keeperCount = computed(() => curationItems.value.filter(i => !i.shouldSkip).length)

function previewCurationItem(item: CuratedExpressionItem) {
  // Same re-fire guarantee as the soundboard: bounce through neutral so every
  // click visibly replays instead of no-op'ing on the current emotion.
  if (lastPreviewKey.value === item.rawKey) {
    triggerModelEmotion(modelType.value, 'neutral')
    window.setTimeout(() => previewCurationItem(item), 350)
    return
  }
  lastPreviewKey.value = item.rawKey
  triggerModelEmotion(modelType.value, item.rawKey)
  toast.success(`Previewing ${item.label || item.rawKey}`)
  // Release the playing state shortly after the driver's ~3s decay so the
  // button falls back to ▶ instead of sticking on ⏸.
  window.clearTimeout(previewResetTimer)
  previewResetTimer = window.setTimeout(() => {
    if (lastPreviewKey.value === item.rawKey) {
      lastPreviewKey.value = ''
    }
  }, 3200)
}

function toggleCurationSkip(item: CuratedExpressionItem) {
  item.shouldSkip = !item.shouldSkip
  if (item.shouldSkip && lastPreviewKey.value === item.rawKey) {
    lastPreviewKey.value = ''
  }
}

// --- 9. Guided Curation (dots breadcrumb; avatar column untouched) ---
export type GuideStep = 'meet' | 'name' | 'verify' | 'remaps' | null

// Guided artwork (see packages/stage-ui/src/assets/acting/). Cards fall back
// to emoji only while a slot is empty.
const GUIDE_ART = {
  hero: new URL('../../../assets/acting/guide-hero.avif', import.meta.url).href,
  press: new URL('../../../assets/acting/guide-press.avif', import.meta.url).href,
  watch: new URL('../../../assets/acting/guide-watch.avif', import.meta.url).href,
  keep: new URL('../../../assets/acting/guide-keep.avif', import.meta.url).href,
}

// Thumbs-up cheer art for the Name step header.
const GUIDE_CHEER = new URL('../../../assets/acting/guide-cheer.avif', import.meta.url).href

// Detective chibi for the Verify step header.
const GUIDE_VERIFY_ART = new URL('../../../assets/acting/guide-verify.avif', import.meta.url).href

const GUIDE_DOTS = [
  { id: 'meet', label: 'Meet' },
  { id: 'name', label: 'Name' },
  { id: 'verify', label: 'Verify' },
  { id: 'remaps', label: 'Remaps' },
] as const

const guideStep = ref<GuideStep>(props.startGuided ? 'meet' : null)
const isAdvancing = ref(false)

function skipGuide() {
  guideStep.value = null
}

function requestDemoModel() {
  emit('request-model', props.demoModelId)
}

function handleMeetDemo() {
  if (isAdvancing.value) {
    return
  }

  // Anchor health-check: ensure the surprise slot resolves before promising a deterministic demo
  if (!expressionMappings.value.surprise) {
    runAutoCalibration(true, false)
  }

  const key = expressionMappings.value.surprise
  if (!key) {
    // No surprise-like expression on this model — that IS the lesson
    toast.info('No surprise-like expression on this model — and that is exactly the point. No two models ship the same expressions.')
    isAdvancing.value = true
    window.setTimeout(() => {
      guideStep.value = 'name'
      isAdvancing.value = false
    }, 1600)
    return
  }

  triggerPreview('surprise')
  toast.success(`See that? ${key} works — that's a keeper! ✨`)
  isAdvancing.value = true
  window.setTimeout(() => {
    guideStep.value = 'name'
    isAdvancing.value = false
  }, 1600)
}

const GUIDE_ORDER: Exclude<GuideStep, null>[] = ['meet', 'name', 'verify', 'remaps']

// Compact avatar panel for the Meet leg only: the viewport caps at 300px so
// the footer stays glued to content instead of a stretched full-body frame.
// Name/Verify/Remaps keep the tall frame (Verify matches Name's height).
const viewportCapClass = computed(() => guideStep.value === 'meet' ? 'max-h-[300px]' : '')

const guideStepIndex = computed(() => guideStep.value ? GUIDE_ORDER.indexOf(guideStep.value) : -1)

// Finish celebration: warm handoff once the whitelist is real. Sync already
// applied everything continuously — this is pure ceremony + tally.
const showFinishModal = ref(false)
const finishTally = computed(() => Object.keys(buildCompiledWhitelist().emotions).length)

// Autonomous Cues Recommendation Pitch on Finish
const enableAutoCues = ref(false)
const showProviderPicker = ref(false)

const isCardAutoCuesInitiallyEnabled = computed(() => {
  return Boolean((activeCard.value as any)?.extensions?.airi?.acting?.autoCuesEnabled)
})

const shouldShowAutoCuesPitch = computed(() => {
  return props.finishContext !== 'onboarding' && !isCardAutoCuesInitiallyEnabled.value
})

const isOpenRouterConfigured = computed(() => {
  return Boolean(providersStore.configuredProviders['openrouter-ai'])
})

const systemOneProviderBadge = computed(() => {
  if (systemOneStore.activeProvider === 'laya-local') {
    return { label: 'On-Device Laya', tone: 'emerald' as const }
  }
  if (systemOneStore.activeProvider === 'openrouter-ai') {
    return { label: 'OpenRouter Jev', tone: 'sky' as const }
  }
  return { label: systemOneStore.activeProvider || 'Default', tone: 'neutral' as const }
})

function selectSystemOneProvider(providerId: 'laya-local' | 'openrouter-ai') {
  systemOneStore.activeProvider = providerId
  if (providerId === 'openrouter-ai') {
    systemOneStore.activeModel = 'typesafe/jev-1.13'
  }
  else if (providerId === 'laya-local') {
    systemOneStore.activeModel = 'tozp/laya-onnx'
  }
}

watch(enableAutoCues, (enabled) => {
  if (enabled && !systemOneStore.configured) {
    // Zero-friction: auto-select on-device Laya so System-1 is immediately armed without requiring an API key
    selectSystemOneProvider('laya-local')
  }
})

function handleFinish() {
  showFinishModal.value = true
}

async function confirmFinish() {
  if (shouldShowAutoCuesPitch.value && enableAutoCues.value && activeCard.value && activeCardId.value) {
    try {
      const currentCard = activeCard.value as any
      const extensions = JSON.parse(JSON.stringify(currentCard.extensions || {}))
      if (!extensions.airi)
        extensions.airi = {}
      if (!extensions.airi.acting)
        extensions.airi.acting = {}
      extensions.airi.acting.autoCuesEnabled = true

      await airiCardStore.updateCard(activeCardId.value, {
        ...currentCard,
        extensions,
      })
      toast.success('Autonomous Cues enabled!')
    }
    catch (err) {
      console.warn('[EmotionCalibrationStudio] Failed to save autoCuesEnabled on card:', err)
    }
  }

  showFinishModal.value = false
  skipGuide()
  emit('finish')
}

function goGuideStep(step: Exclude<GuideStep, null>) {
  // Dots allow revisiting visited steps; forward motion stays on Next buttons
  if (GUIDE_ORDER.indexOf(step) <= guideStepIndex.value) {
    guideStep.value = step
  }
}

watch(guideStep, (step) => {
  if (step === 'remaps') {
    autoApplyKeepersToSlots()
    // Re-render the template from post-apply mappings so Review/Edit shows
    // exactly what the current dropdowns teach — unless the text went bespoke
    // this session (hand-saved or Enhanced), which stays locked.
    if (!sessionBespoke.value) {
      refreshTemplatedDirectives()
    }
  }
})

watch(expressionMappings, () => {
  // Only follow pristine template renders: any divergence (pre-existing card
  // prompt, hand edit, Enhance output) means hands off.
  if (!sessionBespoke.value && actingDirectivesPrompt.value === lastRenderedTemplate.value) {
    refreshTemplatedDirectives()
  }
}, { deep: true })

function handleMappingChange() {
  emitSync()
}

watch(() => props.modelId, async (newId) => {
  if (newId) {
    resetPreviewPosition()
    resetCuration()
    await initializeStageRenderer()
    await loadModelCapabilities()
    if (shouldAutoCalibrate()) {
      runAutoCalibration(true, true)
    }
  }
})

onMounted(async () => {
  await initializeStageRenderer()
  await loadModelCapabilities()
  if (props.autoCalibrateOnMount && shouldAutoCalibrate()) {
    runAutoCalibration(true, true)
  }
})

onBeforeUnmount(() => {
  emitSync()
})
</script>

<template>
  <!-- Main 2-Column Dashboard Cockpit -->
  <div :class="['grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch', contentHeightClass]">
    <!-- Left Column: Live Avatar Viewport Frame & Tactile Soundboard (5 cols) -->
    <div :class="['md:col-span-5 flex flex-col gap-3 h-full min-h-0 overflow-hidden']">
      <!-- Live Avatar Viewport Frame -->
      <div :class="['rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-gradient-to-b from-neutral-100/90 to-neutral-200/50 dark:from-neutral-900/90 dark:to-neutral-950/90 overflow-hidden relative shadow-sm flex flex-col items-center justify-between p-3 flex-1 min-h-0', viewportCapClass]">
        <!-- Top Badge: Model Format & Name -->
        <div :class="['w-full flex items-center justify-between z-10 shrink-0 pointer-events-auto']">
          <span :class="['px-2.5 py-0.8 rounded-full text-[10px] font-mono font-medium border border-neutral-200/80 dark:border-white/10 bg-white/80 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300 backdrop-blur-sm shadow-xs']">
            {{ modelFormatLabel }}
          </span>
          <div :class="['flex items-center gap-1.5']">
            <span
              :class="[
                'px-2 py-0.8 rounded-full text-[10px] font-mono font-medium border backdrop-blur-sm shadow-xs',
                isLiveCanvas
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300',
              ]"
              :title="isLiveCanvas ? 'Live canvas mounted — previews fire here' : 'Static fallback image — previews cannot visibly fire in this window'"
            >
              {{ isLiveCanvas ? '● LIVE' : '○ STATIC' }}
            </span>
            <button
              v-if="modelType === 'vrm'"
              type="button"
              title="Frame at face level"
              :class="[
                'px-2 py-0.8 rounded-full text-[10px] font-mono font-medium border backdrop-blur-sm shadow-xs transition-colors cursor-pointer',
                faceFramed
                  ? 'border-primary-500 bg-primary-500/15 text-primary-600 dark:text-primary-300'
                  : 'border-neutral-200/80 dark:border-white/10 bg-white/80 dark:bg-neutral-800/80 text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200',
              ]"
              @click="toggleFaceFrame"
            >
              {{ faceFramed ? '◉ Face' : '○ Face' }}
            </button>
            <span
              v-if="isLoadingExpressions || isLoadingModel"
              :class="['flex items-center gap-1 text-[10px] text-primary-500 font-medium animate-pulse']"
            >
              <div :class="['i-solar:refresh-linear w-3 h-3 animate-spin']" />
              <span>{{ isLoadingModel ? 'Mounting Model...' : 'Scanning...' }}</span>
            </span>
          </div>
        </div>

        <!-- Live 3D/2D Avatar Model Viewport Surface -->
        <div :class="['relative flex-1 w-full flex items-center justify-center overflow-hidden my-1 min-h-0']">
          <!-- Ambient Glow -->
          <div :class="['absolute w-36 h-36 rounded-full bg-primary-500/15 blur-2xl pointer-events-none z-0']" />

          <!-- Live RendererStage Canvas -->
          <RendererStage
            v-if="stageModelReady && stageModelRenderer && stageModelRenderer !== 'disabled' && (settingsStore.stageModelSelected === modelId || settingsStore.stageModelSelectedDisplayModel?.id === modelId)"
            v-model:state="stageState"
            :focus-at="{ x: 0, y: 0 }"
            :paused="false"
            :show-background="false"
            :radial-menu-enabled="false"
            :draggable="true"
            :x-offset="previewXOffset"
            :y-offset="previewYOffset"
            :scale="previewScale"
            :class="['absolute inset-0 h-full w-full z-0']"
            @offset-change="({ x, y }) => { previewXOffset = x; previewYOffset = y; handleViewportDrag() }"
            @scale-change="(s) => { previewScale = s; handleViewportDrag() }"
          />

          <!-- Fallback Static Asset Preview while loading / unmounted -->
          <div
            v-else
            :class="['flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500 space-y-2 select-none z-0']"
          >
            <img
              v-if="avatarPreviewUrl"
              :src="avatarPreviewUrl"
              :alt="modelFormatLabel"
              :class="['h-full max-h-[190px] object-contain drop-shadow-md']"
            >
            <div
              v-else
              :class="['w-20 h-20 rounded-full border-2 border-dashed border-primary-500/40 dark:border-primary-400/30 flex items-center justify-center bg-primary-500/5']"
            >
              <div :class="['i-solar:user-bold-duotone w-10 h-10 text-primary-500/70']" />
            </div>
          </div>

          <!-- Emotion Reaction Bubble Overlay -->
          <transition name="fade">
            <div
              v-if="activePlayingEmotion !== 'neutral'"
              :class="['absolute top-1 right-3 px-2.5 py-0.8 rounded-full bg-neutral-900/85 dark:bg-white/95 text-white dark:text-neutral-900 text-xs font-bold shadow-lg backdrop-blur-sm animate-bounce flex items-center gap-1 z-20 pointer-events-none']"
            >
              <span>{{ SOUNDBOARD_EMOTIONS.find(e => e.id === activePlayingEmotion)?.emoji || '✨' }}</span>
              <span :class="['capitalize text-[11px]']">{{ activePlayingEmotion }}</span>
            </div>
          </transition>

          <!-- Bottom Right: Reset Position Pill if moved -->
          <button
            v-if="previewXOffset !== 0 || previewYOffset !== 0 || previewScale !== 1"
            type="button"
            title="Reset Avatar Position"
            :class="['absolute bottom-2 right-2 z-20 px-2 py-1 rounded-lg bg-neutral-900/80 backdrop-blur-md border border-neutral-700/60 text-[10px] font-mono text-neutral-300 hover:text-white flex items-center gap-1 shadow-md cursor-pointer transition-all']"
            @click="resetPreviewPosition"
          >
            <div :class="['i-solar:restart-bold w-3 h-3']" />
            <span>Reset Pos</span>
          </button>
        </div>

        <!-- Bottom HUD Bar: "Now Playing" Pill & Reset Button -->
        <div :class="['w-full flex items-center justify-between z-10 pt-1.5 border-t border-neutral-200/60 dark:border-white/5 shrink-0 pointer-events-auto']">
          <div :class="['flex items-center gap-1.5 text-xs']">
            <span :class="['w-2 h-2 rounded-full', activePlayingEmotion !== 'neutral' ? 'bg-cyan-500 animate-ping' : 'bg-emerald-500']" />
            <span :class="['text-[11px] font-medium text-neutral-600 dark:text-neutral-300']">
              Now playing:
              <strong :class="['text-neutral-900 dark:text-white capitalize font-semibold']">
                {{ activePlayingEmotion === 'neutral' ? 'Idle / Neutral' : activePlayingEmotion }}
              </strong>
              <span v-if="activePlayingBlendshape && activePlayingBlendshape !== 'neutral'" :class="['text-[10px] text-neutral-400 font-mono ml-1']">
                ({{ activePlayingBlendshape }})
              </span>
            </span>
          </div>

          <button
            type="button"
            :class="['px-2 py-0.8 rounded-lg text-[10px] font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer']"
            title="Reset to neutral pose"
            @click="handleResetNeutral"
          >
            <div :class="['i-solar:restart-bold w-3 h-3']" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      <!-- Tactile 6-Emotion Soundboard -->
      <div :class="['rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/70 dark:bg-neutral-900/60 p-3 shadow-sm shrink-0']">
        <div :class="['text-[10px] font-bold tracking-wider uppercase text-neutral-400 dark:text-neutral-500 mb-2 flex items-center justify-between']">
          <span>Expression preview</span>
          <span :class="['text-[9px] font-normal text-neutral-400 lowercase']">click to preview</span>
        </div>

        <div :class="['grid grid-cols-3 gap-1.5']">
          <button
            v-for="item in SOUNDBOARD_EMOTIONS"
            :key="item.id"
            type="button"
            :class="[
              'px-2 py-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none',
              activePlayingEmotion === item.id
                ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-300 ring-1 ring-primary-500 shadow-sm'
                : 'border-neutral-200/70 dark:border-white/5 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
            ]"
            @click="triggerPreview(item.id)"
          >
            <span :class="['text-sm']">{{ item.emoji }}</span>
            <span>{{ item.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Right Column: Unified Expression Mapping & Directives Hub (7 cols) -->
    <div :class="['md:col-span-7 flex flex-col gap-3 h-full']">
      <!-- Guided Curation: dots breadcrumb + step body (avatar column untouched) -->
      <div v-if="guideStep === 'meet' || guideStep === 'name' || guideStep === 'verify'" :class="['rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/70 dark:bg-neutral-900/60 p-5 sm:p-6 shadow-sm flex-1 min-h-0 flex flex-col gap-5 overflow-y-auto']">
        <!-- Dots breadcrumb -->
        <div :class="['flex items-center justify-between shrink-0']">
          <div :class="['flex items-center gap-1.5']">
            <template v-for="(dot, i) in GUIDE_DOTS" :key="dot.id">
              <div :class="['flex items-center gap-1.5']">
                <button
                  type="button"
                  :disabled="i > guideStepIndex"
                  :class="[
                    'w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors',
                    dot.id === guideStep
                      ? 'bg-primary-600 text-white'
                      : i < guideStepIndex
                        ? 'bg-primary-500/20 text-primary-600 dark:text-primary-300 cursor-pointer'
                        : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400',
                  ]"
                  :title="dot.label"
                  @click="goGuideStep(dot.id)"
                >
                  {{ i + 1 }}
                </button>
                <span :class="['text-[11px] font-medium', dot.id === guideStep ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-400 dark:text-neutral-500']">
                  {{ dot.label }}
                </span>
              </div>
              <div v-if="i < GUIDE_DOTS.length - 1" :class="['w-3 h-px bg-neutral-200 dark:bg-neutral-700']" />
            </template>
          </div>
          <button
            type="button"
            :class="['text-[11px] font-medium text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer']"
            @click="skipGuide"
          >
            Skip
          </button>
        </div>

        <template v-if="guideStep === 'meet'">
          <!-- Meet body -->
          <div :class="['shrink-0 flex items-start justify-between gap-3']">
            <div>
              <h3 :class="['text-base font-bold text-neutral-900 dark:text-white flex items-center gap-1.5']">
                <span>✨</span>
                <span>Let's see what works!</span>
              </h3>
              <p :class="['mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed']">
                Every avatar ships a different set of facial expressions. Some work beautifully, some do nothing at all.
              </p>
            </div>
            <img
              v-if="GUIDE_ART.hero"
              :src="GUIDE_ART.hero"
              alt=""
              :class="['w-28 h-28 shrink-0 object-contain']"
            >
          </div>

          <!-- How-it-works trio -->
          <div :class="['grid grid-cols-3 gap-2 shrink-0']">
            <div :class="['rounded-xl border border-neutral-200/70 dark:border-white/10 bg-neutral-50/60 dark:bg-neutral-800/40 p-2.5 flex flex-col gap-1']">
              <img v-if="GUIDE_ART.press" :src="GUIDE_ART.press" alt="" :class="['w-full h-24 object-contain rounded-lg']">
              <span v-else :class="['text-lg']">😊</span>
              <div :class="['text-[11px] font-bold text-neutral-800 dark:text-neutral-100']">
                Try an expression
              </div>
              <div :class="['text-[10px] text-neutral-500 dark:text-neutral-400 leading-snug']">
                Tap an expression button to preview it on your avatar.
              </div>
            </div>
            <div :class="['rounded-xl border border-neutral-200/70 dark:border-white/10 bg-neutral-50/60 dark:bg-neutral-800/40 p-2.5 flex flex-col gap-1']">
              <img v-if="GUIDE_ART.watch" :src="GUIDE_ART.watch" alt="" :class="['w-full h-24 object-contain rounded-lg']">
              <span v-else :class="['text-lg']">👀</span>
              <div :class="['text-[11px] font-bold text-neutral-800 dark:text-neutral-100']">
                Watch the avatar
              </div>
              <div :class="['text-[10px] text-neutral-500 dark:text-neutral-400 leading-snug']">
                See how it looks and feels. Some will work great, others might do nothing.
              </div>
            </div>
            <div :class="['rounded-xl border border-neutral-200/70 dark:border-white/10 bg-neutral-50/60 dark:bg-neutral-800/40 p-2.5 flex flex-col gap-1']">
              <img v-if="GUIDE_ART.keep" :src="GUIDE_ART.keep" alt="" :class="['w-full h-24 object-contain rounded-lg']">
              <div v-else :class="['flex items-center gap-1']">
                <span :class="['px-1.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-[10px] font-bold']">✓ Keep</span>
                <span :class="['px-1.5 py-0.5 rounded-lg bg-neutral-500/10 text-neutral-400 text-[10px] font-bold']">Hide</span>
              </div>
              <div :class="['text-[11px] font-bold text-neutral-800 dark:text-neutral-100']">
                Keep what works
              </div>
              <div :class="['text-[10px] text-neutral-500 dark:text-neutral-400 leading-snug']">
                The expressions you keep will be available to your companion.
              </div>
            </div>
          </div>

          <!-- Deterministic demo CTA -->
          <div :class="['rounded-xl border border-primary-500/25 bg-primary-500/5 p-3 flex flex-col gap-2 shrink-0']">
            <div :class="['text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed']">
              Try an expression and watch your avatar:
            </div>
            <button
              type="button"
              :disabled="isAdvancing"
              :class="['w-full py-2.5 rounded-xl bg-primary-500 hover:bg-primary-400 text-white text-sm font-semibold shadow-md shadow-primary-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60']"
              @click="handleMeetDemo"
            >
              <span>{{ isAdvancing ? "Nice — that's a keeper! ✨" : 'Try Surprise →' }}</span>
            </button>
            <div :class="['flex items-center justify-end gap-2']">
              <button
                v-if="allowModelSwitch && modelId !== demoModelId"
                type="button"
                :class="['px-3 py-1.5 rounded-xl text-[11px] font-medium border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer']"
                @click="requestDemoModel"
              >
                Load demo model (AvatarSample_B)
              </button>
            </div>
          </div>
        </template>
        <template v-else-if="guideStep === 'name'">
          <!-- Name step: stats → AI gate → curation trigger -->
          <div :class="['flex items-start justify-between gap-4 shrink-0']">
            <div :class="['flex flex-col gap-2 py-2']">
              <h3 :class="['text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-2']">
                <span>🏷️</span>
                <span>Name what survived</span>
              </h3>
              <p :class="['text-base text-neutral-500 dark:text-neutral-400 leading-relaxed']">
                We'll scan {{ companionName }}'s avatar for facial expressions, filter out what doesn't work,
                and give the rest clean names.
              </p>
            </div>
            <img
              v-if="GUIDE_CHEER"
              :src="GUIDE_CHEER"
              alt=""
              :class="['w-36 h-36 shrink-0 object-contain']"
            >
          </div>

          <!-- Detected Expressions card -->
          <div :class="['rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-neutral-950/40 dark:bg-neutral-950/40 p-5 flex flex-col gap-4 shrink-0']">
            <div :class="['text-sm font-bold text-neutral-800 dark:text-neutral-100']">
              Detected Expressions in Your Model
            </div>
            <div :class="['grid grid-cols-3 gap-3']">
              <div :class="['flex flex-col gap-1 border-r border-neutral-200/60 dark:border-white/5 pr-3']">
                <span :class="['text-2xl']">😊</span>
                <span :class="['text-4xl font-bold text-violet-400 font-mono']">{{ rawCount }}</span>
                <span :class="['text-sm font-bold text-violet-300']">Total Facial Expressions</span>
                <span :class="['text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed']">Everything the model exposes — including tracking shapes we may filter out.</span>
              </div>
              <div :class="['flex flex-col gap-1 border-r border-neutral-200/60 dark:border-white/5 pr-3']">
                <span :class="['text-2xl']">✨</span>
                <span :class="['text-4xl font-bold text-primary-400 font-mono']">{{ candidateCount }}</span>
                <span :class="['text-sm font-bold text-primary-300']">Available Facial Expressions</span>
                <span :class="['text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed']">Expressions that passed the first filter and are ready for AI review. <span :class="['text-neutral-400 dark:text-neutral-500']">({{ noiseCount }} filtered out.)</span></span>
              </div>
              <div :class="['flex flex-col gap-1']">
                <span :class="['text-2xl']">🏃</span>
                <span :class="['text-4xl font-bold text-sky-400 font-mono']">{{ motionCount }}</span>
                <span :class="['text-sm font-bold text-sky-300']">Body Motions</span>
                <span :class="['text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed']">Movements your character can perform, like nods, poses, waves, and dances.</span>
              </div>
            </div>
          </div>

          <!-- Zero-expression early exit -->
          <div v-if="zeroExpressions && !isLoadingExpressions" :class="['rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 flex flex-col gap-2 shrink-0']">
            <div :class="['text-base font-bold text-amber-700 dark:text-amber-300']">
              We couldn't find any facial expressions this model can activate 😔
            </div>
            <div :class="['text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed']">
              You can continue setting up AIRI, but expression acting won't be available for this avatar.
              Try another model, or skip ahead — everything else still works.
            </div>
          </div>

          <!-- AI task section -->
          <div v-else :class="['rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-neutral-950/40 dark:bg-neutral-950/40 p-5 flex flex-col gap-4 shrink-0']">
            <div :class="['grid grid-cols-1 sm:grid-cols-5 gap-4']">
              <div :class="['sm:col-span-3 flex flex-col gap-3']">
                <div :class="['flex items-center gap-2.5']">
                  <span :class="['text-2xl']">🧠</span>
                  <div>
                    <div :class="['text-base font-bold text-neutral-800 dark:text-neutral-100']">
                      Choose the AI for this task
                    </div>
                    <div :class="['text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed']">
                      A smarter model gives better names. This only affects this step — never your character's global brain.
                    </div>
                  </div>
                </div>
                <BrainModelPicker
                  :provider="directorProvider"
                  :model="directorModel"
                  title="Step director"
                  side="bottom"
                  align="start"
                  @update:provider="directorProvider = $event"
                  @update:model="directorModel = $event"
                >
                  <template #trigger>
                    <!-- NOTE: no @click here on purpose. PopoverTrigger as-child
                      injects its own open/close pointer handling; an extra toggle
                      would immediately shut what it just opened. -->
                    <button
                      type="button"
                      :class="['w-full flex items-center gap-3 rounded-xl border border-neutral-200/70 dark:border-white/10 bg-white/60 dark:bg-neutral-800/60 px-4 min-h-[56px] py-2.5 text-left transition-colors cursor-pointer hover:border-primary-500/50']"
                    >
                      <span :class="['w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-base font-bold flex items-center justify-center']">
                        {{ (directorModelShort || directorProvider || '?').charAt(0).toUpperCase() }}
                      </span>
                      <span :class="['flex-1 min-w-0']">
                        <span :class="['block text-sm font-bold text-neutral-800 dark:text-neutral-100 truncate']">
                          {{ directorModelShort || 'Pick a model…' }}
                        </span>
                        <span :class="['block text-[11px] text-neutral-400 truncate']">
                          {{ directorProvider || 'No provider' }}{{ directorIsGlobal ? ' (global)' : ' (this step only)' }}
                        </span>
                      </span>
                      <span :class="['i-solar:alt-arrow-down-bold text-sm text-neutral-400 shrink-0']" />
                    </button>
                  </template>
                </BrainModelPicker>
                <button
                  v-if="!directorIsGlobal && directorLabel"
                  type="button"
                  :class="['self-start text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 underline cursor-pointer']"
                  @click="resetDirectorToGlobal"
                >
                  Back to global brain
                </button>
              </div>
              <div :class="['sm:col-span-2 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/60 dark:bg-neutral-800/30 p-4 flex flex-col items-center text-center gap-2 justify-center']">
                <span :class="['text-3xl']">🤖</span>
                <span :class="['text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed']">
                  The director will quickly test each expression, watch how your avatar moves, and keep only the ones that work.
                </span>
              </div>
            </div>
            <div v-if="!curationDone && !directorLabel" :class="['text-xs font-semibold text-amber-600 dark:text-amber-400']">
              Pick an AI above to enable scanning.
            </div>
            <div v-if="curationDone" :class="['flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-300 font-semibold']">
              <span>✓ {{ curationItems.filter(i => !i.shouldSkip).length }} keepers named out of {{ curationItems.length }} — review them next.</span>
            </div>
            <button
              v-if="!curationDone"
              type="button"
              :disabled="!canCurate"
              :class="['w-full py-4 rounded-2xl bg-primary-500 hover:bg-primary-400 text-white text-base font-semibold shadow-md shadow-primary-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed']"
              @click="handleNameTrigger"
            >
              <div v-if="isCurating" :class="['i-solar:refresh-linear w-5 h-5 animate-spin']" />
              <span>{{ isCurating ? 'Asking the director…' : `✨ Start scanning my expressions (${candidateCount})` }}</span>
            </button>
            <div :class="['text-[11px] text-neutral-400 text-center']">
              This usually takes a few moments. You'll review and rename everything next.
            </div>
            <div v-if="curationError" :class="['text-xs text-red-500 dark:text-red-400']">
              {{ curationError }}
            </div>
          </div>

          <div :class="['flex items-center justify-between shrink-0 pt-1']">
            <button
              type="button"
              :class="['px-4 py-2 rounded-xl text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer']"
              @click="guideStep = 'meet'"
            >
              ← Back
            </button>
            <button
              type="button"
              :disabled="zeroExpressions || (!curationDone)"
              :class="['px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed']"
              @click="guideStep = 'verify'"
            >
              Next →
            </button>
          </div>
        </template>
        <template v-else-if="guideStep === 'verify'">
          <!-- Verify step: per-key test-fire + hide (whitelist shaping).
            Edits here are local until Remaps compiles + persists them. -->
          <div :class="['flex items-start justify-between gap-3 shrink-0']">
            <div :class="['flex flex-col gap-1']">
              <h3 :class="['text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2']">
                <span>🔍</span>
                <span>Verify each keeper</span>
                <span :class="['px-2 py-0.5 rounded-full bg-primary-500/15 text-primary-600 dark:text-primary-300 text-[10px] font-bold']">
                  {{ keeperCount }} keepers
                </span>
              </h3>
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed']">
                Press play on each surviving expression and watch the avatar. If a key does nothing visible,
                hide it with the eye control. Only verified keys become your character's whitelist.
              </p>
            </div>
            <img
              v-if="GUIDE_VERIFY_ART"
              :src="GUIDE_VERIFY_ART"
              alt=""
              :class="['w-20 h-20 shrink-0 object-contain']"
            >
          </div>

          <!-- Empty state: reached Verify without a Name pass -->
          <div v-if="curationItems.length === 0" :class="['rounded-xl border border-neutral-200/70 dark:border-white/10 bg-neutral-50/60 dark:bg-neutral-800/40 p-3 flex flex-col gap-1 shrink-0']">
            <div :class="['text-xs font-bold text-neutral-700 dark:text-neutral-200']">
              Nothing to verify yet
            </div>
            <div :class="['text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed']">
              Run the Name step's scan first — its keepers land in this list for test-firing.
            </div>
          </div>

          <!-- Keeper table (ported from the curator modal's review pass) -->
          <div v-else :class="['flex-none max-h-[420px] overflow-y-auto border border-neutral-200/70 dark:border-white/5 rounded-xl bg-white dark:bg-neutral-900']">
            <table :class="['w-full text-left text-xs']">
              <thead :class="['sticky top-0 border-b border-neutral-200 bg-neutral-50 text-[10px] text-neutral-400 font-bold uppercase dark:border-neutral-800 dark:bg-neutral-800/90']">
                <tr>
                  <th :class="['px-3 py-2']">
                    Raw Morph
                  </th>
                  <th :class="['px-3 py-2']">
                    Display Label
                  </th>
                  <th :class="['px-3 py-2']">
                    ACT Action Token
                  </th>
                  <th :class="['px-2 py-2 text-center']">
                    Preview
                  </th>
                  <th :class="['px-2 py-2 text-center']">
                    Keep
                  </th>
                </tr>
              </thead>
              <tbody :class="['divide-y divide-neutral-100 dark:divide-neutral-800']">
                <tr
                  v-for="item in curationItems"
                  :key="item.rawKey"
                  :class="[
                    'transition-colors',
                    item.shouldSkip
                      ? 'opacity-40 bg-neutral-50 dark:bg-neutral-800/30'
                      : lastPreviewKey === item.rawKey
                        ? 'bg-primary-500/10'
                        : 'hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40',
                  ]"
                >
                  <td :class="['px-3 py-2 text-[11px] text-neutral-500 font-mono dark:text-neutral-400']">
                    <div :class="['max-w-[120px] truncate']" :title="item.rawKey">
                      {{ item.rawKey }}
                    </div>
                    <span v-if="item.shouldSkip && item.skipReason" :class="['block text-[9px] text-amber-600 font-sans dark:text-amber-400']">
                      {{ item.skipReason }}
                    </span>
                  </td>
                  <td :class="['px-3 py-2']">
                    <input
                      v-model="item.label"
                      :disabled="item.shouldSkip"
                      :class="['w-full border border-neutral-200 rounded px-2 py-1 text-xs dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-100 focus:outline-none']"
                    >
                  </td>
                  <td :class="['px-3 py-2 font-mono']">
                    <input
                      v-model="item.actToken"
                      :disabled="item.shouldSkip"
                      :class="['w-full border border-neutral-200 rounded px-2 py-1 text-xs text-primary-600 dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-primary-400 focus:outline-none']"
                    >
                  </td>
                  <td :class="['px-2 py-2 text-center']">
                    <button
                      type="button"
                      :disabled="item.shouldSkip"
                      :class="['cursor-pointer rounded-full p-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed', lastPreviewKey === item.rawKey ? 'bg-primary-500 text-white' : 'text-neutral-400 hover:bg-primary-500/10 hover:text-primary-500 dark:text-neutral-500']"
                      title="Preview on avatar"
                      @click="previewCurationItem(item)"
                    >
                      <div :class="[lastPreviewKey === item.rawKey ? 'i-solar:pause-bold' : 'i-solar:play-bold', 'w-3.5 h-3.5']" />
                    </button>
                  </td>
                  <td :class="['px-2 py-2 text-center']">
                    <button
                      type="button"
                      :class="[
                        'w-7 h-7 rounded-full text-sm font-bold transition-colors cursor-pointer flex items-center justify-center mx-auto',
                        item.shouldSkip
                          ? 'bg-neutral-200 text-neutral-500 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-600'
                          : 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-300',
                      ]"
                      :title="item.shouldSkip ? 'Hidden — click to keep' : 'Kept — click to hide'"
                      @click="toggleCurationSkip(item)"
                    >
                      <span>{{ item.shouldSkip ? '✕' : '✓' }}</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div :class="['flex items-start gap-2 rounded-xl border border-primary-500/25 bg-primary-500/5 px-3 py-2 shrink-0']">
            <span :class="['text-sm']">💡</span>
            <span :class="['text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed']">
              Once you're happy with what you want to keep, press <strong>Next</strong> — your keepers carry forward automatically.
            </span>
          </div>
          <div :class="['flex items-center justify-between shrink-0 pt-1']">
            <button
              type="button"
              :class="['px-4 py-2 rounded-xl text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer']"
              @click="guideStep = 'name'"
            >
              ← Back
            </button>
            <button
              type="button"
              :class="['px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-all cursor-pointer']"
              @click="guideStep = 'remaps'"
            >
              Next →
            </button>
          </div>
        </template>
      </div>

      <template v-else>
        <!-- Dots breadcrumb (remaps leg) -->
        <div v-if="guideStep === 'remaps'" :class="['flex items-center justify-between shrink-0 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/70 dark:bg-neutral-900/60 px-4 py-2.5 shadow-sm']">
          <div :class="['flex items-center gap-1.5']">
            <template v-for="(dot, i) in GUIDE_DOTS" :key="dot.id">
              <div :class="['flex items-center gap-1.5']">
                <button
                  type="button"
                  :disabled="i > guideStepIndex"
                  :class="[
                    'w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors',
                    dot.id === guideStep
                      ? 'bg-primary-600 text-white'
                      : 'bg-primary-500/20 text-primary-600 dark:text-primary-300 cursor-pointer',
                  ]"
                  :title="dot.label"
                  @click="goGuideStep(dot.id)"
                >
                  {{ i + 1 }}
                </button>
                <span :class="['text-[11px] font-medium', dot.id === guideStep ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-400 dark:text-neutral-500']">
                  {{ dot.label }}
                </span>
              </div>
              <div v-if="i < GUIDE_DOTS.length - 1" :class="['w-3 h-px bg-neutral-200 dark:bg-neutral-700']" />
            </template>
          </div>
        </div>
        <!-- Unified Card 1: Expression Mapping & Calibration -->
        <div :class="['rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/70 dark:bg-neutral-900/60 p-3.5 shadow-sm flex-1 min-h-0 flex flex-col']">
          <!-- Card Header: Title, Auto-Calibrate Sparkle Button, and Advanced Details -->
          <div :class="['flex items-start justify-between gap-2 mb-2 shrink-0']">
            <div :class="['flex items-center gap-2']">
              <div :class="['p-1.5 rounded-xl bg-primary-500/10 text-primary-500 shrink-0']">
                <div :class="['i-solar:smile-circle-bold-duotone w-4 h-4']" />
              </div>
              <div>
                <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5']">
                  <span>Canonical Expression Mapping</span>
                  <span
                    v-if="isCalibrated"
                    :class="['px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-medium']"
                  >
                    Calibrated
                  </span>
                </h3>
                <p :class="['text-[11px] text-neutral-400']">
                  Assign model blendshapes to dialogue acting cues.
                </p>
              </div>
            </div>

            <div :class="['flex items-center gap-2 shrink-0']">
              <!-- Auto-Calibrate Sparkle Button (full view only — guided Remaps owns its slots) -->
              <button
                v-if="guideStep === null"
                type="button"
                :class="[
                  'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap',
                  isCalibrated
                    ? 'border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200'
                    : 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-600/30',
                ]"
                @click="() => runAutoCalibration(false, true)"
              >
                <div :class="[isCalibrated ? 'i-solar:refresh-linear w-3.5 h-3.5' : 'i-solar:stars-line-bold-duotone w-3.5 h-3.5 text-cyan-200']" />
                <span>{{ isCalibrated ? 'Recalibrate' : 'Auto-calibrate' }}</span>
              </button>

              <!-- Advanced Details Link (full view only — the table it opens is superseded by guided Verify) -->
              <button
                v-if="guideStep === null"
                type="button"
                :class="['text-[11px] font-medium text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-0.5 cursor-pointer ml-1']"
                @click="isCurationModalOpen = true"
              >
                <span>Details</span>
                <div :class="['i-solar:alt-arrow-right-linear w-3 h-3']" />
              </button>
            </div>
          </div>

          <!-- Compact Dual Readiness Strip (Saves vertical space) -->
          <div :class="['flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-neutral-50/80 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-white/5 text-[11px] mb-2 shrink-0']">
            <div :class="['flex items-center gap-1.5']">
              <div :class="[mappedSlotsCount > 0 ? 'i-solar:check-circle-bold text-emerald-500' : 'i-solar:circle-linear text-neutral-400', 'w-3.5 h-3.5 shrink-0']" />
              <span :class="['text-neutral-500 dark:text-neutral-400']">Model Expressions:</span>
              <span :class="['font-mono font-semibold text-neutral-800 dark:text-neutral-200']">
                {{ mappedSlotsCount }}/6 mapped
              </span>
            </div>

            <div :class="['flex items-center gap-1.5']">
              <div :class="[isGuidanceReady ? 'i-solar:check-circle-bold text-emerald-500' : 'i-solar:circle-linear text-neutral-400', 'w-3.5 h-3.5 shrink-0']" />
              <span :class="['text-neutral-500 dark:text-neutral-400']">Behavior Guidance:</span>
              <span :class="['font-mono font-semibold', isGuidanceReady ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-500']">
                {{ isGuidanceReady ? 'ACT active' : 'Awaiting calibration' }}
              </span>
            </div>
          </div>

          <!-- Scrollable Canonical Expression Mapping Pane -->
          <div :class="['flex-1 min-h-0 overflow-y-auto divide-y divide-neutral-200/60 dark:divide-white/5 border border-neutral-200/70 dark:border-white/5 rounded-xl bg-white dark:bg-neutral-900 pr-0.5']">
            <div
              v-for="slot in CANONICAL_EMOTIONS"
              :key="slot.id"
              :class="['px-3 py-1.5 flex items-center justify-between gap-2.5 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors']"
            >
              <!-- Slot Badge & Token -->
              <div :class="['flex items-center gap-2 min-w-[130px]']">
                <span :class="['text-base']">{{ slot.emoji }}</span>
                <div :class="['flex flex-col']">
                  <span :class="['font-semibold text-neutral-800 dark:text-neutral-200 text-xs']">
                    {{ slot.name }}
                  </span>
                  <span :class="['text-[9px] font-mono text-neutral-400 dark:text-neutral-500']">
                    &lt;|ACT:{{ slot.actToken }}|&gt;
                  </span>
                </div>
              </div>

              <!-- Blendshape Selection Dropdown -->
              <div :class="['flex-1 max-w-[210px]']">
                <select
                  v-model="expressionMappings[slot.id]"
                  :class="['w-full text-xs py-1 px-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 outline-none focus:border-primary-500 transition-colors cursor-pointer font-mono']"
                  @change="handleMappingChange"
                >
                  <option value="">
                    -- Unmapped --
                  </option>
                  <option
                    v-if="expressionMappings[slot.id] && !remapOptions.includes(expressionMappings[slot.id])"
                    :value="expressionMappings[slot.id]"
                  >
                    {{ expressionMappings[slot.id] }}
                  </option>
                  <option
                    v-for="expr in remapOptions"
                    :key="expr"
                    :value="expr"
                  >
                    {{ expr }}
                  </option>
                </select>
              </div>

              <!-- Live Test Play Button -->
              <button
                type="button"
                :disabled="!expressionMappings[slot.id]"
                :class="[
                  'p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0',
                  expressionMappings[slot.id]
                    ? 'text-neutral-600 dark:text-neutral-300 hover:bg-primary-500/10 hover:text-primary-500'
                    : 'text-neutral-300 dark:text-neutral-700 cursor-not-allowed',
                ]"
                title="Test preview blendshape on stage"
                @click="triggerPreview(slot.id)"
              >
                <div :class="['i-solar:play-bold w-3.5 h-3.5']" />
              </button>
            </div>
          </div>
        </div>

        <!-- Card 2: Acting Directives Hub (Compact) -->
        <div :class="['rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/70 dark:bg-neutral-900/60 p-3.5 shadow-sm shrink-0 flex flex-col gap-2']">
          <div :class="['flex items-center justify-between']">
            <div :class="['flex items-center gap-2']">
              <div :class="['p-1.5 rounded-xl bg-primary-500/10 text-primary-500 shrink-0']">
                <div :class="['i-solar:document-text-bold-duotone w-4 h-4']" />
              </div>
              <div>
                <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                  Acting Directives (ACT Tokens)
                </h3>
                <p :class="['text-[11px] text-neutral-400']">
                  Prompt directives instructing the LLM when to insert physical emotion cues.
                </p>
              </div>
            </div>

            <!-- AI Enhance Button (Only available when acting directives are configured) -->
            <button
              v-if="isGuidanceReady"
              type="button"
              :disabled="isGeneratingPrompt"
              :class="['px-2.5 py-1 rounded-lg text-xs font-medium border border-primary-500/30 bg-primary-500/10 hover:bg-primary-500/20 text-primary-600 dark:text-primary-300 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50']"
              @click="handleEnhanceWithAI"
            >
              <div :class="[isGeneratingPrompt ? 'i-solar:refresh-linear w-3 h-3 animate-spin' : 'i-solar:stars-line-bold-duotone w-3 h-3 text-primary-500']" />
              <span>{{ isGeneratingPrompt ? 'Generating...' : 'Enhance with AI' }}</span>
            </button>
          </div>

          <!-- Main Stateful Hub Button -->
          <button
            type="button"
            :class="[
              'w-full py-2 px-3.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between cursor-pointer group shadow-sm',
              isGuidanceReady
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15',
            ]"
            @click="openDirectivesModal"
          >
            <div :class="['flex items-center gap-2']">
              <div :class="[isGuidanceReady ? 'i-solar:check-circle-bold text-emerald-500' : 'i-solar:danger-circle-bold text-amber-500', 'w-4 h-4']" />
              <span>{{ isGuidanceReady ? 'Acting Directives Configured (Ready)' : 'Configure Acting Directives (Empty Draft)' }}</span>
            </div>
            <div :class="['flex items-center gap-1 text-[11px] opacity-80 group-hover:translate-x-0.5 transition-transform']">
              <span>{{ isGuidanceReady ? 'Review / Edit' : 'Edit Guidance' }}</span>
              <div :class="['i-solar:alt-arrow-right-linear w-3.5 h-3.5']" />
            </div>
          </button>
        </div>
        <!-- Remaps leg nav -->
        <div v-if="guideStep === 'remaps'" :class="['flex items-center justify-between shrink-0 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/70 dark:bg-neutral-900/60 px-4 py-2.5 shadow-sm']">
          <button
            type="button"
            :class="['px-4 py-2 rounded-xl text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer']"
            @click="guideStep = 'verify'"
          >
            ← Back to Verify
          </button>
          <button
            type="button"
            :class="['px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-all cursor-pointer flex items-center gap-1.5']"
            @click="handleFinish"
          >
            <span>Finish ✓</span>
          </button>
        </div>
      </template>
    </div>
  </div>

  <!-- Finish celebration handoff -->
  <DialogRoot :open="showFinishModal" @update:open="showFinishModal = $event">
    <DialogPortal>
      <DialogOverlay :class="['fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity']" />
      <DialogContent
        :class="[
          'fixed left-1/2 top-1/2 z-50 w-[92vw] flex flex-col items-center gap-3 border border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900 shadow-2xl -translate-x-1/2 -translate-y-1/2 focus:outline-none p-6 text-center max-h-[90vh] overflow-y-auto',
          shouldShowAutoCuesPitch ? 'max-w-md' : 'max-w-sm',
        ]"
      >
        <img
          :src="GUIDE_CHEER"
          alt=""
          :class="[shouldShowAutoCuesPitch && enableAutoCues ? 'w-20 h-20' : 'w-24 h-24', 'object-contain transition-all']"
        >
        <div>
          <DialogTitle :class="['text-base font-bold text-neutral-900 dark:text-white']">
            {{ finishContext === 'onboarding' ? `Nice work — ${companionName}'s expressions are set! ✨` : `Looking good — ${companionName} is ready to act! ✨` }}
          </DialogTitle>
          <p :class="['mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed']">
            You collected <strong :class="['text-neutral-800 dark:text-neutral-100']">{{ finishTally }} expression{{ finishTally === 1 ? '' : 's' }}</strong>
            ({{ keeperCount }} verified keeper{{ keeperCount === 1 ? '' : 's' }} + {{ mappedSlotsCount }} preset remap{{ mappedSlotsCount === 1 ? '' : 's' }}).
            <template v-if="finishContext === 'onboarding'">
              Saved to your companion draft — finish the rest of setup and you'll meet {{ companionName }} with a face that actually moves.
            </template>
            <template v-else>
              Everything is already saved — go try talking to {{ companionName }} and watch the difference.
            </template>
          </p>
        </div>

        <!-- Autonomous Cues Recommendation Pitch (Shown when autoCues is not yet active on the character) -->
        <div
          v-if="shouldShowAutoCuesPitch"
          :class="['w-full rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-800/50 p-3.5 text-left flex flex-col gap-2.5 transition-all']"
        >
          <!-- Header with Title & Toggle -->
          <div :class="['flex items-start justify-between gap-3']">
            <div :class="['flex items-start gap-2.5']">
              <div :class="['w-8 h-8 rounded-lg bg-primary-500/15 text-primary-500 flex items-center justify-center shrink-0 mt-0.5']">
                <div :class="['i-solar:bolt-circle-bold-duotone w-4.5 h-4.5']" />
              </div>
              <div :class="['flex flex-col']">
                <div :class="['flex items-center gap-1.5 flex-wrap']">
                  <span :class="['text-xs font-semibold text-neutral-900 dark:text-white']">
                    Autonomous Cues
                  </span>
                  <span :class="['px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-primary-500/15 text-primary-600 dark:text-primary-300']">
                    Recommended
                  </span>
                </div>
                <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug']">
                  Automatically triggers expressions in real time as dialogue streams, without relying on the AI model to type markers.
                </p>
              </div>
            </div>

            <!-- Toggle Switch (toggle pattern per UI convention) -->
            <label :class="['relative inline-flex items-center cursor-pointer shrink-0 mt-1']">
              <input
                v-model="enableAutoCues"
                type="checkbox"
                :class="['sr-only peer']"
              >
              <div :class="['w-10 h-5.5 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-empty after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-primary-600']" />
            </label>
          </div>

          <!-- Expanded System-1 Provider Choice / Status when toggled ON -->
          <div
            v-if="enableAutoCues"
            :class="['pt-2.5 border-t border-neutral-200/70 dark:border-neutral-700/60 flex flex-col gap-2 transition-all']"
          >
            <!-- Case 1: System-1 is already configured and user is not changing engine -->
            <div
              v-if="systemOneStore.configured && !showProviderPicker"
              :class="['flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 rounded-lg px-2.5 py-1.5']"
            >
              <div :class="['flex items-center gap-1.5']">
                <div :class="['i-solar:check-circle-bold w-3.5 h-3.5']" />
                <span>System-1 Ready ({{ systemOneProviderBadge.label }})</span>
              </div>
              <button
                type="button"
                :class="['text-[10px] text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 underline cursor-pointer']"
                @click="showProviderPicker = true"
              >
                Change engine
              </button>
            </div>

            <!-- Case 2: System-1 is unconfigured OR user clicked 'Change engine' -->
            <div
              v-else
              :class="['flex flex-col gap-1.5']"
            >
              <div :class="['flex items-center justify-between text-[11px] font-medium text-neutral-700 dark:text-neutral-300']">
                <span>Select classification engine:</span>
                <button
                  v-if="systemOneStore.configured && showProviderPicker"
                  type="button"
                  :class="['text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer']"
                  @click="showProviderPicker = false"
                >
                  Done
                </button>
                <span v-else-if="!systemOneStore.configured" :class="['text-[10px] text-amber-500']">Setup required</span>
              </div>

              <div :class="['grid grid-cols-2 gap-2']">
                <!-- Option 1: On-Device (Laya) -->
                <button
                  type="button"
                  :class="[
                    'p-2 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer',
                    systemOneStore.activeProvider === 'laya-local'
                      ? 'border-primary-500 bg-primary-500/10 ring-1 ring-primary-500 text-neutral-900 dark:text-white'
                      : 'border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600 text-neutral-600 dark:text-neutral-300',
                  ]"
                  @click="selectSystemOneProvider('laya-local')"
                >
                  <div :class="['flex items-center justify-between']">
                    <div :class="['flex items-center gap-1.5 text-xs font-semibold']">
                      <div :class="['i-solar:laptop-minimalistic-bold-duotone text-primary-500 w-3.5 h-3.5']" />
                      <span>On-Device</span>
                    </div>
                    <div v-if="systemOneStore.activeProvider === 'laya-local'" :class="['i-solar:check-circle-bold text-primary-500 text-xs']" />
                  </div>
                  <span :class="['text-[10px] text-emerald-600 dark:text-emerald-400 font-medium']">
                    100% Offline · Free
                  </span>
                  <span :class="['text-[9px] text-neutral-400 leading-tight']">
                    No API key needed
                  </span>
                </button>

                <!-- Option 2: Cloud (OpenRouter) -->
                <button
                  type="button"
                  :class="[
                    'p-2 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer',
                    systemOneStore.activeProvider === 'openrouter-ai'
                      ? 'border-primary-500 bg-primary-500/10 ring-1 ring-primary-500 text-neutral-900 dark:text-white'
                      : 'border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600 text-neutral-600 dark:text-neutral-300',
                  ]"
                  @click="selectSystemOneProvider('openrouter-ai')"
                >
                  <div :class="['flex items-center justify-between']">
                    <div :class="['flex items-center gap-1.5 text-xs font-semibold']">
                      <div :class="['i-solar:cloud-bold-duotone text-primary-500 w-3.5 h-3.5']" />
                      <span>Cloud Jev</span>
                    </div>
                    <div v-if="systemOneStore.activeProvider === 'openrouter-ai'" :class="['i-solar:check-circle-bold text-primary-500 text-xs']" />
                  </div>
                  <span :class="['text-[10px] font-medium', isOpenRouterConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500']">
                    {{ isOpenRouterConfigured ? 'Key Configured' : 'Needs Key' }}
                  </span>
                  <span :class="['text-[9px] text-neutral-400 leading-tight']">
                    Via OpenRouter API
                  </span>
                </button>
              </div>

              <!-- Helper note if OpenRouter was selected but has no key -->
              <p
                v-if="systemOneStore.activeProvider === 'openrouter-ai' && !isOpenRouterConfigured"
                :class="['text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5']"
              >
                <span :class="['i-solar:info-circle-bold w-3 h-3 shrink-0']" />
                <span>You can add an OpenRouter key in Settings → Providers.</span>
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          :class="['w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold shadow-md shadow-primary-600/30 transition-all cursor-pointer']"
          @click="confirmFinish"
        >
          {{ finishContext === 'onboarding' ? 'Continue setup →' : 'Start chatting →' }}
        </button>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <!-- Acting Directives Full-Span Drawer Modal -->
  <DialogRoot :open="isDirectivesModalOpen" @update:open="isDirectivesModalOpen = $event">
    <DialogPortal>
      <DialogOverlay :class="['fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity']" />
      <DialogContent
        :class="['fixed left-1/2 top-1/2 z-50 max-h-[85vh] max-w-2xl w-[92vw] flex flex-col border border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900 shadow-2xl -translate-x-1/2 -translate-y-1/2 focus:outline-none p-6']"
      >
        <!-- Modal Header -->
        <div :class="['flex shrink-0 items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800']">
          <div :class="['flex items-center gap-2.5']">
            <div :class="['w-9 h-9 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center']">
              <div :class="['i-solar:document-text-bold-duotone w-5 h-5']" />
            </div>
            <div>
              <DialogTitle :class="['text-base font-bold text-neutral-900 dark:text-white']">
                Acting Directives (`modelExpressionPrompt`)
              </DialogTitle>
              <p :class="['text-xs text-neutral-400']">
                Injected into the system prompt to guide when and how the LLM triggers emotion cues.
              </p>
            </div>
          </div>

          <button
            type="button"
            :class="['p-1 rounded-lg text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer']"
            @click="isDirectivesModalOpen = false"
          >
            <div :class="['i-solar:close-circle-bold w-5 h-5']" />
          </button>
        </div>

        <!-- Modal Body: Monospace Textarea -->
        <div :class="['flex-1 min-h-0 py-4 flex flex-col gap-3 overflow-y-auto']">
          <div :class="['text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed']">
            Configure character-specific rules for cue placement, dialogue examples, and emotional restraint.
          </div>

          <textarea
            v-model="tempDirectivesText"
            rows="11"
            :class="['w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-3 text-xs font-mono text-neutral-800 dark:text-neutral-200 outline-none focus:border-primary-500 transition-colors resize-none leading-relaxed']"
            placeholder="Inject physical emotion cues sparingly using official Short Format..."
          />

          <div :class="['p-2.5 rounded-xl bg-primary-500/5 border border-primary-500/20 text-[11px] text-neutral-600 dark:text-neutral-300 flex items-start gap-2']">
            <div :class="['i-solar:info-circle-bold-duotone text-primary-500 w-4 h-4 shrink-0 mt-0.5']" />
            <span>
              Available canonical tokens:
              <strong :class="['text-primary-600 dark:text-primary-400 font-mono']">smile, blush, pout, surprise, wink, shy</strong>.
              Tags are emitted like <code :class="['px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 font-mono text-primary-500']">&lt;|ACT:emotion="smile"|&gt;</code>.
            </span>
          </div>
        </div>

        <!-- Modal Footer -->
        <div :class="['flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800']">
          <button
            type="button"
            :class="['px-3 py-1.5 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1.5']"
            @click="restoreDefaultDirectives"
          >
            <div :class="['i-solar:restart-bold w-3.5 h-3.5']" />
            <span>Restore Default Guidance</span>
          </button>

          <div :class="['flex items-center gap-2']">
            <button
              type="button"
              :class="['px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer']"
              @click="isDirectivesModalOpen = false"
            >
              Cancel
            </button>
            <button
              type="button"
              :class="['px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-all cursor-pointer']"
              @click="saveDirectivesModal"
            >
              Save Directives
            </button>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <!-- Advanced Expression Curation Modal (3-Step Noise Gate Wizard) -->
  <ExpressionCurationModal
    v-model="isCurationModalOpen"
    :model-id="modelId"
    :model-format="modelType"
    :visible-expressions="visibleUnifiedExpressions"
    :all-expressions="allUnifiedExpressions"
    @applied="handleAdvancedCurationApplied"
  />
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.95);
}
</style>
