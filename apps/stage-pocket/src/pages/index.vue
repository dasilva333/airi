<script setup lang="ts">
import type { ChatProvider } from '@xsai-ext/providers/utils'

import InteractiveArea from '@proj-airi/stage-layouts/components/Layouts/InteractiveArea.vue'
import MobileHeader from '@proj-airi/stage-layouts/components/Layouts/MobileHeader.vue'
import MobileWhisperSheet from '@proj-airi/stage-layouts/components/Layouts/MobileWhisperSheet.vue'
import workletUrl from '@proj-airi/stage-ui/workers/vad/process.worklet?worker&url'

import { BackgroundProvider } from '@proj-airi/stage-layouts/components/Backgrounds/index'
import { useBackgroundThemeColor } from '@proj-airi/stage-layouts/composables/theme-color'
import { useBackgroundStore } from '@proj-airi/stage-layouts/stores/background'
import { ControlStrip } from '@proj-airi/stage-ui/components'
import { WidgetStage } from '@proj-airi/stage-ui/components/scenes'
import { useAudioRecorder } from '@proj-airi/stage-ui/composables/audio/audio-recorder'
import { useVAD } from '@proj-airi/stage-ui/stores/ai/models/vad'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useHearingSpeechInputPipeline } from '@proj-airi/stage-ui/stores/modules/hearing'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettings, useSettingsAudioDevice } from '@proj-airi/stage-ui/stores/settings'
import { usePositioningStore } from '@proj-airi/stage-ui/stores/settings/positioning'
import { breakpointsTailwind, useBreakpoints, useMouse } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'

defineOptions({
  name: 'IndexScenePage',
})

const paused = ref(false)

function handleSettingsOpen(open: boolean) {
  paused.value = open
}

const positionCursor = useMouse()
const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = breakpoints.smaller('md')

const positioningStore = usePositioningStore()
const settingsStore = useSettings()
const { stageModelSelected, stageModelRenderer } = storeToRefs(settingsStore)

const computedScale = computed(() => {
  const key = stageModelSelected.value || 'global'
  return positioningStore.getPosition(key).scale
})

const computedXOffset = computed(() => {
  const key = stageModelSelected.value || 'global'
  return positioningStore.getPosition(key).x
})

const computedYOffset = computed(() => {
  const key = stageModelSelected.value || 'global'
  const y = positioningStore.getPosition(key).y
  if (stageModelRenderer.value === 'live2d') {
    return -y
  }
  return y
})

function handleScaleChange(newScale: number) {
  const key = stageModelSelected.value || 'global'
  const current = positioningStore.getPosition(key)
  positioningStore.setPosition(key, { ...current, scale: newScale })
}

function handleOffsetChange(offset: { x: number, y: number }) {
  const key = stageModelSelected.value || 'global'
  const current = positioningStore.getPosition(key)
  positioningStore.setPosition(key, {
    ...current,
    x: offset.x,
    y: stageModelRenderer.value === 'live2d' ? -offset.y : offset.y,
  })
}

const backgroundStore = useBackgroundStore()
const { selectedOption, sampledColor } = storeToRefs(backgroundStore)
const backgroundSurface = useTemplateRef<InstanceType<typeof BackgroundProvider>>('backgroundSurface')

const { syncBackgroundTheme } = useBackgroundThemeColor({ backgroundSurface, selectedOption, sampledColor })
onMounted(() => syncBackgroundTheme())

// Audio + transcription pipeline (mirrors stage-tamagotchi)
const settingsAudioDeviceStore = useSettingsAudioDevice()
const { stream, enabled } = storeToRefs(settingsAudioDeviceStore)
const { startRecord, stopRecord, onStopRecord } = useAudioRecorder(stream)
const hearingPipeline = useHearingSpeechInputPipeline()
const { transcribeForRecording, transcribeForMediaStream, stopStreamingTranscription } = hearingPipeline
const { supportsStreamInput } = storeToRefs(hearingPipeline)
const providersStore = useProvidersStore()
const consciousnessStore = useConsciousnessStore()
const { activeProvider: activeChatProvider, activeModel: activeChatModel } = storeToRefs(consciousnessStore)
const chatStore = useChatOrchestratorStore()

const shouldUseStreamInput = computed(() => supportsStreamInput.value && !!stream.value)

