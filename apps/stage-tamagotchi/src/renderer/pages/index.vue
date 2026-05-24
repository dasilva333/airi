<script setup lang="ts">
import type { ChatProvider } from '@xsai-ext/providers/utils'

import workletUrl from '@proj-airi/stage-ui/workers/vad/process.worklet?worker&url'

import { electron } from '@proj-airi/electron-eventa'
import {
  useElectronEventaInvoke,
  useElectronMouseInElement,
  useElectronMouseInWindow,
} from '@proj-airi/electron-vueuse'
import { useMmd } from '@proj-airi/stage-ui-mmd'
import { useCustomVrmAnimationsStore, useModelStore } from '@proj-airi/stage-ui-three'
import { WidgetStage } from '@proj-airi/stage-ui/components/scenes'
import { useAudioRecorder } from '@proj-airi/stage-ui/composables/audio/audio-recorder'
import { useVAD } from '@proj-airi/stage-ui/stores/ai/models/vad'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useLive2d } from '@proj-airi/stage-ui/stores/live2d'
import { useLLM } from '@proj-airi/stage-ui/stores/llm'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useHearingSpeechInputPipeline, useHearingStore } from '@proj-airi/stage-ui/stores/modules/hearing'
import { useLiveSessionStore } from '@proj-airi/stage-ui/stores/modules/live-session'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettings, useSettingsAudioDevice, useSettingsControlsIsland, useSettingsControlStrip } from '@proj-airi/stage-ui/stores/settings'
import { usePositioningStore } from '@proj-airi/stage-ui/stores/settings/positioning'
import { useBroadcastChannel, useColorMode } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import { toast } from 'vue-sonner'

import {
  electronApplySizePreset,
  electronAppQuit,
  electronCaptionSyncDocking,
  electronCaptionToggleVisibility,
  electronControlStripSyncState,
  electronCustomizerToggleVisibility,
  electronGetMainWindowConfig,
  electronOpenChat,
  electronOpenSettings,
  electronStageSetAlwaysOnTop,
  electronStageToggleVisibility,
  electronStartDraggingWindow,
} from '../../shared/eventa'
import { builtinTools } from '../stores/tools/builtin'
import { useWindowStore } from '../stores/window'

const widgetStageRef = ref<InstanceType<typeof WidgetStage>>()
const tools = ref<any[]>([])
const controlStripRoot = computed(() => widgetStageRef.value?.controlStripElement)
const componentStateStage = ref<'pending' | 'loading' | 'mounted'>('pending')

const openChat = useElectronEventaInvoke(electronOpenChat)
const openSettings = useElectronEventaInvoke(electronOpenSettings)
const toggleCaptionVisibility = useElectronEventaInvoke(electronCaptionToggleVisibility)
const toggleCustomizerVisibility = useElectronEventaInvoke(electronCustomizerToggleVisibility)
const setAlwaysOnTop = useElectronEventaInvoke(electronStageSetAlwaysOnTop)
const quitApp = useElectronEventaInvoke(electronAppQuit)
const syncCaptionDocking = useElectronEventaInvoke(electronCaptionSyncDocking)
const startDraggingWindow = useElectronEventaInvoke(electronStartDraggingWindow)
const getBounds = useElectronEventaInvoke(electron.window.getBounds)
const setBounds = useElectronEventaInvoke(electron.window.setBounds)
const syncControlStripState = useElectronEventaInvoke(electronControlStripSyncState)
const applySizePreset = useElectronEventaInvoke(electronApplySizePreset)
const getMainWindowConfig = useElectronEventaInvoke(electronGetMainWindowConfig)
const setIgnoreMouseEvents = useElectronEventaInvoke(electron.window.setIgnoreMouseEvents)

const colorMode = useColorMode()
const modelStore = useModelStore()

const isLoading = ref(true)

const isIgnoringMouseEvents = ref(false)

const { isOutside: isOutsideWindow } = useElectronMouseInWindow()
const { isOutside: isOutsideControlStrip } = useElectronMouseInElement(controlStripRoot)
const isOutside = computed(() => isOutsideControlStrip.value)
const isOutsideForInstant = isOutside

const { stageModelRenderer, stageModelSelected } = storeToRefs(useSettings())

