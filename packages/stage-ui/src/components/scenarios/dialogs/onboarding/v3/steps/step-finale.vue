<script setup lang="ts">
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

import RendererStage from '../../../../../scenes/RendererStage.vue'

import { DisplayModelFormat, useDisplayModelsStore } from '../../../../../../stores/display-models'
import { useSpeechStore } from '../../../../../../stores/modules/speech'
import { useProvidersStore } from '../../../../../../stores/providers'
import { useSettings } from '../../../../../../stores/settings'
import { useSettingsUserProfile } from '../../../../../../stores/settings/user-profile'
import { useStarterCardCommit } from '../composables/useStarterCardCommit'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext?: () => void
  onPrevious?: () => void
  onFinish?: () => void
}>()

const emit = defineEmits<{
  (e: 'previous'): void
  (e: 'finish'): void
}>()

// --- Stores ---
const draft = useOnboardingV3Draft()
const settingsStore = useSettings()
const userProfileStore = useSettingsUserProfile()
const speechStore = useSpeechStore()
const providersStore = useProvidersStore()
const displayModelsStore = useDisplayModelsStore()

const { stageModelRenderer } = storeToRefs(settingsStore)

// --- Fallback Image Previews ---
const presetLive2dPreview = new URL('../../../../../../assets/live2d/models/hiyori/preview.png', import.meta.url).href
const presetVrmAvatarAPreview = new URL('../../../../../../assets/vrm/models/AvatarSample-A/preview.png', import.meta.url).href
const presetVrmAvatarBPreview = new URL('../../../../../../assets/vrm/models/AvatarSample-B/preview.png', import.meta.url).href

// --- 1. Vessel & Avatar Stage Resolution ---
const activeModelId = computed(() => draft.state.vesselDisplayModelId || 'preset-live2d-2')

const currentModel = computed(() => {
  const targetId = activeModelId.value
  return displayModelsStore.displayModels.find(m =>
    m.id === targetId
    || m.id === `display-model-${targetId}`
    || m.id.replace(/^display-model-/, '') === targetId.replace(/^display-model-/, ''),
  )
})

const modelType = computed<'live2d' | 'vrm' | 'mmd' | 'spine' | 'unknown'>(() => {
  const fmt = currentModel.value?.format
  if (fmt) {
    if (fmt === DisplayModelFormat.Live2dZip || fmt === DisplayModelFormat.Live2dDirectory)
      return 'live2d'
    if (fmt === DisplayModelFormat.VRM)
      return 'vrm'
    if (fmt === DisplayModelFormat.PMXZip || fmt === DisplayModelFormat.PMXDirectory || fmt === DisplayModelFormat.PMD)
      return 'mmd'
    if (fmt === DisplayModelFormat.SpineZip)
      return 'spine'
  }

  const idLower = (activeModelId.value || '').toLowerCase()
  if (idLower.includes('spine'))
    return 'spine'
  if (idLower.includes('live2d'))
    return 'live2d'
  if (idLower.includes('pmx') || idLower.includes('pmd') || idLower.includes('mmd'))
    return 'mmd'
  if (idLower.includes('vrm'))
    return 'vrm'

  if (stageModelRenderer.value && stageModelRenderer.value !== 'disabled')
    return stageModelRenderer.value

  return 'unknown'
})

const modelFormatLabel = computed(() => {
  const type = modelType.value
  const name = currentModel.value?.name
    || (activeModelId.value === 'preset-live2d-2' ? 'Hiyori' : activeModelId.value === 'preset-vrm-2' ? 'Seed Girl' : activeModelId.value === 'preset-vrm-1' ? 'AvatarSample_A' : activeModelId.value)
  if (type === 'vrm')
    return `VRM (3D) - ${name}`
  if (type === 'live2d')
    return `Live2D (2D) - ${name}`
  if (type === 'spine')
    return `Spine (2D) - ${name}`
  if (type === 'mmd')
    return `MMD (3D) - ${name}`
  return `${type.toUpperCase()} - ${name}`
})

