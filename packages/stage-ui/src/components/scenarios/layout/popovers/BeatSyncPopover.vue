<script setup lang="ts">
import type { BeatSyncEnergyTier } from '@proj-airi/stage-shared/beat-sync'

import type {
  BeatSyncChoreoPersona,
  BeatSyncLive2DStyle,
} from '../../../../stores/modules/beat-sync-choreography'

import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import StripPopover from '../StripPopover.vue'

import { useControlStripSettingsRoute } from '../../../../composables/use-control-strip-settings-route'
import { useBeatSyncChoreographyStore } from '../../../../stores/modules/beat-sync-choreography'

const emit = defineEmits<{ close: [] }>()

const beatSyncStore = useBeatSyncChoreographyStore()
const { openSettingsRoute } = useControlStripSettingsRoute()

const {
  activeRenderer,
  isRendererSupported,
  isActive,
  bpm,
  energy,
  energyTier,
  danceSpeed,
  live2dConfig,
  vrmConfig,
  resolvedClipTiers,
  availableDanceClips,
  hasAnyDanceClips,
  nowPlayingClipKey,
  nowPlayingClipName,
  aiStatus,
  aiError,
  captureError,
  activeAiPersona,
  nextAiPersona,
  lastBeatAt,
} = storeToRefs(beatSyncStore)

onMounted(() => {
  beatSyncStore.initListeners()
})

// Beat pulse visual feedback (decays smoothly after each detected beat)
const isBeatPulsing = ref(false)
let beatPulseTimer: ReturnType<typeof setTimeout> | undefined

watch(lastBeatAt, (ts) => {
  if (!ts)
    return
  isBeatPulsing.value = true
  if (beatPulseTimer)
    clearTimeout(beatPulseTimer)
  beatPulseTimer = setTimeout(() => {
    isBeatPulsing.value = false
  }, 160)
})

onUnmounted(() => {
  if (beatPulseTimer)
    clearTimeout(beatPulseTimer)
})

const rendererBadgeLabel = computed(() => {
  if (activeRenderer.value === 'live2d')
    return 'Live2D'
  if (activeRenderer.value === 'vrm')
    return 'VRM'
  return 'Unsupported'
})

const audioSourceDisplay = computed(() => {
  return isStageTamagotchi() ? 'System audio' : 'Tab / Screen audio'
})

const energyTierLabel = computed(() => {
  if (energyTier.value === 'intense')
    return 'Intense'
  if (energyTier.value === 'medium')
    return 'Moderate'
  return 'Calm'
})

const bpmReadout = computed(() => {
  if (!isActive.value)
    return '--'
  if (bpm.value && bpm.value > 0)
    return `${Math.round(bpm.value)}`
  return null
})

// Live2D movement options
const live2dStyles: Array<{ id: BeatSyncLive2DStyle, label: string }> = [
  { id: 'punchy-v', label: 'Bounce' },
  { id: 'swing-lr', label: 'Swing' },
  { id: 'sway-sine', label: 'Sway' },
]

const activeLive2dStyleLabel = computed(() => {
  return live2dStyles.find(s => s.id === live2dConfig.value.style)?.label ?? 'Bounce'
})

const strengthPercent = computed(() => Math.round(live2dConfig.value.strength * 100))

function onStrengthInput(event: Event) {
  const val = Number((event.target as HTMLInputElement).value)
  if (!Number.isNaN(val))
    beatSyncStore.setLive2dStrength(val / 100)
}

// VRM Dance Clips tier picker & integrated manager state
const editingTier = ref<BeatSyncEnergyTier | null>(null)
const isManagingClips = ref(false)
const manageTier = ref<BeatSyncEnergyTier>('calm')
const importInputRef = ref<HTMLInputElement | null>(null)

const tierMeta: Array<{ id: BeatSyncEnergyTier, label: string, icon: string }> = [
  { id: 'calm', label: 'Calm', icon: 'i-solar:leaf-linear' },
  { id: 'medium', label: 'Medium', icon: 'i-solar:soundwave-linear' },
  { id: 'intense', label: 'Intense', icon: 'i-solar:flame-linear' },
]

function isClipInTier(tier: BeatSyncEnergyTier, key: string) {
  return resolvedClipTiers.value[tier].includes(key)
}