const llmStore = useLLM()
const providersStore = useProvidersStore()
const consciousnessStore = useConsciousnessStore()
const { activeProvider: activeChatProvider, activeModel: activeChatModel } = storeToRefs(consciousnessStore)

watch([activeChatProvider, activeChatModel], async () => {
  if (activeChatProvider.value && activeChatModel.value) {
    console.info('[Main Page] Discovering tools compatibility for:', activeChatModel.value)
    const provider = await providersStore.getProviderInstance<ChatProvider>(activeChatProvider.value)
    if (provider) {
      await llmStore.discoverToolsCompatibility(activeChatModel.value, provider, [])
    }
  }
}, { immediate: true })

const { stageViewControlsEnabled, alwaysOnTop } = storeToRefs(useSettings())
const { live2dLookAtX, live2dLookAtY } = storeToRefs(useWindowStore())

const settingsStore = useSettings()
const positioningStore = usePositioningStore()
const controlStripStore = useSettingsControlStrip()
const { stageEnabled, captionOpen, collapsed } = storeToRefs(controlStripStore)
const controlsIslandStore = useSettingsControlsIsland()
const { fadeOnHoverEnabled } = storeToRefs(controlsIslandStore)
const toggleStageVisibility = useElectronEventaInvoke(electronStageToggleVisibility)
const liveSessionStore = useLiveSessionStore()

const cardStore = useAiriCardStore()
const { activeCard } = storeToRefs(cardStore)
const customVrmAnimationsStore = useCustomVrmAnimationsStore()
const vrmIdleAnimation = toRef(modelStore as any, 'vrmIdleAnimation')

watch(stageEnabled, (val) => {
  toggleStageVisibility(val)
}, { immediate: true })

watch(captionOpen, (val) => {
  toggleCaptionVisibility(val)
}, { immediate: true })

// Treat stage and caption as partners when captionFollowStage is enabled
watch(stageEnabled, (newVal) => {
  if (settingsStore.captionFollowStage) {
    if (captionOpen.value !== newVal) {
      captionOpen.value = newVal
    }
  }
})

watch(captionOpen, (newVal) => {
  if (settingsStore.captionFollowStage) {
    if (stageEnabled.value !== newVal) {
      controlStripStore.stageEnabled = newVal
    }
  }
})

watch(() => settingsStore.captionFollowStage, (newVal) => {
  if (newVal) {
    // Immediately sync caption state to stage state
    if (captionOpen.value !== stageEnabled.value) {
      captionOpen.value = stageEnabled.value
    }
  }
})

const { data: broadcastAction } = useBroadcastChannel<string, string>({ name: 'airi-control-strip-actions' })
watch(broadcastAction, (action) => {
  if (action) {
    console.info(`[Main Page] Received broadcasted control strip action: "${action}"`)
    const event = new CustomEvent('control-strip:action', { detail: { action } })
    handleControlStripAction(event)
  }
})

const computedScale = computed(() => {
  return positioningStore.getPosition(stageModelSelected.value).scale
})

const computedXOffset = computed(() => {
  return positioningStore.getPosition(stageModelSelected.value).x
})

const computedYOffset = computed(() => {
  const y = positioningStore.getPosition(stageModelSelected.value).y
  if (stageModelRenderer.value === 'live2d') {
    return -y
  }
  return y
})

function handleScaleChange(newScale: number) {
  const key = stageModelSelected.value
  const current = positioningStore.getPosition(key)
  positioningStore.setPosition(key, { ...current, scale: newScale })
}

function handleOffsetChange(offset: { x: number, y: number }) {
  const key = stageModelSelected.value
  const current = positioningStore.getPosition(key)
  positioningStore.setPosition(key, {
    ...current,
    x: offset.x,
    y: stageModelRenderer.value === 'live2d' ? -offset.y : offset.y,
  })
}

watch(componentStateStage, () => isLoading.value = componentStateStage.value !== 'mounted', { immediate: true })

// Main window control strip sizing and smart popovers state
const activePopover = ref<string | null>(null)
const lastPlacement = ref<'left' | 'right' | 'top' | 'bottom' | null>(null)
const lastOrientation = ref<'vertical' | 'horizontal'>('vertical')

const activeButtons = computed(() => {
  return controlStripStore.buttons.filter((btn: any) => btn.enabled)
})