const {
  init: initVAD,
  dispose: disposeVAD,
  start: startVAD,
  loaded: vadLoaded,
} = useVAD(workletUrl, {
  threshold: ref(0.6),
  onSpeechStart: () => handleSpeechStart(),
  onSpeechEnd: () => handleSpeechEnd(),
})

let stopOnStopRecord: (() => void) | undefined

async function startAudioInteraction() {
  try {
    await initVAD()
    if (stream.value)
      await startVAD(stream.value)

    // Hook once
    stopOnStopRecord = onStopRecord(async (recording) => {
      const text = await transcribeForRecording(recording)
      if (!text || !text.trim())
        return

      try {
        const provider = await providersStore.getProviderInstance(activeChatProvider.value)
        if (!provider || !activeChatModel.value)
          return

        await chatStore.ingest(text, { model: activeChatModel.value, chatProvider: provider as ChatProvider })
      }
      catch (err) {
        console.error('Failed to send chat from voice:', err)
      }
    })
  }
  catch (e) {
    console.error('Audio interaction init failed:', e)
  }
}

async function handleSpeechStart() {
  if (shouldUseStreamInput.value && stream.value) {
    // Use both callbacks to support incremental updates and final transcript replacement.
    // ChatArea uses only onSentenceEnd to avoid re-adding deleted text.
    await transcribeForMediaStream(stream.value, {
      onSentenceEnd: (delta) => {
        const finalText = delta
        if (!finalText || !finalText.trim()) {
          return
        }

        void (async () => {
          try {
            const provider = await providersStore.getProviderInstance(activeChatProvider.value)
            if (!provider || !activeChatModel.value)
              return

            await chatStore.ingest(finalText, { model: activeChatModel.value, chatProvider: provider as ChatProvider })
          }
          catch (err) {
            console.error('Failed to send chat from voice:', err)
          }
        })()
      },
    })
    return
  }

  startRecord()
}

async function handleSpeechEnd() {
  if (shouldUseStreamInput.value) {
    // Keep streaming session alive; idle timer in pipeline will handle teardown.
    return
  }

  stopRecord()
}

function stopAudioInteraction() {
  try {
    stopOnStopRecord?.()
    stopOnStopRecord = undefined
    // Stop any active streaming transcription sessions to prevent session leakage
    void stopStreamingTranscription(true)
    disposeVAD()
  }
  catch {}
}

watch(enabled, async (val) => {
  if (val) {
    await startAudioInteraction()
  }
  else {
    stopAudioInteraction()
  }
}, { immediate: true })

onUnmounted(() => {
  stopAudioInteraction()
})

watch([stream, () => vadLoaded.value], async ([s, loaded]) => {
  if (enabled.value && loaded && s) {
    try {
      await startVAD(s)
    }
    catch (e) {
      console.error('Failed to start VAD with stream:', e)
    }
  }
})
</script>

<template>
  <BackgroundProvider
    ref="backgroundSurface"
    class="widgets top-widgets"
    :background="selectedOption"
    :top-color="sampledColor"
  >
    <div class="relative z-2 h-100dvh w-100vw flex flex-col overflow-hidden py-safe">
      <!-- header -->
      <div class="relative z-50 w-full flex gap-2 px-0 py-1 md:px-3 md:py-3">
        <MobileHeader class="w-full" />
      </div>

      <!-- page -->
      <div class="relative min-h-0 flex flex-1 flex-row gap-x-2 gap-y-0 <md:flex-col">
        <WidgetStage
          class="min-h-0 min-w-1/2 flex-1"
          :paused="paused"
          :focus-at="{
            x: positionCursor.x.value,
            y: positionCursor.y.value,
          }"
          :x-offset="computedXOffset"
          :y-offset="computedYOffset"
          :scale="computedScale"
          @scale-change="handleScaleChange"
          @offset-change="handleOffsetChange"
        />
        <!-- Pinned Mobile Control Strip with 14px Edge Notch -->
        <ControlStrip mode="mobile" class="z-40" />

        <InteractiveArea v-if="!isMobile" class="absolute right-4 h-[85dvh] max-w-[500px] min-w-[30%] flex flex-1 flex-col" />
        <MobileWhisperSheet v-if="isMobile" @settings-open="handleSettingsOpen" />
      </div>
    </div>
  </BackgroundProvider>
</template>

<route lang="yaml">
name: IndexScenePage
meta:
  layout: stage
  stageTransition:
    name: bubble-wave-out
</route>
