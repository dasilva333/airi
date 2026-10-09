<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import memoryPersonalJournalUrl from '../../../../../../assets/memory-personal-journal.avif'
import memoryQuietReflectionUrl from '../../../../../../assets/memory-quiet-reflection.avif'
import memorySharedHistoryUrl from '../../../../../../assets/memory-shared-history.avif'
import AssistantBubble from '../components/assistant-bubble.vue'

import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const { t } = useI18n()

const draftStore = useOnboardingV3Draft()

// Short-Term Memory Tiers
interface StmmTier {
  id: string
  label: string
  windowSize: number
  tokenBudget: number
  description: string
  badge: string
}

const stmmTiers: StmmTier[] = [
  {
    id: 'compact',
    label: 'Compact',
    windowSize: 1,
    tokenBudget: 500,
    description: '1-day rolling window. Minimal prompt footprint (~500 tok/day), perfect for snappy lightweight interactions.',
    badge: '1 Day · 500 tok',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    windowSize: 3,
    tokenBudget: 1000,
    description: '3-day rolling window. The golden ratio of conversational continuity and prompt speed (~1,000 tok/day).',
    badge: '3 Days · 1,000 tok (Default)',
  },
  {
    id: 'deep',
    label: 'Deep history',
    windowSize: 7,
    tokenBudget: 2000,
    description: '7-day rolling window. Full week of deep episodic awareness (~2,000 tok/day) across conversational resets.',
    badge: '7 Days · 2,000 tok',
  },
]

const currentStmmTier = computed(() => {
  const ws = draftStore.state.memoryShortTermWindowSize ?? 3
  if (ws <= 1)
    return 'compact'
  if (ws >= 7)
    return 'deep'
  return 'balanced'
})

function selectStmmTier(tier: StmmTier) {
  draftStore.setMemory({
    shortTermWindowSize: tier.windowSize,
    shortTermTokenBudget: tier.tokenBudget,
  })
}

function handleToggleShortTerm() {
  draftStore.setMemory({
    shortTermEnabled: !draftStore.state.memoryShortTermEnabled,
  })
}

function handleToggleLongTermJournal() {
  draftStore.setMemory({
    longTermJournalEnabled: !draftStore.state.memoryLongTermJournalEnabled,
  })
}

function handleToggleLifetime() {
  draftStore.setMemory({
    lifetimeEnabled: !draftStore.state.memoryLifetimeEnabled,
  })
}

function handleToggleDreamState() {
  draftStore.setMemory({
    dreamStateEnabled: !draftStore.state.memoryDreamStateEnabled,
  })
}

function formatWindowDays(days?: number | null) {
  const n = days ?? 3
  return n <= 1 ? '1 day' : `${n} days`
}

const summaryWindowLabel = computed(() => formatWindowDays(draftStore.state.memoryShortTermWindowSize))

const hasAnyMemoryEnabled = computed(() => Boolean(
  draftStore.state.memoryShortTermEnabled
  || draftStore.state.memoryLongTermJournalEnabled
  || draftStore.state.memoryLifetimeEnabled
  || draftStore.state.memoryDreamStateEnabled,
))
</script>

