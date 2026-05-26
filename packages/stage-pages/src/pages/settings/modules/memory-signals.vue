<script setup lang="ts">
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { FieldInput } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)

function updateDreamState(patch: Record<string, any>) {
  const cardId = activeCardId.value
  const card = activeCard.value
  if (!cardId || !card) return

  airiCardStore.updateCard(cardId, {
    extensions: {
      ...card.extensions,
      airi: {
        ...card.extensions?.airi,
        dreamState: {
          ...card.extensions?.airi?.dreamState,
          ...patch,
        },
      },
    },
  } as any)
}

const dreamStateEnabled = computed({
  get: () => activeCard.value?.extensions?.airi?.dreamState?.enabled ?? false,
  set: (value) => updateDreamState({ enabled: value }),
})

const lushness = computed({
  get: () => activeCard.value?.extensions?.airi?.dreamState?.journalingThreshold ?? 'balanced',
  set: (value) => updateDreamState({ journalingThreshold: value as 'minimal' | 'balanced' | 'lush' }),
})

const maxSessions = computed({
  get: () => activeCard.value?.extensions?.airi?.dreamState?.maxSessionsPerDay ?? 4,
  set: (value) => updateDreamState({ maxSessionsPerDay: Number(value) || 4 }),
})

const timeoutThreshold = computed({
  get: () => activeCard.value?.extensions?.airi?.dreamState?.sessionTimeoutMinutes ?? 60,
  set: (value) => updateDreamState({ sessionTimeoutMinutes: Number(value) || 60 }),
})

const afkGating = computed({
  get: () => activeCard.value?.extensions?.airi?.dreamState?.strictAfkGating ?? true,
  set: (value) => updateDreamState({ strictAfkGating: value }),
})

const lushnessOptions: Array<{ value: 'minimal' | 'balanced' | 'lush'; label: string; description: string }> = [
  { description: 'Tags only. No journals are recorded.', label: 'Minimal', value: 'minimal' },
  { description: 'Tags + Journals for highly significant moments.', label: 'Balanced', value: 'balanced' },
  { description: 'Tags + Journals for most sessions (Lower Threshold).', label: 'Lush', value: 'lush' },
]

const statusChips = computed(() => [
  {
    active: afkGating.value,
    icon: 'i-solar:ghost-bold-duotone',
    label: afkGating.value ? 'AFK Gated' : 'AFK Optional',
  },
  { active: true, icon: 'i-solar:calendar-limit-bold-duotone', label: `Max ${maxSessions.value} Sessions/Day` },
  {
    active: dreamStateEnabled.value,
    icon: 'i-solar:moon-stars-bold-duotone',
    label: dreamStateEnabled.value ? 'Idle Consolidation' : 'Dream State Disabled',
  },
  { active: true, icon: 'i-solar:magic-stick-3-bold-duotone', label: 'Flavor Output' },
])
</script>