const stripLength = computed(() => {
  if (collapsed.value) {
    return 60
  }
  const N = activeButtons.value.length
  return N === 0 ? 60 : 60 + 46 * N
})

async function applyBoundsUpdate(nextPopover: string | null, nextPlacement: 'left' | 'right' | 'top' | 'bottom') {
  const current = await getBounds()
  if (!current)
    return

  // 1. Calculate the unexpanded strip bounds from the current window bounds
  let x = current.x
  let y = current.y
  const w = lastOrientation.value === 'vertical' ? 56 : stripLength.value
  const h = lastOrientation.value === 'vertical' ? stripLength.value : 56

  if (activePopover.value) {
    const placement = lastPlacement.value || 'bottom'
    if (lastOrientation.value === 'vertical') {
      x = current.x + (placement === 'left' ? 268 : 0)
      y = current.y + (current.height - stripLength.value) / 2
    }
    else {
      x = current.x + (current.width - stripLength.value) / 2
      y = current.y + (placement === 'top' ? 280 : 0)
    }
  }

  // 2. Calculate the target window bounds
  let targetX = x
  let targetY = y
  let targetW = w
  let targetH = h

  if (nextPopover) {
    if (controlStripStore.orientation === 'vertical') {
      targetW = 324
      targetH = Math.max(336, h)
      targetX = x - (nextPlacement === 'left' ? 268 : 0)
      targetY = y - (targetH - h) / 2
    }
    else {
      targetW = Math.max(336, w)
      targetH = 336
      targetX = x - (targetW - w) / 2
      targetY = y - (nextPlacement === 'top' ? 280 : 0)
    }
  }

  await setBounds([{
    x: Math.round(targetX),
    y: Math.round(targetY),
    width: Math.round(targetW),
    height: Math.round(targetH),
  }])

  activePopover.value = nextPopover
  lastPlacement.value = nextPlacement
  lastOrientation.value = controlStripStore.orientation
}

watch([stripLength, () => controlStripStore.orientation], async ([newLength, newOrientation]) => {
  if (activePopover.value) {
    await applyBoundsUpdate(activePopover.value, lastPlacement.value || 'bottom')
  }
  else {
    const w = newOrientation === 'vertical' ? 56 : newLength
    const h = newOrientation === 'vertical' ? newLength : 56
    const current = await getBounds()
    if (current) {
      await setBounds([{
        x: current.x,
        y: current.y,
        width: w,
        height: h,
      }])
    }
    lastOrientation.value = newOrientation
  }
})

watch(
  [activePopover, lastPlacement, () => controlStripStore.orientation, stripLength],
  async ([popover, placement, orient, len]) => {
    await syncControlStripState({
      activePopover: popover,
      lastPlacement: placement || 'bottom',
      orientation: orient || 'vertical',
      stripLength: len,
    })
  },
  { immediate: true },
)

async function handleApplySizePreset(e: Event) {
  const { target, preset } = (e as CustomEvent).detail
  await applySizePreset({ target, preset })
}

const hearingDialogOpen = ref(false)
const whisperDockOpen = ref(false)

function applyTransparencyState() {
  if (hearingDialogOpen.value || whisperDockOpen.value || stageViewControlsEnabled.value || activePopover.value) {
    isIgnoringMouseEvents.value = false
    setIgnoreMouseEvents([false, { forward: true }])
    return
  }

  const insideControls = !isOutsideForInstant.value

  if (insideControls) {
    isIgnoringMouseEvents.value = false
    setIgnoreMouseEvents([false, { forward: true }])
  }
  else {
    const insideWindow = !isOutsideWindow.value
    const ignore = insideWindow
    isIgnoringMouseEvents.value = ignore
    setIgnoreMouseEvents([ignore, { forward: true }])
  }
}

watch([isOutsideForInstant, isOutsideWindow, hearingDialogOpen, whisperDockOpen, stageViewControlsEnabled, activePopover], applyTransparencyState)

