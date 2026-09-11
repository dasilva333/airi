<script setup lang="ts">
import type { CuratedExpressionItem } from '../../../../../../composables/use-expression-curation'

import { useLive2d } from '@proj-airi/stage-ui-live2d/stores'
import { useMmd } from '@proj-airi/stage-ui-mmd'
import { useSpine } from '@proj-airi/stage-ui-spine'
import { useModelStore } from '@proj-airi/stage-ui-three'
import { storeToRefs } from 'pinia'
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import RendererStage from '../../../../../scenes/RendererStage.vue'
import ExpressionCurationModal from '../../../../dialogs/ExpressionCurationModal.vue'

import { useExpressionCuration } from '../../../../../../composables/use-expression-curation'
import { filterCandidateExpressions } from '../../../../../../libs/character/expression-noise-gate'
import { DisplayModelFormat, useDisplayModelsStore } from '../../../../../../stores/display-models'
import { useSettings } from '../../../../../../stores/settings'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const draft = useOnboardingV3Draft()
const settingsStore = useSettings()
const displayModelsStore = useDisplayModelsStore()
const { stageModelRenderer } = storeToRefs(settingsStore)

const live2dStore = useLive2d()
const modelStore = useModelStore()
const mmdStore = useMmd()
const spineStore = useSpine()

const {
  generateActingPrompt,
  generateDefaultActingPrompt,
  isGeneratingPrompt,
} = useExpressionCuration()

// --- Local Asset Fallback Previews ---
const presetLive2dPreview = new URL('../../../../../../assets/live2d/models/hiyori/preview.png', import.meta.url).href
const presetVrmAvatarAPreview = new URL('../../../../../../assets/vrm/models/AvatarSample-A/preview.png', import.meta.url).href
const presetVrmAvatarBPreview = new URL('../../../../../../assets/vrm/models/AvatarSample-B/preview.png', import.meta.url).href

// --- 1. Active Model & Vessel Resolution ---
const activeModelId = computed(() => draft.state.vesselDisplayModelId || 'preset-live2d-2')

const currentModel = computed(() => {
  return displayModelsStore.displayModels.find(m => m.id === activeModelId.value)
})

