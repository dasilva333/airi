<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useShortTermMemoryStore } from '../../../stores/memory-short-term'
import { useAiriCardStore } from '../../../stores/modules/airi-card'

const props = withDefaults(
  defineProps<{
    /** Whether to show the cache status section (rebuild buttons, etc) */
    showCacheStatus?: boolean
    /** Tooltip for the main button */
    title?: string
    /** Variant of the trigger button */
    variant?: 'default' | 'mobile'
  }>(),
  {
    showCacheStatus: false,
    title: 'Memory & Context',
    variant: 'default',
  },
)

const emit = defineEmits<{
  (e: 'view-context'): void
  (e: 'manage-sessions'): void
}>()

const router = useRouter()
const shortTermMemory = useShortTermMemoryStore()
const airiCardStore = useAiriCardStore()
const { activeCardId } = storeToRefs(airiCardStore)

// --- Cache Status logic ---
const todayDate = computed(() => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
})

const characterBlocks = computed(() => {
  if (!activeCardId.value) return []
  return shortTermMemory.getCharacterBlocks(activeCardId.value)
})

const isTodayCached = computed(() => {
  return characterBlocks.value.some((b) => b.date === todayDate.value)
})

const last3Dates = computed(() => {
  const dates: string[] = []
  for (let i = 1; i <= 3; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    dates.push(`${year}-${month}-${day}`)
  }
  return dates
})

const cachedDayCount = computed(() => {
  const blockDates = new Set(characterBlocks.value.map((b) => b.date))
  return last3Dates.value.filter((d) => blockDates.has(d)).length
})

const allLast3Cached = computed(() => cachedDayCount.value === 3)

async function handleCacheToday() {
  if (!activeCardId.value) return
  await shortTermMemory.rebuildToday(activeCardId.value)
}

async function handleRebuildFromHistory() {
  if (!activeCardId.value) return
  await shortTermMemory.rebuildFromHistory(activeCardId.value)
}