const settingsAudioDeviceStore = useSettingsAudioDevice()
const { stream, enabled } = storeToRefs(settingsAudioDeviceStore)
const { askPermission, startStream } = settingsAudioDeviceStore
const { startRecord, stopRecord, onStopRecord, dispose: disposeRecorder } = useAudioRecorder(stream)
const hearingPipeline = useHearingSpeechInputPipeline()
const {
  transcribeForRecording,
  transcribeForMediaStream,
  stopStreamingTranscription,
} = hearingPipeline
const { supportsStreamInput } = storeToRefs(hearingPipeline)
const chatStore = useChatOrchestratorStore()
const hearingStore = useHearingStore()
const { hearingDetectionMode } = storeToRefs(hearingStore)
const isStartingAudio = ref(false)

const shouldUseStreamInput = computed(() => supportsStreamInput.value && !!stream.value)

const {
  init: initVAD,
  start: startVAD,
  stop: stopVAD,
  dispose: disposeVAD,
  loaded: vadLoaded,
} = useVAD(workletUrl, {
  threshold: ref(0.6),
  onSpeechStart: () => {
    if (hearingDetectionMode.value === 'vad')
      void handleSpeechStart()
  },
  onSpeechEnd: () => {
    if (hearingDetectionMode.value === 'vad')
      void handleSpeechEnd()
  },
})

let stopOnStopRecord: (() => void) | undefined

// Caption overlay broadcast channel
type CaptionChannelEvent
  = | { type: 'caption-speaker', text: string }
    | { type: 'caption-assistant', text: string }
const { post: postCaption } = useBroadcastChannel<CaptionChannelEvent, CaptionChannelEvent>({ name: 'airi-caption-overlay' })

async function handleSpeechStart() {
  console.info('[Main Page] Speech Start detected')
  if (shouldUseStreamInput.value) {
    return
  }
  startRecord()
}

async function handleSpeechEnd() {
  console.info('[Main Page] Speech End detected')
  if (shouldUseStreamInput.value) {
    return
  }
  stopRecord()
}

async function startAudioInteraction() {
  if (isStartingAudio.value) {
    console.warn('[Main Page] Audio interaction startup already in progress, skipping duplicate call')
    return
  }

  isStartingAudio.value = true
  try {
    console.info('[Main Page] Starting audio interaction')

    if (stream.value) {
      if (hearingDetectionMode.value === 'vad' && !shouldUseStreamInput.value) {
        console.info('[Main Page] Initializing separate VAD for non-streaming mode')
        await initVAD()
        await startVAD(stream.value)
      }
      else if (hearingDetectionMode.value === 'vad') {
        console.info('[Main Page] Skipping separate VAD in streaming mode (provider handles segmentation)')
      }
      else {
        if (!shouldUseStreamInput.value) {
          console.info('[Main Page] Manual mode enabled, starting recording immediately')
          startRecord()
        }
      }
    }

    if (shouldUseStreamInput.value) {
      console.info('[Main Page] Starting streaming transcription...', {
        supportsStreamInput: supportsStreamInput.value,
        hasStream: !!stream.value,
      })

      if (!stream.value) {
        console.warn('[Main Page] Stream not available despite shouldUseStreamInput being true')
        return
      }

      await transcribeForMediaStream(stream.value, {
        onSentenceEnd: (delta) => {
          console.info('[Main Page] Received transcription delta:', delta)
          if (!delta || !delta.trim()) {
            return
          }
          postCaption({ type: 'caption-speaker', text: delta })
        },
        onSpeechEnd: (text) => {
          console.info('[Main Page] Speech ended, final text:', text)
          if (!text || !text.trim()) {
            return
          }

          postCaption({ type: 'caption-speaker', text })

          void (async () => {
            try {
              const provider = await providersStore.getProviderInstance(activeChatProvider.value)
              if (!provider || !activeChatModel.value) {
                console.warn('[Main Page] No provider or model available, skipping chat send')
                return
              }

              toast.info(`🎤 You said: ${text}`, { id: 'transcription-feedback' })
              console.info('[Main Page] Sending transcription to chat:', text)

              const { autoSendEnabled } = storeToRefs(hearingStore)
              await chatStore.ingest(text, {
                model: activeChatModel.value,
                chatProvider: provider as ChatProvider,
                tools: builtinTools,
                skipAssistant: !autoSendEnabled.value,
              })
            }
            catch (err) {
              console.error('[Main Page] Failed to send chat from voice:', err)
            }
          })()
        },
      })

      console.info('[Main Page] Streaming transcription started successfully')
    }
    else {
      console.warn('[Main Page] Not starting streaming transcription:', {
        shouldUseStreamInput: shouldUseStreamInput.value,
        hasStream: !!stream.value,
        supportsStreamInput: supportsStreamInput.value,
      })
    }

    if (stopOnStopRecord)
      stopOnStopRecord()

    stopOnStopRecord = onStopRecord(async (recording) => {
      console.info('[Main Page] Voice recording stopped, size:', recording?.size, 'bytes')
      if (!recording || recording.size === 0) {
        console.warn('[Main Page] Recording is empty, skipping transcription')
        return
      }

      if (shouldUseStreamInput.value)
        return

      const text = await transcribeForRecording(recording)
      if (!text || !text.trim()) {
        toast.error('STT: No speech detected', { id: 'transcription-feedback' })
        return
      }

      toast.info(`🎤 You said: ${text}`, { id: 'transcription-feedback' })

      postCaption({ type: 'caption-speaker', text })

      if (hearingDialogOpen.value) {
        console.info('[Main Page] (Manual) Hearing dialog is open, skipping duplicate ingestion in favor of ChatArea.')
        return
      }

      try {
        const provider = await providersStore.getProviderInstance(activeChatProvider.value)
        if (!provider || !activeChatModel.value)
          return

        const { autoSendEnabled } = storeToRefs(hearingStore)
        await chatStore.ingest(text, {
          model: activeChatModel.value,
          chatProvider: provider as ChatProvider,
          tools: builtinTools,
          skipAssistant: !autoSendEnabled.value,
        })
      }
      catch (err) {
        console.error('Failed to send chat from voice:', err)
      }
    })
  }
  catch (e) {
    console.error('Audio interaction init failed:', e)
  }
  finally {
    isStartingAudio.value = false
  }
}

