<script setup lang="ts">
import { useSpeechCaptionPlayer } from '@proj-airi/stage-ui/composables'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useSettingsUserProfile } from '@proj-airi/stage-ui/stores/settings/user-profile'
import { useLocalStorage } from '@vueuse/core'
import { onBeforeUnmount, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

interface Choice {
  title: string
  message: string
}

const props = defineProps<{
  message: {
    choices: Choice[]
    loading?: boolean
  }
}>()

const emit = defineEmits<{
  (e: 'choose', choice: Choice, isPlaybackOnly?: boolean): void
  (e: 'retry'): void
  (e: 'delete'): void
}>()

const userProfileStore = useSettingsUserProfile()
const chatOrchestratorStore = useChatOrchestratorStore()
const suggestionCount = useLocalStorage('airi:producer:suggestion-count', 2)

const { play: playSpeech, stop: stopSpeech } = useSpeechCaptionPlayer()

const loadingIndex = ref<number | null>(null)
const activePlayingIndex = ref<number | null>(null)
const isPlayingAll = ref(false)

function stopActiveAudio() {
  stopSpeech()
  activePlayingIndex.value = null
  loadingIndex.value = null
}

async function playChoiceSpeech(idx: number, text: string) {
  const voiceId = userProfileStore.voiceProfileId
  if (!voiceId) {
    toast.error('No voice profile configured. Go to Settings > System > User Profile.')
    return
  }

  // If clicking the currently playing card → pause and stop
  if (activePlayingIndex.value === idx) {
    stopActiveAudio()
    return
  }

  // Interrupt any card currently loading or playing
  stopActiveAudio()

  // Update textarea with this choice message immediately for preview
  emit('choose', props.message.choices[idx], true)

  await playSpeech(text, voiceId, {
    onLoading: () => { loadingIndex.value = idx },
    onPlaying: () => { loadingIndex.value = null; activePlayingIndex.value = idx },
    onDone: () => { activePlayingIndex.value = null },
    onError: () => { loadingIndex.value = null; activePlayingIndex.value = null },
  })
}

async function playAllChoices() {
  if (!props.message.choices.length || isPlayingAll.value)
    return

  stopActiveAudio()
  isPlayingAll.value = true

  for (let i = 0; i < props.message.choices.length; i++) {
    if (!isPlayingAll.value)
      break
    await playChoiceSpeech(i, props.message.choices[i].message)
    // Wait for the audio to finish before moving to the next one
    await new Promise<void>((resolve) => {
      const check = () => {
        if (activePlayingIndex.value === null || !isPlayingAll.value)
          resolve()
        else
          requestAnimationFrame(check)
      }
      check()
    })
  }

  isPlayingAll.value = false
}

function stopPlayAll() {
  isPlayingAll.value = false
  stopActiveAudio()
}

// Auto-play all if enabled and choices become loaded/available
watch(() => props.message.loading, (isLoading) => {
  if (isLoading === false && props.message.choices.length > 0) {
    const autoPlayAll = (localStorage.getItem('airi:producer:auto-play-all') ?? 'true') === 'true'
    if (autoPlayAll) {
      void playAllChoices()
    }
  }
}, { immediate: true })

// Auto-stop all playing/loading suggestion speech when any message is submitted
watch(() => chatOrchestratorStore.sending, (isSending) => {
  if (isSending) {
    stopPlayAll()
  }
})

onBeforeUnmount(() => {
  stopPlayAll()
})
</script>

<template>
  <div
    class="producer-choice-bubble relative my-2 flex flex-col border border-primary-500/30 rounded-xl bg-primary-50/70 p-3 text-sm shadow-[0_0_15px_rgba(var(--primary-rgb),0.15)] backdrop-blur-md transition-all dark:border-primary-500/30 hover:border-primary-500/40 dark:bg-black/40"
  >
    <!-- Subtle scanline effect overlay -->
    <div class="pointer-events-none absolute inset-0 rounded-xl bg-[length:100%_4px] bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.15)_50%)] opacity-10" />

    <!-- Header Actions -->
    <div class="z-10 flex select-none items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="i-solar:magic-stick-3-bold-duotone animate-pulse text-lg text-primary-500 dark:text-primary-400" />
        <span class="text-xs text-primary-700 font-bold tracking-widest font-mono dark:text-primary-300">PRODUCER DIRECTIVES</span>
      </div>

      <div class="flex items-center gap-1.5 border border-primary-500/10 rounded-lg bg-primary-100/40 p-0.5 dark:bg-black/40">
        <button
          v-if="!message.loading && message.choices.length > 0"
          class="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-neutral-500 font-semibold transition-colors hover:bg-blue-100/50 dark:text-neutral-400 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
          :title="isPlayingAll ? 'Stop playing all' : 'Play all choices'"
          @click="isPlayingAll ? stopPlayAll() : playAllChoices()"
        >
          <span :class="isPlayingAll ? 'i-solar:pause-circle-bold-duotone' : 'i-solar:play-stream-bold-duotone'" class="text-xs" />
          <span>{{ isPlayingAll ? 'Stop' : 'Play All' }}</span>
        </button>
        <div v-if="!message.loading && message.choices.length > 0" class="h-2.5 w-[1px] bg-neutral-200 dark:bg-neutral-800" />
        <button
          class="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-neutral-500 font-semibold transition-colors hover:bg-neutral-100 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-300"
          title="Regenerate choices"
          @click="emit('retry')"
        >
          <span class="i-solar:restart-square-outline text-xs" />
          <span>Retry</span>
        </button>
        <div class="h-2.5 w-[1px] bg-neutral-200 dark:bg-neutral-800" />
        <button
          class="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-neutral-500 font-semibold transition-colors hover:bg-red-100/50 dark:text-neutral-400 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400"
          title="Dismiss suggestions"
          @click="emit('delete')"
        >
          <span class="i-solar:trash-bin-trash-outline text-xs" />
          <span>Dismiss</span>
        </button>
      </div>
    </div>

    <!-- Cards Grid -->
    <div class="z-10 mt-3 flex flex-col gap-2">
      <!-- Loading Skeleton State -->
      <div v-if="message.loading" class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div
          v-for="i in suggestionCount"
          :key="i"
          class="h-18 flex flex-col animate-pulse gap-2 border border-neutral-200 rounded-xl bg-neutral-100/30 p-3 dark:border-neutral-800/50 dark:bg-neutral-900/30"
        >
          <div class="h-4 w-1/3 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div class="h-3 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </div>

      <!-- Generated Options -->
      <div v-else class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          v-for="(choice, idx) in message.choices"
          :key="idx"
          type="button"
          :class="[
            'group relative border rounded-xl bg-primary-100/10 dark:bg-neutral-900/20 p-3 text-left transition-all active:scale-[0.98] cursor-pointer',
            'hover:border-primary-500/40 hover:bg-primary-50/50 dark:hover:bg-primary-950/10 hover:shadow-[0_2px_10px_rgba(var(--primary-rgb),0.05)]',
            activePlayingIndex === idx
              ? 'border-primary-500/50 bg-primary-50/50 dark:bg-primary-950/10'
              : 'border-neutral-200 dark:border-neutral-800',
          ]"
          @click="emit('choose', choice)"
        >
          <div class="flex items-start gap-2.5">
            <!-- Voice icon: left edge, own dedicated space -->
            <!-- Uses a span (not a button) to avoid nested-button DOM issues inside the card <button> -->
            <span
              v-if="userProfileStore.voiceProfileId"
              class="mt-0.5 cursor-pointer rounded p-0.5 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800/50"
              :title="activePlayingIndex === idx ? 'Pause' : 'Preview with your voice'"
              @click.stop.prevent="playChoiceSpeech(idx, choice.message)"
            >
              <!-- Loading state -->
              <span
                v-if="loadingIndex === idx"
                class="i-solar:restart-square-outline block animate-spin text-sm text-primary-500 dark:text-primary-400"
              />
              <!-- Playing state -->
              <span
                v-else-if="activePlayingIndex === idx"
                class="i-solar:pause-circle-bold-duotone block text-sm text-primary-500"
              />
              <!-- Idle state -->
              <span
                v-else
                class="i-solar:user-speak-linear block text-sm text-neutral-500 transition-colors group-hover:text-primary-500 dark:group-hover:text-neutral-300"
              />
            </span>
            <!-- No voice profile: spacer to keep layout consistent -->
            <span v-else class="mt-0.5 w-4 shrink-0" />

            <!-- Card content -->
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between">
                <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase transition-colors dark:text-neutral-400 group-hover:text-primary-600 dark:group-hover:text-primary-300">
                  {{ choice.title }}
                </span>
                <span class="i-solar:arrow-right-up-outline ml-1.5 shrink-0 translate-y-1 transform text-xs text-neutral-600 opacity-0 transition-all group-hover:translate-y-0 group-hover:text-primary-500 group-hover:opacity-100 dark:group-hover:text-primary-400" />
              </div>
              <p class="line-clamp-2 mt-1 text-xs text-neutral-600 font-medium leading-relaxed dark:text-neutral-300">
                {{ choice.message }}
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.producer-choice-bubble {
  --primary-rgb: 99, 102, 241; /* Tailwind Indigo-500 or equivalent primary color */
}
</style>
