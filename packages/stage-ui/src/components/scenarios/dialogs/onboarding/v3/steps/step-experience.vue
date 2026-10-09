<script setup lang="ts">
import { useOnboardingDisplayText } from '../composables/use-onboarding-display-text'


import type { ExperienceArchetypeId, ModuleBundleConfig } from '../stores/useOnboardingV3Draft'

import { Button } from '@proj-airi/ui'
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  useOnboardingV3Draft,
} from '../stores/useOnboardingV3Draft'
import { ONBOARDING_V3_STEPS } from '../types'

const { displayText } = useOnboardingDisplayText()


const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const { t, te } = useI18n()
const draftStore = useOnboardingV3Draft()
const showAdvancedModules = ref(false)

interface CapabilityDetail {
  title: string
  icon: string
  color?: string
  description: string
  bullets: string[]
}

const CAPABILITY_DETAILS: Record<string, CapabilityDetail> = {
  Hearing: {
    title: 'Hearing',
    icon: 'i-solar:microphone-bold',
    color: 'text-sky-400',
    description: 'Listens to your voice and turns speech into text for natural spoken conversation.',
    bullets: [
      'Real-time speech transcription',
      'Voice activity / pause detection',
      'Continuous listening or push-to-talk',
    ],
  },
  Voice: {
    title: 'Voice',
    icon: 'i-solar:volume-loud-bold',
    color: 'text-indigo-400',
    description: 'Lets your companion speak aloud with a natural, expressive voice.',
    bullets: [
      'Neural text-to-speech',
      'Voice, speed, and pitch controls',
      'Captions and avatar lip-sync',
    ],
  },
  Pacing: {
    title: 'Pacing',
    icon: 'i-solar:pulse-2-bold',
    color: 'text-purple-400',
    description: 'Keeps conversations flowing naturally while responses are being prepared.',
    bullets: [
      'Natural fillers and acknowledgements',
      'Brief transition phrases during longer responses',
      'Faster, smoother conversational turn-taking',
    ],
  },
  Emotions: {
    title: 'Emotions',
    icon: 'i-solar:heart-bold',
    color: 'text-pink-400',
    description: 'Turns conversational emotion into live avatar expressions and body language.',
    bullets: [
      'Facial expressions and emotion cues',
      'Avatar gestures and body language',
      'Mood that can carry across the conversation',
    ],
  },
  Memory: {
    title: 'Memory',
    icon: 'i-solar:database-bold',
    color: 'text-cyan-400',
    description: 'Carries useful context across conversations so your companion can remember past interactions.',
    bullets: [
      'Daily summaries of recent conversations',
      'Searchable journal of important memories',
      'Connections between people, places, and topics',
    ],
  },
  Vision: {
    title: 'Vision',
    icon: 'i-solar:eye-bold',
    color: 'text-sky-400',
    description: 'Lets your companion understand images, photos, and screenshots you share.',
    bullets: [
      'Image and scene understanding',
      'Object, text, and detail recognition',
      'Follow-up discussion about visual content',
    ],
  },
  Presence: {
    title: 'Presence',
    icon: 'i-solar:moon-bold',
    color: 'text-amber-300',
    description: 'Lets your companion check in and react on its own instead of always waiting for you to start the conversation.',
    bullets: [
      'Scheduled routines and timers',
      'Proactive casual check-ins',
      'Context-aware commentary on screen activity',
    ],
  },
  Visuals: {
    title: 'Visuals',
    icon: 'i-solar:gallery-bold',
    color: 'text-amber-400',
    description: 'Lets your companion create artwork and visual scenes as part of the conversation.',
    bullets: [
      'AI image generation',
      'Visual-novel scenes and selfies',
      'Illustrated memory journal',
    ],
  },
  Tools: {
    title: 'Tools',
    icon: 'i-solar:settings-minimalistic-bold',
    color: 'text-teal-400',
    description: 'Lets your companion use external tools, browse information, and interact with your workspace.',
    bullets: [
      'Web search and page reading',
      'Local workspace access',
      'Connected services and custom tools',
    ],
  },
  Text: {
    title: 'Text',
    icon: 'i-solar:document-text-bold',
    color: 'text-slate-300',
    description: 'Provides a lightweight, keyboard-first way to chat without voice features.',
    bullets: [
      'Markdown and code formatting',
      'Streaming text responses',
      'Ideal for quiet or text-only use',
    ],
  },
}

interface ArchetypeChip {
  label: string
  icon?: string
  color?: string
}

