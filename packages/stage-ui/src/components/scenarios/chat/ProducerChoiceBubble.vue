<script setup lang="ts">
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettingsUserProfile } from '@proj-airi/stage-ui/stores/settings/user-profile'
import { useBroadcastChannel, useLocalStorage } from '@vueuse/core'
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
const speechStore = useSpeechStore()
const providersStore = useProvidersStore()
const chatOrchestratorStore = useChatOrchestratorStore()
const suggestionCount = useLocalStorage('airi:producer:suggestion-count', 4)

const { post } = useBroadcastChannel<any, any>({ name: 'airi-caption-overlay' })

const utteredSegments = ref<{ text: string, color: string, actorId: string, isActive: boolean }[]>([])

function showCaption(text: string) {
  console.log('[CaptionDebug] [Chatbox] showCaption called with text:', text)
  try {
    post({ type: 'caption-speaker', text: 'User' })
    utteredSegments.value.forEach(s => s.isActive = false)
    utteredSegments.value.push({ text, color: '#818cf8', actorId: 'user', isActive: true })
    post({
      type: 'caption-assistant',
      segments: JSON.parse(JSON.stringify(utteredSegments.value)),
    })
  }
  catch (e) {
    console.warn('[CaptionDebug] [Chatbox] Failed to post caption:', e)
  }
}

function clearCaption() {
  console.log('[CaptionDebug] [Chatbox] clearCaption called')
  try {
    utteredSegments.value = []
    post({ type: 'caption-speaker', text: '' })
    post({ type: 'caption-assistant', segments: [] })
  }
  catch (e) {
    console.warn('[CaptionDebug] [Chatbox] Failed to clear caption:', e)
  }
}

// Tracks which card index is currently loading TTS audio
const loadingIndex = ref<number | null>(null)
// Tracks which card index is currently playing audio
const activePlayingIndex = ref<number | null>(null)
// Holds the active Audio element so we can interrupt it
const activeAudio = ref<HTMLAudioElement | null>(null)
// True while "Play All" is actively sequencing through choices
const isPlayingAll = ref(false)
// Holds session identifier for the active sentence-by-sentence play loop
const currentPlaybackSession = ref<any>(null)

function stopActiveAudio() {
  currentPlaybackSession.value = null
  if (activeAudio.value) {
    activeAudio.value.pause()
    activeAudio.value.currentTime = 0
    activeAudio.value = null
  }
  activePlayingIndex.value = null
  loadingIndex.value = null
  clearCaption()
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

  loadingIndex.value = idx
  try {
    const provider = await providersStore.getProviderInstance('virtual-audio-studio')
    if (!provider) {
      throw new Error('Virtual Audio Studio provider is not active.')
    }

    // Split text into sentences using lookbehind for punctuation boundaries (. ! ?)
    const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)

    // Synthesize speech concurrently for each sentence
    const audioItems = await Promise.all(
      sentences.map(async (sentence) => {
        const audioData = await speechStore.speech(
          provider as any,
          'virtual',
          sentence,
          voiceId,
        )
        const audioUrl = URL.createObjectURL(new Blob([audioData]))
        return {
          text: sentence,
          audio: new Audio(audioUrl),
        }
      }),
    )

    // Guard: user may have cancelled while we were fetching
    if (loadingIndex.value !== idx)
      return

    loadingIndex.value = null

    // Create a new playback session token
    const sessionToken = Symbol('playback-session')
    currentPlaybackSession.value = sessionToken

    // Play each sentence in sequence
    for (let i = 0; i < audioItems.length; i++) {
      if (currentPlaybackSession.value !== sessionToken)
        break

      const item = audioItems[i]
      activeAudio.value = item.audio
      activePlayingIndex.value = idx

      showCaption(item.text)
      item.audio.play()

      // Wait for ended, pause, or error to progress or terminate
      await new Promise<void>((resolve) => {
        const cleanup = () => {
          item.audio.removeEventListener('ended', onDone)
          item.audio.removeEventListener('pause', onDone)
          item.audio.removeEventListener('error', onDone)
        }
        const onDone = () => {
          cleanup()
          resolve()
        }
        item.audio.addEventListener('ended', onDone)
        item.audio.addEventListener('pause', onDone)
        item.audio.addEventListener('error', onDone)
      })
    }

    // Reset state when the entire sentence list has finished playing naturally
    if (currentPlaybackSession.value === sessionToken) {
      activePlayingIndex.value = null
      activeAudio.value = null
      currentPlaybackSession.value = null
      clearCaption()
    }
  }
  catch (error) {
    console.error('[ProducerChoiceBubble] Speech synthesis failed:', error)
    toast.error(error instanceof Error ? error.message : 'Speech synthesis failed.')
    loadingIndex.value = null
    activePlayingIndex.value = null
    activeAudio.value = null
    currentPlaybackSession.value = null
    clearCaption()
  }
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
    const autoPlayAll = localStorage.getItem('airi:producer:auto-play-all') === 'true'
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
          :class="[
            'group relative border rounded-xl bg-primary-100/10 dark:bg-neutral-900/20 p-3 text-left transition-all active:scale-[0.98]',
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
