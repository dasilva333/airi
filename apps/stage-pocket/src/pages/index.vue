<script setup lang="ts">
import type { VoiceInputBinding } from '@proj-airi/stage-ui/libs/audio'
import type { ChatProvider } from '@xsai-ext/providers/utils'

import InteractiveArea from '@proj-airi/stage-layouts/components/Layouts/InteractiveArea.vue'
import MobileHeader from '@proj-airi/stage-layouts/components/Layouts/MobileHeader.vue'
import MobileWhisperSheet from '@proj-airi/stage-layouts/components/Layouts/MobileWhisperSheet.vue'
import MobileWorkspaceSheet from '@proj-airi/stage-layouts/components/Layouts/MobileWorkspaceSheet.vue'
import workletUrl from '@proj-airi/stage-ui/workers/vad/process.worklet?worker&url'

import { BackgroundProvider } from '@proj-airi/stage-layouts/components/Backgrounds/index'
import { useBackgroundThemeColor } from '@proj-airi/stage-layouts/composables/theme-color'
import { useBackgroundStore } from '@proj-airi/stage-layouts/stores/background'
import { ControlStrip, FloatingWidgetsLayer } from '@proj-airi/stage-ui/components'
import { WidgetStage } from '@proj-airi/stage-ui/components/scenes'
import { useAudioRecorder } from '@proj-airi/stage-ui/composables/audio/audio-recorder'
import { createVoiceInputBinding } from '@proj-airi/stage-ui/libs/audio'
import { useVAD } from '@proj-airi/stage-ui/stores/ai/models/vad'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useHearingSpeechInputPipeline, useHearingStore } from '@proj-airi/stage-ui/stores/modules/hearing'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettings, useSettingsAudioDevice, useSettingsControlStrip } from '@proj-airi/stage-ui/stores/settings'
import { usePositioningStore } from '@proj-airi/stage-ui/stores/settings/positioning'
import { breakpointsTailwind, useBreakpoints, useMediaQuery, useMouse } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'

defineOptions({
  name: 'IndexScenePage',
})

const router = useRouter()

const paused = ref(false)

function handleSettingsOpen(open: boolean) {
  paused.value = open
}

const positionCursor = useMouse()
const breakpoints = useBreakpoints(breakpointsTailwind)
const isLandscape = useMediaQuery('(orientation: landscape)')
const isPortraitMobile = computed(() => breakpoints.smaller('md').value && !isLandscape.value)

const positioningStore = usePositioningStore()
const settingsStore = useSettings()
const controlStripStore = useSettingsControlStrip()
const { stageModelSelected, stageModelRenderer } = storeToRefs(settingsStore)
const { dockedEdge, workspaceOpen } = storeToRefs(controlStripStore)

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

onMounted(() => {
  syncBackgroundTheme()

  if (typeof window !== 'undefined') {
    const handleOpenSettings = (e: Event) => {
      const route = (e as CustomEvent).detail?.route
      if (route) {
        void router.push(route)
      }
    }
    window.addEventListener('control-strip:open-settings', handleOpenSettings as EventListener)
    onUnmounted(() => {
      window.removeEventListener('control-strip:open-settings', handleOpenSettings as EventListener)
    })
  }
})

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

const hearingStore = useHearingStore()
const { vadThreshold } = storeToRefs(hearingStore)

const {
  init: initVAD,
  dispose: disposeVAD,
  start: startVAD,
  loaded: vadLoaded,
} = useVAD(workletUrl, {
  threshold: vadThreshold,
  onSpeechStart: () => handleSpeechStart(),
  onSpeechEnd: () => handleSpeechEnd(),
})

let stopOnStopRecord: (() => void) | undefined
let currentBinding: VoiceInputBinding | undefined

async function sendVoiceInputTextToChat(text: string | undefined) {
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
}

async function startAudioInteraction(binding: VoiceInputBinding) {
  currentBinding = binding
  if (binding.mode === 'stream') {
    await transcribeForMediaStream(binding.stream, {
      onSentenceEnd: (delta) => {
        if (currentBinding === binding) {
          void sendVoiceInputTextToChat(delta)
        }
      },
    })
    return
  }

  try {
    await initVAD()
    if (!vadLoaded.value)
      return
    if (currentBinding !== binding)
      return

    await startVAD(binding.stream)

    stopOnStopRecord = onStopRecord(async (recording) => {
      const text = await transcribeForRecording(recording)
      if (currentBinding === binding) {
        await sendVoiceInputTextToChat(text)
      }
    })
  }
  catch (e) {
    console.error('Audio interaction init failed:', e)
  }
}

let vadMaxUtteranceTimeout: ReturnType<typeof setTimeout> | undefined

function clearVadSafetyTimeout() {
  if (vadMaxUtteranceTimeout) {
    clearTimeout(vadMaxUtteranceTimeout)
    vadMaxUtteranceTimeout = undefined
  }
}

async function handleSpeechStart() {
  if (currentBinding?.mode === 'stream') {
    return
  }

  clearVadSafetyTimeout()
  vadMaxUtteranceTimeout = setTimeout(() => {
    console.warn('[Main Page] VAD speech duration exceeded safety limit (30s), forcing handleSpeechEnd()')
    void handleSpeechEnd()
  }, 30_000)

  startRecord()
}

async function handleSpeechEnd() {
  clearVadSafetyTimeout()

  if (currentBinding?.mode === 'stream') {
    return
  }

  stopRecord()
}

async function stopAudioInteraction() {
  currentBinding = undefined
  try {
    clearVadSafetyTimeout()
    stopOnStopRecord?.()
    stopOnStopRecord = undefined
    await stopStreamingTranscription(true)
    disposeVAD()
  }
  catch {}
}

const voiceInputBinding = createVoiceInputBinding({
  start: startAudioInteraction,
  stop: stopAudioInteraction,
})

watch([enabled, stream, supportsStreamInput], ([isEnabled, currentStream, supportsStream]) => {
  const binding: VoiceInputBinding | undefined = isEnabled && currentStream
    ? { stream: currentStream, mode: supportsStream ? 'stream' : 'recording' }
    : undefined
  void voiceInputBinding.update(binding).catch((error) => {
    console.error('Audio interaction failed:', error)
  })
}, { immediate: true })

onUnmounted(() => {
  void voiceInputBinding.update().catch(error => console.error('Failed to stop audio interaction:', error))
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
        <ControlStrip mode="mobile" class="z-45" />

        <InteractiveArea
          v-if="!isPortraitMobile"
          :class="[
            'absolute h-[85dvh] max-w-[500px] min-w-[30%] flex flex-1 flex-col transition-all duration-300 ease-out z-10',
            dockedEdge === 'left' ? 'right-6' : 'left-6',
          ]"
        />
        <!-- In-Page Floating Generative Widgets Layer -->
        <FloatingWidgetsLayer />
        <MobileWhisperSheet v-if="isPortraitMobile" @settings-open="handleSettingsOpen" />
        <MobileWorkspaceSheet v-if="workspaceOpen" @close="workspaceOpen = false" />
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