const avatarPreviewUrl = computed(() => {
  if (currentModel.value && 'previewImage' in currentModel.value && currentModel.value.previewImage)
    return currentModel.value.previewImage
  if (currentModel.value && 'authorIcon' in currentModel.value && currentModel.value.authorIcon)
    return currentModel.value.authorIcon
  if (activeModelId.value === 'preset-live2d-2')
    return presetLive2dPreview
  if (activeModelId.value === 'preset-vrm-2')
    return presetVrmAvatarBPreview
  if (activeModelId.value === 'preset-vrm-1')
    return presetVrmAvatarAPreview
  return undefined
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
      await settingsStore.updateStageModel('onboarding-v3-finale')
    }
    stageModelReady.value = true
  }
  catch (err) {
    console.warn('[StepFinale] updateStageModel encountered error:', err)
  }
  finally {
    isLoadingModel.value = false
  }
}

onMounted(async () => {
  if (displayModelsStore.displayModels.length === 0) {
    await displayModelsStore.loadDisplayModelsFromIndexedDB?.(true)
  }
  await initializeStageRenderer()
})

// --- 2. Persona & Greeting Resolution ---
const userName = computed(() => draft.state.userName || userProfileStore.name || 'Master')
const { resolvePersona, compileCardPayload, commitStarterCompanion } = useStarterCardCommit()

const resolvedPersona = computed(() => resolvePersona(draft.state, userName.value))
const fullGreeting = computed(() => resolvedPersona.value.firstGreeting)

// --- 3. Typewriter Effect ---
const typedGreeting = ref('')
let typeTimer: ReturnType<typeof setInterval> | undefined

function startTypewriter(text: string) {
  if (typeTimer) {
    clearInterval(typeTimer)
    typeTimer = undefined
  }
  if (!text) {
    typedGreeting.value = ''
    return
  }
  let i = 0
  typedGreeting.value = ''
  typeTimer = setInterval(() => {
    i++
    typedGreeting.value = text.slice(0, i)
    if (i >= text.length) {
      clearInterval(typeTimer)
      typeTimer = undefined
    }
  }, 22)
}

watch(fullGreeting, (newGreeting) => {
  if (newGreeting) {
    startTypewriter(newGreeting)
  }
}, { immediate: true })

// --- 4. Audio Playback & Replay ---
const audioPlayer = ref<HTMLAudioElement | null>(null)
const isPlayingAudio = ref(false)

async function playGreetingVoice() {
  if (isPlayingAudio.value && audioPlayer.value) {
    audioPlayer.value.pause()
    isPlayingAudio.value = false
    return
  }

  if (!draft.state.modules.speech) {
    toast.info('Speech is disabled for this companion (Silent Mode).')
    return
  }

  try {
    isPlayingAudio.value = true
    const providerId = draft.state.ttsProvider || 'kokoro-local'
    const modelId = draft.state.ttsModel || 'q4'
    const voiceId = draft.state.ttsVoiceId || 'af_bella'

    const rawProvider = await providersStore.getProviderInstance(providerId)
    const providerConfig = {
      pitch: draft.state.ttsPitch ?? 1.0,
      rate: draft.state.ttsRate ?? 1.0,
    }

    const audioData = await speechStore.speech(
      rawProvider as any,
      modelId,
      fullGreeting.value,
      voiceId,
      providerConfig,
    )

    if (!audioData || audioData.byteLength === 0) {
      throw new Error('TTS returned empty audio stream')
    }

    const blob = new Blob([audioData], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audioPlayer.value = audio

    audio.onended = () => {
      isPlayingAudio.value = false
      audioPlayer.value = null
    }
    audio.onerror = () => {
      isPlayingAudio.value = false
      audioPlayer.value = null
    }

    await audio.play()
  }
  catch (err) {
    isPlayingAudio.value = false
    console.warn('[StepFinale] Voice audition skipped or failed:', err)
  }
}

onBeforeUnmount(() => {
  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value = null
  }
  if (typeTimer) {
    clearInterval(typeTimer)
    typeTimer = undefined
  }
})

// --- 5. Pre-Flight Honesty Matrix Items ---
interface HonestyItem {
  id: string
  title: string
  status: string
  subtitle: string
  icon: string
  theme: 'green' | 'purple' | 'sky' | 'amber' | 'gray'
}

