<script setup lang="ts">
import { computed } from 'vue'

import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

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
    label: 'Deep History',
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

// Lifetime Memory Tiers
interface LifetimeTier {
  id: 'lightweight' | 'relational' | 'deep'
  label: string
  tokens: string
  description: string
  badge: string
}

const lifetimeTiers: LifetimeTier[] = [
  {
    id: 'lightweight',
    label: 'Lightweight Essence',
    tokens: '~500 tokens',
    description: 'Distills only core milestones and relationship anchors. Highly efficient for smaller local models.',
    badge: '~500 tok',
  },
  {
    id: 'relational',
    label: 'Relational Thread',
    tokens: '~1,000 tokens',
    description: 'Balanced relationship evolution, nickname memories, and shared milestone tracking across long horizons.',
    badge: '~1,000 tok (Default)',
  },
  {
    id: 'deep',
    label: 'Deep Foundation',
    tokens: '~2,500 tokens',
    description: 'Rich narrative foundation with dense milestone graphs and character personality nuance.',
    badge: '~2,500 tok',
  },
]

const currentLifetimeTier = computed(() => {
  return draftStore.state.memoryLifetimeTier || 'relational'
})

function selectLifetimeTier(tierId: 'lightweight' | 'relational' | 'deep') {
  draftStore.setMemory({
    lifetimeTier: tierId,
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
</script>

<template>
  <div :class="['w-full max-w-4xl mx-auto flex flex-col gap-5 py-1 select-none animate-fadeIn']">
    <!-- Header Section -->
    <div :class="['flex flex-col items-center text-center gap-2']">
      <div :class="['inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary-500/20 bg-primary-500/10 text-primary-400 text-xs font-semibold']">
        <div :class="['i-solar:book-bookmark-bold-duotone h-3.5 w-3.5']" />
        <span>Cognitive Memory Architecture</span>
      </div>
      <h1 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
        Memory Hierarchy & Continuity
      </h1>
      <p :class="['text-xs text-neutral-500 dark:text-neutral-400 max-w-xl text-center leading-relaxed']">
        Segment ephemeral chat reactions from eternal relational identity. Configure daily summaries, sacred journal records, and offline dream consolidation.
      </p>
    </div>

    <!-- The 4 Temporal Memory Quadrants -->
    <div :class="['flex flex-col gap-4']">
      <!-- 1. Short-Term Memory (STMM) — The Active Pulse -->
      <div
        :class="[
          'rounded-2xl border transition-all p-4.5 flex flex-col gap-3',
          draftStore.state.memoryShortTermEnabled
            ? 'border-cyan-500/40 bg-white/70 dark:bg-cyan-950/10 shadow-sm'
            : 'border-neutral-200/70 bg-white/40 dark:border-neutral-800/70 dark:bg-neutral-900/30 opacity-75',
        ]"
      >
        <div :class="['flex items-start justify-between gap-4']">
          <div :class="['flex items-start gap-3 min-w-0']">
            <div :class="['h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-cyan-500/15 text-cyan-500']">
              <div :class="['i-solar:alarm-bold-duotone text-xl']" />
            </div>
            <div :class="['flex flex-col min-w-0']">
              <div :class="['flex items-center gap-2 flex-wrap']">
                <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                  24-Hour Short-Term Memory (STMM)
                </h3>
                <span :class="['text-[10px] font-semibold px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-600 dark:text-cyan-300']">
                  The Active Pulse
                </span>
              </div>
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
                Proactively summarizes each 24-hour conversational block into daily memory chunks injected directly into the system prompt. Retains recent days' continuity across reloads.
              </p>
            </div>
          </div>

          <!-- Switch Toggle -->
          <label :class="['relative inline-flex items-center cursor-pointer shrink-0 mt-1']">
            <input
              type="checkbox"
              :checked="draftStore.state.memoryShortTermEnabled"
              :class="['sr-only peer']"
              @change="handleToggleShortTerm"
            >
            <div :class="['w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600']" />
          </label>
        </div>

        <!-- STMM Tiers Selector (Visible when enabled) -->
        <div
          v-if="draftStore.state.memoryShortTermEnabled"
          :class="['pt-3 border-t border-cyan-500/20 flex flex-col gap-2']"
        >
          <span :class="['text-[11px] font-semibold text-neutral-700 dark:text-neutral-300']">
            Context Window & Daily Budget Tier
          </span>
          <div :class="['grid grid-cols-1 sm:grid-cols-3 gap-2.5']">
            <div
              v-for="tier in stmmTiers"
              :key="tier.id"
              :class="[
                'p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5',
                currentStmmTier === tier.id
                  ? 'border-cyan-500 bg-cyan-500/10 text-neutral-900 dark:text-white shadow-xs'
                  : 'border-neutral-200/80 dark:border-neutral-800 bg-black/2 dark:bg-white/2 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-600 dark:text-neutral-400',
              ]"
              @click="selectStmmTier(tier)"
            >
              <div :class="['flex items-center justify-between']">
                <span :class="['text-xs font-bold']">{{ tier.label }}</span>
                <span :class="['text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-300']">
                  {{ tier.badge }}
                </span>
              </div>
              <p :class="['text-[11px] leading-snug opacity-90']">
                {{ tier.description }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Sacred Long-Term Text Journal (LTMM) — Episodic Records -->
      <div
        :class="[
          'rounded-2xl border transition-all p-4.5 flex flex-col gap-3',
          draftStore.state.memoryLongTermJournalEnabled
            ? 'border-emerald-500/40 bg-white/70 dark:bg-emerald-950/10 shadow-sm'
            : 'border-neutral-200/70 bg-white/40 dark:border-neutral-800/70 dark:bg-neutral-900/30 opacity-75',
        ]"
      >
        <div :class="['flex items-start justify-between gap-4']">
          <div :class="['flex items-start gap-3 min-w-0']">
            <div :class="['h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-500']">
              <div :class="['i-solar:notebook-bookmark-bold-duotone text-xl']" />
            </div>
            <div :class="['flex flex-col min-w-0']">
              <div :class="['flex items-center gap-2 flex-wrap']">
                <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                  Sacred Long-Term Text Journal (LTMM)
                </h3>
                <span :class="['text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-mono']">
                  tool: text_journal
                </span>
              </div>
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
                Equips your companion with the append-only <code :class="['text-emerald-500 font-mono text-[11px]']">text_journal</code> tool. Allows them to record meaningful autobiographical memories, feelings, and search past records on-demand.
              </p>
            </div>
          </div>

          <!-- Switch Toggle -->
          <label :class="['relative inline-flex items-center cursor-pointer shrink-0 mt-1']">
            <input
              type="checkbox"
              :checked="draftStore.state.memoryLongTermJournalEnabled"
              :class="['sr-only peer']"
              @change="handleToggleLongTermJournal"
            >
            <div :class="['w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600']" />
          </label>
        </div>

        <div
          v-if="draftStore.state.memoryLongTermJournalEnabled"
          :class="['rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-[11px] text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5']"
        >
          <div :class="['i-solar:shield-check-bold text-emerald-500 text-base shrink-0 mt-0.5']" />
          <div :class="['leading-relaxed']">
            <strong>The Sacred Record Rule:</strong> Journal entries are strictly append-only and immortal. The companion will autonomously preserve significant life events without overwriting past history.
          </div>
        </div>
      </div>

      <!-- 3. The Eternal Thread — Lifetime Relational Essence -->
      <div
        :class="[
          'rounded-2xl border transition-all p-4.5 flex flex-col gap-3',
          draftStore.state.memoryLifetimeEnabled
            ? 'border-amber-500/40 bg-white/70 dark:bg-amber-950/10 shadow-sm'
            : 'border-neutral-200/70 bg-white/40 dark:border-neutral-800/70 dark:bg-neutral-900/30 opacity-75',
        ]"
      >
        <div :class="['flex items-start justify-between gap-4']">
          <div :class="['flex items-start gap-3 min-w-0']">
            <div :class="['h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/15 text-amber-500']">
              <div :class="['i-solar:dna-bold-duotone text-xl']" />
            </div>
            <div :class="['flex flex-col min-w-0']">
              <div :class="['flex items-center gap-2 flex-wrap']">
                <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                  The Eternal Thread (Lifetime Artifact)
                </h3>
                <span :class="['text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-300']">
                  Relational Essence
                </span>
              </div>
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
                Maintains the companion's core relational identity and shared milestones across weeks and months. Distills daily changes into a permanent foundation so their bond never resets.
              </p>
            </div>
          </div>

          <!-- Switch Toggle -->
          <label :class="['relative inline-flex items-center cursor-pointer shrink-0 mt-1']">
            <input
              type="checkbox"
              :checked="draftStore.state.memoryLifetimeEnabled"
              :class="['sr-only peer']"
              @change="handleToggleLifetime"
            >
            <div :class="['w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600']" />
          </label>
        </div>

        <!-- Lifetime Tiers Selector (Visible when enabled) -->
        <div
          v-if="draftStore.state.memoryLifetimeEnabled"
          :class="['pt-3 border-t border-amber-500/20 flex flex-col gap-2']"
        >
          <span :class="['text-[11px] font-semibold text-neutral-700 dark:text-neutral-300']">
            Relational Distillation Density
          </span>
          <div :class="['grid grid-cols-1 sm:grid-cols-3 gap-2.5']">
            <div
              v-for="tier in lifetimeTiers"
              :key="tier.id"
              :class="[
                'p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5',
                currentLifetimeTier === tier.id
                  ? 'border-amber-500 bg-amber-500/10 text-neutral-900 dark:text-white shadow-xs'
                  : 'border-neutral-200/80 dark:border-neutral-800 bg-black/2 dark:bg-white/2 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-600 dark:text-neutral-400',
              ]"
              @click="selectLifetimeTier(tier.id)"
            >
              <div :class="['flex items-center justify-between']">
                <span :class="['text-xs font-bold']">{{ tier.label }}</span>
                <span :class="['text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300']">
                  {{ tier.badge }}
                </span>
              </div>
              <p :class="['text-[11px] leading-snug opacity-90']">
                {{ tier.description }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. Day Dreaming (Echo Chips) — The Echoes -->
      <div
        :class="[
          'rounded-2xl border transition-all p-4.5 flex items-start justify-between gap-4',
          draftStore.state.memoryDreamStateEnabled
            ? 'border-violet-500/40 bg-white/70 dark:bg-violet-950/10 shadow-sm'
            : 'border-neutral-200/70 bg-white/40 dark:border-neutral-800/70 dark:bg-neutral-900/30 opacity-75',
        ]"
      >
        <div :class="['flex items-start gap-3 min-w-0']">
          <div :class="['h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-violet-500/15 text-violet-500']">
            <div :class="['i-solar:sleeping-bold-duotone text-xl']" />
          </div>
          <div :class="['flex flex-col min-w-0']">
            <div :class="['flex items-center gap-2 flex-wrap']">
              <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                Day Dreaming & Echo Chips
              </h3>
              <span :class="['text-[10px] font-semibold px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-600 dark:text-violet-300']">
                The Echoes
              </span>
            </div>
            <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
              When you go idle after a conversation session, background consolidation distills recent dialogue into interpretive Echo Chips and mood tags, pre-warming thoughts for your next return.
            </p>
          </div>
        </div>

        <!-- Switch Toggle -->
        <label :class="['relative inline-flex items-center cursor-pointer shrink-0 mt-1']">
          <input
            type="checkbox"
            :checked="draftStore.state.memoryDreamStateEnabled"
            :class="['sr-only peer']"
            @change="handleToggleDreamState"
          >
          <div :class="['w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600']" />
        </label>
      </div>
    </div>

    <!-- Active Memory Footprint Summary -->
    <div :class="['rounded-2xl border border-neutral-200/80 bg-neutral-100/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50 flex flex-col gap-2.5']">
      <div :class="['flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-200']">
        <div :class="['flex items-center gap-2']">
          <div :class="['i-solar:layers-bold-duotone text-primary-500']" />
          <span>Active Cognitive Memory Footprint</span>
        </div>
        <span :class="['text-[11px] font-mono text-emerald-500 font-medium']">● Ready for Compilation</span>
      </div>

      <div :class="['flex flex-wrap gap-2 pt-1']">
        <span
          v-if="draftStore.state.memoryShortTermEnabled"
          :class="['px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 flex items-center gap-1.5']"
        >
          <div :class="['i-solar:alarm-bold text-cyan-500']" />
          STMM: {{ currentStmmTier.toUpperCase() }} ({{ draftStore.state.memoryShortTermWindowSize }}d / {{ draftStore.state.memoryShortTermTokenBudget }} tok)
        </span>
        <span
          v-if="draftStore.state.memoryLongTermJournalEnabled"
          :class="['px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-1.5']"
        >
          <div :class="['i-solar:notebook-bookmark-bold text-emerald-500']" />
          LTMM: text_journal (Sacred Records)
        </span>
        <span
          v-if="draftStore.state.memoryLifetimeEnabled"
          :class="['px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 flex items-center gap-1.5']"
        >
          <div :class="['i-solar:dna-bold text-amber-500']" />
          Lifetime: {{ currentLifetimeTier.toUpperCase() }}
        </span>
        <span
          v-if="draftStore.state.memoryDreamStateEnabled"
          :class="['px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20 flex items-center gap-1.5']"
        >
          <div :class="['i-solar:sleeping-bold text-violet-500']" />
          Dreams: Active on Idle
        </span>
      </div>
    </div>

    <!-- Navigation Footer -->
    <div :class="['flex items-center justify-between pt-2 border-t border-neutral-200/80 dark:border-white/5']">
      <button
        type="button"
        :class="['px-4 py-2 rounded-xl bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 text-xs font-medium border border-neutral-200 dark:border-white/10 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        ← Previous Step
      </button>
      <button
        type="button"
        :class="['px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-colors cursor-pointer flex items-center gap-1.5']"
        @click="props.onNext"
      >
        <span>Confirm & Continue</span>
        <div :class="['i-solar:arrow-right-linear w-4 h-4']" />
      </button>
    </div>
  </div>
</template>
