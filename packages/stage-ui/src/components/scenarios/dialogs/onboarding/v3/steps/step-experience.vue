<script setup lang="ts">
import type { ExperienceArchetypeId, ModuleBundleConfig } from '../stores/useOnboardingV3Draft'

import { Button } from '@proj-airi/ui'
import { computed, ref } from 'vue'

import {
  ARCHETYPE_MODULE_PRESETS,
  useOnboardingV3Draft,
} from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const draftStore = useOnboardingV3Draft()
const showAdvancedModules = ref(false)

interface ArchetypeCard {
  id: ExperienceArchetypeId
  title: string
  badgeLabel?: string
  subtitle: string
  description: string
  icon: string
  colorTheme: {
    activeBorder: string
    activeRing: string
    activeGlow: string
    badgeBg: string
    badgeText: string
    iconBg: string
    iconColor: string
  }
}

const archetypes: ArchetypeCard[] = [
  {
    id: 'quiet',
    title: 'The Quiet Observer',
    badgeLabel: '⚡ Fastest · Minimalist',
    subtitle: 'Text, Expressions & Memory',
    description: 'Zero audio overhead, avatar emotions, thinking pacing, and long-term memory.',
    icon: 'i-solar:chat-round-line-bold-duotone',
    colorTheme: {
      activeBorder: 'border-slate-400 dark:border-slate-300',
      activeRing: 'ring-slate-400/40',
      activeGlow: 'shadow-slate-500/15',
      badgeBg: 'bg-slate-500/20',
      badgeText: 'text-slate-700 dark:text-slate-200',
      iconBg: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
      iconColor: 'text-slate-600 dark:text-slate-300',
    },
  },
  {
    id: 'casual',
    title: 'The Casual Companion',
    badgeLabel: '✨ Popular Choice',
    subtitle: 'Voice Dialogue & Vision',
    description: 'Live speech transcription (STT), emotional voice (TTS), photo vision, natural pacing, and memory.',
    icon: 'i-solar:microphone-3-bold-duotone',
    colorTheme: {
      activeBorder: 'border-purple-500',
      activeRing: 'ring-purple-500/40',
      activeGlow: 'shadow-purple-500/20',
      badgeBg: 'bg-purple-500/20',
      badgeText: 'text-purple-600 dark:text-purple-300',
      iconBg: 'bg-purple-500/15 text-purple-500',
      iconColor: 'text-purple-500',
    },
  },
  {
    id: 'muse',
    title: 'The Creative Muse',
    badgeLabel: '🎨 Visual Focus',
    subtitle: 'Voice, Vision & Artistry',
    description: 'Spoken dialogue, image generation (Pollinations/ComfyUI), chat vision, and expressive morphs.',
    icon: 'i-solar:palette-round-bold-duotone',
    colorTheme: {
      activeBorder: 'border-amber-500',
      activeRing: 'ring-amber-500/40',
      activeGlow: 'shadow-amber-500/20',
      badgeBg: 'bg-amber-500/20',
      badgeText: 'text-amber-600 dark:text-amber-300',
      iconBg: 'bg-amber-500/15 text-amber-500',
      iconColor: 'text-amber-500',
    },
  },
  {
    id: 'copilot',
    title: 'The Executive Copilot',
    badgeLabel: '💼 Productivity',
    subtitle: 'Voice + Action Tools',
    description: 'Voice dialogue, desktop screen watching, local filesystem action tools, and live web search.',
    icon: 'i-solar:case-round-bold-duotone',
    colorTheme: {
      activeBorder: 'border-teal-500',
      activeRing: 'ring-teal-500/40',
      activeGlow: 'shadow-teal-500/20',
      badgeBg: 'bg-teal-500/20',
      badgeText: 'text-teal-600 dark:text-teal-300',
      iconBg: 'bg-teal-500/15 text-teal-500',
      iconColor: 'text-teal-500',
    },
  },
  {
    id: 'roommate',
    title: 'The Ambient Roommate',
    badgeLabel: '🌙 Proactive Presence',
    subtitle: 'Living Routine & Presence',
    description: 'Spoken voice, ambient heartbeats, sleep schedule, quiet hours, and screen awareness.',
    icon: 'i-solar:moon-sleep-bold-duotone',
    colorTheme: {
      activeBorder: 'border-indigo-500',
      activeRing: 'ring-indigo-500/40',
      activeGlow: 'shadow-indigo-500/20',
      badgeBg: 'bg-indigo-500/20',
      badgeText: 'text-indigo-600 dark:text-indigo-300',
      iconBg: 'bg-indigo-500/15 text-indigo-500',
      iconColor: 'text-indigo-500',
    },
  },
  {
    id: 'swiss-army',
    title: 'The Swiss Army Companion',
    badgeLabel: '🔥 Most Steps · All-In-One',
    subtitle: 'Full Autonomous Multimodal',
    description: 'The flagship do-it-all: Voice STT/TTS, vision, screen watching, daily routine, visual novels, tools & memory.',
    icon: 'i-solar:magic-stick-3-bold-duotone',
    colorTheme: {
      activeBorder: 'border-rose-500',
      activeRing: 'ring-rose-500/40',
      activeGlow: 'shadow-rose-500/20',
      badgeBg: 'bg-rose-500/20',
      badgeText: 'text-rose-600 dark:text-rose-300',
      iconBg: 'bg-rose-500/15 text-rose-500',
      iconColor: 'text-rose-500',
    },
  },
]

