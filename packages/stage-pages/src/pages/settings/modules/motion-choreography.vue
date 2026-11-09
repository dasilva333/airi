<script setup lang="ts">
import type {
  AcousticFeatures,
  AlignedKeyframeMapping,
  DanceSheet,
  PersonaArchetype,
  WarpedPoseFrame,
} from '@proj-airi/motion-choreography'

import {
  alignDanceSheetToBeats,
  analyzeAudioBuffer,
  decodeWav,
  encodeWav,
  evaluateWarpedPoseAt,
  extractKeyPosesFromHumanML3D,
  generateSyntheticAmbient,
  generateSyntheticBoomBap,
  generateSyntheticDembow,
  generateSyntheticSalsa,
  generateSyntheticSwayMotion,
  generateSyntheticTrap,
  generateSyntheticWaltz,
  synthesizeDanceBrief,
} from '@proj-airi/motion-choreography'
import { RendererStage } from '@proj-airi/stage-ui/components/scenes'
import { Button } from '@proj-airi/ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// Preset tracks
interface TrackPreset {
  id: string
  name: string
  genre: string
  bpm: number
  meter: string
  icon: string
  generator: () => { channelData: Float32Array[], sampleRate: number, duration: number }
}

const presets: TrackPreset[] = [
  {
    id: 'waltz',
    name: 'Johann Strauss - The Blue Danube',
    genre: 'Classical Waltz',
    bpm: 174,
    meter: '3/4 Waltz',
    icon: 'i-solar:music-note-bold-duotone',
    generator: () => generateSyntheticWaltz(174, 8, 44100),
  },
  {
    id: 'dembow',
    name: 'Latin Dembow & Reggaeton',
    genre: 'Reggaeton / Latin Urban',
    bpm: 96,
    meter: '4/4 Tresillo',
    icon: 'i-solar:fire-bold-duotone',
    generator: () => generateSyntheticDembow(96, 8, 44100),
  },
  {
    id: 'boombap',
    name: '90s Boom-Bap Hip-Hop',
    genre: 'Hip-Hop Boom-Bap',
    bpm: 92,
    meter: '4/4 Swing',
    icon: 'i-solar:cassette-bold-duotone',
    generator: () => generateSyntheticBoomBap(92, 8, 44100),
  },
  {
    id: 'trap',
    name: 'Modern Trap 808 Sub-Bass',
    genre: 'Modern Trap',
    bpm: 140,
    meter: '4/4 Half-Time',
    icon: 'i-solar:bolt-bold-duotone',
    generator: () => generateSyntheticTrap(140, 8, 44100),
  },
  {
    id: 'salsa',
    name: 'Afro-Cuban Salsa (Son Clave)',
    genre: 'Salsa / Afro-Cuban',
    bpm: 185,
    meter: '4/4 3:2 Clave',
    icon: 'i-solar:sun-2-bold-duotone',
    generator: () => generateSyntheticSalsa(185, 8, 44100),
  },
  {
    id: 'ambient',
    name: 'Ambient Harmonic Soundscape',
    genre: 'Ambient Soundscape',
    bpm: 80,
    meter: 'Free Ambient',
    icon: 'i-solar:cloud-bold-duotone',
    generator: () => generateSyntheticAmbient(8, 44100),
  },
]

// State
const selectedPresetId = ref('waltz')
const audioElement = ref<HTMLAudioElement | null>(null)
const audioBlobUrl = ref<string | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(8)
const audioVolume = ref(0.75)
const isAnalyzing = ref(false)

// Live Stage Viewport State
const stageState = ref<'pending' | 'loading' | 'mounted'>('pending')
const stageScale = ref(1.0)
const stageXOffset = ref(0)
const stageYOffset = ref(0)
const stageFraming = ref<'full' | 'bust'>('full')

