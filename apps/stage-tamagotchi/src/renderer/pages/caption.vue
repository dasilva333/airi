<script setup lang="ts">
import { defineInvoke } from '@moeru/eventa'
import { useElectronEventaContext, useElectronEventaInvoke, useElectronMouseAroundWindowBorder, useElectronMouseInWindow } from '@proj-airi/electron-vueuse'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { refDebounced, useBroadcastChannel } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'

import { captionGetIsFollowingWindow, captionIsFollowingWindowChanged, electronCaptionSetFollowWindow, electronSetIgnoreMouseEvents } from '../../shared/eventa'

const setIgnoreMouseEvents = useElectronEventaInvoke(electronSetIgnoreMouseEvents)
const setFollowWindow = useElectronEventaInvoke(electronCaptionSetFollowWindow)
const attached = ref(true)
const scrollContainer = ref<HTMLElement | null>(null)
const settingsStore = useSettings()
const speakerText = ref('') // NOTICE: do NOT add 'caption-speaker' or user speech to captions. This is intentionally AI-only.

export interface CaptionSegment { text: string, color: string, actorId: string, isActive?: boolean }
const assistantSegments = ref<CaptionSegment[]>([])
const { isOutside: isOutsideWindow } = useElectronMouseInWindow()
const isOutsideWindowFor250Ms = refDebounced(isOutsideWindow, 250)
const shouldFadeOnCursorWithin = computed(() => !isOutsideWindowFor250Ms.value)

function handleHandleMouseEnter() {
  console.log('[Caption] Mouse entered drag handle, making window interactive.')
  setIgnoreMouseEvents(false)
}

function handleHandleMouseLeave() {
  console.log('[Caption] Mouse left drag handle, making window click-through.')
  setIgnoreMouseEvents(true)
}
const { isNearAnyBorder: isAroundWindowBorder } = useElectronMouseAroundWindowBorder({ threshold: 30 })
const isAroundWindowBorderFor250Ms = refDebounced(isAroundWindowBorder, 250)

// Broadcast channel for captions
type CaptionChannelEvent
  = | { type: 'caption-speaker', text: string }
    | { type: 'caption-assistant', segments: CaptionSegment[] }
const { data } = useBroadcastChannel<CaptionChannelEvent, CaptionChannelEvent>({ name: 'airi-caption-overlay' })

// NOTICE: Secondary broadcast channel to listen for turn-resets (user messages)
// This is a hardware-level fix because the 'airi-caption-overlay' empty string reset was failing.
const { data: sessionUpdate } = useBroadcastChannel<any, any>({ name: 'airi-chat-stream' })

const context = useElectronEventaContext()
const getAttached = defineInvoke(context.value, captionGetIsFollowingWindow)

onMounted(async () => {
  try {
    const isAttached = await getAttached()
    attached.value = Boolean(isAttached)
  }
  catch {}

  try {
    context.value.on(captionIsFollowingWindowChanged, (event) => {
      const val = Boolean(event?.body)
      attached.value = val
      if (settingsStore.captionFollowStage !== val) {
        settingsStore.captionFollowStage = val
      }
    })
  }
  catch {}

  try {
    // Hardware-level turn reset: clear everything when a new user message enters the session
    watch(sessionUpdate, (event) => {
      if (event?.type === 'session-updated' && event.message?.role === 'user') {
        console.log('[Caption] New user turn detected (via session-updated), resetting panel.')
        speakerText.value = ''
        assistantSegments.value = []
      }
    })

    // Synchronize spatial follow with dashboard toggle
    watch(() => settingsStore.captionFollowStage, (shouldFollow) => {
      console.log('[Caption] Follow status changed:', shouldFollow)
      attached.value = shouldFollow
      setFollowWindow(shouldFollow)
    }, { immediate: true })

    // Listen for Layout Mode transitions
    watch(() => settingsStore.captionLayoutMode, (mode) => {
      console.log('[Caption] Layout mode changed:', mode)
      // Future: Implement multi-turn historical view
    }, { immediate: true })

    // Listen for Home Snap triggers
    watch(() => settingsStore.captionResetTrigger, () => {
      console.log('[Caption] Reset Position triggered.')
      // Recovery logic: re-attach if it was detached and lost
      if (!settingsStore.captionFollowStage) {
        settingsStore.captionFollowStage = true
      }
    })

    // Update texts from broadcast channel
    watch(data, (event) => {
      console.log('[Caption] Received event (overlay):', event)
      if (!event)
        return

      if (event.type === 'caption-speaker') {
        speakerText.value = event.text
      }
      else if (event.type === 'caption-assistant') {
        // Fallback reset for when assistant sends a reset signal
        if (!event.segments || event.segments.length === 0) {
          speakerText.value = ''
          assistantSegments.value = []
        }
        else {
          assistantSegments.value = event.segments
        }
      }
    }, { immediate: true })
  }
  catch {}
})