const modelType = computed<'live2d' | 'vrm' | 'mmd' | 'spine' | 'unknown'>(() => {
  if (stageModelRenderer.value && stageModelRenderer.value !== 'disabled')
    return stageModelRenderer.value

  if (!currentModel.value) {
    if (activeModelId.value.includes('live2d'))
      return 'live2d'
    if (activeModelId.value.includes('vrm'))
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
    || (activeModelId.value === 'preset-live2d-2' ? 'Hiyori' : activeModelId.value === 'preset-vrm-2' ? 'Seed Girl' : 'AvatarSample_A')
  if (type === 'vrm')
    return `VRM (3D) - ${name}`
  if (type === 'live2d')
    return `Live2D (2D) - ${name}`
  return `${type.toUpperCase()} - ${name}`
})

const avatarPreviewUrl = computed(() => {
  if (currentModel.value && 'previewImage' in currentModel.value && currentModel.value.previewImage)
    return currentModel.value.previewImage
  if (activeModelId.value === 'preset-live2d-2')
    return presetLive2dPreview
  if (activeModelId.value === 'preset-vrm-2')
    return presetVrmAvatarBPreview
  if (activeModelId.value === 'preset-vrm-1')
    return presetVrmAvatarAPreview
  return ''
})

// --- Stage Model Live Mounting ---
const stageModelReady = ref(false)
const isLoadingModel = ref(false)
const stageState = ref<'pending' | 'loading' | 'mounted'>('pending')
const previewXOffset = ref(0)
const previewYOffset = ref(0)
const previewScale = ref(1)

function resetPreviewPosition() {
  previewXOffset.value = 0
  previewYOffset.value = 0
  previewScale.value = 1
}

async function initializeStageRenderer() {
  isLoadingModel.value = true
  try {
    if (activeModelId.value) {
      settingsStore.stageModelSelected = activeModelId.value
      await settingsStore.updateStageModel('onboarding-v3-emotions')
    }
    stageModelReady.value = true
  }
  catch (err) {
    console.warn('[StepEmotions] updateStageModel encountered error:', err)
  }
  finally {
    isLoadingModel.value = false
  }
}

// --- 2. Expressions Extraction & Noise Filtering ---
const rawExpressions = ref<string[]>([])
const candidateExpressions = ref<string[]>([])
const isLoadingExpressions = ref(false)

async function loadModelCapabilities() {
  isLoadingExpressions.value = true
  try {
    const caps = await displayModelsStore.getOrLoadModelCapabilities(activeModelId.value)
    if (caps.expressions && caps.expressions.length > 0) {
      rawExpressions.value = caps.expressions
      const gateResult = filterCandidateExpressions(caps.expressions)
      candidateExpressions.value = gateResult.candidates.length > 0 ? gateResult.candidates : caps.expressions
    }
    else {
      // Fallback candidate vocabulary for uninstantiated or remote models
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
    console.warn('[StepEmotions] Failed to load model capabilities:', e)
    const fallback = ['happy', 'surprised', 'angry', 'relaxed', 'sad', 'neutral', 'blink', 'wink']
    rawExpressions.value = fallback
    candidateExpressions.value = fallback
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
  { id: 'blush', name: 'Blush', emoji: '😳', actToken: 'blush', matchRegex: /relaxed|blush|dere|shy|exp_02|f02/i },
  { id: 'pout', name: 'Pout', emoji: '😠', actToken: 'pout', matchRegex: /angry|pout|rage|irritated|displeased|exp_03|f03/i },
  { id: 'surprise', name: 'Surprise', emoji: '😲', actToken: 'surprise', matchRegex: /surprised|surprise|shock|wide_eye|exp_04|f04/i },
  { id: 'wink', name: 'Wink', emoji: '😉', actToken: 'wink', matchRegex: /wink|blink_l|blink_r|wink_l|wink_r|exp_05|f05/i },
  { id: 'shy', name: 'Shy', emoji: '🙈', actToken: 'shy', matchRegex: /shy|sad|sorrow|troubled|down|cry|tear|exp_06|f06/i },
]

// --- 4. Emotion Mappings & Draft State ---
const expressionMappings = ref<Record<string, string>>({
  ...draft.state.expressionMappings,
})
const isCalibrated = ref<boolean>(Boolean(draft.state.emotionsCurated))
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
    console.error('[StepEmotions] triggerModelEmotion failed:', err)
  }
}

function triggerPreview(emotionId: string) {
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
  const companionName = draft.state.companionName || 'Companion'
  const defaultPrompt = generateDefaultActingPrompt(tokens)
  return `You are ${companionName}. ${defaultPrompt}`
}

const actingDirectivesPrompt = ref<string>(
  draft.state.actingModelExpressionPrompt || '',
)

const mappedSlotsCount = computed(() => {
  return CANONICAL_EMOTIONS.filter(slot => Boolean(expressionMappings.value[slot.id])).length
})

const isGuidanceReady = computed(() => {
  return Boolean(actingDirectivesPrompt.value && actingDirectivesPrompt.value.trim().length > 0)
})

function runAutoCalibration() {
  const candidates = candidateExpressions.value.length > 0 ? candidateExpressions.value : rawExpressions.value
  const newMappings: Record<string, string> = { ...expressionMappings.value }

  for (const slot of CANONICAL_EMOTIONS) {
    const match = candidates.find(c => slot.matchRegex.test(c))
    if (match) {
      newMappings[slot.id] = match
    }
    else if (!newMappings[slot.id] && candidates.length > 0) {
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

  syncDraft()
  toast.success('Auto-calibrated canonical expressions and generated acting directives!')
}

// --- 6. Acting Directives Full-Span Modal ---
const isDirectivesModalOpen = ref(false)
const tempDirectivesText = ref('')

function openDirectivesModal() {
  tempDirectivesText.value = actingDirectivesPrompt.value.trim()
    || buildDefaultActingDirectives(CANONICAL_EMOTIONS.map(s => s.actToken))
  isDirectivesModalOpen.value = true
}

function saveDirectivesModal() {
  actingDirectivesPrompt.value = tempDirectivesText.value
  syncDraft()
  isDirectivesModalOpen.value = false
  toast.success('Acting directives saved!')
}

function restoreDefaultDirectives() {
  const validTokens = CANONICAL_EMOTIONS.map(s => s.actToken)
  tempDirectivesText.value = buildDefaultActingDirectives(validTokens)
  toast.info('Restored default acting template.')
}

async function handleEnhanceWithAI() {
  const companionName = draft.state.companionName || 'Companion'
  toast.info('Generating character-tailored acting guidance...')
  try {
    const curatedItems: CuratedExpressionItem[] = CANONICAL_EMOTIONS.map(s => ({
      rawKey: expressionMappings.value[s.id] || s.id,
      label: s.name,
      actToken: s.actToken,
      category: 'emotes',
      shouldSkip: false,
    }))
    const enhanced = await generateActingPrompt(
      {
        name: companionName,
        personality: draft.state.userDescription || 'Warm, attentive, and expressive companion',
        description: draft.state.userPrompt || '',
      },
      curatedItems,
    )
    if (enhanced) {
      actingDirectivesPrompt.value = enhanced
      syncDraft()
      toast.success('Enhanced acting guidance successfully generated!')
    }
  }
  catch (e) {
    console.warn('[StepEmotions] AI enhancement fallback:', e)
    const validTokens = CANONICAL_EMOTIONS.map(s => s.actToken)
    actingDirectivesPrompt.value = buildDefaultActingDirectives(validTokens)
    syncDraft()
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
  syncDraft()
  toast.success('Advanced token curation applied!')
}

// --- 8. Draft Synchronization ---
function syncDraft() {
  draft.setEmotions({
    emotionsCurated: isCalibrated.value,
    expressionMappings: { ...expressionMappings.value },
    actingModelExpressionPrompt: actingDirectivesPrompt.value,
  })
}

watch(activeModelId, async (newId) => {
  if (newId) {
    resetPreviewPosition()
    await initializeStageRenderer()
    await loadModelCapabilities()
  }
})

onMounted(async () => {
  await initializeStageRenderer()
  await loadModelCapabilities()
})

function handleContinue() {
  syncDraft()
  props.onNext()
}
</script>

<template>
  <div :class="['w-full max-w-5xl mx-auto flex flex-col justify-between flex-1 space-y-3.5 my-auto animate-fadeIn select-none']">
    <!-- Top Header -->
    <div>
      <div :class="['flex items-center gap-2 text-xs text-neutral-400 mb-0.5']">
        <span :class="['text-primary-500 dark:text-primary-400 font-medium']">Stage Calibration</span>
        <span>• 2-Pass ACT Expression Bridge</span>
      </div>
      <h2 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
        Emotions & Expressions
      </h2>
      <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
        Map physical blendshapes to dialogue emotion cues and configure character acting guidance.
      </p>
    </div>

    <!-- Main 2-Column Dashboard Cockpit (Fixed Natural Viewport Height) -->
    <div :class="['grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch h-[450px]']">
      <!-- Left Column: Live Avatar Viewport Frame & Tactile Soundboard (5 cols) -->
      <div :class="['md:col-span-5 flex flex-col gap-3 h-full']">
        <!-- Live Avatar Viewport Frame -->
        <div :class="['rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-gradient-to-b from-neutral-100/90 to-neutral-200/50 dark:from-neutral-900/90 dark:to-neutral-950/90 overflow-hidden relative shadow-sm flex flex-col items-center justify-between p-3 flex-1 min-h-0']">
          <!-- Top Badge: Model Format & Name -->
          <div :class="['w-full flex items-center justify-between z-10 shrink-0 pointer-events-auto']">
            <span :class="['px-2.5 py-0.8 rounded-full text-[10px] font-mono font-medium border border-neutral-200/80 dark:border-white/10 bg-white/80 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300 backdrop-blur-sm shadow-xs']">
              {{ modelFormatLabel }}
            </span>
            <span
              v-if="isLoadingExpressions || isLoadingModel"
              :class="['flex items-center gap-1 text-[10px] text-primary-500 font-medium animate-pulse']"
            >
              <div :class="['i-solar:refresh-linear w-3 h-3 animate-spin']" />
              <span>{{ isLoadingModel ? 'Mounting Model...' : 'Scanning...' }}</span>
            </span>
          </div>

          <!-- Live 3D/2D Avatar Model Viewport Surface -->
          <div :class="['relative flex-1 w-full flex items-center justify-center overflow-hidden my-1 min-h-0']">
            <!-- Ambient Glow -->
            <div :class="['absolute w-36 h-36 rounded-full bg-primary-500/15 blur-2xl pointer-events-none z-0']" />

            <!-- Live RendererStage Canvas -->
            <RendererStage
              v-if="stageModelReady && stageModelRenderer && stageModelRenderer !== 'disabled' && (settingsStore.stageModelSelected === activeModelId || settingsStore.stageModelSelectedDisplayModel?.id === activeModelId)"
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
              @offset-change="({ x, y }) => { previewXOffset = x; previewYOffset = y }"
              @scale-change="(s) => previewScale = s"
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
            <span>Tactile Soundboard</span>
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
        <!-- Unified Card 1: Expression Mapping & Calibration -->
        <div :class="['rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/70 dark:bg-neutral-900/60 p-3.5 shadow-sm flex-1 min-h-0 flex flex-col']">
          <!-- Card Header: Title, Auto-Calibrate Sparkle Button, and Advanced Details -->
          <div :class="['flex items-start justify-between gap-2 mb-2 shrink-0']">
            <div :class="['flex items-center gap-2']">
              <div :class="['p-1.5 rounded-xl bg-primary-500/10 text-primary-500 shrink-0']">
                <div :class="['i-solar:face-smile-bold-duotone w-4 h-4']" />
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
                  Assign model blendshapes to the 6 primary dialogue acting cues.
                </p>
              </div>
            </div>

            <div :class="['flex items-center gap-2 shrink-0']">
              <!-- Auto-Calibrate Sparkle Button -->
              <button
                type="button"
                :class="[
                  'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap',
                  isCalibrated
                    ? 'border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200'
                    : 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-600/30',
                ]"
                @click="runAutoCalibration"
              >
                <div :class="[isCalibrated ? 'i-solar:refresh-linear w-3.5 h-3.5' : 'i-solar:stars-line-bold-duotone w-3.5 h-3.5 text-cyan-200']" />
                <span>{{ isCalibrated ? 'Recalibrate' : 'Auto-calibrate' }}</span>
              </button>

              <!-- Advanced Details Link -->
              <button
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
                  @change="syncDraft"
                >
                  <option value="">
                    -- Unmapped --
                  </option>
                  <option
                    v-for="expr in (candidateExpressions.length > 0 ? candidateExpressions : rawExpressions)"
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
      </div>
    </div>

    <!-- Bottom Navigation Bar -->
    <div :class="['flex items-center justify-between pt-2.5 border-t border-neutral-200/60 dark:border-white/5 shrink-0']">
      <button
        type="button"
        :class="['px-5 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        ← Previous Step
      </button>

      <div :class="['text-[11px] text-neutral-400 hidden sm:block']">
        Changes automatically saved to companion draft
      </div>

      <div :class="['flex items-center gap-2.5']">
        <button
          type="button"
          :class="['px-4 py-2 rounded-xl text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer']"
          @click="props.onNext"
        >
          Set up later
        </button>

        <button
          type="button"
          :class="['px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-all cursor-pointer flex items-center gap-2']"
          @click="handleContinue"
        >
          <span>Continue to Artistry</span>
          <div :class="['i-solar:arrow-right-linear w-4 h-4']" />
        </button>
      </div>
    </div>

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
      :model-id="activeModelId"
      :model-format="modelType"
      :visible-expressions="visibleUnifiedExpressions"
      :all-expressions="allUnifiedExpressions"
      @applied="handleAdvancedCurationApplied"
    />
  </div>
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
