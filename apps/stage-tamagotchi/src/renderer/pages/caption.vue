<script setup lang="ts">
import CaptionPanel from '@proj-airi/stage-ui/components/scenes/CaptionPanel.vue'

import { defineInvoke } from '@moeru/eventa'
import { useElectronEventaContext, useElectronEventaInvoke, useElectronMouseAroundWindowBorder, useElectronMouseInElement, useElectronMouseInWindow } from '@proj-airi/electron-vueuse'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { refDebounced } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'

import {
  captionFollowStagePositionChanged,
  captionFollowStageVisibilityChanged,
  captionGetFollowStagePosition,
  captionGetFollowStageVisibility,
  electron,
  electronCaptionSetFollowStagePosition,
  electronCaptionSetFollowStageVisibility,
  electronCaptionToggleVisibility,
} from '../../shared/eventa'

const setIgnoreMouseEvents = useElectronEventaInvoke(electron.window.setIgnoreMouseEvents)
const setFollowStagePosition = useElectronEventaInvoke(electronCaptionSetFollowStagePosition)
const setFollowStageVisibility = useElectronEventaInvoke(electronCaptionSetFollowStageVisibility)
const toggleVisibility = useElectronEventaInvoke(electronCaptionToggleVisibility)

const followsStagePosition = ref(true)
const followsStageVisibility = ref(true)
const settingsStore = useSettings()

const { isOutside: isOutsideWindow } = useElectronMouseInWindow()
const isOutsideWindowFor250Ms = refDebounced(isOutsideWindow, 250)
const shouldFadeOnCursorWithin = computed(() => !isOutsideWindowFor250Ms.value)

const dragHandleRef = ref<HTMLElement | null>(null)
const { isOutside: isOutsideDragHandle } = useElectronMouseInElement(dragHandleRef)

const { isNearAnyBorder: isAroundWindowBorder } = useElectronMouseAroundWindowBorder({ threshold: 15 })
const isAroundWindowBorderFor250Ms = refDebounced(isAroundWindowBorder, 250)

const isInteractiveArea = computed(() => !isOutsideDragHandle.value || isAroundWindowBorder.value)

// NOTICE: We intentionally debounce the transition BACK to ignoreMouseEvents=true.
// If we flip ignore on/off synchronously as the cursor grazes the resize border,
// the OS window-resize drag handler never gets a clean latch, causing the resize to stutter.
// Entering interactive (ignore=false) must be immediate; leaving gets a 600ms grace window.
let reEnableIgnoreTimer: ReturnType<typeof setTimeout> | null = null

function applyIgnore(interactive: boolean) {
  if (interactive) {
    // Cursor entered interactive area — immediately enable mouse events
    if (reEnableIgnoreTimer !== null) {
      clearTimeout(reEnableIgnoreTimer)
      reEnableIgnoreTimer = null
    }
    setIgnoreMouseEvents([false, { forward: true }])
  }
  else {
    // Cursor left interactive area — wait 600ms before re-enabling click-through
    // so in-progress resize/drag ops can complete without interruption
    if (reEnableIgnoreTimer !== null)
      return
    reEnableIgnoreTimer = setTimeout(() => {
      reEnableIgnoreTimer = null
      setIgnoreMouseEvents([true, { forward: true }])
    }, 600)
  }
}

watch(isInteractiveArea, applyIgnore, { immediate: true })

const context = useElectronEventaContext()
const getFollowPosition = defineInvoke(context.value, captionGetFollowStagePosition)
const getFollowVisibility = defineInvoke(context.value, captionGetFollowStageVisibility)