// DSP analysis state
const acousticFeatures = ref<AcousticFeatures | null>(null)
const selectedPersona = ref<PersonaArchetype>('none')
const selectedCadence = ref<'downbeats_only' | 'all_beats' | 'adaptive'>('downbeats_only')
const selectedEasing = ref<'smooth_step' | 'cubic_elastic' | 'linear'>('smooth_step')

// Kinematics and Conductor state
const activeDanceSheet = ref<DanceSheet | null>(null)
const alignmentMappings = ref<AlignedKeyframeMapping[]>([])
const currentPose = ref<WarpedPoseFrame | null>(null)

// Synthesized FlowMDM prompt
const synthesizedPrompt = computed(() => {
  if (!acousticFeatures.value)
    return ''
  const brief = synthesizeDanceBrief(acousticFeatures.value, undefined, {
    archetype: selectedPersona.value,
  })
  return brief.choreographerPrompt
})

const activePreset = computed(() => {
  return presets.find(p => p.id === selectedPresetId.value) || presets[0]
})

function setFraming(preset: 'full' | 'bust') {
  stageFraming.value = preset
  if (preset === 'full') {
    stageScale.value = 1.0
    stageXOffset.value = 0
    stageYOffset.value = 0
  }
  else {
    stageScale.value = 1.6
    stageXOffset.value = 0
    stageYOffset.value = 0.35
  }
}

function resetStageCamera() {
  stageScale.value = 1.0
  stageXOffset.value = 0
  stageYOffset.value = 0
  stageFraming.value = 'full'
}

// Load and analyze track preset
function loadPreset(presetId: string) {
  selectedPresetId.value = presetId
  const preset = presets.find(p => p.id === presetId)
  if (!preset)
    return

  isAnalyzing.value = true

  try {
    const track = preset.generator()
    const wavBytes = encodeWav(track.channelData, track.sampleRate)

    // Revoke previous URL
    if (audioBlobUrl.value) {
      URL.revokeObjectURL(audioBlobUrl.value)
    }

    const blob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' })
    audioBlobUrl.value = URL.createObjectURL(blob)
    duration.value = track.duration
    currentTime.value = 0
    isPlaying.value = false

    // Run acoustic analysis
    const features = analyzeAudioBuffer(track.channelData, track.sampleRate)
    acousticFeatures.value = features

    // Generate synthetic motion trajectory for demonstration
    const totalFrames = Math.max(40, Math.floor(features.durationSeconds * 20))
    const motion = generateSyntheticSwayMotion(totalFrames, 20)
    const danceSheet = extractKeyPosesFromHumanML3D(motion.features, totalFrames, {
      targetKeyPoseCount: Math.max(4, Math.min(8, Math.floor(features.durationSeconds))),
      fps: 20,
    })
    activeDanceSheet.value = danceSheet

    // Run Conductor alignment pass
    recalculateAlignment(features, danceSheet)
  }
  finally {
    isAnalyzing.value = false
  }
}

function recalculateAlignment(features = acousticFeatures.value, danceSheet = activeDanceSheet.value) {
  if (!features || !danceSheet)
    return

  const alignmentResult = alignDanceSheetToBeats(danceSheet, features.beatTimestamps, {
    cadence: selectedCadence.value,
    rhythmStructure: features.rhythmStructure,
  })

  alignmentMappings.value = alignmentResult.mappings
  updatePoseAtTime(currentTime.value)
}

function updatePoseAtTime(timeSec: number) {
  if (!activeDanceSheet.value || alignmentMappings.value.length === 0)
    return

  currentPose.value = evaluateWarpedPoseAt(
    timeSec,
    activeDanceSheet.value,
    alignmentMappings.value,
    {
      easing: selectedEasing.value,
      loop: true,
    },
  )
}

function togglePlayback() {
  if (!audioElement.value)
    return
  if (isPlaying.value) {
    audioElement.value.pause()
    isPlaying.value = false
  }
  else {
    audioElement.value.play().then(() => {
      isPlaying.value = true
    }).catch(() => {
      isPlaying.value = false
    })
  }
}

