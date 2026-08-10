<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import CompanionBubble from '../components/companion-bubble.vue'

// V2 onboarding scaffold — Step 1: Hearing & Mic Playground.
// All audio input, downloads, and transcription are SIMULATED. No WebWorker
// RPCs, no mic streams, no model caches are wired in this pass.

type EngineId = 'whisper' | 'webspeech'

const selectedEngine = ref<EngineId>('whisper')
const selectedMic = ref('default')
const mockMics = [
  { value: 'default', label: 'Default — MacBook Pro Microphone' },
  { value: 'usb', label: 'USB Audio Device' },
  { value: 'airpods', label: 'AirPods Pro' },
]

// --- Simulated volume meter ---
const METER_BARS = 24
const meterBars = ref<number[]>(Array.from({ length: METER_BARS }, () => 4))
let meterTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  meterTimer = setInterval(() => {
    meterBars.value = meterBars.value.map(() => 4 + Math.random() * 36)
  }, 120)
})

onBeforeUnmount(() => clearInterval(meterTimer))

// --- Simulated model download ---
const downloadState = ref<'idle' | 'downloading' | 'ready'>('idle')
const downloadProgress = ref(0)
let downloadTimer: ReturnType<typeof setInterval> | undefined

function startMockDownload() {
  if (downloadState.value === 'downloading')
    return
  downloadState.value = 'downloading'
  downloadProgress.value = 0
  downloadTimer = setInterval(() => {
    downloadProgress.value = Math.min(100, downloadProgress.value + Math.random() * 7)
    if (downloadProgress.value >= 100) {
      clearInterval(downloadTimer)
      downloadState.value = 'ready'
      startMockTranscription()
    }
  }, 150)
}

onBeforeUnmount(() => clearInterval(downloadTimer))

// --- Simulated live transcription ---
const transcriptLines = [
  'Testing 1 2 3…',
  'Hello AIRI, can you hear me?',
  'Wow, this actually works!',
]
const transcript = ref('')
let transcriptTimer: ReturnType<typeof setInterval> | undefined

function startMockTranscription() {
  let i = 0
  transcriptTimer = setInterval(() => {
    transcript.value = transcriptLines[i % transcriptLines.length]
    i++
  }, 2200)
  transcript.value = transcriptLines[0]
}

onBeforeUnmount(() => clearInterval(transcriptTimer))

function selectEngine(id: EngineId) {
  selectedEngine.value = id
  if (id === 'webspeech') {
    downloadState.value = 'ready'
    startMockTranscription()
  }
  else {
    downloadState.value = 'idle'
    downloadProgress.value = 0
    clearInterval(transcriptTimer)
    transcript.value = ''
  }
}

const mockSizeGb = '1.2'
const mockTotalGb = '2.7'
</script>