onMounted(async () => {
  try {
    followsStagePosition.value = Boolean(await getFollowPosition())
    followsStageVisibility.value = Boolean(await getFollowVisibility())
  }
  catch {}

  try {
    context.value.on(captionFollowStagePositionChanged, (event) => {
      followsStagePosition.value = Boolean(event?.body)
    })
    context.value.on(captionFollowStageVisibilityChanged, (event) => {
      followsStageVisibility.value = Boolean(event?.body)
    })
  }
  catch {}

  try {
    // Synchronize position follow with settings store
    watch(() => settingsStore.captionFollowStagePosition, (shouldFollow) => {
      console.log('[Caption] Follow stage position changed:', shouldFollow)
      followsStagePosition.value = shouldFollow
      setFollowStagePosition(shouldFollow)
    }, { immediate: true })

    // Synchronize visibility follow with settings store
    watch(() => settingsStore.captionFollowStageVisibility, (shouldFollow) => {
      console.log('[Caption] Follow stage visibility changed:', shouldFollow)
      followsStageVisibility.value = shouldFollow
      setFollowStageVisibility(shouldFollow)
    }, { immediate: true })

    // Listen for Layout Mode transitions
    watch(() => settingsStore.captionLayoutMode, (mode) => {
      console.log('[Caption] Layout mode changed:', mode)
    }, { immediate: true })

    // Listen for Home Snap triggers
    watch(() => settingsStore.captionResetTrigger, () => {
      console.log('[Caption] Reset Position triggered.')
      if (!settingsStore.captionFollowStagePosition) {
        settingsStore.captionFollowStagePosition = true
      }
    })
  }
  catch {}
})
</script>

<template>
  <div
    :class="[
      'pointer-events-none relative h-full w-full flex justify-center overflow-hidden',
      settingsStore.captionDocking === 'top' ? 'items-start' : 'items-end',
    ]"
  >
    <!-- Modular Caption Panel -->
    <CaptionPanel
      :show-active-sentence-only="settingsStore.captionLayoutMode === 'single'"
      :fade-on-cursor="shouldFadeOnCursorWithin"
    />

    <!-- Always-visible drag handle pill — shown when free-floating (none/head), hidden when edge-docked (top/bottom) -->
    <div
      v-if="settingsStore.captionDocking !== 'top' && settingsStore.captionDocking !== 'bottom'"
      class="pointer-events-auto absolute bottom-1 left-1/2 z-50 -translate-x-1/2"
    >
      <!-- NOTICE: [-webkit-app-region:drag] cannot be applied via UnoCSS since it requires
           Electron to treat this element as a native drag region. Must use inline style. -->
      <div
        class="h-[6px] w-9 cursor-grab border border-white/10 rounded-full bg-white/30 shadow-sm backdrop-blur-sm active:cursor-grabbing dark:border-white/10 dark:bg-white/20"
        style="-webkit-app-region: drag;"
        title="Drag to Reposition"
      />
    </div>

    <!-- Floating Drag & Visibility Controls (fades in on hover) -->
    <Transition
      enter-active-class="transition-opacity duration-250 ease-in-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-250 ease-in-out"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="shouldFadeOnCursorWithin"
        ref="dragHandleRef"
        :class="[
          'pointer-events-auto absolute right-2.5 top-2.5 z-50',
        ]"
      >
        <div class="flex items-center gap-0.5 border border-neutral-200/50 rounded-lg bg-white/80 p-0.5 shadow-sm backdrop-blur-md dark:border-neutral-800/40 dark:bg-neutral-900/70">
          <!-- Drag Handle Button (in corner toolbar) -->
          <button
            class="text-neutral-850 size-6 flex cursor-pointer items-center justify-center rounded-md transition-all duration-200 active:scale-95 hover:bg-neutral-200/60 dark:text-neutral-200 dark:hover:bg-neutral-700/60"
            title="Drag to Reposition"
            @mousedown="setIgnoreMouseEvents([false, { forward: true }])"
          >
            <!-- NOTICE: [-webkit-app-region:drag] cannot be applied via UnoCSS since it requires
                 Electron to treat this element as a native drag region. Must use inline style. -->
            <div
              class="i-ph:arrows-out-cardinal size-3.5"
              style="-webkit-app-region: drag;"
            />
          </button>
          <!-- Quick Hide Button -->
          <button
            class="text-neutral-850 size-6 flex cursor-pointer items-center justify-center rounded-md transition-all duration-200 active:scale-95 hover:bg-neutral-200/60 dark:text-neutral-200 dark:hover:bg-neutral-700/60"
            title="Hide Captions"
            @click="toggleVisibility(false)"
          >
            <div class="i-ph:eye-slash size-3.5" />
          </button>
        </div>
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