const activeMemoryQuadrants = computed(() => {
  const list: string[] = []
  if (draft.state.memoryShortTermEnabled)
    list.push('STMM')
  if (draft.state.memoryLongTermJournalEnabled)
    list.push('Journal')
  if (draft.state.memoryLifetimeEnabled)
    list.push('Lifetime')
  if (draft.state.memoryDreamStateEnabled)
    list.push('Dreams')
  return list
})

const activeToolsList = computed(() => {
  const list: string[] = []
  if (draft.state.mcpWebSearchEnabled)
    list.push('Web Search')
  if (draft.state.mcpFilesystemEnabled)
    list.push('Filesystem')
  if (draft.state.toolMotionGeneratorEnabled)
    list.push('3D Motions')
  return list
})

const honestyMatrix = computed<HonestyItem[]>(() => {
  const d = draft.state
  const items: HonestyItem[] = []

  // 1. Audio Input (Hearing)
  if (d.modules.hearing) {
    items.push({
      id: 'hearing',
      title: 'Audio Input (Hearing)',
      status: 'Calibrated',
      subtitle: `${d.sttProvider || 'whisper-local'} · Mic Active`,
      icon: 'i-solar:microphone-3-bold-duotone',
      theme: 'green',
    })
  }
  else {
    items.push({
      id: 'hearing',
      title: 'Audio Input (Hearing)',
      status: 'Muted / Skipped',
      subtitle: 'Microphone input disabled',
      icon: 'i-solar:muted-bold-duotone',
      theme: 'gray',
    })
  }

  // 2. Reasoning Core (Consciousness)
  items.push({
    id: 'consciousness',
    title: 'Reasoning Core (Mind)',
    status: 'Verified Active',
    subtitle: `${d.llmModel || 'gpt-4o'} (${d.llmProvider || 'openai'})`,
    icon: 'i-solar:cpu-bolt-bold-duotone',
    theme: 'green',
  })

  // 3. Voice Synthesis (Speech)
  if (d.modules.speech) {
    items.push({
      id: 'speech',
      title: 'Voice Synthesis (Speech)',
      status: 'Voice Active',
      subtitle: `${d.ttsVoiceId || 'af_bella'} (${d.ttsProvider || 'kokoro-local'})`,
      icon: 'i-solar:soundwave-bold-duotone',
      theme: 'green',
    })
  }
  else {
    items.push({
      id: 'speech',
      title: 'Voice Synthesis (Speech)',
      status: 'Silent Mode',
      subtitle: 'Zero audio output · Subtitles only',
      icon: 'i-solar:volume-cross-bold-duotone',
      theme: 'gray',
    })
  }

  // 4. Avatar Stage (Vessel)
  items.push({
    id: 'vessel',
    title: 'Avatar Stage (Vessel)',
    status: 'Vessel Bound',
    subtitle: modelFormatLabel.value,
    icon: 'i-solar:people-nearby-bold-duotone',
    theme: 'green',
  })

  // 5. Memory Hierarchy
  if (d.modules.memory) {
    const quads = activeMemoryQuadrants.value
    items.push({
      id: 'memory',
      title: 'Memory Hierarchy',
      status: 'Memory Active',
      subtitle: `${quads.length} Active: ${quads.join(', ')}`,
      icon: 'i-solar:bookmark-opened-bold-duotone',
      theme: 'purple',
    })
  }

  // 6. Autonomous Tools
  if (d.modules.tools) {
    const tools = activeToolsList.value
    items.push({
      id: 'tools',
      title: 'Autonomous Tools',
      status: tools.length > 0 ? 'Toolbelt Armed' : 'Safe Sandboxed',
      subtitle: tools.length > 0 ? `${tools.length} Granted: ${tools.join(', ')}` : 'No external tools',
      icon: 'i-solar:widget-bold-duotone',
      theme: 'sky',
    })
  }

  // 7. Visual Artistry
  if (d.modules.artistry) {
    items.push({
      id: 'artistry',
      title: 'Visual Artistry',
      status: 'Art Engine Ready',
      subtitle: `${d.artistryProvider || 'pollinations'}${d.artistryDirectorEnabled ? ' · Director Active' : ''}`,
      icon: 'i-solar:gallery-bold-duotone',
      theme: 'green',
    })
  }

  // 8. Sensory Perception
  if (d.modules.sensory) {
    items.push({
      id: 'sensory',
      title: 'Sensory Perception',
      status: 'Sensory Active',
      subtitle: `Screen Watching (${d.screenWatcherMode || 'voice-and-bubble'})`,
      icon: 'i-solar:eye-bold-duotone',
      theme: 'green',
    })
  }

  return items
})