async function stopAudioInteraction() {
  try {
    await stopRecord()
    stopOnStopRecord?.()
    stopOnStopRecord = undefined
    await stopStreamingTranscription(false)
    stopVAD()
  }
  catch (e) {
    console.warn('[Main Page] Error during audio interaction stop:', e)
  }
}

watch(enabled, async (val) => {
  console.info('[Main Page] Audio enabled changed:', val, 'stream available:', !!stream.value)
  if (val) {
    await askPermission()
    await startStream()
    await startAudioInteraction()
  }
  else {
    await stopAudioInteraction()
  }
}, { immediate: true })

watch(stream, async (newStream) => {
  if (enabled.value && newStream) {
    console.info('[Main Page] Stream changed while enabled, restarting audio interaction')
    await stopAudioInteraction()
    await startAudioInteraction()
  }
})

async function handleOpenCustomizer(e?: Event) {
  const group = (e as CustomEvent)?.detail?.group
  console.info('[Main Page] [Control Strip Action] Toggling Customizer Window with group:', group)
  await toggleCustomizerVisibility({ enabled: true, group })
}

function handleOpenSettings(e: Event) {
  const route = (e as CustomEvent).detail?.route
  console.info(`[Main Page] [Control Strip Action] Opening settings for route: "${route}"`)
  openSettings({ route })
}

function cycleAnimation() {
  if (stageModelRenderer.value === 'mmd') {
    const mmdStore = useMmd()
    const allKeys = mmdStore.availableMotions
    if (allKeys.length === 0) {
      toast.error('No MMD motions available', { id: 'animation-cycle' })
      return
    }
    const currentKey = mmdStore.currentMotion
    const currentIndex = allKeys.indexOf(currentKey)
    const nextIndex = (currentIndex + 1) % allKeys.length
    const nextAnimation = allKeys[nextIndex]

    mmdStore.currentMotion = nextAnimation
    toast.info(`Cycling MMD: ${nextAnimation}`, { id: 'animation-cycle' })
    return
  }

  const cardIdleAnimations = activeCard.value?.extensions?.airi?.acting?.idleAnimations || []
  const allKeys = customVrmAnimationsStore.animationKeys
  const hasCardSubset = cardIdleAnimations.length > 0

  if (cardIdleAnimations.length === 1) {
    const currentKey = cardIdleAnimations[0]
    const currentIndex = allKeys.indexOf(currentKey)
    const nextIndex = (currentIndex + 1) % allKeys.length
    const nextAnimation = allKeys[nextIndex]

    if (activeCard.value?.extensions?.airi?.acting) {
      activeCard.value.extensions.airi.acting.idleAnimations = [nextAnimation]
    }
    toast.info(`Character Fixed: ${customVrmAnimationsStore.animationLabelByKey[nextAnimation] || nextAnimation}`, { id: 'animation-cycle' })
    return
  }

  const keys = hasCardSubset ? cardIdleAnimations.filter(k => allKeys.includes(k)) : allKeys
  const finalKeys = keys.length > 0 ? keys : allKeys

  const currentKey = vrmIdleAnimation.value
  const currentIndex = finalKeys.indexOf(currentKey)
  const nextIndex = (currentIndex + 1) % finalKeys.length
  const nextAnimation = finalKeys[nextIndex]

  vrmIdleAnimation.value = nextAnimation
  toast.info(`Cycling: ${customVrmAnimationsStore.animationLabelByKey[nextAnimation] || nextAnimation}`, { id: 'animation-cycle' })
}