function toggleClipInTier(tier: BeatSyncEnergyTier, key: string) {
  const current = resolvedClipTiers.value[tier]
  const next = current.includes(key)
    ? current.filter(k => k !== key)
    : [...current, key]
  beatSyncStore.setTierClips(tier, next)
}

async function handleImportVrmaChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files?.length)
    return
  for (const file of Array.from(files)) {
    await beatSyncStore.importDanceClip(file, manageTier.value)
  }
  input.value = ''
}

// VRM AI Choreography personas
const personaCards: Array<{ id: BeatSyncChoreoPersona, label: string, icon: string }> = [
  { id: 'none', label: 'Pure Beat', icon: 'i-solar:pulse-2-linear' },
  { id: 'idol', label: 'Idol', icon: 'i-solar:star-linear' },
  { id: 'gothic_maid', label: 'Gothic Maid', icon: 'i-solar:bow-linear' },
  { id: 'cool_android', label: 'Cool Android', icon: 'i-solar:cpu-linear' },
]

function personaLabel(id: BeatSyncChoreoPersona | null | undefined) {
  return personaCards.find(p => p.id === id)?.label ?? 'Idol'
}

const barCadenceValue = computed(() => {
  return vrmConfig.value.autoBars ? 'auto' : String(vrmConfig.value.barsPerPhrase)
})

function onBarCadenceChange(event: Event) {
  const val = (event.target as HTMLSelectElement).value
  if (val === 'auto') {
    beatSyncStore.setAutoBars(true)
  }
  else {
    const parsed = Number(val)
    if (!Number.isNaN(parsed))
      beatSyncStore.setBarsPerPhrase(parsed, false)
  }
}

function navigateSettings(path: string) {
  openSettingsRoute(path)
  emit('close')
}

async function handlePrimaryAction() {
  if (activeRenderer.value === 'vrm' && vrmConfig.value.mode === 'clips' && !hasAnyDanceClips.value) {
    isManagingClips.value = true
    return
  }
  await beatSyncStore.toggleDancing()
}

const primaryActionLabel = computed(() => {
  if (isActive.value)
    return 'Stop dancing'
  if (activeRenderer.value === 'vrm' && vrmConfig.value.mode === 'clips' && !hasAnyDanceClips.value)
    return 'Add dance clips'
  if (activeRenderer.value === 'vrm' && vrmConfig.value.mode === 'ai')
    return 'Generate & dance'
  return 'Start dancing'
})
</script>