<template>
  <div class="font-urbanist flex flex-col gap-8 pb-12">
    <!-- Breadcrumb Nav -->
    <nav class="flex items-center gap-2 text-xs text-neutral-500 font-bold tracking-widest uppercase dark:text-neutral-400">
      <router-link to="/settings/memory" class="transition-colors hover:text-primary-500">
        Memory Hub
      </router-link>
      <div class="i-solar:alt-arrow-right-bold h-3 w-3" />
      <span class="text-neutral-400 dark:text-neutral-500">The Dream State</span>
    </nav>

    <!-- Bespoke Header -->
    <header class="relative overflow-hidden border border-neutral-200 rounded-3xl bg-neutral-100/40 p-8 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/40">
      <!-- Chromatic Backdrop Glow -->
      <div class="absolute h-64 w-64 bg-violet-500/10 blur-3xl -right-24 -top-24" />
      <div class="absolute h-64 w-64 bg-indigo-500/10 blur-3xl -bottom-24 -left-24" />

      <div class="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div class="flex flex-col gap-2">
          <div class="h-12 w-12 flex items-center justify-center rounded-2xl bg-violet-500/20 text-3xl text-violet-500 shadow-inner">
            <div class="i-solar:bolt-bold-duotone" />
          </div>
          <h1 class="text-4xl text-neutral-800 font-bold tracking-tight dark:text-neutral-100">
            The Dream State
          </h1>
          <p class="max-w-2xl text-lg text-neutral-500 line-height-relaxed dark:text-neutral-400">
            AIRI consolidates completed conversations into flavor tags and "Sacred Records" while you're away.
          </p>
        </div>
      </div>

      <!-- Summary Status Strip -->
      <div class="mt-8 flex flex-wrap gap-3">
        <div
          v-for="chip in statusChips"
          :key="chip.label"
          class="flex items-center gap-2 border border-neutral-200/50 rounded-full bg-white/50 px-4 py-2 text-xs font-bold tracking-tight uppercase shadow-sm dark:border-neutral-700/50 dark:bg-neutral-800/50 dark:text-neutral-200"
        >
          <div :class="[chip.icon, 'text-primary-500 text-base']" />
          {{ chip.label }}
        </div>
      </div>
    </header>

    <!-- Main Body: The Three Cards -->
    <div class="grid gap-6 lg:grid-cols-3">
      <!-- 1. The Deliverables -->
      <section class="group relative overflow-hidden border border-neutral-200 rounded-3xl bg-white p-6 shadow-sm transition-all dark:border-neutral-800 hover:border-violet-500/30 dark:bg-neutral-900/60">
        <div class="mb-4 h-10 w-10 flex items-center justify-center rounded-xl bg-violet-500/10 text-xl text-violet-500 transition-transform group-hover:scale-110">
          <div class="i-solar:magic-stick-bold-duotone" />
        </div>
        <h3 class="mb-2 text-xl text-neutral-800 font-bold dark:text-neutral-100">
          The Deliverables
        </h3>
        <p class="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
          What AIRI produces during the consolidation phase.
        </p>

        <ul class="flex flex-col gap-3">
          <li v-for="item in ['Flavor Tags & Mood Highlights', 'Interpretive Session Summaries', 'Recurring Motifs', 'Journal-Worthy Entries']" :key="item" class="flex items-center gap-3 text-sm text-neutral-700 dark:text-neutral-300">
            <div class="i-solar:check-circle-bold-duotone text-violet-500" />
            {{ item }}
          </li>
        </ul>
      </section>

      <!-- 2. The Ritual (Trigger Logic) -->
      <section class="group relative overflow-hidden border border-neutral-200 rounded-3xl bg-white p-6 shadow-sm transition-all dark:border-neutral-800 hover:border-indigo-500/30 dark:bg-neutral-900/60">
        <div class="mb-4 h-10 w-10 flex items-center justify-center rounded-xl bg-indigo-500/10 text-xl text-indigo-500 transition-transform group-hover:scale-110">
          <div class="i-solar:ghost-bold-duotone" />
        </div>
        <h3 class="mb-2 text-xl text-neutral-800 font-bold dark:text-neutral-100">
          The Ritual
        </h3>
        <p class="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
          The conditions that allow AIRI to begin dreaming.
        </p>

        <ul class="flex flex-col gap-3">
          <li v-for="item in ['1-Hour Session Timeout', 'Strict AFK Gating', 'Character Idle Threshold', 'Daily Consolidation Cap (4)']" :key="item" class="flex items-center gap-3 text-sm text-neutral-700 dark:text-neutral-300">
            <div class="i-solar:play-circle-bold-duotone text-indigo-500" />
            {{ item }}
          </li>
        </ul>
      </section>

      <!-- 3. The Experience -->
      <section class="group relative overflow-hidden border border-neutral-200 rounded-3xl bg-white p-6 shadow-sm transition-all dark:border-neutral-800 hover:border-primary-500/30 dark:bg-neutral-900/60">
        <div class="mb-4 h-10 w-10 flex items-center justify-center rounded-xl bg-primary-500/10 text-xl text-primary-500 transition-transform group-hover:scale-110">
          <div class="i-solar:heart-bold-duotone" />
        </div>
        <h3 class="mb-2 text-xl text-neutral-800 font-bold dark:text-neutral-100">
          The Experience
        </h3>
        <p class="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
          How the consolidation affects your active relationship.
        </p>

        <ul class="flex flex-col gap-3">
          <li v-for="item in ['Lively & Textured Feed Decorations', 'Preserves Emotional Sprints', 'Reviewable Session Vault', 'Curation of Memorable Highlights']" :key="item" class="flex items-center gap-3 text-sm text-neutral-700 dark:text-neutral-300">
            <div class="i-solar:star-circle-bold-duotone text-primary-500" />
            {{ item }}
          </li>
        </ul>
      </section>
    </div>

    <!-- Interface Controls Mockup -->
    <section class="border border-neutral-200 rounded-[2.5rem] bg-white p-10 shadow-xl dark:border-neutral-800 dark:bg-neutral-900/80">
      <h2 class="mb-8 text-2xl text-neutral-800 font-bold dark:text-neutral-100">
        Console Controls
      </h2>

      <div class="grid gap-10 lg:grid-cols-2">
        <!-- Lushness Selector -->
        <div class="flex flex-col gap-6">
          <div class="flex items-center gap-3 border border-neutral-200 rounded-2xl bg-neutral-50/50 px-6 py-4 dark:border-neutral-700 dark:bg-neutral-800/40">
            <input id="dream-state-enabled" v-model="dreamStateEnabled" type="checkbox" class="h-5 w-5 border-neutral-300 rounded text-primary-500">
            <label for="dream-state-enabled" class="flex flex-col cursor-pointer">
              <span class="text-sm text-neutral-700 font-bold dark:text-neutral-200">Enable Dream State</span>
              <span class="text-[10px] text-neutral-500 tracking-tighter uppercase">Allow idle-time chips generation for the active character</span>
            </label>
          </div>

          <div>
            <span class="text-sm text-neutral-500 font-bold tracking-widest uppercase dark:text-neutral-400">Journaling Threshold</span>
            <p class="text-xs text-neutral-400 dark:text-neutral-500">
              Determines the density and "worth" of recorded memories.
            </p>
          </div>

          <div class="grid grid-cols-3 gap-3 border border-neutral-200 rounded-2xl bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-800/50">
            <button
              v-for="opt in lushnessOptions"
              :key="opt.value"
              :class="[
                'flex flex-col items-center gap-1 rounded-xl py-4 transition-all',
                lushness === opt.value ? 'bg-white shadow-md text-primary-500 dark:bg-neutral-700' : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
              ]"
              @click="lushness = opt.value"
            >
              <span class="text-sm font-bold">{{ opt.label }}</span>
              <span class="px-2 text-center text-[10px] leading-tight opacity-70">{{ opt.description }}</span>
            </button>
          </div>
        </div>

        <!-- Metric Controls -->
        <div class="flex flex-col gap-8">
          <div class="grid gap-6 sm:grid-cols-2">
            <FieldInput v-model="maxSessions" label="Max Sessions / Day" type="number" description="Daily consolidation cap." />
            <FieldInput v-model="timeoutThreshold" label="Timeout (Minutes)" type="number" description="Idle time before dreaming starts." />
          </div>

          <div class="flex flex-wrap gap-6 pt-4">
            <div class="flex items-center gap-3 border border-neutral-200 rounded-2xl bg-neutral-50/50 px-6 py-4 dark:border-neutral-700 dark:bg-neutral-800/40">
              <input id="afk" v-model="afkGating" type="checkbox" class="h-5 w-5 border-neutral-300 rounded text-primary-500">
              <label for="afk" class="flex flex-col cursor-pointer">
                <span class="text-sm text-neutral-700 font-bold dark:text-neutral-200">Strict AFK Gating</span>
                <span class="text-[10px] text-neutral-500 tracking-tighter uppercase">Only dreams while you're away</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Optional: Soft font easing */
.font-urbanist {
  font-family: 'Urbanist', sans-serif;
  -webkit-font-smoothing: antialiased;
}
</style>

<route lang="yaml">
meta:
  layout: settings
  titleKey: The Dream State
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