<template>
  <div class="h-full flex flex-col gap-5 overflow-y-auto px-1 pb-2">
    <div>
      <h2 class="text-xl text-neutral-800 font-semibold md:text-2xl dark:text-neutral-100">
        Hearing & Mic Playground
      </h2>
      <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Zero dependencies on character or persona — test your ear right away.
      </p>
    </div>

    <CompanionBubble
      message="Test your microphone here! Scream a little to watch the wave react. If it doesn't work, make sure your browser permissions are enabled!"
    />

    <!-- Hardware controls -->
    <div :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3']">
      <label class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">Microphone</label>
      <select
        v-model="selectedMic"
        class="w-full border border-neutral-200 rounded-lg bg-white px-3 py-2 text-sm outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
      >
        <option v-for="mic in mockMics" :key="mic.value" :value="mic.value">
          {{ mic.label }}
        </option>
      </select>
      <!-- Simulated live volume meter -->
      <div class="h-10 flex items-end gap-1">
        <div
          v-for="(h, i) in meterBars"
          :key="i"
          class="flex-1 rounded-full from-primary-500 to-indigo-400 bg-gradient-to-t transition-all duration-100"
          :style="{ height: `${h}px` }"
        />
      </div>
    </div>

    <!-- Engine hero cards -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        :class="[
          'relative flex flex-col gap-2 border-2 rounded-xl p-4 text-left transition-all duration-300',
          selectedEngine === 'whisper'
            ? 'border-primary-500 bg-primary-500/5 shadow-lg shadow-primary-500/10 dark:border-primary-400'
            : 'border-neutral-200/60 bg-white/40 dark:border-neutral-800/80 dark:bg-neutral-900/40 hover:border-primary-500/50',
        ]"
        @click="selectEngine('whisper')"
      >
        <div class="flex items-center gap-2">
          <div class="i-solar:microphone-3-bold-duotone h-6 w-6 text-primary-500" />
          <span class="text-sm text-neutral-800 font-bold dark:text-neutral-100">Whisper WebGPU</span>
          <span class="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400">LOCAL</span>
        </div>
        <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
          Fully offline, zero-telemetry. Large-v3-turbo (~800 MB) or Small (~480 MB).
        </p>
      </button>

      <button
        :class="[
          'relative flex flex-col gap-2 border-2 rounded-xl p-4 text-left transition-all duration-300',
          selectedEngine === 'webspeech'
            ? 'border-primary-500 bg-primary-500/5 shadow-lg shadow-primary-500/10 dark:border-primary-400'
            : 'border-neutral-200/60 bg-white/40 dark:border-neutral-800/80 dark:bg-neutral-900/40 hover:border-primary-500/50',
        ]"
        @click="selectEngine('webspeech')"
      >
        <div class="flex items-center gap-2">
          <div class="i-solar:global-bold-duotone h-6 w-6 text-indigo-500" />
          <span class="text-sm text-neutral-800 font-bold dark:text-neutral-100">Browser Web Speech</span>
          <span class="ml-auto rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-600 font-bold dark:text-indigo-400">ZERO DOWNLOAD</span>
        </div>
        <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
          Native browser STT, no model weights. Recognition backend varies by browser.
        </p>
      </button>
    </div>

    <!-- Download / test playground -->
    <div :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3']">
      <div v-if="selectedEngine === 'whisper' && downloadState === 'idle'" class="flex flex-col items-center gap-2 py-2">
        <button
          class="rounded-lg bg-primary-500 px-4 py-2 text-sm text-white font-semibold shadow-lg shadow-primary-500/25 transition-all active:scale-95 hover:bg-primary-600"
          @click="startMockDownload"
        >
          Download & Verify Whisper (Mock)
        </button>
        <span class="text-[10px] text-neutral-400 italic">Simulated for UI preview — no real download</span>
      </div>

      <div v-else-if="selectedEngine === 'whisper' && downloadState === 'downloading'" class="flex flex-col gap-2">
        <div class="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <span>Downloading weight shards…</span>
          <span>{{ Math.floor(downloadProgress) }}% ({{ mockSizeGb }} GB / {{ mockTotalGb }} GB)</span>
        </div>
        <div class="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
          <div
            class="h-full rounded-full from-primary-500 to-indigo-500 bg-gradient-to-r transition-all duration-150"
            :style="{ width: `${downloadProgress}%` }"
          />
        </div>
      </div>

      <div v-else class="flex flex-col gap-2">
        <div class="flex items-center gap-2 text-xs text-emerald-600 font-bold dark:text-emerald-400">
          <div class="i-solar:check-circle-bold-duotone h-4 w-4" />
          Engine ready — live transcription test
        </div>
        <div class="border border-neutral-200/60 rounded-lg bg-neutral-50 px-3 py-2.5 text-sm text-neutral-700 italic dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-300">
          <span v-if="transcript">"I hear you! You said: {{ transcript }}"</span>
          <span v-else class="text-neutral-400">Say something into your mic…</span>
        </div>
      </div>
    </div>
  </div>
</template>
