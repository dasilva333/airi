<script setup lang="ts">
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { useBroadcastChannel } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  showActiveSentenceOnly?: boolean
  fadeOnCursor?: boolean
  transparentBg?: boolean
  fallbackText?: string
  textSize?: string
}>(), {
  showActiveSentenceOnly: false,
  fadeOnCursor: false,
  transparentBg: false,
  fallbackText: '',
  textSize: 'text-[1.25rem]',
})

const settingsStore = useSettings()
const speakerText = ref('')
const assistantSegments = ref<CaptionSegment[]>([])
const scrollContainer = ref<HTMLElement | null>(null)

export interface CaptionSegment {
  text: string
  color: string
  actorId: string
  isActive?: boolean
}

// Broadcast channel for captions
type CaptionChannelEvent
  = | { type: 'caption-speaker', text: string }
    | { type: 'caption-assistant', segments: CaptionSegment[] }
const { data } = useBroadcastChannel<CaptionChannelEvent, CaptionChannelEvent>({ name: 'airi-caption-overlay' })

// Turn-resets listener
const { data: sessionUpdate } = useBroadcastChannel<any, any>({ name: 'airi-chat-stream' })

// Mouse tracking for fade-out if fadeOnCursor is active
const isOutsideWindow = ref(true)
// In a non-page component, we default to showing unless hover logic is explicitly handled
const shouldFadeOnCursor = computed(() => props.fadeOnCursor && !isOutsideWindow.value)

onMounted(() => {
  // Turn reset listener
  watch(sessionUpdate, (event) => {
    if (event?.type === 'session-updated' && event.message?.role === 'user') {
      speakerText.value = ''
      assistantSegments.value = []
    }
  })

  // Broadcast data listener
  watch(data, (event) => {
    if (!event)
      return

    console.log('[CaptionDebug] [CaptionPanel] Received event:', event)

    if (event.type === 'caption-speaker') {
      speakerText.value = event.text
    }
    else if (event.type === 'caption-assistant') {
      if (!event.segments || event.segments.length === 0) {
        speakerText.value = ''
        assistantSegments.value = []
      }
      else {
        assistantSegments.value = event.segments
      }
    }
  }, { immediate: true })
})

// Auto-scroll logic
watch(assistantSegments, () => {
  if (scrollContainer.value) {
    setTimeout(() => {
      scrollContainer.value?.scrollTo({
        top: scrollContainer.value.scrollHeight,
        behavior: 'smooth',
      })
    }, 10)
  }
}, { deep: true })

// Filtered segments display list
const displaySegments = computed(() => {
  if (props.showActiveSentenceOnly) {
    return assistantSegments.value.filter(s => s.isActive)
  }
  return assistantSegments.value
})

const containerStyle = computed(() => {
  const alpha = settingsStore.captionOpacity / 100
  return {
    background: props.transparentBg
      ? 'transparent'
      : `linear-gradient(135deg, rgba(0,0,0,${(alpha * 0.85).toFixed(2)}) 0%, rgba(10,10,20,${(alpha * 0.95).toFixed(2)}) 100%)`,
    border: props.transparentBg ? 'none' : `1px solid rgba(255,255,255,${(alpha * 0.08).toFixed(2)})`,
    boxShadow: props.transparentBg ? 'none' : `0 4px 24px rgba(0,0,0,${(alpha * 0.4).toFixed(2)}), inset 0 1px 0 rgba(255,255,255,${(alpha * 0.06).toFixed(2)})`,
    transform: `scale(${settingsStore.captionFontSize / 100})`,
    transformOrigin: settingsStore.captionDocking === 'top' ? 'top center' : 'bottom center',
  }
})
</script>

<template>
  <div
    ref="scrollContainer"
    :class="[
      'w-full h-full flex justify-center overflow-y-auto scrollbar-hide',
      settingsStore.captionDocking === 'top' ? 'items-start pt-1' : 'items-end pb-1',
    ]"
  >
    <div
      v-if="speakerText || displaySegments.length > 0 || fallbackText"
      :class="[
        shouldFadeOnCursor ? 'op-0' : 'op-100',
        'relative select-none rounded-xl px-3 py-2',
        'pointer-events-none',
        transparentBg ? '' : 'backdrop-blur-sm',
        'transition-all duration-300 ease-in-out my-2',
      ]"
      :style="containerStyle"
    >
      <div class="max-w-[80vw] flex flex-col gap-1">
        <div
          v-if="speakerText && (!showActiveSentenceOnly || displaySegments.length > 0)"
          class="rounded-md px-2 py-1 text-[1.1rem] text-neutral-50 font-medium text-shadow-lg text-shadow-color-neutral-900/60"
        >
          {{ speakerText }}
        </div>
        <div
          v-if="displaySegments.length > 0 || fallbackText"
          :class="[textSize, 'rounded-md px-2 py-1 font-semibold leading-relaxed text-shadow-lg']"
          style="white-space: pre-wrap;"
        >
          <template v-if="displaySegments.length > 0">
            <span
              v-for="(segment, idx) in displaySegments"
              :key="idx"
              :style="{
                color: segment.color,
                textShadow: segment.isActive
                  ? `0 0 10px ${segment.color}, 0 2px 4px rgba(0,0,0,0.9)`
                  : `0 1px 3px rgba(0,0,0,0.9)`,
                transform: segment.isActive ? 'scale(1.06) translateY(-1px)' : 'scale(1)',
                display: 'inline-block',
                transition: 'all 0.25s ease-out',
                filter: segment.isActive ? 'brightness(1.2)' : 'brightness(0.95)',
                margin: segment.isActive ? '0 1px' : '0',
              }"
              :class="[
                'origin-center',
                segment.isActive ? 'z-10 relative font-bold' : 'opacity-95',
              ]"
            >{{ segment.text }}</span>
          </template>
          <template v-else>
            <span class="text-white font-medium opacity-95">{{ fallbackText }}</span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
