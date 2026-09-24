<script setup lang="ts">
import { useEntityLedgerStore } from '@proj-airi/stage-ui/stores/entity-ledger'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

const props = defineProps<{
  viewMode: 'constellation' | 'timeline'
  searchQuery: string
  selectedCategory: string
}>()

const emit = defineEmits<{
  (e: 'update:viewMode', mode: 'constellation' | 'timeline'): void
  (e: 'update:searchQuery', query: string): void
  (e: 'update:selectedCategory', category: string): void
  (e: 'rebuild'): void
  (e: 'clear'): void
  (e: 'openSettings'): void
}>()

const entityLedgerStore = useEntityLedgerStore()
const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)

const showSettingsMenu = ref(false)

const cognitionConfig = computed(() => {
  const airiExt = activeCard.value?.extensions?.airi as Record<string, any> | undefined
  return airiExt?.modules?.cognition ?? airiExt?.cognition
})

const isGroundingActive = computed(() => {
  return Boolean(cognitionConfig.value?.searchEngine?.universeRagEnabled ?? true)
})

const categories: { label: string, value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Person', value: 'person' },
  { label: 'Organization', value: 'organization' },
  { label: 'Place', value: 'place' },
  { label: 'Concept', value: 'concept' },
  { label: 'Activity', value: 'activity' },
]

function toggleGrounding() {
  if (activeCardId.value) {
    airiCardStore.toggleGrounding(activeCardId.value)
  }
}

function toggleGroundingMemory() {
  if (activeCardId.value) {
    airiCardStore.toggleGroundingMemory(activeCardId.value)
  }
}
</script>

