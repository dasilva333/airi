<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const { t } = useI18n()

const draft = useOnboardingV3Draft()

// --- State Bindings: Screen Watching (Visual Push) ---
const screenWatcherEnabled = ref<boolean>(draft.state.screenWatcherEnabled !== false)
const screenWatcherMode = ref<'voice-and-bubble' | 'bubble-only' | 'voice-only' | 'muted'>(
  draft.state.screenWatcherMode || 'voice-and-bubble',
)
const screenWatcherTier = ref<'lightweight' | 'moondream' | 'external'>(
  draft.state.screenWatcherTier || 'lightweight',
)
const screenWatcherInterval = ref<number>(
  draft.state.screenWatcherInterval || 2000,
)

// --- Reaction Delivery Modes Catalog ---
const reactionModes = computed(() => [
  {
    id: 'voice-and-bubble' as const,
    title: t('onboarding.steps.screen.reactionModes.voice-and-bubble.title'),
    badge: t('onboarding.steps.screen.reactionModes.voice-and-bubble.badge'),
    badgeColor: 'bg-primary-500/10 text-primary-500 border-primary-500/20',
    desc: t('onboarding.steps.screen.reactionModes.voice-and-bubble.desc'),
    icon: 'i-solar:chat-round-line-bold',
  },
  {
    id: 'bubble-only' as const,
    title: t('onboarding.steps.screen.reactionModes.bubble-only.title'),
    badge: t('onboarding.steps.screen.reactionModes.bubble-only.badge'),
    badgeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    desc: t('onboarding.steps.screen.reactionModes.bubble-only.desc'),
    icon: 'i-solar:chat-square-bold-duotone',
  },
  {
    id: 'voice-only' as const,
    title: t('onboarding.steps.screen.reactionModes.voice-only.title'),
    badge: t('onboarding.steps.screen.reactionModes.voice-only.badge'),
    badgeColor: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    desc: t('onboarding.steps.screen.reactionModes.voice-only.desc'),
    icon: 'i-solar:soundwave-bold-duotone',
  },
  {
    id: 'muted' as const,
    title: t('onboarding.steps.screen.reactionModes.muted.title'),
    badge: t('onboarding.steps.screen.reactionModes.muted.badge'),
    badgeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    desc: t('onboarding.steps.screen.reactionModes.muted.desc'),
    icon: 'i-solar:eye-bold-duotone',
  },
])

// --- Vision Analysis Tiers ---
const visionTiers = computed(() => [
  {
    id: 'lightweight' as const,
    title: t('onboarding.steps.screen.visionTiers.lightweight.title'),
    vram: t('onboarding.steps.screen.visionTiers.lightweight.vram'),
    desc: t('onboarding.steps.screen.visionTiers.lightweight.desc'),
    icon: 'i-solar:shield-check-bold-duotone',
  },
  {
    id: 'moondream' as const,
    title: t('onboarding.steps.screen.visionTiers.moondream.title'),
    vram: t('onboarding.steps.screen.visionTiers.moondream.vram'),
    desc: t('onboarding.steps.screen.visionTiers.moondream.desc'),
    icon: 'i-solar:magic-stick-3-bold-duotone',
  },
])

// --- Interval Presets ---
const screenIntervalPresets = [
  { label: '1s (High)', labelKey: 'onboarding.steps.screen.screenIntervalPresets.1000.label', value: 1000 },
  { label: '2s (Balanced)', labelKey: 'onboarding.steps.screen.screenIntervalPresets.2000.label', value: 2000 },
  { label: '5s (Gentle)', labelKey: 'onboarding.steps.screen.screenIntervalPresets.5000.label', value: 5000 },
  { label: '10s (Eco)', labelKey: 'onboarding.steps.screen.screenIntervalPresets.10000.label', value: 10000 },
]

function syncDraft() {
  draft.setScreen({
    screenWatcherEnabled: screenWatcherEnabled.value,
    screenWatcherMode: screenWatcherMode.value,
    screenWatcherTier: screenWatcherTier.value,
    screenWatcherInterval: screenWatcherInterval.value,
  })
}