<template>
  <div :class="['w-full h-full flex flex-col justify-between select-none animate-fadeIn']">
    <!-- Scrollable Content Body -->
    <div :class="['flex-1 min-h-0 min-w-0 overflow-y-auto px-4 sm:px-6 pt-2 pb-5 flex flex-col gap-4']">
      <!-- Shared centered header -->
      <div :class="['flex flex-col items-center text-center gap-3 flex-shrink-0']">
        <div
          v-motion
          :initial="{ opacity: 0, y: -6 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="350"
          :class="['text-center']"
        >
          <h1 :class="['text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white']">
            Memory
          </h1>
        </div>

        <AssistantBubble
          message="Choose what I remember, and how I carry our conversations forward."
          step-key="memory"
          tone="primary"
        />
      </div>

      <!-- Memory cards, row one -->
      <div :class="['w-full max-w-[1280px] mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0 items-stretch']">
        <!-- Recent context -->
        <div
          :class="[
            'rounded-[20px] border transition-all p-5 flex flex-col gap-3 min-w-0',
            draftStore.state.memoryShortTermEnabled
              ? 'border-cyan-500/40 bg-white/70 dark:bg-cyan-950/10 shadow-sm'
              : 'border-neutral-200/70 bg-white/40 dark:border-neutral-800/70 dark:bg-neutral-900/30',
          ]"
        >
          <div :class="['flex items-start justify-between gap-3']">
            <div :class="['flex items-center gap-3 min-w-0']">
              <div :class="['h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-cyan-500/15 text-cyan-500']">
                <div :class="['i-solar:alarm-bold-duotone text-xl']" />
              </div>
              <div :class="['min-w-0']">
                <h3 :class="['text-base font-bold text-neutral-900 dark:text-white leading-tight']">
                  Recent context
                </h3>
                <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed']">
                  Keeps recent conversation summaries close at hand, so we can pick up where we left off.
                </p>
              </div>
            </div>

            <label :class="['relative inline-flex items-center cursor-pointer shrink-0 mt-1']">
              <input
                type="checkbox"
                :checked="draftStore.state.memoryShortTermEnabled"
                aria-label="Recent context"
                :class="['sr-only peer']"
                @change="handleToggleShortTerm"
              >
              <div :class="['w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-empty after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600']" />
            </label>
          </div>

          <div
            v-if="draftStore.state.memoryShortTermEnabled"
            :class="['flex flex-col gap-2']"
          >
            <span :class="['text-xs font-semibold text-neutral-700 dark:text-neutral-300']">
              Summary window
            </span>
            <div :class="['grid grid-cols-3 gap-2']">
              <button
                v-for="tier in stmmTiers"
                :key="tier.id"
                type="button"
                :class="[
                  'rounded-xl border p-2.5 text-left cursor-pointer transition-all flex items-start gap-2 min-w-0',
                  currentStmmTier === tier.id
                    ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500/30'
                    : 'border-neutral-200/80 dark:border-neutral-800 bg-white/50 dark:bg-white/[0.02] hover:border-neutral-300 dark:hover:border-neutral-700',
                ]"
                @click="selectStmmTier(tier)"
              >
                <div :class="['w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5', currentStmmTier === tier.id ? 'border-cyan-500 bg-cyan-500' : 'border-neutral-300 dark:border-neutral-600']">
                  <div v-if="currentStmmTier === tier.id" :class="['w-1.5 h-1.5 rounded-full bg-white']" />
                </div>
                <div :class="['min-w-0']">
                  <div :class="['text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate']">
                    {{ tier.label }}
                  </div>
                  <div :class="['text-[11px] text-neutral-500 dark:text-neutral-400']">
                    {{ formatWindowDays(tier.windowSize) }}
                  </div>
                </div>
              </button>
            </div>
            <span :class="['text-[11px] text-neutral-400 dark:text-neutral-500']">
              Larger windows add more context to each reply.
            </span>
          </div>
        </div>

        <!-- Personal journal -->
        <div
          :class="[
            'rounded-[20px] border transition-all p-5 flex flex-col gap-3 min-w-0',
            draftStore.state.memoryLongTermJournalEnabled
              ? 'border-emerald-500/40 bg-white/70 dark:bg-emerald-950/10 shadow-sm'
              : 'border-neutral-200/70 bg-white/40 dark:border-neutral-800/70 dark:bg-neutral-900/30',
          ]"
        >
          <div :class="['flex items-start justify-between gap-3']">
            <div :class="['flex items-center gap-3 min-w-0']">
              <div :class="['h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-500']">
                <div :class="['i-solar:notebook-bookmark-bold-duotone text-xl']" />
              </div>
              <div :class="['min-w-0']">
                <h3 :class="['text-base font-bold text-neutral-900 dark:text-white leading-tight']">
                  Personal journal
                </h3>
                <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed']">
                  Records meaningful moments and feelings, and can look them up later.
                </p>
              </div>
            </div>

            <label :class="['relative inline-flex items-center cursor-pointer shrink-0 mt-1']">
              <input
                type="checkbox"
                :checked="draftStore.state.memoryLongTermJournalEnabled"
                aria-label="Personal journal"
                :class="['sr-only peer']"
                @change="handleToggleLongTermJournal"
              >
              <div :class="['w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-empty after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600']" />
            </label>
          </div>

          <div :class="['rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 px-3 py-2.5 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200']">
            <div :class="['i-solar:shield-check-bold text-emerald-500 text-base shrink-0']" />
            <span :class="['leading-relaxed']">
              New entries add to the journal without rewriting earlier ones.
            </span>
          </div>

          <div :class="['relative h-[104px] hidden sm:block']">
            <img
              :src="memoryPersonalJournalUrl"
              alt=""
              width="140"
              height="140"
              draggable="false"
              :class="['absolute right-0 bottom-0 w-[120px] h-auto select-none pointer-events-none']"
            >
          </div>
        </div>
      </div>

      <!-- Memory cards, row two -->
      <div :class="['w-full max-w-[1280px] mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0 items-stretch']">
        <!-- Shared history -->
        <div
          :class="[
            'rounded-[20px] border transition-all p-5 flex flex-col gap-3 min-w-0',
            draftStore.state.memoryLifetimeEnabled
              ? 'border-amber-500/40 bg-white/70 dark:bg-amber-950/10 shadow-sm'
              : 'border-neutral-200/70 bg-white/40 dark:border-neutral-800/70 dark:bg-neutral-900/30',
          ]"
        >
          <div :class="['flex items-start justify-between gap-3']">
            <div :class="['flex items-center gap-3 min-w-0']">
              <div :class="['h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/15 text-amber-500']">
                <div :class="['i-solar:infinity-bold-duotone text-xl']" />
              </div>
              <div :class="['min-w-0']">
                <h3 :class="['text-base font-bold text-neutral-900 dark:text-white leading-tight']">
                  Shared history
                </h3>
                <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed']">
                  Carries important milestones and relationship context across weeks and months.
                </p>
              </div>
            </div>

            <label :class="['relative inline-flex items-center cursor-pointer shrink-0 mt-1']">
              <input
                type="checkbox"
                :checked="draftStore.state.memoryLifetimeEnabled"
                aria-label="Shared history"
                :class="['sr-only peer']"
                @change="handleToggleLifetime"
              >
              <div :class="['w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-empty after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600']" />
            </label>
          </div>

          <div :class="['flex items-end gap-3']">
            <div :class="['rounded-xl border border-neutral-200/60 dark:border-white/10 bg-neutral-50/60 dark:bg-black/20 px-3 py-2.5 flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300 flex-1 min-w-0']">
              <div :class="['i-solar:info-circle-bold text-neutral-400 text-base shrink-0']" />
              <span :class="['leading-relaxed']">
                A lasting summary of what matters between you and your companion.
              </span>
            </div>
            <img
              :src="memorySharedHistoryUrl"
              alt=""
              width="140"
              height="140"
              draggable="false"
              :class="['hidden sm:block w-[110px] h-auto shrink-0 select-none pointer-events-none']"
            >
          </div>
        </div>

        <!-- Quiet reflection -->
        <div
          :class="[
            'rounded-[20px] border transition-all p-5 flex flex-col gap-3 min-w-0',
            draftStore.state.memoryDreamStateEnabled
              ? 'border-violet-500/40 bg-white/70 dark:bg-violet-950/10 shadow-sm'
              : 'border-neutral-200/70 bg-white/40 dark:border-neutral-800/70 dark:bg-neutral-900/30',
          ]"
        >
          <div :class="['flex items-start justify-between gap-3']">
            <div :class="['flex items-center gap-3 min-w-0']">
              <div :class="['h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-violet-500/15 text-violet-500']">
                <div :class="['i-solar:moon-bold-duotone text-xl']" />
              </div>
              <div :class="['min-w-0']">
                <h3 :class="['text-base font-bold text-neutral-900 dark:text-white leading-tight']">
                  Quiet reflection
                </h3>
                <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed']">
                  Reflects on recent conversations while you’re away, preparing context for your return.
                </p>
              </div>
            </div>

            <label :class="['relative inline-flex items-center cursor-pointer shrink-0 mt-1']">
              <input
                type="checkbox"
                :checked="draftStore.state.memoryDreamStateEnabled"
                aria-label="Quiet reflection"
                :class="['sr-only peer']"
                @change="handleToggleDreamState"
              >
              <div :class="['w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-empty after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600']" />
            </label>
          </div>

          <div :class="['flex items-end gap-3']">
            <div :class="['rounded-xl border border-neutral-200/60 dark:border-white/10 bg-neutral-50/60 dark:bg-black/20 px-3 py-2.5 flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300 flex-1 min-w-0']">
              <div :class="['i-solar:info-circle-bold text-neutral-400 text-base shrink-0']" />
              <span :class="['leading-relaxed']">
                Runs during idle time between conversations.
              </span>
            </div>
            <img
              :src="memoryQuietReflectionUrl"
              alt=""
              width="140"
              height="137"
              draggable="false"
              :class="['hidden sm:block w-[110px] h-auto shrink-0 select-none pointer-events-none']"
            >
          </div>
        </div>
      </div>

      <!-- Your memory setup -->
      <div :class="['w-full max-w-[1280px] mx-auto rounded-[20px] border border-neutral-200/80 dark:border-neutral-800/80 bg-white/60 dark:bg-neutral-900/60 backdrop-blur-md px-4 sm:px-5 py-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 min-w-0']">
        <div :class="['flex items-center gap-2']">
          <div :class="['h-8 w-8 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center shrink-0']">
            <div :class="['i-solar:layers-bold-duotone text-base']" />
          </div>
          <span :class="['text-sm font-bold text-neutral-900 dark:text-white']">
            Your memory setup
          </span>
        </div>
        <template v-if="hasAnyMemoryEnabled">
          <span
            v-if="draftStore.state.memoryShortTermEnabled"
            :class="['flex items-center gap-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 sm:border-l sm:border-neutral-200/70 dark:sm:border-white/10 sm:pl-4']"
          >
            <div :class="['i-solar:alarm-bold-duotone text-cyan-500']" />
            <span>Recent context · {{ summaryWindowLabel }}</span>
          </span>
          <span
            v-if="draftStore.state.memoryLongTermJournalEnabled"
            :class="['flex items-center gap-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 sm:border-l sm:border-neutral-200/70 dark:sm:border-white/10 sm:pl-4']"
          >
            <div :class="['i-solar:notebook-bookmark-bold-duotone text-emerald-500']" />
            <span>Personal journal</span>
          </span>
          <span
            v-if="draftStore.state.memoryLifetimeEnabled"
            :class="['flex items-center gap-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 sm:border-l sm:border-neutral-200/70 dark:sm:border-white/10 sm:pl-4']"
          >
            <div :class="['i-solar:infinity-bold-duotone text-amber-500']" />
            <span>Shared history</span>
          </span>
          <span
            v-if="draftStore.state.memoryDreamStateEnabled"
            :class="['flex items-center gap-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 sm:border-l sm:border-neutral-200/70 dark:sm:border-white/10 sm:pl-4']"
          >
            <div :class="['i-solar:moon-bold-duotone text-violet-500']" />
            <span>Quiet reflection</span>
          </span>
        </template>
        <span v-else :class="['text-xs text-neutral-500 dark:text-neutral-400']">
          No memory features enabled.
        </span>
      </div>
    </div>

    <!-- Navigation Footer -->
    <div :class="['flex items-center justify-between pt-4 px-4 sm:px-6 border-t border-neutral-200/80 dark:border-white/5 shrink-0']">
      <button
        type="button"
        :class="['px-4 py-2 rounded-xl bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 text-xs font-medium border border-neutral-200 dark:border-white/10 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        {{ t('onboarding.shell.previous') }}
      </button>
      <button
        type="button"
        :class="['px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-colors cursor-pointer flex items-center gap-1.5']"
        @click="props.onNext"
      >
        <span>{{ t('onboarding.shell.next') }}</span>
        <div :class="['i-solar:arrow-right-linear w-4 h-4']" />
      </button>
    </div>
  </div>
</template>