<template>
  <header class="flex flex-col gap-3 border-b border-neutral-200/50 bg-white/70 p-3.5 backdrop-blur-md dark:border-neutral-800/60 dark:bg-neutral-950/60">
    <!-- Row 1: Title, View Switcher, Live Telemetry, & Primary Controls -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <!-- Left: Title & View Mode Switcher -->
      <div class="flex items-center gap-3">
        <div class="h-9 w-9 flex items-center justify-center rounded-xl bg-primary-500/10 text-lg text-primary-500">
          <div class="i-solar:share-circle-bold-duotone" />
        </div>

        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-sm text-neutral-800 font-bold dark:text-neutral-100">
              Mind Map
            </h1>
            <span
              class="cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase transition-colors"
              :class="isGroundingActive
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-700'"
              :title="isGroundingActive ? 'Universe RAG++ Grounding Active (Click to toggle)' : 'Grounding Standby (Click to activate)'"
              @click="toggleGrounding"
            >
              {{ isGroundingActive ? 'RAG++ Active' : 'Standby' }}
            </span>
          </div>
          <p class="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
            <span>{{ entityLedgerStore.stats.entitiesCount }} Entities</span>
            <span>•</span>
            <span>{{ entityLedgerStore.stats.claimsCount }} Claims</span>
            <span>•</span>
            <span>{{ entityLedgerStore.stats.sourcesCount }} Sources</span>
          </p>
        </div>

        <!-- Mode Toggle Pill -->
        <div class="ml-2 flex items-center border border-neutral-200/60 rounded-xl bg-neutral-100 p-0.5 text-xs dark:border-neutral-800/80 dark:bg-neutral-900">
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg px-3 py-1 font-semibold transition-all"
            :class="viewMode === 'constellation'
              ? 'bg-white dark:bg-neutral-800 text-primary-600 dark:text-primary-400 shadow-xs'
              : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'"
            @click="emit('update:viewMode', 'constellation')"
          >
            <div class="i-solar:graph-bold-duotone text-sm" />
            <span>Constellation</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg px-3 py-1 font-semibold transition-all"
            :class="viewMode === 'timeline'
              ? 'bg-white dark:bg-neutral-800 text-primary-600 dark:text-primary-400 shadow-xs'
              : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'"
            @click="emit('update:viewMode', 'timeline')"
          >
            <div class="i-solar:history-bold-duotone text-sm" />
            <span>Timeline</span>
          </button>
        </div>
      </div>

      <!-- Right: Action Buttons & Overflow Menu -->
      <div class="flex items-center gap-2">
        <Button
          :label="entityLedgerStore.isPriming ? 'Synthesizing...' : 'Rebuild Graph'"
          :icon="entityLedgerStore.isPriming ? 'i-solar:restart-bold-duotone' : 'i-solar:bolt-bold-duotone'"
          variant="primary"
          size="sm"
          :disabled="entityLedgerStore.isPriming"
          @click="emit('rebuild')"
        />

        <!-- Settings Overflow Flyout -->
        <div class="relative">
          <button
            type="button"
            class="border border-neutral-200/60 rounded-lg bg-white/70 p-1.5 text-neutral-600 transition dark:border-neutral-800/80 dark:bg-neutral-900/70 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            title="Mind Map Settings & Options"
            @click="showSettingsMenu = !showSettingsMenu"
          >
            <div class="i-solar:menu-dots-bold text-base" />
          </button>

          <!-- Dropdown Menu -->
          <div
            v-if="showSettingsMenu"
            class="absolute right-0 top-full z-50 mt-2 w-64 border border-neutral-200 rounded-2xl bg-white/95 p-2 text-xs shadow-xl backdrop-blur-xl space-y-1 dark:border-neutral-800 dark:bg-neutral-900/95"
          >
            <div class="px-2.5 py-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
              Cognitive Controls
            </div>

            <button
              type="button"
              class="w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800/60"
              @click="toggleGrounding"
            >
              <span>In-Flight Grounding</span>
              <div :class="isGroundingActive ? 'i-solar:check-circle-bold text-emerald-500' : 'i-solar:close-circle-linear text-neutral-400'" />
            </button>

            <button
              type="button"
              class="w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800/60"
              @click="toggleGroundingMemory"
            >
              <span>Deep Memory Reasoning</span>
              <div :class="cognitionConfig?.deepReasoningEnabled ? 'i-solar:check-circle-bold text-emerald-500' : 'i-solar:close-circle-linear text-neutral-400'" />
            </button>

            <div class="my-1 border-t border-neutral-100 dark:border-neutral-800" />

            <button
              type="button"
              class="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-rose-500 transition hover:bg-rose-500/10"
              @click="emit('clear'); showSettingsMenu = false"
            >
              <div class="i-solar:trash-bin-trash-bold text-sm" />
              <span>Clear Knowledge Graph</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Row 2: Search Input & Category Filters -->
    <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
      <!-- Search Input -->
      <div class="relative w-full sm:w-64">
        <div class="i-solar:magnifer-linear pointer-events-none absolute left-2.5 top-1/2 text-sm text-neutral-400 -translate-y-1/2" />
        <input
          :value="searchQuery"
          type="text"
          placeholder="Filter entities, claims, places..."
          class="w-full border border-neutral-200/60 rounded-xl bg-neutral-100/80 py-1.5 pl-8 pr-3 text-xs text-neutral-800 dark:border-neutral-800/60 dark:bg-neutral-900/80 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-hidden focus:ring-1 focus:ring-primary-500"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        >
      </div>

      <!-- Category Filter Pills -->
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-for="c in categories"
          :key="c.value"
          type="button"
          :class="[
            'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all capitalize',
            selectedCategory === c.value
              ? 'bg-primary-500/15 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/40'
              : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 bg-neutral-100/60 dark:bg-neutral-900/60',
          ]"
          @click="emit('update:selectedCategory', c.value)"
        >
          {{ c.label }}
        </button>
      </div>
    </div>

    <!-- Priming Progress Live HUD -->
    <div
      v-if="entityLedgerStore.isPriming"
      class="flex flex-col gap-1.5 pt-1"
    >
      <div class="flex items-center justify-between text-[11px] text-primary-500 font-medium">
        <span class="flex items-center gap-1.5">
          <div class="i-solar:restart-bold-duotone animate-spin text-sm" />
          <span>{{ entityLedgerStore.primingStatusText || 'Synthesizing knowledge graph...' }}</span>
        </span>
        <span class="font-mono">{{ (entityLedgerStore.primingProgress * 100).toFixed(0) }}%</span>
      </div>
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/60 dark:bg-neutral-800">
        <div
          class="h-full rounded-full bg-primary-500 shadow-sm transition-all duration-300"
          :style="{ width: `${Math.max(5, entityLedgerStore.primingProgress * 100)}%` }"
        />
      </div>
    </div>
  </header>
</template>