const selectedArchetypeId = computed<ExperienceArchetypeId>({
  get: () => {
    const current = draftStore.state.experienceArchetype || 'casual'
    return current === 'performer' ? 'swiss-army' : current
  },
  set: (val) => {
    draftStore.setExperienceArchetype(val)
  },
})

const selectedArchetype = computed(() => {
  return archetypes.find(a => a.id === selectedArchetypeId.value) || archetypes[1]
})

function selectArchetype(id: ExperienceArchetypeId) {
  selectedArchetypeId.value = id
}

interface ModuleDefinition {
  key: keyof ModuleBundleConfig
  label: string
  shortLabel: string
  description: string
  icon: string
}

const moduleDefinitions: ModuleDefinition[] = [
  {
    key: 'hearing',
    label: 'Voice Input (STT)',
    shortLabel: 'STT',
    description: 'Mic input & Whisper voice transcription',
    icon: 'i-solar:microphone-bold-duotone',
  },
  {
    key: 'speech',
    label: 'Neural Voice (TTS)',
    shortLabel: 'TTS',
    description: 'Kokoro or Edge TTS spoken voice synthesis',
    icon: 'i-solar:volume-loud-bold-duotone',
  },
  {
    key: 'thinking',
    label: 'Thinking & Pacing',
    shortLabel: 'Pacing',
    description: 'Dynamic conversational fillers & subconscious asides',
    icon: 'i-ph:brain-duotone',
  },
  {
    key: 'emotions',
    label: 'Avatar Emotions',
    shortLabel: 'Emotions',
    description: '2-Pass AI ACT emotion mapping and avatar morphs',
    icon: 'i-solar:smile-circle-bold-duotone',
  },
  {
    key: 'memory',
    label: 'Memory Hierarchy',
    shortLabel: 'Memory',
    description: '24h short-term memories & long-term text journal',
    icon: 'i-solar:book-bookmark-bold-duotone',
  },
  {
    key: 'vision',
    label: 'Chat Image Vision',
    shortLabel: 'Vision',
    description: 'Photo analysis & VLM 1-hop/2-hop routing',
    icon: 'i-solar:camera-bold-duotone',
  },
  {
    key: 'screen',
    label: 'Screen Watching',
    shortLabel: 'Screen',
    description: 'Desktop display watching & OCR salience gate',
    icon: 'i-solar:videocamera-record-bold-duotone',
  },
  {
    key: 'proactivity',
    label: 'Daily Routine',
    shortLabel: 'Routine',
    description: 'Circadian rhythm, sleep hours & ambient check-ins',
    icon: 'i-solar:heart-pulse-2-bold-duotone',
  },
  {
    key: 'artistry',
    label: 'Visual Novels',
    shortLabel: 'Visuals',
    description: 'Turn-by-turn scene visuals, art generation & selfies',
    icon: 'i-solar:palette-round-bold-duotone',
  },
  {
    key: 'tools',
    label: 'Action Tools',
    shortLabel: 'Tools',
    description: 'Web search, local file access, and MCP servers',
    icon: 'i-solar:widget-add-bold-duotone',
  },
]

const activeModules = computed(() => {
  const modules = draftStore.state?.modules
  if (!modules)
    return []
  return moduleDefinitions.filter(m => Boolean(modules[m.key]))
})

function toggleModule(key: keyof ModuleBundleConfig) {
  draftStore.toggleModule(key)
}

function resetToPresetDefaults() {
  draftStore.setExperienceArchetype(selectedArchetypeId.value)
}
</script>