// Auto-scroll to bottom when text segments change
watch(assistantSegments, () => {
  if (scrollContainer.value) {
    // Delay slightly to allow DOM to update
    setTimeout(() => {
      scrollContainer.value?.scrollTo({
        top: scrollContainer.value.scrollHeight,
        behavior: 'smooth',
      })
    }, 10)
  }
}, { deep: true })

const containerStyle = computed(() => ({
  backgroundColor: `rgba(0, 0, 0, ${settingsStore.captionOpacity / 100})`,
  transform: `scale(${settingsStore.captionFontSize / 100})`,
  transformOrigin: settingsStore.captionDocking === 'top' ? 'top center' : 'bottom center',
}))
</script>

<template>
  <div
    :class="[
      'pointer-events-none relative h-full w-full flex justify-center overflow-hidden',
      settingsStore.captionDocking === 'top' ? 'items-start' : 'items-end',
    ]"
  >
    <!-- Content Wrapper (Clean) -->
    <div
      ref="scrollContainer"
      :class="[
        'w-full h-full flex justify-center overflow-y-auto scrollbar-hide',
        settingsStore.captionDocking === 'top' ? 'items-start pt-1' : 'items-end pb-1',
      ]"
    >
      <div
        :class="[
          (!settingsStore.showCaptions || shouldFadeOnCursorWithin) ? 'op-0' : 'op-100',
          'relative select-none rounded-xl px-3 py-2',
          'pointer-events-none', // Text is always click-through
          'backdrop-blur-sm',
          'transition-all duration-300 ease-in-out my-2',
        ]"
        :style="containerStyle"
      >
        <div class="max-w-[80vw] flex flex-col gap-1">
          <div
            v-if="speakerText"
            class="rounded-md px-2 py-1 text-[1.1rem] text-neutral-50 font-medium text-shadow-lg text-shadow-color-neutral-900/60"
          >
            {{ speakerText }}
          </div>
          <div
            v-if="assistantSegments.length > 0"
            class="rounded-md px-2 py-1 text-[1.25rem] font-semibold leading-relaxed text-shadow-lg"
            style="white-space: pre-wrap;"
          >
            <span
              v-for="(segment, idx) in assistantSegments"
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
          </div>
        </div>
      </div>
    </div>

    <!-- Drag Handle: only visible when detached and hovering the window area -->
    <Transition
      enter-active-class="transition-opacity duration-250 ease-in-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-250 ease-in-out"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="!attached && shouldFadeOnCursorWithin"
        class="[-webkit-app-region:drag] pointer-events-auto absolute left-1/2 top-4 h-[14px] w-[36px] border border-[rgba(125,125,125,0.35)] rounded-[10px] bg-[rgba(125,125,125,0.75)] backdrop-blur-[6px] -translate-x-1/2"
        title="Drag to move"
        @mouseenter="handleHandleMouseEnter"
        @mouseleave="handleHandleMouseLeave"
      >
        <div class="absolute left-1/2 top-1/2 h-[3px] w-4 rounded-full bg-[rgba(255,255,255,0.85)] -translate-x-1/2 -translate-y-1/2" />
      </div>
    </Transition>

    <Transition
      enter-active-class="transition-opacity duration-250 ease-in-out"
      enter-from-class="opacity-50"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-250 ease-in-out"
      leave-from-class="opacity-100"
      leave-to-class="opacity-50"
    >
      <div v-if="isAroundWindowBorderFor250Ms" class="pointer-events-none absolute left-0 top-0 z-999 h-full w-full">
        <div
          :class="[
            'b-primary/50',
            'h-full w-full animate-flash animate-duration-3s animate-count-infinite b-4 rounded-2xl',
          ]"
        />
      </div>
    </Transition>
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

<route lang="yaml">
meta:
  layout: stage
</route>