<template>
  <StripPopover title="Beat Sync" gap="2.5" header-padding="2" @close="emit('close')">
    <template #header>
      <div class="flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
        <div class="flex items-center gap-2">
          <span class="i-solar:music-note-2-bold-duotone text-base text-amber-500" />
          <span class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">Beat Sync</span>
          <span
            class="border border-neutral-200 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600 font-medium dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            {{ rendererBadgeLabel }}
          </span>
        </div>
        <button
          type="button"
          class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          @click="emit('close')"
        >
          <span class="i-solar:close-circle-outline text-lg" />
        </button>
      </div>
    </template>

    <!-- Unsupported Renderer State -->
    <div v-if="!isRendererSupported" class="flex flex-col items-center gap-2 py-6 text-center">
      <span class="i-solar:music-note-slider-linear text-3xl text-neutral-400" />
      <p class="text-xs text-neutral-600 font-medium dark:text-neutral-300">
        Beat Sync supports Live2D and VRM avatars
      </p>
      <p class="text-[11px] text-neutral-400 dark:text-neutral-500">
        Switch to a Live2D or VRM model to dance along to your audio.
      </p>
    </div>

    <template v-else>
      <!-- Audio Source Strip -->
      <div class="flex flex-col gap-1">
        <span class="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase">Audio Source</span>
        <button
          type="button"
          class="flex items-center justify-between border border-neutral-200 rounded-xl bg-neutral-50 px-2.5 py-1.5 text-left text-xs text-neutral-700 transition-colors dark:border-neutral-800 hover:border-neutral-300 dark:bg-neutral-800/70 dark:text-neutral-200 dark:hover:border-neutral-700"
          @click="beatSyncStore.toggleDancing()"
        >
          <div class="flex items-center gap-2 truncate">
            <span class="i-solar:volume-loud-linear text-sm text-neutral-500 dark:text-neutral-400" />
            <span class="truncate">{{ audioSourceDisplay }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-[10px]" :class="isActive ? 'text-amber-500 font-medium' : 'text-neutral-400'">
              {{ isActive ? 'Listening' : 'Off' }}
            </span>
            <span
              class="h-2 w-2 rounded-full transition-colors"
              :class="isActive ? 'bg-amber-500 animate-pulse' : 'bg-neutral-300 dark:bg-neutral-600'"
            />
          </div>
        </button>
        <p v-if="captureError" class="text-[10px] text-red-500 leading-snug">
          {{ captureError }}
        </p>
      </div>

      <!-- Live Signal Strip -->
      <div
        class="flex flex-col gap-2 border border-neutral-200 rounded-xl bg-neutral-50/80 p-2.5 dark:border-neutral-800 dark:bg-neutral-800/50"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-baseline gap-1.5">
            <template v-if="bpmReadout">
              <span class="text-xl text-neutral-900 font-bold tabular-nums dark:text-neutral-50">{{ bpmReadout }}</span>
              <span class="text-[11px] text-neutral-400 font-medium uppercase">BPM</span>
            </template>
            <span v-else class="text-xs text-amber-600 font-medium dark:text-amber-400">
              Finding the beat…
            </span>
          </div>

          <!-- Compact Beat Pulse Bars -->
          <div class="h-5 flex items-end gap-0.5" aria-hidden="true">
            <span
              class="w-1 rounded-full bg-amber-500 transition-all duration-100"
              :style="{ height: isActive ? (isBeatPulsing ? '14px' : '7px') : '4px', opacity: isActive ? 1 : 0.35 }"
            />
            <span
              class="w-1 rounded-full bg-amber-500 transition-all duration-100"
              :style="{ height: isActive ? (isBeatPulsing ? '20px' : '10px') : '6px', opacity: isActive ? 1 : 0.35 }"
            />
            <span
              class="w-1 rounded-full bg-amber-500 transition-all duration-100"
              :style="{ height: isActive ? (isBeatPulsing ? '16px' : '8px') : '5px', opacity: isActive ? 1 : 0.35 }"
            />
            <span
              class="w-1 rounded-full bg-amber-500 transition-all duration-100"
              :style="{ height: isActive ? (isBeatPulsing ? '11px' : '5px') : '4px', opacity: isActive ? 1 : 0.35 }"
            />
          </div>
        </div>

        <div class="flex items-center gap-2 text-[11px]">
          <span class="text-neutral-400">Energy</span>
          <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
            <div
              class="h-full rounded-full bg-amber-500 transition-all duration-150"
              :style="{ width: `${Math.round(energy * 100)}%` }"
            />
          </div>
          <span class="min-w-13 text-right text-neutral-600 font-medium dark:text-neutral-300">
            {{ isActive ? energyTierLabel : 'Idle' }}
          </span>
        </div>
      </div>

      <!-- LIVE2D CONTROLS -->
      <template v-if="activeRenderer === 'live2d'">
        <div class="flex flex-col gap-1.5">
          <span class="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase">Movement</span>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="item in live2dStyles"
              :key="item.id"
              type="button"
              class="flex flex-col items-center gap-1 border rounded-xl px-2 py-2 text-xs transition-all"
              :class="[
                live2dConfig.style === item.id
                  ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-300 font-semibold'
                  : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700',
              ]"
              @click="beatSyncStore.setLive2dStyle(item.id)"
            >
              <!-- Expressive line-figure illustrations -->
              <svg v-if="item.id === 'punchy-v'" viewBox="0 0 36 36" class="h-8 w-8 stroke-current" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18" cy="7" r="3" />
                <path d="M10 13l8 3 8-3M18 16v8M14 29l4-5 4 5" />
                <path d="M13 32h10" stroke-dasharray="2 2" opacity="0.6" />
              </svg>
              <svg v-else-if="item.id === 'swing-lr'" viewBox="0 0 36 36" class="h-8 w-8 stroke-current" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="20" cy="8" r="3" />
                <path d="M14 15l5 2 6-1M19 17l-3 8M12 31l4-6 6 5" />
                <path d="M9 12c-1.5 2-1.5 4 0 6M27 12c1.5 2 1.5 4 0 6" opacity="0.55" />
              </svg>
              <svg v-else viewBox="0 0 36 36" class="h-8 w-8 stroke-current" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18" cy="8" r="3" />
                <path d="M10 17c3-2 13-2 16 0M18 15c1.5 3-1.5 6 0 9M14 31l4-7 4 7" />
                <path d="M8 12c-1 1.5-1 3 0 4.5M28 12c1 1.5 1 3 0 4.5" opacity="0.55" />
              </svg>
              <span class="text-[11px]">{{ item.label }}</span>
            </button>
          </div>
        </div>

        <!-- Strength Slider -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between text-xs">
            <span class="text-neutral-600 font-medium dark:text-neutral-300">Strength</span>
            <span class="text-neutral-400 tabular-nums">{{ strengthPercent }}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            :value="strengthPercent"
            class="h-1.5 w-full cursor-pointer accent-amber-500"
            @input="onStrengthInput"
          >
          <div class="flex justify-between text-[10px] text-neutral-400">
            <span>Gentle</span>
            <span>Strong</span>
          </div>
        </div>

        <!-- Live2D Status -->
        <div class="flex items-center gap-1.5 text-[11px]">
          <span
            class="h-2 w-2 rounded-full"
            :class="isActive ? 'bg-amber-500 animate-pulse' : 'bg-neutral-400'"
          />
          <span class="text-neutral-600 dark:text-neutral-300">
            {{ isActive ? `Dancing · ${activeLive2dStyleLabel}` : `Ready · ${activeLive2dStyleLabel}` }}
          </span>
        </div>
      </template>

      <!-- VRM CONTROLS -->
      <template v-else-if="activeRenderer === 'vrm'">
        <!-- Segmented Mode Switcher -->
        <div class="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800/80">
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-all"
            :class="[
              vrmConfig.mode === 'clips'
                ? 'bg-amber-500 text-neutral-950 shadow-sm'
                : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100',
            ]"
            @click="beatSyncStore.setVrmMode('clips')"
          >
            <span class="i-solar:clapperboard-play-linear text-sm" />
            <span>Dance clips</span>
          </button>
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-all"
            :class="[
              vrmConfig.mode === 'ai'
                ? 'bg-amber-500 text-neutral-950 shadow-sm'
                : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100',
            ]"
            @click="beatSyncStore.setVrmMode('ai')"
          >
            <span class="i-solar:stars-minimalistic-linear text-sm" />
            <span>AI choreography</span>
          </button>
        </div>

        <!-- VRM DANCE CLIPS MODE -->
        <template v-if="vrmConfig.mode === 'clips'">
          <!-- Integrated Manage Dance Clips View -->
          <div v-if="isManagingClips" class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <button
                type="button"
                class="flex items-center gap-1 text-xs text-neutral-600 font-medium dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"
                @click="isManagingClips = false"
              >
                <span class="i-solar:alt-arrow-left-linear text-sm" />
                <span>Back</span>
              </button>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                  @click="beatSyncStore.resetClipTiersToDefaults()"
                >
                  Reset defaults
                </button>
                <button
                  type="button"
                  class="border border-amber-500/40 rounded-lg bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600 font-medium hover:bg-amber-500/20 dark:text-amber-300"
                  @click="importInputRef?.click()"
                >
                  + Import .vrma
                </button>
                <input
                  ref="importInputRef"
                  type="file"
                  accept=".vrma"
                  multiple
                  class="hidden"
                  @change="handleImportVrmaChange"
                >
              </div>
            </div>

            <!-- Tier Selector Tabs -->
            <div class="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800/80">
              <button
                v-for="tier in tierMeta"
                :key="tier.id"
                type="button"
                class="flex items-center justify-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all"
                :class="[
                  manageTier === tier.id
                    ? 'bg-amber-500 text-neutral-950 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100',
                ]"
                @click="manageTier = tier.id"
              >
                <span>{{ tier.label }}</span>
                <span class="opacity-75">({{ resolvedClipTiers[tier.id].length }})</span>
              </button>
            </div>

            <!-- Clip Checklist with One-Click Preview -->
            <div class="max-h-48 flex flex-col gap-1 overflow-y-auto border border-neutral-200 rounded-xl bg-neutral-50/70 p-1.5 text-xs scrollbar-thin dark:border-neutral-800 dark:bg-neutral-900/60">
              <div
                v-for="clip in availableDanceClips"
                :key="clip.key"
                class="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-neutral-200/50 dark:hover:bg-neutral-800"
              >
                <label class="flex flex-1 cursor-pointer items-center gap-2 truncate">
                  <input
                    type="checkbox"
                    :checked="isClipInTier(manageTier, clip.key)"
                    class="accent-amber-500"
                    @change="toggleClipInTier(manageTier, clip.key)"
                  >
                  <span class="truncate text-neutral-700 dark:text-neutral-200">{{ clip.label }}</span>
                  <span
                    class="shrink-0 rounded px-1 py-0.25 text-[9px]"
                    :class="clip.source === 'custom' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300' : 'bg-neutral-200/80 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'"
                  >
                    {{ clip.source === 'custom' ? 'Custom' : 'Built-in' }}
                  </span>
                </label>
                <button
                  type="button"
                  title="Preview dance"
                  class="shrink-0 rounded-md p-1 text-neutral-400 transition-colors hover:bg-amber-500/15 hover:text-amber-500"
                  :class="nowPlayingClipKey === clip.key ? 'text-amber-500 bg-amber-500/10' : ''"
                  @click="beatSyncStore.previewClip(clip.key)"
                >
                  <span class="i-solar:play-bold text-xs" />
                </button>
              </div>
            </div>
          </div>

          <!-- Standard Dance Intensity Tiers View -->
          <template v-else>
            <div class="flex flex-col gap-1.5">
              <span class="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase">Dance Intensity</span>
              <div class="flex flex-col gap-1">
                <div v-for="tier in tierMeta" :key="tier.id" class="flex flex-col gap-1">
                  <button
                    type="button"
                    class="flex items-center justify-between border rounded-xl px-2.5 py-1.5 text-xs transition-all"
                    :class="[
                      isActive && energyTier === tier.id
                        ? 'border-amber-500 bg-amber-500/12 text-amber-600 dark:text-amber-300 font-semibold'
                        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40 text-neutral-700 dark:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-700',
                    ]"
                    @click="editingTier = editingTier === tier.id ? null : tier.id"
                  >
                    <div class="flex items-center gap-2">
                      <span :class="tier.icon" class="text-sm" />
                      <span>{{ tier.label }}</span>
                    </div>
                    <div class="flex items-center gap-1 text-[11px] text-neutral-400">
                      <span>{{ resolvedClipTiers[tier.id].length }} clips</span>
                      <span
                        class="i-solar:alt-arrow-right-linear text-xs transition-transform"
                        :class="editingTier === tier.id ? 'rotate-90' : ''"
                      />
                    </div>
                  </button>

                  <!-- Inline Tier Clip Picker -->
                  <div
                    v-if="editingTier === tier.id"
                    class="ml-2 max-h-36 flex flex-col gap-1 overflow-y-auto border border-neutral-200 rounded-lg bg-neutral-50 p-1.5 text-[11px] scrollbar-thin dark:border-neutral-800 dark:bg-neutral-900/70"
                  >
                    <label
                      v-for="clip in availableDanceClips"
                      :key="clip.key"
                      class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-neutral-200/50 dark:hover:bg-neutral-800"
                    >
                      <input
                        type="checkbox"
                        :checked="isClipInTier(tier.id, clip.key)"
                        class="accent-amber-500"
                        @change="toggleClipInTier(tier.id, clip.key)"
                      >
                      <span class="truncate text-neutral-700 dark:text-neutral-200">{{ clip.label }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Now Playing Strip -->
            <div
              class="flex items-center justify-between border border-neutral-200 rounded-xl bg-neutral-50/70 px-2.5 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-800/40"
            >
              <div class="flex items-center gap-2 truncate">
                <span class="i-solar:music-note-linear text-sm text-neutral-400" />
                <div class="flex flex-col truncate">
                  <span class="text-[10px] text-neutral-400 leading-tight">Now playing</span>
                  <span class="truncate text-neutral-800 font-medium dark:text-neutral-100">
                    {{ nowPlayingClipName ?? (isActive ? 'Auto-selecting clip…' : 'Idle') }}
                  </span>
                </div>
              </div>
              <span class="text-[10px] text-neutral-400 tabular-nums">{{ danceSpeed.toFixed(2) }}×</span>
            </div>

            <button
              type="button"
              class="self-center text-[11px] text-amber-600 font-medium dark:text-amber-400 hover:underline"
              @click="isManagingClips = true"
            >
              Manage dance clips →
            </button>
          </template>
        </template>

        <!-- VRM AI CHOREOGRAPHY MODE -->
        <template v-else>
          <div class="flex flex-col gap-1.5">
            <span class="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase">Dance Persona</span>
            <div class="grid grid-cols-2 gap-1.5">
              <button
                v-for="persona in personaCards"
                :key="persona.id"
                type="button"
                class="flex items-center gap-1.5 border rounded-xl px-2.5 py-2 text-xs transition-all"
                :class="[
                  vrmConfig.persona === persona.id
                    ? 'border-amber-500 bg-amber-500/12 text-amber-600 dark:text-amber-300 font-semibold'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700',
                ]"
                @click="beatSyncStore.setVrmPersona(persona.id)"
              >
                <span :class="persona.icon" class="shrink-0 text-sm" />
                <span class="truncate">{{ persona.label }}</span>
              </button>
            </div>
          </div>

          <!-- Cycle Personas + Bar Cadence -->
          <div class="flex flex-col gap-1.5 border border-neutral-200 rounded-xl bg-neutral-50/70 p-2 text-xs dark:border-neutral-800 dark:bg-neutral-800/40">
            <div class="flex items-center justify-between">
              <span class="text-neutral-700 dark:text-neutral-200">Cycle personas</span>
              <button
                type="button"
                role="switch"
                :aria-checked="vrmConfig.cyclePersonas"
                class="relative h-5 w-9 rounded-full transition-colors"
                :class="vrmConfig.cyclePersonas ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-700'"
                @click="beatSyncStore.setCyclePersonas(!vrmConfig.cyclePersonas)"
              >
                <span
                  class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
                  :class="vrmConfig.cyclePersonas ? 'translate-x-4' : 'translate-x-0'"
                />
              </button>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-neutral-500 dark:text-neutral-400">Change every</span>
              <select
                :value="barCadenceValue"
                class="border border-neutral-200 rounded-lg bg-white px-2 py-0.5 text-[11px] text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                @change="onBarCadenceChange"
              >
                <option value="8">
                  8 bars
                </option>
                <option value="16">
                  16 bars
                </option>
                <option value="32">
                  32 bars
                </option>
                <option value="auto">
                  Auto
                </option>
              </select>
            </div>
          </div>

          <!-- Dual Status Lines -->
          <div class="flex flex-col gap-1 text-[11px]">
            <div class="flex items-center gap-1.5">
              <span
                class="h-2 w-2 rounded-full"
                :class="isActive ? 'bg-amber-500 animate-pulse' : 'bg-neutral-400'"
              />
              <span class="text-neutral-700 dark:text-neutral-200">
                {{ isActive ? `Dancing · ${personaLabel(activeAiPersona)}` : `Ready · ${personaLabel(vrmConfig.persona)}` }}
              </span>
            </div>
            <div v-if="aiStatus === 'preparing'" class="flex items-center gap-1.5 text-neutral-400">
              <span class="i-svg-spinners:ring-resize text-xs" />
              <span>Preparing next dance…</span>
            </div>
            <div v-else-if="isActive && vrmConfig.cyclePersonas && nextAiPersona" class="flex items-center gap-1.5 text-neutral-400">
              <span class="i-solar:clock-circle-linear text-xs" />
              <span>Next: {{ personaLabel(nextAiPersona) }}</span>
            </div>
            <p v-if="aiError" class="text-[10px] text-red-500">
              {{ aiError }}
            </p>
          </div>
        </template>
      </template>

      <!-- Primary Action Button -->
      <button
        type="button"
        class="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all"
        :class="[
          isActive
            ? 'bg-amber-500 text-neutral-950 hover:bg-amber-400'
            : 'bg-amber-500/90 text-neutral-950 hover:bg-amber-500',
        ]"
        @click="handlePrimaryAction"
      >
        <span :class="isActive ? 'i-solar:stop-bold' : 'i-solar:play-bold'" class="text-xs" />
        <span>{{ primaryActionLabel }}</span>
      </button>

      <!-- Quiet Settings Link -->
      <button
        type="button"
        class="self-center text-[11px] text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-200"
        @click="navigateSettings(activeRenderer === 'vrm' && vrmConfig.mode === 'ai' ? '/settings/modules/motion-choreography' : '/settings/modules/beat-sync')"
      >
        {{ activeRenderer === 'vrm' && vrmConfig.mode === 'ai' ? 'Choreography settings →' : 'Beat Sync settings →' }}
      </button>
    </template>
  </StripPopover>
</template>