function onTimeUpdate() {
  if (audioElement.value) {
    currentTime.value = audioElement.value.currentTime
    updatePoseAtTime(currentTime.value)
  }
}

function onSeek(event: Event) {
  const target = event.target as HTMLInputElement
  const newTime = Number.parseFloat(target.value)
  currentTime.value = newTime
  if (audioElement.value) {
    audioElement.value.currentTime = newTime
  }
  updatePoseAtTime(newTime)
}

function onVolumeChange(event: Event) {
  const target = event.target as HTMLInputElement
  const vol = Number.parseFloat(target.value)
  audioVolume.value = vol
  if (audioElement.value) {
    audioElement.value.volume = vol
  }
}

function onAudioEnded() {
  isPlaying.value = false
  currentTime.value = 0
  updatePoseAtTime(0)
}

function handleCustomFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  isAnalyzing.value = true
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const arrayBuffer = e.target?.result as ArrayBuffer
      if (!arrayBuffer)
        return

      if (audioBlobUrl.value) {
        URL.revokeObjectURL(audioBlobUrl.value)
      }

      const blob = new Blob([arrayBuffer], { type: 'audio/wav' })
      audioBlobUrl.value = URL.createObjectURL(blob)
      selectedPresetId.value = 'custom'

      const decoded = decodeWav(new Uint8Array(arrayBuffer))
      duration.value = decoded.duration
      currentTime.value = 0
      isPlaying.value = false

      const features = analyzeAudioBuffer(decoded.channelData, decoded.sampleRate)
      acousticFeatures.value = features

      const totalFrames = Math.max(40, Math.floor(features.durationSeconds * 20))
      const motion = generateSyntheticSwayMotion(totalFrames, 20)
      const danceSheet = extractKeyPosesFromHumanML3D(motion.features, totalFrames, {
        targetKeyPoseCount: Math.max(4, Math.min(8, Math.floor(features.durationSeconds))),
        fps: 20,
      })
      activeDanceSheet.value = danceSheet
      recalculateAlignment(features, danceSheet)
    }
    catch (err) {
      console.error('Failed to process custom audio file:', err)
    }
    finally {
      isAnalyzing.value = false
    }
  }
  reader.readAsArrayBuffer(file)
}

// Watchers
watch(selectedCadence, () => recalculateAlignment())
watch(selectedEasing, () => updatePoseAtTime(currentTime.value))

onMounted(() => {
  loadPreset('waltz')
})

onUnmounted(() => {
  if (audioBlobUrl.value) {
    URL.revokeObjectURL(audioBlobUrl.value)
  }
  if (audioElement.value) {
    audioElement.value.pause()
  }
})
</script>