function navigateToMemory() {
  router.push('/settings/memory')
}
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <button
        v-if="variant === 'mobile'"
        class="w-fit flex items-center justify-center border-2 border-neutral-100/60 rounded-xl border-solid bg-neutral-50/70 p-2 backdrop-blur-md transition-all active:scale-95 dark:border-neutral-800/30 dark:bg-neutral-800/70"
        :title="title"
      >
        <div class="i-solar:leaf-bold-duotone size-5 text-neutral-500 dark:text-neutral-400" />
      </button>
      <button
        v-else
        class="max-h-[10lh] min-h-[1lh] flex items-center justify-center rounded-md p-2 outline-none transition-colors transition-transform active:scale-95"
        bg="neutral-100 dark:neutral-800"
        text="lg neutral-500 dark:neutral-400"
        hover:text="primary-500 dark:primary-400"
        :title="title"
      >
        <div class="i-solar:leaf-bold-duotone" />
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        side="top"
        :side-offset="8"
        align="end"
        class="animate-in fade-in zoom-in z-100 w-72 border border-neutral-200/50 rounded-2xl bg-white/90 p-3 shadow-2xl backdrop-blur-xl duration-200 dark:border-neutral-700/50 dark:bg-neutral-900/90"
      >
        <!-- Header -->
        <div class="mb-3 flex items-center justify-between border-b border-neutral-100 pb-2 dark:border-neutral-800">
          <span class="text-xs text-neutral-400 font-bold tracking-wider uppercase">Memory & Context</span>
          <div class="i-solar:leaf-bold-duotone text-xs text-primary-500" />
        </div>

        <!-- System Prompt Quick View -->
        <button
          class="mb-2 w-full flex items-center gap-3 rounded-xl bg-primary-50/50 p-2.5 text-left transition-all dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-800/30"
          @click="emit('view-context')"
        >
          <div class="i-solar:notes-bold-duotone text-lg text-primary-600 dark:text-primary-400" />
          <div class="flex flex-col">
            <span class="text-[13px] text-primary-900 font-semibold leading-none dark:text-primary-100">View System Prompt</span>
            <span class="mt-1 text-[10px] text-primary-600/70 dark:text-primary-400/70">Check character instructions</span>
          </div>
        </button>

        <!-- Cache Status (Optional for full UI) -->
        <div v-if="showCacheStatus" class="mb-2 space-y-2">
          <!-- Rebuild Progress -->
          <div v-if="shortTermMemory.rebuilding" class="rounded-lg bg-primary-50 p-2 dark:bg-primary-900/30">
            <div class="flex items-center gap-2 text-xs text-primary-600 dark:text-primary-300">
              <div class="i-svg-spinners:pulse-ring text-sm" />
              <span>{{ shortTermMemory.rebuildProgress || 'Working...' }}</span>
            </div>
          </div>

          <!-- Last 3 Days -->
          <div class="flex items-center justify-between border border-neutral-100 rounded-xl p-2 dark:border-neutral-800">
            <div class="flex items-center gap-2">
              <div :class="allLast3Cached ? 'text-emerald-500' : 'text-amber-500'" class="text-base">
                <div :class="allLast3Cached ? 'i-solar:check-circle-bold-duotone' : 'i-solar:danger-triangle-bold-duotone'" />
              </div>
              <div class="flex flex-col">
                <span class="text-[11px] text-neutral-700 font-bold leading-none dark:text-neutral-200">Last 3 Days</span>
                <span class="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">{{ cachedDayCount }}/3 Cached</span>
              </div>
            </div>
            <button
              class="rounded-lg bg-neutral-100 px-2 py-1 text-[10px] text-neutral-600 font-bold transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
              :disabled="shortTermMemory.rebuilding"
              @click="handleRebuildFromHistory"
            >
              Rebuild
            </button>
          </div>

          <!-- Today -->
          <div class="flex items-center justify-between border border-neutral-100 rounded-xl p-2 dark:border-neutral-800">
            <div class="flex items-center gap-2">
              <div :class="isTodayCached ? 'text-emerald-500' : 'text-amber-500'" class="text-base">
                <div :class="isTodayCached ? 'i-solar:check-circle-bold-duotone' : 'i-solar:danger-triangle-bold-duotone'" />
              </div>
              <div class="flex flex-col">
                <span class="text-[11px] text-neutral-700 font-bold leading-none dark:text-neutral-200">Today</span>
                <span class="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">{{ isTodayCached ? 'Cached' : 'Not Cached' }}</span>
              </div>
            </div>
            <button
              class="rounded-lg bg-neutral-100 px-2 py-1 text-[10px] text-neutral-600 font-bold transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
              :disabled="shortTermMemory.rebuilding"
              @click="handleCacheToday"
            >
              {{ isTodayCached ? 'Refresh' : 'Cache Today' }}
            </button>
          </div>
        </div>

        <!-- Footer / Link -->
        <div class="space-y-1">
          <button
            class="w-full flex items-center justify-between rounded-xl p-2 text-left transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
            @click="emit('manage-sessions')"
          >
            <div class="flex items-center gap-2">
              <div class="i-solar:layers-minimalistic-linear text-neutral-400" />
              <span class="text-xs text-neutral-600 font-medium dark:text-neutral-300">Session Management</span>
            </div>
            <div class="i-solar:alt-arrow-right-linear text-xs text-neutral-400" />
          </button>

          <button
            class="w-full flex items-center justify-between rounded-xl p-2 text-left transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
            @click="navigateToMemory"
          >
            <div class="flex items-center gap-2">
              <div class="i-solar:settings-minimalistic-linear text-neutral-400" />
              <span class="text-xs text-neutral-600 font-medium dark:text-neutral-300">Memory Management</span>
            </div>
            <div class="i-solar:alt-arrow-right-linear text-xs text-neutral-400" />
          </button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
