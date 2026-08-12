<script setup lang="ts">
import type { EventCategoryFilter } from '@proj-airi/stage-ui/stores/event-log'

import { useEventLogStore } from '@proj-airi/stage-ui/stores/event-log'
import { onMounted, ref } from 'vue'

const eventLogStore = useEventLogStore()
const expandedEventId = ref<string | null>(null)

const categoryOptions: { label: string, value: EventCategoryFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Vision', value: 'vision' },
  { label: 'Tools', value: 'tools' },
  { label: 'Chat', value: 'chat' },
  { label: 'Proactivity', value: 'proactivity' },
  { label: 'Memory', value: 'memory' },
  { label: 'Stage', value: 'stage' },
  { label: 'Discord', value: 'discord' },
]

onMounted(() => {
  eventLogStore.init()
})
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden bg-neutral-50/50 p-6 dark:bg-neutral-950/40">
    <!-- Header Title -->
    <div class="mb-4 flex flex-col gap-1 border-b border-neutral-200/40 pb-4 dark:border-neutral-800/40">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="h-10 w-10 flex items-center justify-center rounded-xl bg-primary-500/10 text-xl text-primary-500">
            <div class="i-solar:document-text-bold-duotone" />
          </div>
          <div>
            <h1 class="text-xl text-neutral-800 font-bold tracking-tight dark:text-neutral-100">
              AIRI Event Ledger
            </h1>
            <p class="text-xs text-neutral-500 dark:text-neutral-400">
              Unified cognitive event log & streaming awareness stream
            </p>
          </div>
        </div>

        <button
          class="shadow-xs flex items-center gap-1.5 border border-neutral-200/60 rounded-lg bg-white/70 px-3 py-1.5 text-xs text-neutral-600 font-semibold transition dark:border-neutral-800/60 dark:bg-neutral-900/70 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          @click="eventLogStore.isPaused = !eventLogStore.isPaused"
        >
          <div :class="eventLogStore.isPaused ? 'i-solar:play-bold-duotone text-emerald-500' : 'i-solar:pause-bold-duotone text-amber-500'" />
          <span>{{ eventLogStore.isPaused ? 'Resume Logging' : 'Pause Logging' }}</span>
        </button>
      </div>

      <!-- Search & Category Filters -->
      <div class="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div class="relative flex-1">
          <div class="i-solar:magnifer-linear absolute left-3 top-1/2 text-sm text-neutral-400 -translate-y-1/2" />
          <input
            v-model="eventLogStore.searchQuery"
            type="text"
            placeholder="Search natural language events..."
            class="w-full border border-neutral-200/60 rounded-xl bg-white/80 py-2 pl-9 pr-3 text-xs outline-none dark:border-neutral-800/60 focus:border-primary-500 dark:bg-neutral-900/80"
          >
        </div>

        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="cat in categoryOptions"
            :key="cat.value"
            class="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all"
            :class="eventLogStore.selectedCategory === cat.value
              ? 'bg-primary-500 text-white shadow-xs'
              : 'bg-neutral-200/60 text-neutral-600 hover:bg-neutral-300/60 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-700/60'"
            @click="eventLogStore.selectedCategory = cat.value"
          >
            {{ cat.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Event List Body / Phase 3 Empty State UI -->
    <div class="flex-1 overflow-y-auto pr-1">
      <div
        v-if="eventLogStore.filteredEvents.length === 0"
        class="h-full min-h-[300px] flex flex-col items-center justify-center p-8 text-center"
      >
        <div class="mb-4 h-16 w-16 flex items-center justify-center rounded-2xl bg-primary-500/10 text-3xl text-primary-500 shadow-inner">
          <div class="i-solar:inbox-line-bold-duotone" />
        </div>
        <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-200">
          No events logged yet
        </h3>
        <p class="mt-2 max-w-md text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
          The Event Ledger is empty. As AIRI perceives screen activity, executes MCP tools, or consolidates memories, events will stream here live in natural language.
        </p>
      </div>

      <!-- Event Cards List -->
      <div v-else class="space-y-2.5">
        <div
          v-for="event in eventLogStore.filteredEvents"
          :key="event.id"
          class="shadow-xs backdrop-blur-xs border border-neutral-200/60 rounded-xl bg-white/80 p-3 transition dark:border-neutral-800/60 hover:border-primary-500/30 dark:bg-neutral-900/80"
        >
          <div class="flex items-center justify-between text-xs text-neutral-400 font-medium">
            <span class="rounded-md bg-primary-500/10 px-2 py-0.5 text-[10px] text-primary-600 font-bold tracking-wider uppercase dark:text-primary-400">
              {{ event.category }}
            </span>
            <span>{{ new Date(event.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }) }}</span>
          </div>

          <p class="mt-2 text-sm text-neutral-800 font-medium leading-relaxed dark:text-neutral-200">
            {{ event.textSummary }}
          </p>

          <!-- Expandable Payload Inspection -->
          <div v-if="event.inspectable && event.payload" class="mt-2 border-t border-neutral-200/40 pt-1.5 dark:border-neutral-800/40">
            <button
              class="text-xs text-neutral-400 font-semibold hover:text-primary-500"
              @click="expandedEventId = expandedEventId === event.id ? null : event.id"
            >
              {{ expandedEventId === event.id ? 'Hide details' : 'Inspect details' }}
            </button>
            <pre
              v-if="expandedEventId === event.id"
              class="mt-1.5 overflow-x-auto rounded-lg bg-neutral-100 p-2.5 text-xs text-neutral-700 font-mono dark:bg-neutral-950 dark:text-neutral-300"
            >{{ JSON.stringify(event.payload, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