interface ArchetypeCard {
  id: ExperienceArchetypeId
  title: string
  subtitle: string
  description: string
  icon: string
  chips: ArchetypeChip[]
  colorTheme: {
    activeBorder: string
    activeRing: string
    activeGlow: string
    activeBg: string
    iconBg: string
    iconColor: string
    subtitleColor: string
  }
}

function getArchetypeTitle(arch: ArchetypeCard): string {
  const key = `onboarding.steps.experience.archetypes.${arch.id}.title`
  return te(key) ? t(key) : arch.title
}

function getArchetypeSubtitle(arch: ArchetypeCard): string {
  const key = `onboarding.steps.experience.archetypes.${arch.id}.subtitle`
  return te(key) ? t(key) : arch.subtitle
}

function getArchetypeDescription(arch: ArchetypeCard): string {
  const key = `onboarding.steps.experience.archetypes.${arch.id}.description`
  return te(key) ? t(key) : arch.description
}

const archetypes: ArchetypeCard[] = [
  {
    id: 'quiet',
    title: 'The Minimalist',
    subtitle: 'Text, memory & workspace tools',
    description: 'Zero audio or avatar overhead. Fast keyboard chat, long-term memory, and local tools.',
    icon: 'i-solar:chat-round-line-bold',
    chips: [
      { label: 'Text' },
      { label: 'Memory' },
      { label: 'Tools' },
    ],
    colorTheme: {
      activeBorder: 'border-slate-400/80',
      activeRing: 'ring-1 ring-slate-400/50',
      activeGlow: 'shadow-[0_0_24px_rgba(148,163,184,0.18)]',
      activeBg: 'bg-slate-950/30',
      iconBg: 'bg-slate-500/20',
      iconColor: 'text-slate-300',
      subtitleColor: 'text-slate-400',
    },
  },
  {
    id: 'roommate',
    title: 'The Ambient Roommate',
    subtitle: 'Passive presence companion',
    description: 'Ambient voice, heartbeats, sleep schedule, quiet hours, and awareness.',
    icon: 'i-solar:moon-sleep-bold',
    chips: [
      { label: 'Hearing' },
      { label: 'Voice' },
      { label: 'Presence' },
      { label: 'Pacing' },
      { label: 'Memory' },
    ],
    colorTheme: {
      activeBorder: 'border-sky-500',
      activeRing: 'ring-1 ring-sky-500/50',
      activeGlow: 'shadow-[0_0_30px_rgba(14,165,233,0.25)]',
      activeBg: 'bg-sky-950/25',
      iconBg: 'bg-sky-500/25',
      iconColor: 'text-sky-300',
      subtitleColor: 'text-sky-400',
    },
  },
  {
    id: 'casual',
    title: 'The Casual Companion',
    subtitle: 'Everyday voice companion',
    description: 'Live speech, natural voice, vision, expressive emotions, and memory.',
    icon: 'i-solar:microphone-3-bold',
    chips: [
      { label: 'Hearing' },
      { label: 'Voice' },
      { label: 'Pacing' },
      { label: 'Emotions' },
      { label: 'Memory' },
      { label: 'Vision' },
    ],
    colorTheme: {
      activeBorder: 'border-purple-500',
      activeRing: 'ring-1 ring-purple-500/50',
      activeGlow: 'shadow-[0_0_30px_rgba(168,85,247,0.25)]',
      activeBg: 'bg-purple-950/25',
      iconBg: 'bg-purple-500/25',
      iconColor: 'text-purple-300',
      subtitleColor: 'text-purple-400',
    },
  },
  {
    id: 'copilot',
    title: 'The Executive Copilot',
    subtitle: 'Desktop productivity companion',
    description: 'Voice dialogue, screen awareness, local action tools, and web search.',
    icon: 'i-solar:case-round-bold',
    chips: [
      { label: 'Hearing' },
      { label: 'Voice' },
      { label: 'Vision' },
      { label: 'Tools' },
      { label: 'Memory' },
      { label: 'Pacing' },
    ],
    colorTheme: {
      activeBorder: 'border-teal-500',
      activeRing: 'ring-1 ring-teal-500/50',
      activeGlow: 'shadow-[0_0_30px_rgba(20,184,166,0.25)]',
      activeBg: 'bg-teal-950/25',
      iconBg: 'bg-teal-500/25',
      iconColor: 'text-teal-300',
      subtitleColor: 'text-teal-400',
    },
  },
  {
    id: 'muse',
    title: 'The Creative Muse',
    subtitle: 'Visual creative companion',
    description: 'Spoken dialogue, image generation, chat vision, and expressive morphs.',
    icon: 'i-solar:palette-round-bold',
    chips: [
      { label: 'Hearing' },
      { label: 'Voice' },
      { label: 'Vision' },
      { label: 'Emotions' },
      { label: 'Visuals' },
      { label: 'Memory' },
    ],
    colorTheme: {
      activeBorder: 'border-amber-500',
      activeRing: 'ring-1 ring-amber-500/50',
      activeGlow: 'shadow-[0_0_30px_rgba(245,158,11,0.25)]',
      activeBg: 'bg-amber-950/25',
      iconBg: 'bg-amber-500/25',
      iconColor: 'text-amber-300',
      subtitleColor: 'text-amber-400',
    },
  },
  {
    id: 'swiss-army',
    title: 'The Swiss Army Companion',
    subtitle: 'Full-spectrum multimodal companion',
    description: 'Hearing voice, pacing, emotions, screen watching, artistry, tools, and memory.',
    icon: 'i-solar:stars-minimalistic-bold',
    chips: [
      { label: 'Hearing' },
      { label: 'Voice' },
      { label: 'Pacing' },
      { label: 'Emotions' },
      { label: 'Vision' },
      { label: 'Presence' },
      { label: 'Visuals' },
      { label: 'Tools' },
      { label: 'Memory' },
    ],
    colorTheme: {
      activeBorder: 'border-rose-500',
      activeRing: 'ring-1 ring-rose-500/50',
      activeGlow: 'shadow-[0_0_30px_rgba(244,63,94,0.25)]',
      activeBg: 'bg-rose-950/25',
      iconBg: 'bg-rose-500/25',
      iconColor: 'text-rose-300',
      subtitleColor: 'text-rose-400',
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
    label: 'Voice Input (Hearing)',
    shortLabel: 'Hearing',
    description: 'Mic input & Whisper voice transcription',
    icon: 'i-solar:microphone-bold-duotone',
  },
  {
    key: 'speech',
    label: 'Neural Voice',
    shortLabel: 'Voice',
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
    key: 'proactivity',
    label: 'Proactive Presence',
    shortLabel: 'Presence',
    description: 'Schedule, ambient heartbeats & screen awareness',
    icon: 'i-solar:radar-bold-duotone',
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

const totalSteps = computed(() => {
  const modules = draftStore.state?.modules
  const archetype = draftStore.state?.experienceArchetype
  const isNoModel = archetype === 'quiet' || !modules?.emotions
  return ONBOARDING_V3_STEPS.filter((step) => {
    if (step.id === 'vessel')
      return !isNoModel
    if (!step.moduleKey)
      return true
    return Boolean(modules?.[step.moduleKey])
  }).length
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
        <h1 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
          {{ t('onboarding.steps.experience.title') }}
        </h1>
      </div>

      <!-- Compact Companion Speech Bubble -->
      <div
        v-motion
        :initial="{ opacity: 0, scale: 0.98 }"
        :enter="{ opacity: 1, scale: 1 }"
        :duration="350"
        :delay="100"
        :class="['max-w-xl w-full flex items-center gap-3 text-left']"
      >
        <div
          :class="[
            'h-9 w-9 flex flex-shrink-0 items-center justify-center rounded-full',
            'border border-sky-500/40 bg-sky-950/40 shadow-[0_0_12px_rgba(56,189,248,0.25)]',
          ]"
        >
          <div :class="['i-solar:stars-minimalistic-bold h-4 w-4 text-sky-400']" />
        </div>
        <div
          :class="[
            'relative flex-1 border border-sky-500/30 rounded-2xl px-4 py-2.5',
            'text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed backdrop-blur-md',
            'bg-sky-950/20 shadow-sm',
          ]"
        >
          {{ t('onboarding.ui.choose-an-archetype-that-fits-your-style-whether-you-prefer-a-silent-observer') }}
        </div>
      </div>
    </div>

    <!-- 6 Hero Archetype Cards Grid (3 Columns x 2 Rows) -->
    <TooltipProvider :delay-duration="150">
      <div
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="400"
        :delay="150"
        :class="['grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1 items-stretch']"
      >
        <div
          v-for="archetype in archetypes"
          :key="archetype.id"
          :class="[
            'relative flex flex-col justify-between rounded-2xl p-4 transition-all duration-200 cursor-pointer min-h-[195px]',
            selectedArchetypeId === archetype.id
              ? [
                archetype.colorTheme.activeBorder,
                archetype.colorTheme.activeGlow,
                archetype.colorTheme.activeRing,
                archetype.colorTheme.activeBg,
                'border-2 scale-[1.01] z-10',
              ]
              : 'border border-neutral-200/80 dark:border-white/[0.08] bg-white/70 dark:bg-[#121318]/90 hover:border-neutral-300 dark:hover:border-white/20 backdrop-blur-md',
          ]"
          @click="selectArchetype(archetype.id)"
        >
          <div>
            <!-- Top Row: Icon + Title & Subtitle Horizontal -->
            <div :class="['flex items-center gap-3.5 mb-2.5']">
              <div
                :class="[
                  'h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors',
                  archetype.colorTheme.iconBg,
                  archetype.colorTheme.iconColor,
                ]"
              >
                <div :class="[archetype.icon, 'text-xl']" />
              </div>

              <div :class="['min-w-0 flex-1']">
                <h2 :class="['text-sm font-bold text-neutral-900 dark:text-white leading-tight truncate']">
                  {{ displayText(getArchetypeTitle(archetype)) }}
                </h2>
                <p :class="['text-xs font-medium mt-0.5 leading-tight truncate', archetype.colorTheme.subtitleColor]">
                  {{ displayText(getArchetypeSubtitle(archetype)) }}
                </p>
              </div>
            </div>

            <!-- Description -->
            <p :class="['text-xs text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed']">
              {{ displayText(getArchetypeDescription(archetype)) }}
            </p>
          </div>

          <!-- Capability Chips Footer with Hover Popovers -->
          <div :class="['flex flex-wrap gap-1.5 mt-3 pt-1']">
            <TooltipRoot
              v-for="chip in archetype.chips"
              :key="chip.label"
            >
              <TooltipTrigger as-child>
                <div
                  :class="[
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-help transition-all',
                    'border border-neutral-200/80 dark:border-white/10 bg-neutral-100/80 dark:bg-white/5 text-neutral-700 dark:text-neutral-300',
                    'hover:border-neutral-400 dark:hover:border-white/30 hover:bg-neutral-200/50 dark:hover:bg-white/10',
                  ]"
                >
                  <div :class="[CAPABILITY_DETAILS[chip.label]?.icon || chip.icon, 'text-xs shrink-0', CAPABILITY_DETAILS[chip.label]?.color || chip.color || 'text-neutral-400']" />
                  <span>{{ displayText(chip.label) }}</span>
                </div>
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent
                  side="top"
                  :side-offset="8"
                  :collision-padding="12"
                  :class="[
                    'z-50 w-64 rounded-xl p-3 shadow-2xl backdrop-blur-xl',
                    'bg-white/95 dark:bg-[#121620]/95 border border-neutral-200/80 dark:border-white/10',
                    'text-neutral-800 dark:text-neutral-200 pointer-events-none select-none text-left',
                    'animate-in fade-in-0 zoom-in-95 duration-150',
                  ]"
                >
                  <div v-if="CAPABILITY_DETAILS[chip.label]">
                    <div :class="['flex items-center gap-1.5 font-bold text-xs text-neutral-900 dark:text-white mb-1']">
                      <div :class="[CAPABILITY_DETAILS[chip.label].icon, 'text-xs shrink-0', CAPABILITY_DETAILS[chip.label].color]" />
                      <span>{{ displayText(CAPABILITY_DETAILS[chip.label].title) }}</span>
                    </div>
                    <p :class="['text-[11px] text-neutral-600 dark:text-neutral-400 leading-snug mb-2']">
                      {{ displayText(CAPABILITY_DETAILS[chip.label].description) }}
                    </p>
                    <div :class="['space-y-1 pt-1.5 border-t border-neutral-100 dark:border-white/5 text-[10px] text-neutral-500 dark:text-neutral-300']">
                      <div
                        v-for="bullet in CAPABILITY_DETAILS[chip.label].bullets"
                        :key="bullet"
                        :class="['flex items-center gap-1.5 leading-tight']"
                      >
                        <div :class="['w-1 h-1 rounded-full bg-primary-500/80 dark:bg-primary-400/80 shrink-0']" />
                        <span>{{ displayText(bullet) }}</span>
                      </div>
                    </div>
                  </div>
                </TooltipContent>
              </TooltipPortal>
            </TooltipRoot>
          </div>
        </div>
      </div>
    </TooltipProvider>

    <!-- Collapsible Advanced: Customize Modules Drawer -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="350"
      :delay="200"
      :class="[
        'rounded-2xl border transition-all mt-1',
        'border-neutral-200/80 dark:border-white/10 bg-white/70 dark:bg-[#0d1017]/90 shadow-xs hover:border-neutral-300 dark:hover:border-white/20 backdrop-blur-md',
      ]"
    >
      <!-- Drawer Header Bar (Clickable Toggle) -->
      <div
        :class="['px-4 py-3 flex items-center justify-between cursor-pointer select-none']"
        @click="showAdvancedModules = !showAdvancedModules"
      >
        <div :class="['flex items-center gap-2.5']">
          <div :class="['i-solar:shield-check-bold text-sky-400 text-lg']" />
          <span :class="['text-xs font-semibold text-neutral-900 dark:text-white']">
            {{ t('onboarding.steps.experience.customizeModules') }}
          </span>
        </div>

        <div :class="['flex items-center gap-3']">
          <button
            v-if="showAdvancedModules"
            type="button"
            :class="['text-[11px] text-neutral-400 hover:text-primary-500 font-medium transition-colors cursor-pointer mr-2']"
            @click.stop="resetToPresetDefaults"
          >
            {{ t('onboarding.ui.reset-to-preset') }}
          </button>
          <span :class="['text-xs text-neutral-500 dark:text-neutral-400 font-medium']">
            {{ displayText(activeModules.length) }} {{ t('onboarding.ui.enabled') }} {{ displayText(Math.max(0, 10 - activeModules.length)) }} {{ t('onboarding.ui.available') }} {{ displayText(totalSteps) }} {{ t('onboarding.ui.steps') }}
          </span>
          <div
            :class="[
              'i-solar:alt-arrow-down-linear text-xs transition-transform duration-200 text-neutral-400',
              showAdvancedModules ? 'rotate-180 text-sky-400' : '',
            ]"
          />
        </div>
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
                  {{ displayText(mod.label) }}
                </span>
                <span
                  :class="[
                    'text-[10px] font-mono shrink-0',
                    draftStore.state?.modules?.[mod.key] ? 'text-primary-500 font-bold' : 'text-neutral-400',
                  ]"
                >
                  {{ displayText(draftStore.state?.modules?.[mod.key] ? 'ON' : 'OFF') }}
                </span>
              </div>
              <p :class="['text-[10px] text-neutral-400 mt-0.5 leading-snug line-clamp-2']">
                {{ displayText(mod.description) }}
              </p>
            </div>
          </button>

          <!-- 10th Slot: Extensible Plugins / Community Skills (Future Hook) -->
          <div
            :class="[
              'flex items-start gap-2.5 p-2.5 rounded-xl border border-dashed border-neutral-300/70 dark:border-neutral-800 bg-neutral-50/20 dark:bg-neutral-950/20 text-neutral-400 select-none opacity-75',
            ]"
          >
            <div :class="['h-7 w-7 rounded-lg flex items-center justify-center shrink-0 bg-neutral-200/50 dark:bg-neutral-800/50 text-neutral-400']">
              <div :class="['i-solar:add-circle-bold-duotone text-sm']" />
            </div>

            <div :class="['min-w-0 flex-1']">
              <div :class="['flex items-center justify-between gap-1']">
                <span :class="['text-xs font-semibold text-neutral-500 dark:text-neutral-400 truncate']">
                  {{ t('onboarding.ui.extensible-plugins') }}
                </span>
                <span :class="['text-[9px] font-mono text-neutral-400 dark:text-neutral-500 uppercase tracking-wider']">
                  {{ t('onboarding.ui.soon') }}
                </span>
              </div>
              <p :class="['text-[10px] text-neutral-400/80 mt-0.5 leading-snug line-clamp-2']">
                {{ t('onboarding.ui.discord-bot-community-skills-triggers') }}
              </p>
            </div>
          </div>
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
        <span>{{ t('onboarding.shell.previous') }}</span>
      </button>

      <div :class="['text-[11px] text-neutral-400 font-medium']">
        {{ t('onboarding.ui.selected') }} <span :class="['text-neutral-700 dark:text-neutral-200 font-semibold']">{{ displayText(getArchetypeTitle(selectedArchetype)) }}</span>
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
        <span>{{ t('onboarding.shell.next') }}</span>
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