<template>
  <div class="flex flex-col gap-6 pb-12">
    <!-- Hidden Audio Element -->
    <audio
      ref="audioElement"
      :src="audioBlobUrl || undefined"
      @timeupdate="onTimeUpdate"
      @ended="onAudioEnded"
    />

    <!-- Main Studio Grid: Split 2-Column Layout -->
    <div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <!-- LEFT COLUMN: Dedicated 3D Avatar Viewport Stage (5 columns on lg) -->
      <div class="flex flex-col gap-4 lg:sticky lg:top-4 lg:col-span-5">
        <!-- Stage Viewport Card -->
        <div class="flex flex-col overflow-hidden border border-neutral-200 rounded-2xl bg-neutral-900/95 shadow-lg dark:border-neutral-800">
          <!-- Stage Top Bar -->
          <div class="flex items-center justify-between border-b border-neutral-800/80 bg-neutral-900/90 px-4 py-3 text-xs">
            <div class="flex items-center gap-2">
              <span
                class="size-2 rounded-full"
                :class="[isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-500']"
              />
              <span class="text-neutral-200 font-bold">Avatar Dance Stage</span>
              <span class="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400 font-mono">
                {{ stageState === 'mounted' ? 'Live 3D' : stageState }}
              </span>
            </div>

            <!-- Viewport Reset / Framing Controls -->
            <div class="flex items-center gap-1.5 text-neutral-400">
              <button
                type="button"
                title="Full Body Framing"
                :class="[
                  'px-2 py-0.5 rounded text-[10px] font-medium border transition-colors',
                  stageFraming === 'full'
                    ? 'border-primary-500 bg-primary-500/20 text-primary-300'
                    : 'border-neutral-700 bg-neutral-800/60 hover:text-neutral-200',
                ]"
                @click="setFraming('full')"
              >
                Full
              </button>
              <button
                type="button"
                title="Bust Framing"
                :class="[
                  'px-2 py-0.5 rounded text-[10px] font-medium border transition-colors',
                  stageFraming === 'bust'
                    ? 'border-primary-500 bg-primary-500/20 text-primary-300'
                    : 'border-neutral-700 bg-neutral-800/60 hover:text-neutral-200',
                ]"
                @click="setFraming('bust')"
              >
                Bust
              </button>
              <button
                type="button"
                title="Reset Camera Position"
                class="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
                @click="resetStageCamera"
              >
                <div class="i-solar:restart-bold text-sm" />
              </button>
            </div>
          </div>

          <!-- Viewport Canvas Container -->
          <div class="relative h-[460px] w-full flex items-center justify-center overflow-hidden from-neutral-900 to-neutral-950 bg-gradient-to-b lg:h-[520px]">
            <!-- Ambient Radial Glow -->
            <div
              class="pointer-events-none absolute h-64 w-64 rounded-full bg-primary-500/15 blur-3xl transition-transform duration-300"
              :style="{ transform: isPlaying ? 'scale(1.2)' : 'scale(1.0)' }"
            />

            <!-- Live RendererStage Canvas -->
            <RendererStage
              v-model:state="stageState"
              :focus-at="{ x: 0, y: 0 }"
              :paused="false"
              :show-background="false"
              :radial-menu-enabled="false"
              :draggable="true"
              :scale="stageScale"
              :x-offset="stageXOffset"
              :y-offset="stageYOffset"
              class="absolute inset-0 z-1 size-full"
              @offset-change="({ x, y }) => { stageXOffset = x; stageYOffset = y }"
              @scale-change="(s) => { stageScale = s }"
            />

            <!-- Beat Pulse Badge (overlay on stage canvas) -->
            <div
              v-if="isPlaying"
              class="absolute left-3 top-3 z-2 flex items-center gap-1.5 border border-white/10 rounded-full bg-black/60 px-2.5 py-1 text-[10px] text-primary-400 font-mono shadow-sm backdrop-blur-md"
            >
              <div class="size-1.5 animate-ping rounded-full bg-primary-500" />
              <span>{{ Math.round(acousticFeatures?.bpm || 0) }} BPM · BEAT SYNC</span>
            </div>

            <!-- Drag hint overlay on hover -->
            <div class="backdrop-blur-xs pointer-events-none absolute bottom-3 right-3 z-2 select-none rounded bg-black/40 px-2 py-0.5 text-[10px] text-neutral-500">
              Drag to pan · Scroll to zoom
            </div>
          </div>

          <!-- Stage Telemetry Footer -->
          <div class="flex flex-col gap-2 border-t border-neutral-800/80 bg-neutral-900/90 px-4 py-3">
            <div class="flex items-center justify-between text-xs">
              <span class="text-neutral-400 font-medium">Kinematic Pose Warper</span>
              <span class="text-primary-400 font-bold font-mono">
                {{ currentPose ? `Keyframe #${currentPose.activeKeyframeIndex + 1}` : 'Idle' }}
              </span>
            </div>
            <!-- Warper Progress Bar -->
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
              <div
                class="h-full rounded-full bg-primary-500 transition-all duration-75"
                :style="{ width: `${((currentPose?.phaseProgress || 0) * 100).toFixed(0)}%` }"
              />
            </div>
            <!-- Kinematics Coordinates -->
            <div v-if="currentPose" class="grid grid-cols-2 gap-2 text-[10px] text-neutral-400 font-mono">
              <div class="truncate">
                Pos: [{{ currentPose.rootTranslation.map(v => v.toFixed(2)).join(', ') }}]
              </div>
              <div class="truncate">
                Rot: [{{ currentPose.rootRotation.map(v => v.toFixed(2)).join(', ') }}]
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: Audio Controls, DSP Telemetry, Conductor Timeline (7 columns on lg) -->
      <div class="flex flex-col gap-6 lg:col-span-7">
        <!-- Header Section -->
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg text-neutral-800 font-bold md:text-2xl dark:text-neutral-100">
                {{ t('settings.pages.modules.motion_choreography.title', 'Motion Choreography & 3D Conductor') }}
              </h2>
              <span class="rounded-full bg-primary-500/10 px-2.5 py-0.5 text-xs text-primary-600 font-semibold dark:bg-primary-500/20 dark:text-primary-400">
                FlowMDM + Jev
              </span>
            </div>
            <p class="mt-1 text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
              {{ t('settings.pages.modules.motion_choreography.description', 'Acoustic DSP rhythm analysis, FlowMDM 3D dance synthesis, and elastic beat-warp conductor.') }}
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <label
              class="flex cursor-pointer items-center gap-2 border border-neutral-200 rounded-xl bg-white px-3 py-2 text-xs text-neutral-700 font-medium shadow-sm transition-colors dark:border-neutral-800 dark:bg-neutral-900/60 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800/80"
            >
              <div class="i-solar:upload-track-2-bold-duotone text-sm text-primary-500" />
              <span>Upload WAV</span>
              <input
                type="file"
                accept=".wav,audio/wav"
                class="hidden"
                @change="handleCustomFileUpload"
              >
            </label>
          </div>
        </div>

        <!-- Audio Player & Track Selector Bar -->
        <div class="border border-neutral-200 rounded-2xl bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
          <div class="flex flex-col gap-4">
            <!-- Preset Buttons -->
            <div>
              <span class="text-xs text-neutral-400 font-semibold tracking-wider uppercase dark:text-neutral-500">
                Select Acoustic Test Track
              </span>
              <div class="grid grid-cols-2 mt-2 gap-2 sm:grid-cols-3">
                <button
                  v-for="p in presets"
                  :key="p.id"
                  type="button"
                  :class="[
                    'flex flex-col items-start p-2.5 rounded-xl border text-left transition-all',
                    selectedPresetId === p.id
                      ? 'border-primary-500 bg-primary-500/10 text-primary-700 dark:text-primary-300 dark:bg-primary-500/20 shadow-sm'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300 dark:hover:border-neutral-700',
                  ]"
                  @click="loadPreset(p.id)"
                >
                  <div class="w-full flex items-center gap-1.5">
                    <div :class="[p.icon, 'text-base text-primary-500 shrink-0']" />
                    <span class="truncate text-xs font-bold">{{ p.genre }}</span>
                  </div>
                  <div class="mt-1 w-full flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500">
                    <span>{{ p.bpm }} BPM</span>
                    <span>{{ p.meter }}</span>
                  </div>
                </button>
              </div>
            </div>

            <!-- Playback Controller -->
            <div class="flex flex-col gap-3 border border-neutral-100 rounded-xl bg-neutral-50 p-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800/60 dark:bg-neutral-800/30">
              <div class="flex items-center gap-3">
                <Button
                  type="button"
                  :class="['rounded-full w-9 h-9 flex items-center justify-center shadow-sm']"
                  @click="togglePlayback"
                >
                  <div :class="[isPlaying ? 'i-solar:pause-bold' : 'i-solar:play-bold', 'text-base']" />
                </Button>
                <div>
                  <div class="max-w-[180px] truncate text-xs text-neutral-800 font-bold dark:text-neutral-100">
                    {{ activePreset.name }}
                  </div>
                  <div class="text-[10px] text-neutral-400 font-mono dark:text-neutral-500">
                    {{ currentTime.toFixed(2) }}s / {{ duration.toFixed(2) }}s
                  </div>
                </div>
              </div>

              <!-- Timeline Scrubber -->
              <div class="mx-2 flex flex-1 items-center gap-2">
                <input
                  type="range"
                  min="0"
                  :max="duration"
                  step="0.01"
                  :value="currentTime"
                  class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-500 dark:bg-neutral-700"
                  @input="onSeek"
                >
              </div>

              <!-- Volume Slider -->
              <div class="flex shrink-0 items-center gap-2">
                <div class="i-solar:volume-loud-bold-duotone text-sm text-neutral-400" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  :value="audioVolume"
                  class="h-1.5 w-16 cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-500 dark:bg-neutral-700"
                  @input="onVolumeChange"
                >
              </div>
            </div>
          </div>
        </div>

        <!-- Acoustic DSP & Jev Classification Matrix -->
        <div class="border border-neutral-200 rounded-2xl bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
          <div class="flex items-center justify-between">
            <h3 class="flex items-center gap-2 text-sm text-neutral-800 font-bold dark:text-neutral-100">
              <div class="i-solar:tuning-square-2-bold-duotone text-primary-500" />
              Acoustic DSP & Jev Decision Coprocessor
            </h3>
            <span class="rounded bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600 font-mono dark:bg-neutral-800 dark:text-neutral-400">
              jev-1.13-free
            </span>
          </div>

          <div v-if="acousticFeatures" class="grid grid-cols-2 mt-3 gap-2.5 sm:grid-cols-3">
            <div class="border border-neutral-100 rounded-xl bg-neutral-50/70 p-2.5 dark:border-neutral-800/80 dark:bg-neutral-800/20">
              <span class="text-[10px] text-neutral-400 font-medium uppercase">Tempo / BPM</span>
              <div class="mt-0.5 text-sm text-neutral-800 font-bold dark:text-neutral-100">
                {{ Math.round(acousticFeatures.bpm) }} <span class="text-[10px] text-neutral-400 font-normal">BPM</span>
              </div>
              <div class="text-[10px] text-primary-600 dark:text-primary-400">
                Confidence: {{ (acousticFeatures.confidence * 100).toFixed(0) }}%
              </div>
            </div>

            <div class="border border-neutral-100 rounded-xl bg-neutral-50/70 p-2.5 dark:border-neutral-800/80 dark:bg-neutral-800/20">
              <span class="text-[10px] text-neutral-400 font-medium uppercase">Rhythm Meter</span>
              <div class="mt-0.5 truncate text-sm text-neutral-800 font-bold capitalize dark:text-neutral-100">
                {{ acousticFeatures.rhythmStructure.replace('_', ' ') }}
              </div>
              <div class="text-[10px] text-neutral-400">
                Cadence: {{ selectedCadence }}
              </div>
            </div>

            <div class="border border-neutral-100 rounded-xl bg-neutral-50/70 p-2.5 dark:border-neutral-800/80 dark:bg-neutral-800/20">
              <span class="text-[10px] text-neutral-400 font-medium uppercase">Spectral Brightness</span>
              <div class="mt-0.5 truncate text-xs text-neutral-800 font-bold capitalize dark:text-neutral-100">
                {{ acousticFeatures.timbreBrightness.replace(/_/g, ' ') }}
              </div>
              <div class="text-[10px] text-emerald-600 font-semibold dark:text-emerald-400">
                {{ Math.round(acousticFeatures.spectralCentroid) }} Hz
              </div>
            </div>

            <div class="border border-neutral-100 rounded-xl bg-neutral-50/70 p-2.5 dark:border-neutral-800/80 dark:bg-neutral-800/20">
              <span class="text-[10px] text-neutral-400 font-medium uppercase">Energy Tier</span>
              <div class="mt-0.5 text-sm text-neutral-800 font-bold capitalize dark:text-neutral-100">
                {{ acousticFeatures.energyTier }}
              </div>
              <div class="truncate text-[10px] text-neutral-400 capitalize">
                {{ acousticFeatures.timbreBrightness.replace('_', ' ') }}
              </div>
            </div>

            <div class="border border-neutral-100 rounded-xl bg-neutral-50/70 p-2.5 dark:border-neutral-800/80 dark:bg-neutral-800/20">
              <span class="text-[10px] text-neutral-400 font-medium uppercase">RMS Energy</span>
              <div class="mt-0.5 text-sm text-neutral-800 font-bold dark:text-neutral-100">
                {{ acousticFeatures.energyRms.toFixed(3) }}
              </div>
              <div class="text-[10px] text-neutral-400">
                Peak: {{ (20 * Math.log10(Math.max(1e-4, acousticFeatures.energyRms))).toFixed(1) }} dB
              </div>
            </div>

            <div class="border border-neutral-100 rounded-xl bg-neutral-50/70 p-2.5 dark:border-neutral-800/80 dark:bg-neutral-800/20">
              <span class="text-[10px] text-neutral-400 font-medium uppercase">Detected Beats</span>
              <div class="mt-0.5 text-sm text-neutral-800 font-bold dark:text-neutral-100">
                {{ acousticFeatures.beatTimestamps.length }} <span class="text-[10px] text-neutral-400 font-normal">onsets</span>
              </div>
              <div class="text-[10px] text-neutral-400">
                Duration: {{ acousticFeatures.durationSeconds.toFixed(1) }}s
              </div>
            </div>
          </div>
        </div>

        <!-- FlowMDM Prompt & Persona Settings -->
        <div class="border border-neutral-200 rounded-2xl bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
          <div class="flex items-center justify-between">
            <h3 class="flex items-center gap-2 text-sm text-neutral-800 font-bold dark:text-neutral-100">
              <div class="i-solar:magic-stick-3-bold-duotone text-primary-500" />
              FlowMDM Prompt Synthesis & Persona
            </h3>
            <span class="rounded bg-primary-500/10 px-2 py-0.5 text-[10px] text-primary-600 font-semibold dark:bg-primary-500/20 dark:text-primary-400">
              263-dim Tensor
            </span>
          </div>

          <!-- Persona Archetype Tabs -->
          <div class="mt-3">
            <span class="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase dark:text-neutral-500">
              Persona Archetype Filter
            </span>
            <div class="grid grid-cols-4 mt-1.5 gap-2">
              <button
                v-for="persona in ['none', 'idol', 'gothic_maid', 'cool_android'] as const"
                :key="persona"
                type="button"
                :class="[
                  'px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors capitalize',
                  selectedPersona === persona
                    ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400 dark:bg-primary-500/20'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-400',
                ]"
                @click="selectedPersona = persona"
              >
                {{ persona === 'none' ? 'Pure Beat' : persona.replace('_', ' ') }}
              </button>
            </div>
          </div>

          <!-- Synthesized Dance Brief Card -->
          <div class="mt-3 border border-neutral-200/80 rounded-xl bg-neutral-50/70 p-3.5 dark:border-neutral-800 dark:bg-neutral-800/30">
            <div class="flex items-center justify-between">
              <span class="text-[10px] text-neutral-400 font-semibold uppercase">Synthesized FlowMDM Prompt</span>
              <span class="text-[10px] text-neutral-400">{{ synthesizedPrompt.length }} chars</span>
            </div>
            <p class="mt-1.5 text-xs text-neutral-700 leading-relaxed font-mono dark:text-neutral-300">
              "{{ synthesizedPrompt }}"
            </p>
          </div>
        </div>

        <!-- The Conductor: Beat-to-Keypoint Alignment & Warping Timeline -->
        <div class="border border-neutral-200 rounded-2xl bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="flex items-center gap-2 text-sm text-neutral-800 font-bold dark:text-neutral-100">
                <div class="i-solar:play-circle-bold-duotone text-primary-500" />
                The Conductor: Elastic Beat Alignment
              </h3>
              <p class="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                Maps extracted DanceSheet key-poses to physical audio beats.
              </p>
            </div>

            <!-- Conductor Options Controls -->
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1">
                <span class="text-[10px] text-neutral-400">Cadence:</span>
                <select
                  v-model="selectedCadence"
                  class="border border-neutral-200 rounded-lg bg-neutral-50 px-2 py-1 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                >
                  <option value="downbeats_only">
                    Downbeats Only
                  </option>
                  <option value="all_beats">
                    All Beats
                  </option>
                  <option value="adaptive">
                    Adaptive
                  </option>
                </select>
              </div>

              <div class="flex items-center gap-1">
                <span class="text-[10px] text-neutral-400">Easing:</span>
                <select
                  v-model="selectedEasing"
                  class="border border-neutral-200 rounded-lg bg-neutral-50 px-2 py-1 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                >
                  <option value="smooth_step">
                    SmoothStep
                  </option>
                  <option value="cubic_elastic">
                    Cubic Elastic
                  </option>
                  <option value="linear">
                    Linear
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- Timeline Visualization -->
          <div class="mt-4 border border-neutral-100 rounded-xl bg-neutral-50/50 p-3.5 dark:border-neutral-800/80 dark:bg-neutral-800/20">
            <!-- Interactive Beat Bar -->
            <div class="relative h-10 w-full border border-neutral-200 rounded-lg bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900">
              <!-- Beat Ticks -->
              <div
                v-for="(beat, idx) in (acousticFeatures?.beatTimestamps || [])"
                :key="idx"
                :style="{ left: `${(beat / duration) * 100}%` }"
                :class="[
                  'absolute top-0 bottom-0 w-0.5 transition-opacity',
                  Number(idx) % 4 === 0
                    ? 'bg-primary-500 opacity-90 z-2'
                    : 'bg-neutral-400 dark:bg-neutral-600 opacity-40 z-1',
                ]"
                :title="`Beat ${Number(idx) + 1}: ${beat.toFixed(2)}s`"
              />

              <!-- Aligned Keyframe Anchors -->
              <div
                v-for="map in alignmentMappings"
                :key="map.keyframeIndex"
                :style="{ left: `${(map.targetBeatSeconds / duration) * 100}%` }"
                class="absolute bottom-1 top-1 z-3 w-2 rounded bg-amber-500 opacity-80"
                :title="`Pose ${map.keyframeIndex + 1} (${map.poseType}) at ${map.targetBeatSeconds.toFixed(2)}s (warp: ${map.warpRatio.toFixed(2)}x)`"
              />

              <!-- Playhead Needle -->
              <div
                :style="{ left: `${(currentTime / duration) * 100}%` }"
                class="absolute bottom-0 top-0 z-4 w-1 bg-rose-500 shadow-md"
              />
            </div>

            <div class="mt-2 flex items-center justify-between text-[10px] text-neutral-400">
              <div class="flex items-center gap-3">
                <span class="flex items-center gap-1">
                  <span class="size-2 rounded-full bg-primary-500" />
                  <span>Downbeats</span>
                </span>
                <span class="flex items-center gap-1">
                  <span class="size-2 rounded bg-amber-500" />
                  <span>Key-Poses ({{ alignmentMappings.length }})</span>
                </span>
                <span class="flex items-center gap-1">
                  <span class="size-2 bg-rose-500" />
                  <span>Playhead</span>
                </span>
              </div>
              <span class="font-mono">{{ currentTime.toFixed(2) }}s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.motion_choreography.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
