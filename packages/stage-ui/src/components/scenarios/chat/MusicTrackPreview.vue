<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * Inline player for a generated music track.
 *
 * Rendered from a tool result by `tool-call-block.vue`, so a finished track is
 * playable in the transcript rather than a URL the user has to open by hand.
 */
interface MusicTrack {
  id?: string
  title?: string
  model?: string
  durationMs?: number
  audioUrl?: string
}

const props = defineProps<{
  track: MusicTrack
}>()

const audioEl = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentMs = ref(0)
const totalMs = ref(props.track.durationMs ?? 0)
const loadError = ref(false)

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const elapsedLabel = computed(() => formatMs(currentMs.value))
const totalLabel = computed(() => formatMs(totalMs.value))
const progressPercent = computed(() => {
  if (totalMs.value <= 0)
    return 0
  return Math.min(100, Math.max(0, (currentMs.value / totalMs.value) * 100))
})

function togglePlay() {
  const el = audioEl.value
  if (!el)
    return

  if (el.paused) {
    void el.play().catch(() => {
      loadError.value = true
    })
  }
  else {
    el.pause()
  }
}

function handleTimeUpdate() {
  const el = audioEl.value
  if (el)
    currentMs.value = Math.round(el.currentTime * 1000)
}

function handleLoadedMetadata() {
  const el = audioEl.value
  if (!el)
    return
  if (Number.isFinite(el.duration) && el.duration > 0)
    totalMs.value = Math.round(el.duration * 1000)
}

function handleSeek(event: Event) {
  const el = audioEl.value
  const target = Number((event.target as HTMLInputElement).value)
  if (!el || !Number.isFinite(target))
    return
  el.currentTime = target / 1000
  currentMs.value = target
}

function handleEnded() {
  isPlaying.value = false
  currentMs.value = 0
  if (audioEl.value)
    audioEl.value.currentTime = 0
}
</script>

<template>
  <div class="w-full flex flex-col gap-2.5">
    <audio
      ref="audioEl"
      :src="track.audioUrl"
      preload="metadata"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      @ended="handleEnded"
      @timeupdate="handleTimeUpdate"
      @loadedmetadata="handleLoadedMetadata"
      @error="loadError = true"
    />

    <div class="flex items-center gap-2.5">
      <button
        type="button"
        :class="[
          'size-9 flex shrink-0 items-center justify-center rounded-full transition-all active:scale-95',
          loadError
            ? 'bg-neutral-300 text-neutral-500 dark:bg-neutral-700'
            : 'bg-fuchsia-500 text-white shadow-sm hover:bg-fuchsia-600',
        ]"
        :title="isPlaying ? 'Pause' : 'Play'"
        @click="togglePlay"
      >
        <div :class="isPlaying ? 'i-solar:pause-bold' : 'i-solar:play-bold'" class="text-base" />
      </button>

      <div class="min-w-0 flex flex-1 flex-col gap-1">
        <div class="flex items-baseline gap-2">
          <span class="truncate text-xs text-neutral-800 font-semibold dark:text-neutral-100">
            {{ track.title || 'Untitled track' }}
          </span>
          <span class="shrink-0 rounded bg-neutral-500/10 px-1 py-0.5 text-[10px] text-neutral-500 font-medium dark:text-neutral-400">
            {{ track.model || 'music' }}
          </span>
          <span class="ml-auto shrink-0 text-[10px] text-neutral-400 font-mono tabular-nums">
            {{ elapsedLabel }} / {{ totalLabel }}
          </span>
        </div>

        <div class="relative h-1.5 w-full overflow-hidden rounded-full bg-neutral-300/70 dark:bg-neutral-700/70">
          <div
            class="absolute inset-y-0 left-0 rounded-full bg-fuchsia-500 transition-[width] duration-150"
            :style="{ width: `${progressPercent}%` }"
          />
          <input
            type="range"
            min="0"
            :max="Math.max(1, totalMs)"
            :value="currentMs"
            class="absolute inset-0 h-full w-full cursor-pointer op-0"
            aria-label="Seek"
            @input="handleSeek"
          >
        </div>
      </div>
    </div>

    <div v-if="loadError" class="text-[10px] text-rose-500 leading-snug">
      Could not load the audio from the server.
      <a :href="track.audioUrl" target="_blank" rel="noreferrer" class="underline underline-offset-2">Open in browser</a>
    </div>
  </div>
</template>
