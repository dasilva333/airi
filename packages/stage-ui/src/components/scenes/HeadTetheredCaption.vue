<script setup lang="ts">
import { useLive2d } from '@proj-airi/stage-ui-live2d'
import { attachLive2DHeadTetheredCaption } from '@proj-airi/stage-ui-live2d/composables/live2d'
import { storeToRefs } from 'pinia'
import { onBeforeUnmount, ref, watch } from 'vue'

import { useSettings } from '../../stores/settings'

const props = defineProps<{
  /**
   * Live2D scene component instance (from `RendererStage.vue`). The caption
   * polls `live2dApp()` lazily because the PIXI canvas boots asynchronously
   * after the model is mounted.
   */
  live2dSceneRef?: {
    live2dApp?: () => unknown
  } | null
  /** Bubble text. Fixed placeholder for MVP — Sentence Sync replaces it later. */
  text?: string
}>()

/**
 * Head-tethered caption plank (in-scene speech bubble).
 *
 * Renders a comic-style bubble inside the active model's renderer stage and
 * lets a per-renderer adapter drive its position/skew based on the model's
 * pose each frame. Independent of the existing windowed caption system.
 *
 * MVP scope: Live2D only, fixed placeholder text, no in-scene drag-to-offset.
 * VRM/Spine/MMD branches intentionally no-op when the toggle is on.
 */

const TAG = '[HeadTetheredCaption]'

const settingsStore = useSettings()
const live2dStore = useLive2d()
const { model } = storeToRefs(live2dStore)

const detachAdapter = ref<(() => void) | null>(null)
// Polls `live2dApp()` until the PIXI canvas is available; cleared on detach.
const appPollTimer = ref<ReturnType<typeof setInterval> | null>(null)

function clearAppPoll() {
  if (appPollTimer.value !== null) {
    clearInterval(appPollTimer.value)
    appPollTimer.value = null
  }
}

function detach(reason: string) {
  console.info(TAG, 'detach', { reason })
  clearAppPoll()
  detachAdapter.value?.()
  detachAdapter.value = null
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
    detachAdapter.value = attachLive2DHeadTetheredCaption({
      app: app as any,
      model: currentModel,
      text: props.text ?? 'Hello there! ✨ Floating with AIRI! 💖🌸',
      followStrength: settingsStore.headTetheredCaptionFollowStrength,
      offset: settingsStore.headTetheredCaptionOffset,
    })
    console.info(TAG, 'attached', {
      followStrength: settingsStore.headTetheredCaptionFollowStrength,
      offset: settingsStore.headTetheredCaptionOffset,
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
  if (detachAdapter.value)
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