onBeforeUnmount(() => {
  syncDraft()
})
</script>

<template>
  <div :class="['w-full max-w-5xl mx-auto flex flex-col gap-4 py-1 select-none']">
    <!-- Header Section -->
    <div :class="['flex items-start justify-between gap-4 pb-2 border-b border-neutral-200/80 dark:border-white/10']">
      <div :class="['flex items-start gap-3']">
        <div :class="['w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center text-xl flex-shrink-0 mt-0.5 border border-sky-500/20 shadow-xs']">
          <div :class="['i-solar:videocamera-record-bold-duotone w-5 h-5']" />
        </div>
        <div>
          <div :class="['flex items-center gap-2']">
            <h2 :class="['text-lg font-bold text-neutral-900 dark:text-white tracking-tight']">
              {{ t('onboarding.steps.screen.title') }}
            </h2>
            <span :class="['text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400']">
              {{ t('onboarding.steps.screen.subtitle') }}
            </span>
          </div>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
            {{ t('onboarding.steps.screen.description') }}
          </p>
        </div>
      </div>

      <!-- Active Status Badge -->
      <div :class="['flex items-center gap-2 flex-shrink-0']">
        <span
          :class="[
            'text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full font-mono border flex items-center gap-1.5',
            screenWatcherEnabled
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700',
          ]"
        >
          <span :class="['w-1.5 h-1.5 rounded-full', screenWatcherEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400']" />
          <span>{{ screenWatcherEnabled ? t('onboarding.steps.screen.screenWatchingActive') : t('onboarding.steps.screen.watcherPaused') }}</span>
        </span>
      </div>
    </div>

    <!-- Master Switch Card -->
    <div :class="['flex flex-col gap-4 p-5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] shadow-sm backdrop-blur-md']">
      <div :class="['flex items-start justify-between gap-4']">
        <div :class="['flex items-start gap-3']">
          <div :class="['w-8 h-8 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center text-base flex-shrink-0 mt-0.5']">
            <div :class="['i-solar:eye-bold-duotone w-4 h-4']" />
          </div>
          <div>
            <div :class="['flex items-center gap-2']">
              <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                {{ t('onboarding.steps.screen.screenPerceptionVisualPush') }}
              </h3>
              <span :class="['text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20']">
                {{ t('onboarding.steps.screen.eventDrivenPush') }}
              </span>
            </div>
            <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
              {{ t('onboarding.steps.screen.enableBackgroundDesktopFrameCapturesPromotesSignificantVisualDifferenc') }}
            </p>
          </div>
        </div>

        <!-- Master Switch -->
        <button
          type="button"
          :class="[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
            screenWatcherEnabled ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
          ]"
          @click="screenWatcherEnabled = !screenWatcherEnabled; syncDraft()"
        >
          <span
            :class="[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              screenWatcherEnabled ? 'translate-x-5' : 'translate-x-0',
            ]"
          />
        </button>
      </div>

      <!-- Enabled Options Container -->
      <div v-if="screenWatcherEnabled" :class="['flex flex-col gap-4 pt-3 border-t border-neutral-200/60 dark:border-white/5 animate-fadeIn']">
        <!-- Reaction Delivery Modes -->
        <div :class="['flex flex-col gap-2']">
          <label :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5']">
            <span>{{ t('onboarding.steps.screen.reactionDeliveryMode') }}</span>
            <span :class="['text-[10px] font-normal text-neutral-400']">{{ t('onboarding.steps.screen.howReactionsArePresented') }}</span>
          </label>
          <div :class="['grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5']">
            <button
              v-for="mode in reactionModes"
              :key="mode.id"
              type="button"
              :class="[
                'p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer min-h-[96px]',
                screenWatcherMode === mode.id
                  ? 'border-primary-500 bg-primary-500/10 text-neutral-900 dark:text-white ring-1 ring-primary-500/30'
                  : 'border-neutral-200/80 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-white/20',
              ]"
              @click="screenWatcherMode = mode.id; syncDraft()"
            >
              <div>
                <div :class="['flex items-center justify-between gap-1 mb-1']">
                  <span :class="['text-xs font-bold truncate']">{{ mode.title }}</span>
                  <div :class="[mode.icon, 'text-sm shrink-0 text-neutral-400']" />
                </div>
                <p :class="['text-[10px] text-neutral-500 dark:text-neutral-400 leading-snug']">
                  {{ mode.desc }}
                </p>
              </div>
              <div :class="['mt-2 pt-1 border-t border-neutral-200/40 dark:border-white/5']">
                <span :class="['text-[9px] font-medium px-1.5 py-0.5 rounded border', mode.badgeColor]">
                  {{ mode.badge }}
                </span>
              </div>
            </button>
          </div>
        </div>

        <!-- Vision Analysis Tiers -->
        <div :class="['flex flex-col gap-2']">
          <label :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200']">
            {{ t('onboarding.steps.screen.perceptionEngineTier') }}
          </label>
          <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-2.5']">
            <button
              v-for="tier in visionTiers"
              :key="tier.id"
              type="button"
              :class="[
                'p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer',
                screenWatcherTier === tier.id
                  ? 'border-primary-500 bg-primary-500/10 text-neutral-900 dark:text-white ring-1 ring-primary-500/30'
                  : 'border-neutral-200/80 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-white/20',
              ]"
              @click="screenWatcherTier = tier.id; syncDraft()"
            >
              <div :class="['h-8 w-8 rounded-lg bg-neutral-200/50 dark:bg-white/10 flex items-center justify-center shrink-0 text-base']">
                <div :class="tier.icon" />
              </div>
              <div :class="['flex flex-col gap-0.5 min-w-0 flex-1']">
                <div :class="['flex items-center justify-between gap-1']">
                  <span :class="['text-xs font-bold truncate']">{{ tier.title }}</span>
                  <span :class="['text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-neutral-200/60 dark:bg-white/10 text-neutral-600 dark:text-neutral-300']">
                    {{ tier.vram }}
                  </span>
                </div>
                <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug']">
                  {{ tier.desc }}
                </p>
              </div>
            </button>
          </div>
        </div>

        <!-- Capture Cadence Presets -->
        <div :class="['flex flex-col gap-2']">
          <label :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200']">
            {{ t('onboarding.steps.screen.screenSamplingCadence') }}
          </label>
          <div :class="['grid grid-cols-2 sm:grid-cols-4 gap-2']">
            <button
              v-for="preset in screenIntervalPresets"
              :key="preset.value"
              type="button"
              :class="[
                'py-2 px-3 rounded-xl border text-xs font-medium transition-all text-center cursor-pointer',
                screenWatcherInterval === preset.value
                  ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400 font-semibold'
                  : 'border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-white/20',
              ]"
              @click="screenWatcherInterval = preset.value; syncDraft()"
            >
              {{ 'labelKey' in preset && preset.labelKey ? t(preset.labelKey) : preset.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation Action Bar -->
    <div :class="['flex items-center justify-between pt-3 border-t border-neutral-200/80 dark:border-white/5']">
      <button
        type="button"
        :class="['flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        <div :class="['i-solar:alt-arrow-left-line-duotone h-4 w-4']" />
        <span>{{ t('onboarding.shell.previous') }}</span>
      </button>

      <div :class="['text-[11px] text-neutral-400 font-medium']">
        {{ t('onboarding.steps.screen.status') }} <span :class="['text-neutral-700 dark:text-neutral-200 font-semibold']">{{ screenWatcherEnabled ? t('onboarding.steps.screen.enabled') : t('onboarding.steps.screen.paused') }}</span>
        <span v-if="screenWatcherEnabled" :class="['text-sky-500 ml-1 font-bold']">({{ screenWatcherTier }})</span>
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