// --- 6. Compiled Card Payload ---
const isPayloadModalOpen = ref(false)
const compiledCardPayload = computed(() => compileCardPayload(draft.state, resolvedPersona.value))

function copyPayload() {
  navigator.clipboard.writeText(JSON.stringify(compiledCardPayload.value, null, 2))
  toast.success('Card JSON copied to clipboard')
}

// --- 7. Atomic Launch to Stage ---
const isSubmitting = ref(false)

async function handleLaunch() {
  if (isSubmitting.value)
    return

  isSubmitting.value = true
  let createdCardId: string | null = null

  try {
    createdCardId = await commitStarterCompanion(draft.state)
    toast.success('Companion ready on stage!')
  }
  catch (err) {
    console.error('[StepFinale] Failed to launch companion:', err)
    const msg = err instanceof Error ? err.message : String(err)
    toast.error(`Failed to create companion card: ${msg}`)
  }
  finally {
    isSubmitting.value = false
    if (createdCardId) {
      emit('finish')
      props.onFinish?.()
    }
  }
}
</script>

<template>
  <div :class="['h-full w-full max-w-5xl mx-auto flex flex-col justify-between gap-4 overflow-hidden px-2 pb-2 select-none']">
    <!-- Main 2-Column Cockpit Layout -->
    <div :class="['flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden']">
      <!-- Left Column: Avatar Viewport & Spoken Turn 0 Bubble -->
      <div :class="['lg:col-span-5 flex flex-col gap-3 min-h-0 h-full']">
        <!-- Avatar Viewport Frame -->
        <div :class="['flex-1 min-h-[260px] lg:min-h-0 relative rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-900/90 overflow-hidden shadow-inner flex flex-col']">
          <!-- Top Left: Model Format Badge -->
          <div :class="['absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-neutral-900/80 backdrop-blur-md border border-neutral-700/60 text-[11px] font-medium text-neutral-200 flex items-center gap-1.5 shadow-md']">
            <div
              :class="[
                modelType === 'vrm' || modelType === 'mmd' ? 'i-solar:box-bold text-sky-400' : 'i-solar:layers-minimalistic-bold text-emerald-400',
                'w-3.5 h-3.5',
              ]"
            />
            <span class="max-w-[170px] truncate">{{ modelFormatLabel }}</span>
          </div>

          <!-- Top Right: Stage Preview Beacon -->
          <div :class="['absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 flex items-center gap-1 shadow-md']">
            <span :class="['w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse']" />
            <span>STAGE READY</span>
          </div>

          <!-- Live Model Viewport / Fallback -->
          <div :class="['w-full h-full relative flex items-center justify-center overflow-hidden']">
            <div :class="['absolute w-36 h-36 rounded-full bg-primary-500/15 blur-2xl pointer-events-none z-0']" />

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
                alt="Avatar Preview"
                :class="['h-44 w-44 object-contain rounded-2xl shadow-md border border-neutral-700/50 bg-black/40']"
              >
              <div
                v-else
                :class="['h-44 w-44 rounded-2xl border border-neutral-700/50 bg-neutral-800/60 flex flex-col items-center justify-center gap-2 p-4 text-center shadow-md']"
              >
                <div
                  :class="[
                    modelType === 'vrm' || modelType === 'mmd' ? 'i-solar:box-bold text-sky-400' : 'i-solar:layers-minimalistic-bold text-emerald-400',
                    'w-12 h-12',
                  ]"
                />
                <span class="max-w-full truncate text-xs text-neutral-300 font-medium font-mono">
                  {{ currentModel?.name || activeModelId }}
                </span>
                <span class="text-[10px] text-neutral-500 font-mono uppercase">
                  {{ modelType }}
                </span>
              </div>
              <div v-if="isLoadingModel" :class="['text-xs text-primary-400 flex items-center gap-1.5 animate-pulse']">
                <div :class="['i-solar:restart-bold w-3.5 h-3.5 animate-spin']" />
                <span>Mounting Avatar Vessel...</span>
              </div>
            </div>

            <!-- Bottom Right: Reset Position Pill if moved -->
            <button
              v-if="previewXOffset !== 0 || previewYOffset !== 0 || previewScale !== 1"
              type="button"
              title="Reset Avatar Position"
              :class="['absolute bottom-3 right-3 z-10 px-2 py-1 rounded-lg bg-neutral-900/80 backdrop-blur-md border border-neutral-700/60 text-[10px] font-mono text-neutral-300 hover:text-white flex items-center gap-1 shadow-md cursor-pointer transition-all']"
              @click="resetPreviewPosition"
            >
              <div :class="['i-solar:restart-bold w-3 h-3']" />
              <span>Reset Pos</span>
            </button>
          </div>
        </div>

        <!-- Turn 0 Dialogue Bubble (Floating Frosted Glass) -->
        <div :class="['rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/90 backdrop-blur-md p-4 shadow-lg flex flex-col gap-2.5 shrink-0']">
          <div :class="['flex items-center justify-between text-xs']">
            <div :class="['flex items-center gap-2 font-bold text-neutral-800 dark:text-neutral-200']">
              <div :class="['w-2 h-2 rounded-full bg-primary-500']" />
              <span>{{ resolvedPersona.name }}</span>
              <span :class="['text-[10px] font-normal px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-500 font-mono']">
                Turn 0 Spoken Greeting
              </span>
            </div>

            <!-- Replay Audio CTA if Speech Enabled -->
            <button
              v-if="draft.state.modules.speech"
              type="button"
              :disabled="isPlayingAudio"
              :class="[
                'px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer border',
                isPlayingAudio
                  ? 'bg-primary-500/15 border-primary-500/30 text-primary-600 dark:text-primary-400 animate-pulse'
                  : 'bg-black/5 dark:bg-white/5 border-transparent text-neutral-600 dark:text-neutral-300 hover:bg-black/10 dark:hover:bg-white/10',
              ]"
              @click="playGreetingVoice"
            >
              <div :class="[isPlayingAudio ? 'i-solar:soundwave-bold-duotone' : 'i-solar:volume-loud-bold-duotone', 'w-3.5 h-3.5']" />
              <span>{{ isPlayingAudio ? 'Playing...' : 'Replay' }}</span>
            </button>
            <span
              v-else
              :class="['text-[10px] text-neutral-400 font-mono flex items-center gap-1']"
            >
              <div :class="['i-solar:volume-cross-bold w-3 h-3 text-neutral-400']" />
              <span>Silent Mode</span>
            </span>
          </div>

          <!-- Typewriter Greeting Text -->
          <div :class="['text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans min-h-[38px]']">
            {{ typedGreeting }}
            <span v-if="typedGreeting.length < fullGreeting.length" :class="['inline-block w-1.5 h-3 bg-primary-500 ml-0.5 animate-pulse']" />
          </div>
        </div>
      </div>

      <!-- Right Column: Pre-Flight Honesty Matrix & Launch Control -->
      <div :class="['lg:col-span-7 flex flex-col justify-between gap-4 min-h-0 h-full overflow-y-auto pr-1']">
        <div :class="['flex flex-col gap-3.5']">
          <!-- Header Area -->
          <div :class="['flex flex-col gap-1']">
            <h2 :class="['text-xl font-bold text-neutral-900 dark:text-white tracking-tight']">
              Stage Calibration & Victory Launch
            </h2>
            <p :class="['text-xs text-neutral-500 dark:text-neutral-400']">
              Truthful runtime verification across all active companion faculties.
            </p>
          </div>

          <!-- Manifest Summary Pill -->
          <div :class="['rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-100/70 dark:bg-neutral-900/60 px-3.5 py-2 text-xs flex items-center justify-between flex-wrap gap-2 text-neutral-600 dark:text-neutral-300']">
            <div :class="['flex items-center gap-3 flex-wrap']">
              <span :class="['font-semibold text-neutral-800 dark:text-neutral-200']">Manifest:</span>
              <span :class="['flex items-center gap-1 font-mono text-[11px]']">
                <span class="text-neutral-400">Soul:</span>
                <strong>{{ resolvedPersona.name }}</strong>
              </span>
              <span class="text-neutral-300 dark:text-neutral-700">•</span>
              <span :class="['flex items-center gap-1 font-mono text-[11px]']">
                <span class="text-neutral-400">Vessel:</span>
                <strong>{{ modelType.toUpperCase() }}</strong>
              </span>
              <span class="text-neutral-300 dark:text-neutral-700">•</span>
              <span :class="['flex items-center gap-1 font-mono text-[11px]']">
                <span class="text-neutral-400">Brain:</span>
                <strong>{{ draft.state.llmModel || 'gpt-4o' }}</strong>
              </span>
              <span class="text-neutral-300 dark:text-neutral-700">•</span>
              <span :class="['flex items-center gap-1 font-mono text-[11px]']">
                <span class="text-neutral-400">Voice:</span>
                <strong>{{ draft.state.modules.speech ? (draft.state.ttsVoiceId || 'af_bella') : 'None' }}</strong>
              </span>
            </div>
          </div>

          <!-- Pre-Flight Honesty Matrix Grid -->
          <div :class="['flex flex-col gap-2']">
            <div :class="['text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-between']">
              <span>Pre-Flight Readiness Honesty Matrix</span>
              <span :class="['text-[11px] font-mono text-emerald-500 font-medium']">
                {{ honestyMatrix.length }} Faculties Verified
              </span>
            </div>

            <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-2.5']">
              <div
                v-for="item in honestyMatrix"
                :key="item.id"
                :class="[
                  'rounded-xl border p-3 flex items-start gap-3 transition-all',
                  item.theme === 'green'
                    ? 'border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10'
                    : item.theme === 'purple'
                      ? 'border-purple-500/20 bg-purple-500/5 dark:bg-purple-500/10'
                      : item.theme === 'sky'
                        ? 'border-sky-500/20 bg-sky-500/5 dark:bg-sky-500/10'
                        : 'border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40',
                ]"
              >
                <!-- Icon -->
                <div
                  :class="[
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    item.theme === 'green'
                      ? 'bg-emerald-500/15 text-emerald-500'
                      : item.theme === 'purple'
                        ? 'bg-purple-500/15 text-purple-500'
                        : item.theme === 'sky'
                          ? 'bg-sky-500/15 text-sky-500'
                          : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400',
                  ]"
                >
                  <div :class="[item.icon, 'text-lg']" />
                </div>

                <!-- Info -->
                <div :class="['flex-1 min-w-0 flex flex-col gap-0.5']">
                  <div :class="['flex items-center justify-between gap-1']">
                    <span :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate']">
                      {{ item.title }}
                    </span>
                    <span
                      :class="[
                        'text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1 font-mono',
                        item.theme === 'green'
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : item.theme === 'purple'
                            ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                            : item.theme === 'sky'
                              ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400'
                              : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500',
                      ]"
                    >
                      <div v-if="item.theme !== 'gray'" :class="['i-solar:check-circle-bold w-3 h-3']" />
                      <div v-else :class="['i-solar:minus-circle-linear w-3 h-3']" />
                      <span>{{ item.status }}</span>
                    </span>
                  </div>
                  <span :class="['text-[11px] text-neutral-500 dark:text-neutral-400 truncate leading-snug']">
                    {{ item.subtitle }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Launch Actions Area -->
        <div :class="['flex flex-col gap-3 pt-3 border-t border-neutral-200/80 dark:border-white/5 shrink-0']">
          <!-- Bottom Action Buttons -->
          <div :class="['flex items-center justify-between gap-3']">
            <button
              type="button"
              :class="['px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 text-xs font-medium border border-neutral-200 dark:border-white/10 transition-colors cursor-pointer flex items-center gap-1.5']"
              @click="props.onPrevious ? props.onPrevious() : emit('previous')"
            >
              <div :class="['i-solar:arrow-left-linear w-4 h-4']" />
              <span>Previous Step</span>
            </button>

            <div :class="['flex items-center gap-2.5']">
              <!-- View JSON Inspection Button -->
              <button
                type="button"
                :class="['px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 text-xs font-medium border border-neutral-200 dark:border-white/10 transition-colors cursor-pointer flex items-center gap-1.5']"
                title="Inspect the compiled AiriCard payload"
                @click="isPayloadModalOpen = true"
              >
                <div :class="['i-solar:code-file-bold-duotone w-4 h-4 text-neutral-400']" />
                <span>View Card JSON</span>
              </button>

              <!-- Primary Hero Launch CTA -->
              <button
                type="button"
                :disabled="isSubmitting"
                :class="[
                  'px-6 py-2.5 rounded-xl text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-2',
                  'bg-gradient-to-r from-cyan-500 via-primary-600 to-purple-600 hover:from-cyan-400 hover:via-primary-500 hover:to-purple-500',
                  'shadow-lg shadow-primary-600/30 hover:shadow-cyan-500/25 hover:scale-[1.02] active:scale-[0.98]',
                  isSubmitting ? 'opacity-70 cursor-not-allowed' : '',
                ]"
                @click="handleLaunch"
              >
                <div v-if="isSubmitting" :class="['i-solar:restart-bold w-4 h-4 animate-spin']" />
                <div v-else :class="['i-solar:rocket-bold w-4 h-4']" />
                <span>{{ isSubmitting ? 'Entering Stage...' : 'Enter AIRI Stage' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- AiriCard JSON Inspection Dialog -->
    <DialogRoot :open="isPayloadModalOpen" @update:open="isPayloadModalOpen = $event">
      <DialogPortal>
        <DialogOverlay :class="['fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity']" />
        <DialogContent
          :class="['fixed left-1/2 top-1/2 z-50 max-h-[85vh] max-w-2xl w-[92vw] flex flex-col border border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900 shadow-2xl -translate-x-1/2 -translate-y-1/2 focus:outline-none p-6']"
        >
          <!-- Modal Header -->
          <div :class="['flex shrink-0 items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800']">
            <div :class="['flex items-center gap-2.5']">
              <div :class="['w-9 h-9 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center']">
                <div :class="['i-solar:code-file-bold-duotone w-5 h-5']" />
              </div>
              <div>
                <DialogTitle :class="['text-base font-bold text-neutral-900 dark:text-white']">
                  Compiled AiriCard Payload (`chara_card_v3`)
                </DialogTitle>
                <p :class="['text-xs text-neutral-400']">
                  The exact deterministic JSON specification committed to IndexedDB on launch.
                </p>
              </div>
            </div>

            <button
              type="button"
              :class="['p-1 rounded-lg text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer']"
              @click="isPayloadModalOpen = false"
            >
              <div :class="['i-solar:close-circle-bold w-5 h-5']" />
            </button>
          </div>

          <!-- Modal Body: JSON View -->
          <div :class="['flex-1 min-h-0 py-4 overflow-y-auto']">
            <pre :class="['w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-950 p-4 text-[11px] font-mono text-emerald-400 overflow-x-auto leading-relaxed']">{{ JSON.stringify(compiledCardPayload, null, 2) }}</pre>
          </div>

          <!-- Modal Footer -->
          <div :class="['flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800 shrink-0']">
            <button
              type="button"
              :class="['px-3.5 py-1.5 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1.5']"
              @click="copyPayload"
            >
              <div :class="['i-solar:copy-bold w-3.5 h-3.5']" />
              <span>Copy JSON</span>
            </button>

            <button
              type="button"
              :class="['px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-all cursor-pointer']"
              @click="isPayloadModalOpen = false"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
