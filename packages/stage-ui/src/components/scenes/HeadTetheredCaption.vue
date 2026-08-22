<script setup lang="ts">
import type { AttachLive2DHeadTetheredCaptionResult } from '@proj-airi/stage-ui-live2d/composables/live2d'

import { subChunkText } from '@proj-airi/stage-shared/utils/caption-sentiment'
import { useLive2d } from '@proj-airi/stage-ui-live2d'
import { attachLive2DHeadTetheredCaption } from '@proj-airi/stage-ui-live2d/composables/live2d'
import { useBroadcastChannel } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { onBeforeUnmount, ref, watch } from 'vue'

import { useSettings } from '../../stores/settings'

interface CaptionSegment {
  text: string
  color?: string
  actorId?: string
  isActive?: boolean
}

const props = defineProps<{
  /**
   * Live2D scene component instance (from `RendererStage.vue`). The caption
   * polls `live2dApp()` lazily because the PIXI canvas boots asynchronously
   * after the model is mounted.
   */
  live2dSceneRef?: {
    live2dApp?: () => unknown
  } | null
  /** Bubble text. Default state: Hello there! ✨ Floating with AIRI! 💖🌸 */
  text?: string
}>()

const TAG = '[HeadTetheredCaption]'

const settingsStore = useSettings()
const live2dStore = useLive2d()
const { model } = storeToRefs(live2dStore)

const attachedInstance = ref<AttachLive2DHeadTetheredCaptionResult | null>(null)
// Polls `live2dApp()` until the PIXI canvas is available; cleared on detach.
const appPollTimer = ref<ReturnType<typeof setInterval> | null>(null)

// Sentence Sync state: default to initial text, persist last active state once updated
const defaultText = props.text ?? 'Hello there! ✨ Floating with AIRI! 💖🌸'
const currentCaptionText = ref(defaultText)
const currentCaptionColor = ref<string | undefined>(undefined)

let pacerTimer: ReturnType<typeof setTimeout> | null = null
let currentSegmentText = ''

function clearPacer() {
  if (pacerTimer) {
    clearTimeout(pacerTimer)
    pacerTimer = null
  }
}

function startPacingSubChunks(subChunks: string[], index: number, color?: string) {
  clearPacer()
  if (index >= subChunks.length)
    return

  const activeChunk = subChunks[index]
  currentCaptionText.value = activeChunk
  currentCaptionColor.value = color
  attachedInstance.value?.updateText(activeChunk, color)

  // If there are remaining sub-chunks, schedule the next step based on reading speed (~16 chars/sec, min 1.5s)
  if (index < subChunks.length - 1) {
    const chars = activeChunk.length
    const durationMs = Math.max(1500, Math.round((chars / 16) * 1000))
    pacerTimer = setTimeout(() => {
      startPacingSubChunks(subChunks, index + 1, color)
    }, durationMs)
  }
}

// Sentence Sync BroadcastChannel listener
const { data: captionChannelData } = useBroadcastChannel<any, any>({ name: 'airi-caption-overlay' })

watch(captionChannelData, (evt) => {
  if (!evt || typeof evt !== 'object')
    return

  if (evt.type === 'caption-assistant' && Array.isArray(evt.segments)) {
    const activeSegment = (evt.segments as CaptionSegment[]).find(s => s?.isActive)
    if (activeSegment?.text && activeSegment.text !== currentSegmentText) {
      currentSegmentText = activeSegment.text
      const subChunks = subChunkText(activeSegment.text, 80)
      startPacingSubChunks(subChunks, 0, activeSegment.color)
    }
    // Falsy / inactive payloads are ignored to persist the last spoken state
  }
})

function clearAppPoll() {
  if (appPollTimer.value !== null) {
    clearInterval(appPollTimer.value)
    appPollTimer.value = null
  }
}

function detach(reason: string) {
  console.info(TAG, 'detach', { reason })
  clearAppPoll()
  clearPacer()
  attachedInstance.value?.detach()
  attachedInstance.value = null
}

function tryAttach(): boolean {
  const currentModel = model.value
  if (!currentModel) {
    console.info(TAG, 'attach deferred — model not loaded yet')
    return false
  }
  if (!props.live2dSceneRef || typeof props.live2dSceneRef.live2dApp !== 'function') {
    console.warn(TAG, 'live2dSceneRef missing or live2dApp not exposed')
    return false
  }
  const app = props.live2dSceneRef.live2dApp()
  if (!app) {
    console.info(TAG, 'attach deferred — pixi app not yet available')
    return false
  }

  try {
    attachedInstance.value = attachLive2DHeadTetheredCaption({
      app: app as any,
      model: currentModel,
      text: currentCaptionText.value,
      followStrength: settingsStore.headTetheredCaptionFollowStrength,
      offset: settingsStore.headTetheredCaptionOffset,
    })
    // Apply initial accent color if available
    if (currentCaptionColor.value)
      attachedInstance.value.updateText(currentCaptionText.value, currentCaptionColor.value)

    console.info(TAG, 'attached', {
      followStrength: settingsStore.headTetheredCaptionFollowStrength,
      offset: settingsStore.headTetheredCaptionOffset,
      text: currentCaptionText.value,
    })
    return true
  }
  catch (err) {
    console.error(TAG, 'attach failed', err)
    return false
  }
}

function scheduleAttach() {
  // Already attached — do nothing.
  if (attachedInstance.value)
    return

  // Try immediately in case the model + canvas are already hot.
  if (tryAttach())
    return

  // Otherwise poll until the canvas boots. Ticker cadence is fine — attach
  // is idempotent and only one interval is ever live.
  clearAppPoll()
  appPollTimer.value = setInterval(() => {
    if (!settingsStore.headTetheredCaptionEnabled) {
      clearAppPoll()
      return
    }
    if (tryAttach()) {
      clearAppPoll()
      console.info(TAG, 'attached after poll')
    }
  }, 250)
}

watch(
  () => [model.value, settingsStore.headTetheredCaptionEnabled, props.live2dSceneRef] as const,
  ([currentModel, enabled]) => {
    if (!enabled) {
      detach('toggle disabled')
      return
    }
    if (!currentModel) {
      console.info(TAG, 'watch: enabled but no live2d model loaded')
      detach('no model')
      return
    }
    // Detach any prior attach and re-attach against the new model instance.
    detach('re-attach')
    scheduleAttach()
  },
  { immediate: true },
)

onBeforeUnmount(() => detach('unmount'))
</script>

<template>
  <!--
    Plank is rendered into PIXI directly by the adapter; the host template is
    intentionally empty. Its presence in the Vue tree manages the lifecycle.
  -->
  <span hidden aria-hidden="true" />
</template>