function handleControlStripAction(e: Event) {
  const action = (e as CustomEvent).detail.action
  console.info(`[Main Page] [Control Strip Action] Received action: "${action}"`)
  if (action === 'chat') {
    controlStripStore.chatOpen = !controlStripStore.chatOpen
    console.info(`[Main Page] [Control Strip Action] Invoking openChat(${controlStripStore.chatOpen})...`)
    openChat(controlStripStore.chatOpen)
  }
  else if (action === 'settings') {
    openSettings()
  }
  else if (action === 'caption') {
    controlStripStore.captionOpen = !controlStripStore.captionOpen
  }
  else if (action === 'mic') {
    settingsAudioDeviceStore.enabled = !settingsAudioDeviceStore.enabled
  }
  else if (action === 'stage') {
    controlStripStore.stageEnabled = !controlStripStore.stageEnabled
  }
  else if (action === 'gemini-session') {
    liveSessionStore.toggle()
  }
  else if (action === 'always-on-top') {
    alwaysOnTop.value = !alwaysOnTop.value
  }
  else if (action === 'theme-mode') {
    colorMode.value = colorMode.value === 'dark' ? 'light' : 'dark'
  }
  else if (action === 'caption-follow-stage') {
    settingsStore.captionFollowStage = !settingsStore.captionFollowStage
  }
  else if (action === 'caption-docking') {
    const next = settingsStore.captionDocking === 'top' ? 'bottom' : 'top'
    settingsStore.captionDocking = next
    syncCaptionDocking(next)
  }
  else if (action === 'caption-layout-mode') {
    settingsStore.captionLayoutMode = settingsStore.captionLayoutMode === 'single' ? 'multi' : 'single'
  }
  else if (action === 'exit-app') {
    quitApp()
  }
  else if (action === 'viewport-tactile') {
    modelStore.interactionMode = 'tactile'
    stageViewControlsEnabled.value = false
    controlStripStore.stageMode = 'tactileMode'
  }
  else if (action === 'viewport-drag') {
    modelStore.interactionMode = 'tactile'
    stageViewControlsEnabled.value = true
    controlStripStore.stageMode = 'dragMode'
  }
  else if (action === 'viewport-positioning') {
    modelStore.interactionMode = 'tactile'
    stageViewControlsEnabled.value = true
    controlStripStore.stageMode = 'positionMode'
  }
  else if (action === 'viewport-orbit') {
    modelStore.interactionMode = 'orbit'
    stageViewControlsEnabled.value = false
    controlStripStore.stageMode = 'orbitMode'
  }
  else if (action === 'viewport-cycle-modes') {
    controlStripStore.cycleStageMode()
    const mode = controlStripStore.stageMode
    if (mode === 'tactileMode') {
      modelStore.interactionMode = 'tactile'
      stageViewControlsEnabled.value = false
    }
    else if (mode === 'dragMode') {
      modelStore.interactionMode = 'tactile'
      stageViewControlsEnabled.value = true
    }
    else if (mode === 'positionMode') {
      modelStore.interactionMode = 'tactile'
      stageViewControlsEnabled.value = true
    }
    else if (mode === 'orbitMode') {
      modelStore.interactionMode = 'orbit'
      stageViewControlsEnabled.value = false
    }
  }
  else if (action === 'viewport-auto-hide') {
    fadeOnHoverEnabled.value = !fadeOnHoverEnabled.value
  }
  else if (action === 'viewport-reset-coordinates') {
    const key = stageModelSelected.value
    positioningStore.setPosition(key, { x: 0, y: 0, scale: 1 })
    if (stageModelRenderer.value === 'live2d') {
      const live2dStore = useLive2d()
      live2dStore.resetState()
    }
    else {
      modelStore.modelOffset = { x: 0, y: 0, z: 0 }
      modelStore.cameraDistance = modelStore.modelSize.z * 10
    }
  }
  else if (action === 'actor-idle-animations') {
    cycleAnimation()
  }
}