<template>
  <div :class="['w-full max-w-5xl mx-auto flex flex-col gap-4 py-1 select-none']">
    <!-- Header Section -->
    <div :class="['flex flex-col items-center text-center gap-2.5']">
      <div
        v-motion
        :initial="{ opacity: 0, y: -6 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="350"
        :class="['text-center']"
      >
        <div :class="['inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary-500/20 bg-primary-500/10 text-primary-400 text-xs font-semibold mb-1']">
          <div :class="['i-solar:tuning-square-bold-duotone h-3.5 w-3.5']" />
          <span>Step 4 of 16 · Interaction Archetype</span>
        </div>
        <h1 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
          Choose How You Want to Interact
        </h1>
        <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
          Select a curated archetype preset, or customize your own bundle of capabilities.
        </p>
      </div>

      <!-- Compact Companion Speech Bubble -->
      <div
        v-motion
        :initial="{ opacity: 0, scale: 0.98 }"
        :enter="{ opacity: 1, scale: 1 }"
        :duration="350"
        :delay="100"
        :class="['max-w-xl w-full flex items-start gap-3 text-left']"
      >
        <div
          :class="[
            'h-8 w-8 flex flex-shrink-0 items-center justify-center border border-primary-500/30 rounded-full',
            'bg-gradient-to-br from-primary-500/20 to-indigo-500/20 shadow-xs mt-0.5',
          ]"
        >
          <div :class="['i-solar:emoji-funny-circle-bold-duotone h-5 w-5 text-primary-400']" />
        </div>
        <div
          :class="[
            'relative flex-1 border border-primary-500/20 rounded-xl rounded-tl-xs px-4 py-2',
            'text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed backdrop-blur-md',
            'bg-primary-500/5 dark:bg-primary-950/20 shadow-sm',
          ]"
        >
          "Choose an archetype that fits your style. Whether you prefer a silent observer, voice companion, or full stage performer, every capability can be customized."
        </div>
      </div>
    </div>

    <!-- 6 Hero Archetype Cards Grid (3 Columns x 2 Rows) -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      :delay="150"
      :class="['grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 items-stretch']"
    >
      <div
        v-for="archetype in archetypes"
        :key="archetype.id"
        :class="[
          'relative flex flex-col justify-between overflow-hidden rounded-2xl p-3.5 border-2 transition-all duration-200 cursor-pointer min-h-[195px]',
          selectedArchetypeId === archetype.id
            ? [
              archetype.colorTheme.activeBorder,
              'bg-gradient-to-b from-white/90 to-white/70 dark:from-neutral-900/90 dark:to-neutral-950/90',
              archetype.colorTheme.activeGlow,
              archetype.colorTheme.activeRing,
              'shadow-lg ring-1 scale-[1.01] z-10',
            ]
            : 'border-neutral-200/80 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/50 hover:border-neutral-300 dark:hover:border-neutral-700 backdrop-blur-md',
        ]"
        @click="selectArchetype(archetype.id)"
      >
        <!-- Top Row: Icon + Selection Badge / Archetype Badge -->
        <div>
          <div :class="['flex items-start justify-between mb-2.5']">
            <div
              :class="[
                'h-9 w-9 rounded-xl flex items-center justify-center transition-colors',
                selectedArchetypeId === archetype.id
                  ? archetype.colorTheme.iconBg
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400',
              ]"
            >
              <div :class="[archetype.icon, 'text-lg']" />
            </div>

            <!-- Active Selected Badge OR Archetype Badge Label -->
            <span
              v-if="selectedArchetypeId === archetype.id"
              :class="[
                'px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide flex items-center gap-1 shadow-xs',
                archetype.colorTheme.badgeBg,
                archetype.colorTheme.badgeText,
              ]"
            >
              <div :class="['i-solar:check-circle-bold text-xs']" />
              <span>Selected Preset</span>
            </span>
            <span
              v-else-if="archetype.badgeLabel"
              :class="[
                'px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide flex items-center gap-1',
                'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200/60 dark:border-neutral-700/60',
              ]"
            >
              {{ archetype.badgeLabel }}
            </span>
          </div>

          <!-- Title & Subtitle -->
          <h2 :class="['text-sm font-bold text-neutral-900 dark:text-white leading-snug']">
            {{ archetype.title }}
          </h2>
          <p :class="['text-[11px] font-semibold mt-0.5', archetype.colorTheme.badgeText]">
            {{ archetype.subtitle }}
          </p>

          <!-- Description -->
          <p :class="['text-[11px] text-neutral-600 dark:text-neutral-400 mt-1.5 leading-snug']">
            {{ archetype.description }}
          </p>
        </div>

        <!-- Card Footer (Active Indicator bar) -->
        <div :class="['pt-2.5 mt-2.5 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-[11px]']">
          <span :class="['text-neutral-500 dark:text-neutral-400 font-medium']">
            {{ Object.values(ARCHETYPE_MODULE_PRESETS[archetype.id]).filter(Boolean).length }} Capabilities
          </span>
          <span
            :class="[
              'font-semibold transition-colors',
              selectedArchetypeId === archetype.id ? archetype.colorTheme.badgeText : 'text-neutral-400',
            ]"
          >
            {{ selectedArchetypeId === archetype.id ? 'Active' : 'Choose →' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Collapsible Advanced: Customize Modules Drawer -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="350"
      :delay="200"
      :class="[
        'rounded-2xl border transition-all',
        'border-neutral-200/80 bg-white/70 shadow-xs dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md',
      ]"
    >
      <!-- Drawer Header Bar (Clickable Toggle) -->
      <div
        :class="['p-3 flex items-center justify-between cursor-pointer select-none']"
        @click="showAdvancedModules = !showAdvancedModules"
      >
        <div :class="['flex items-center gap-2.5 flex-wrap min-w-0']">
          <button
            type="button"
            :class="['flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:text-primary-500 transition-colors cursor-pointer']"
          >
            <div :class="['i-solar:settings-minimalistic-bold text-sm text-primary-500']" />
            <span>Advanced: Customize Modules</span>
            <span :class="['text-[11px] text-neutral-400 font-normal']">
              ({{ activeModules.length }} Enabled)
            </span>
            <div
              :class="[
                'i-solar:alt-arrow-down-linear text-xs transition-transform duration-200 text-neutral-400',
                showAdvancedModules ? 'rotate-180 text-primary-500' : '',
              ]"
            />
          </button>

          <!-- Quick Preview Tag Chips (Always visible when drawer is collapsed) -->
          <div v-if="!showAdvancedModules" :class="['hidden sm:flex items-center gap-1.5 overflow-x-auto py-0.5']">
            <span
              v-for="mod in activeModules"
              :key="mod.key"
              :class="['px-2 py-0.5 rounded-md text-[10px] font-medium border border-neutral-200/80 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 whitespace-nowrap']"
            >
              {{ mod.shortLabel }}
            </span>
          </div>
        </div>

        <button
          v-if="showAdvancedModules"
          type="button"
          :class="['text-[11px] text-neutral-400 hover:text-primary-500 font-medium transition-colors cursor-pointer']"
          @click.stop="resetToPresetDefaults"
        >
          Reset to Preset
        </button>
      </div>

      <!-- Expanded Module Customization Grid -->
      <div
        v-if="showAdvancedModules"
        :class="['px-3.5 pb-3.5 pt-1 border-t border-neutral-100 dark:border-neutral-800/80 animate-fadeIn']"
      >
        <div :class="['grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 mt-2']">
          <button
            v-for="mod in moduleDefinitions"
            :key="mod.key"
            type="button"
            :class="[
              'flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer',
              draftStore.state?.modules?.[mod.key]
                ? 'border-primary-500/50 bg-primary-500/10 dark:bg-primary-950/30 text-neutral-900 dark:text-white ring-1 ring-primary-500/20'
                : 'border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 text-neutral-500 hover:border-neutral-300 dark:hover:border-neutral-700',
            ]"
            @click="toggleModule(mod.key)"
          >
            <div
              :class="[
                'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                draftStore.state?.modules?.[mod.key]
                  ? 'bg-primary-500 text-white shadow-xs'
                  : 'bg-neutral-200/60 dark:bg-neutral-800 text-neutral-400',
              ]"
            >
              <div :class="[mod.icon, 'text-sm']" />
            </div>

            <div :class="['min-w-0 flex-1']">
              <div :class="['flex items-center justify-between gap-1']">
                <span :class="['text-xs font-bold truncate']">
                  {{ mod.label }}
                </span>
                <span
                  :class="[
                    'text-[10px] font-mono shrink-0',
                    draftStore.state?.modules?.[mod.key] ? 'text-primary-500 font-bold' : 'text-neutral-400',
                  ]"
                >
                  {{ draftStore.state?.modules?.[mod.key] ? 'ON' : 'OFF' }}
                </span>
              </div>
              <p :class="['text-[10px] text-neutral-400 mt-0.5 leading-snug line-clamp-2']">
                {{ mod.description }}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Navigation Action Bar -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="350"
      :delay="250"
      :class="['flex items-center justify-between pt-3 border-t border-neutral-200/80 dark:border-white/5']"
    >
      <button
        type="button"
        :class="['flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        <div :class="['i-solar:alt-arrow-left-line-duotone h-4 w-4']" />
        <span>Back to Triage</span>
      </button>

      <div :class="['text-[11px] text-neutral-400 font-medium']">
        Selected: <span :class="['text-neutral-700 dark:text-neutral-200 font-semibold']">{{ selectedArchetype.title }}</span>
      </div>

      <Button
        variant="primary"
        size="md"
        :class="[
          'flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 px-5 py-2',
          'text-xs font-semibold text-white shadow-md shadow-primary-600/25 transition-all active:scale-95 cursor-pointer',
        ]"
        @click="props.onNext"
      >
        <span>Continue with {{ selectedArchetype.title }}</span>
        <div :class="['i-solar:alt-arrow-right-line-duotone h-4 w-4']" />
      </Button>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
