<script setup lang="ts">
import type { ShortTermMemoryBlock } from '@proj-airi/stage-ui/types/short-term-memory'

import { useShortTermMemoryStore } from '@proj-airi/stage-ui/stores/memory-short-term'
import { computed, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  minTimestamp: number
  maxTimestamp: number
  modelValue: number
  totalEntitiesCount: number
  activeEntitiesCount: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const shortTermStore = useShortTermMemoryStore()

const isPlaying = ref(false)
let playTimer: ReturnType<typeof setInterval> | null = null

const isLive = computed(() => {
  return props.modelValue >= props.maxTimestamp
})

const formattedCurrentDate = computed(() => {
  if (isLive.value)
    return 'Present (Live Constellation)'
  const d = new Date(props.modelValue)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

const chapterMarkers = computed(() => {
  return shortTermStore.blocks.map((block: ShortTermMemoryBlock) => {
    const ts = block.createdAt || new Date(block.date).getTime()
    const pct = props.maxTimestamp > props.minTimestamp
      ? Math.min(100, Math.max(0, ((ts - props.minTimestamp) / (props.maxTimestamp - props.minTimestamp)) * 100))
      : 50
    return {
      id: block.id,
      date: block.date,
      summary: block.summary,
      timestamp: ts,
      percent: pct,
    }
  })
})

function handleSliderInput(e: Event) {
  stopPlay()
  const val = Number((e.target as HTMLInputElement).value)
  emit('update:modelValue', val)
}

watch(() => [props.minTimestamp, props.maxTimestamp], () => {
  stopPlay()
})

function jumpToLive() {
  stopPlay()
  emit('update:modelValue', props.maxTimestamp)
}

function stepDays(days: number) {
  stopPlay()
  const stepMs = days * 24 * 60 * 60 * 1000
  const next = Math.max(props.minTimestamp, Math.min(props.maxTimestamp, props.modelValue + stepMs))
  emit('update:modelValue', next)
}

function togglePlay() {
  if (isPlaying.value) {
    stopPlay()
  }
  else {
    startPlay()
  }
}

function startPlay() {
  if (isLive.value) {
    emit('update:modelValue', props.minTimestamp)
  }
  isPlaying.value = true
  const totalSteps = 100
  const stepMs = Math.max(1, (props.maxTimestamp - props.minTimestamp) / totalSteps)

  playTimer = setInterval(() => {
    const next = props.modelValue + stepMs
    if (next >= props.maxTimestamp) {
      emit('update:modelValue', props.maxTimestamp)
      stopPlay()
    }
    else {
      emit('update:modelValue', next)
    }
  }, 100)
}

function stopPlay() {
  isPlaying.value = false
  if (playTimer) {
    clearInterval(playTimer)
    playTimer = null
  }
}

onUnmounted(() => {
  stopPlay()
})
</script>

<template>
  <div class="z-20 flex flex-col gap-2 border-t border-neutral-200/50 bg-white/80 p-3 backdrop-blur-md dark:border-neutral-800/60 dark:bg-neutral-950/80">
    <div class="flex items-center justify-between text-xs">
      <!-- Left: Step and Play Controls -->
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          class="rounded-lg p-1 text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          title="Step back 1 day"
          @click="stepDays(-1)"
        >
          <div class="i-solar:skip-previous-bold text-sm" />
        </button>

        <button
          type="button"
          class="flex items-center justify-center rounded-lg bg-primary-500/10 p-1.5 text-primary-500 font-bold transition hover:bg-primary-500/20"
          :title="isPlaying ? 'Pause timeline playback' : 'Play mind growth animation'"
          @click="togglePlay"
        >
          <div :class="isPlaying ? 'i-solar:pause-bold text-sm' : 'i-solar:play-bold text-sm'" />
        </button>

        <button
          type="button"
          class="rounded-lg p-1 text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          title="Step forward 1 day"
          @click="stepDays(1)"
        >
          <div class="i-solar:skip-next-bold text-sm" />
        </button>

        <span class="ml-2 text-[11px] text-neutral-800 font-semibold font-mono dark:text-neutral-200">
          {{ formattedCurrentDate }}
        </span>
      </div>

      <!-- Right: Entities count & Live Button -->
      <div class="flex items-center gap-3">
        <span class="text-[11px] text-neutral-500 dark:text-neutral-400">
          Active Entities: <strong class="text-neutral-800 font-mono dark:text-neutral-200">{{ activeEntitiesCount }}</strong> / {{ totalEntitiesCount }}
        </span>

        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all"
          :class="isLive
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30'
            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'"
          @click="jumpToLive"
        >
          <div :class="['h-2 w-2 rounded-full', isLive ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400']" />
          <span>Live</span>
        </button>
      </div>
    </div>

    <!-- Scrubber Track & Markers -->
    <div class="relative w-full flex items-center py-1">
      <!-- 24h Summary Chapter Marker Pins -->
      <div
        v-for="marker in chapterMarkers"
        :key="marker.id"
        class="shadow-xs absolute top-1/2 z-10 h-2 w-2 cursor-pointer rounded-full bg-teal-400 transition-transform -translate-y-1/2 hover:scale-150"
        :style="{ left: `${marker.percent}%` }"
        :title="`${marker.date}: ${marker.summary?.slice(0, 60)}...`"
        @click="emit('update:modelValue', marker.timestamp)"
      />

      <!-- Native Range Input (styled as modern slim track) -->
      <input
        type="range"
        :min="minTimestamp"
        :max="maxTimestamp"
        :value="modelValue"
        class="z-0 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-500 dark:bg-neutral-800"
        @input="handleSliderInput"
      >
    </div>
  </div>
</template>