onMounted(async () => {
  chatStore.setToolsResolver(builtinTools)
  tools.value = await builtinTools()
  initVAD().catch((err) => {
    console.error('[Main Page] VAD initialization failed:', err)
  })

  // Initialize orientation from main process config
  const mainConfig = await getMainWindowConfig()
  if (mainConfig?.orientation) {
    controlStripStore.orientation = mainConfig.orientation
  }

  // Resize window to fit Control Strip initially
  lastOrientation.value = controlStripStore.orientation
  const w = controlStripStore.orientation === 'vertical' ? 56 : stripLength.value
  const h = controlStripStore.orientation === 'vertical' ? stripLength.value : 56
  const current = await getBounds()
  if (current) {
    await setBounds([{
      x: current.x,
      y: current.y,
      width: w,
      height: h,
    }])
  }

  if (window.electron?.ipcRenderer) {
    window.electron.ipcRenderer.on('toggle-mic-from-shortcut', () => {
      settingsAudioDeviceStore.enabled = !settingsAudioDeviceStore.enabled
    })
    window.electron.ipcRenderer.on('chat-window-state', (_, isOpen: boolean) => {
      controlStripStore.chatOpen = isOpen
    })
    window.electron.ipcRenderer.on('caption-window-state', (_, isOpen: boolean) => {
      controlStripStore.captionOpen = isOpen
    })
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('control-strip:action', handleControlStripAction as EventListener)
    window.addEventListener('control-strip:open-customizer', handleOpenCustomizer as EventListener)
    window.addEventListener('control-strip:open-settings', handleOpenSettings as EventListener)
    window.addEventListener('control-strip:drag-start', () => {
      startDraggingWindow()
    })
    window.addEventListener('control-strip:popover-changed', async (e: Event) => {
      const { activePopover: nextPopover, placement: nextPlacement } = (e as CustomEvent).detail
      await applyBoundsUpdate(nextPopover, nextPlacement)
    })
    window.addEventListener('control-strip:apply-size-preset', handleApplySizePreset as EventListener)
  }
})

watch(hearingDetectionMode, async () => {
  if (enabled.value) {
    await stopAudioInteraction()
    await startAudioInteraction()
  }
})

onUnmounted(async () => {
  await stopAudioInteraction()
  disposeVAD()
  await disposeRecorder()

  if (typeof window !== 'undefined') {
    window.removeEventListener('control-strip:action', handleControlStripAction as EventListener)
    window.removeEventListener('control-strip:open-customizer', handleOpenCustomizer as EventListener)
    window.removeEventListener('control-strip:open-settings', handleOpenSettings as EventListener)
    window.removeEventListener('control-strip:apply-size-preset', handleApplySizePreset as EventListener)
  }
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
  <div :class="['relative w-full h-full', 'bg-transparent flex flex-col']">
    <WidgetStage
      ref="widgetStageRef"
      v-model:state="componentStateStage"
      :class="['w-full h-full', 'flex-1']"
      :focus-at="{ x: live2dLookAtX, y: live2dLookAtY }"
      :scale="computedScale"
      :x-offset="computedXOffset"
      :y-offset="computedYOffset"
      @scale-change="handleScaleChange"
      @offset-change="handleOffsetChange"
    />

    <div v-if="isLoading" :class="['absolute inset-0 z-100', 'flex items-center justify-center', 'bg-transparent']">
      <div :class="['w-8 h-8', 'flex items-center justify-center', 'text-primary-600 dark:text-primary-400']">
        <div :class="['i-solar:spinner-bold animate-spin', 'text-2xl']" />
      </div>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: stage
</route>
