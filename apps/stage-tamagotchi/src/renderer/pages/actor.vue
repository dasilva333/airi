<script setup lang="ts">
import { useElectronEventaContext, useElectronEventaInvoke, useElectronMouseAroundWindowBorder, useElectronMouseInElement, useElectronMouseInWindow } from '@proj-airi/electron-vueuse'
import { StageConfigOverlay, WhisperDock } from '@proj-airi/stage-ui/components'
import { RendererStage } from '@proj-airi/stage-ui/components/scenes'
import { useProducer, useSpeechCaptionPlayer } from '@proj-airi/stage-ui/composables'
import { useBackgroundStore } from '@proj-airi/stage-ui/stores'
import { useSpeakingStore } from '@proj-airi/stage-ui/stores/audio'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useAutonomousArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry-autonomous'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { useSettingsControlStrip } from '@proj-airi/stage-ui/stores/settings/control-strip'
import { useSettingsControlsIsland } from '@proj-airi/stage-ui/stores/settings/controls-island'
import { usePositioningStore } from '@proj-airi/stage-ui/stores/settings/positioning'
import { useSettingsUserProfile } from '@proj-airi/stage-ui/stores/settings/user-profile'
import { refDebounced, useBroadcastChannel, useEventListener, useLocalStorage, useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, ref, toRaw, watch } from 'vue'
import { toast } from 'vue-sonner'

import { electron, electronApplySizePreset, electronStageToggleVisibility, electronStartDraggingWindow } from '../../shared/eventa'
import { useWindowStore } from '../stores/window'

const toggleStageVisibility = useElectronEventaInvoke(electronStageToggleVisibility)

function handleHideStage() {
  toggleStageVisibility(false)
}

const configOverlayOpen = ref(false)
const showBackgroundLayer = ref(true)
const showModelLayer = ref(true)
const monitorCount = ref(1)
const activeMonitor = ref(1)

function handleApplyPreset(preset: string) {
  const mapped = preset === 'med.' ? 'medium' : preset
  applySizePreset({ target: 'actor', preset: mapped })
}

function handleApplyAlignment(alignment: string) {
  applySizePreset({ target: 'actor', alignment: alignment as any })
}

function handleSelectMonitor(m: number) {
  activeMonitor.value = m
  applySizePreset({ target: 'actor', monitorIndex: m })
}

function handleOverlayHide() {
  handleHideStage()
  configOverlayOpen.value = false
}

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && configOverlayOpen.value) {
    e.stopImmediatePropagation()
    configOverlayOpen.value = false
  }
}, { capture: true })

const backgroundStore = useBackgroundStore()
const { activeBackgroundUrl } = storeToRefs(backgroundStore)

const settingsStore = useSettings()
const { stageModelSelected } = storeToRefs(settingsStore)

const controlStripStore = useSettingsControlStrip()
const { stageEnabled } = storeToRefs(controlStripStore)

const positioningStore = usePositioningStore()

const windowStore = useWindowStore()
const { live2dLookAtX, live2dLookAtY } = storeToRefs(windowStore)

const controlsIslandStore = useSettingsControlsIsland()
const { fadeOnHoverEnabled } = storeToRefs(controlsIslandStore)

const speakingStore = useSpeakingStore()
const { mouthOpenSize } = storeToRefs(speakingStore)

interface SpeakingState {
  mouthOpenSize: number
  nowSpeaking: boolean
}
const { data: speakingState } = useBroadcastChannel<SpeakingState, SpeakingState>({ name: 'airi-speaking-state' })

watch(speakingState, (val) => {
  if (val) {
    speakingStore.mouthOpenSize = val.mouthOpenSize
    speakingStore.nowSpeaking = val.nowSpeaking
  }
})

const scale = computed(() => {
  return positioningStore.getPosition(stageModelSelected.value).scale
})

const xOffset = computed(() => {
  return positioningStore.getPosition(stageModelSelected.value).x
})

const yOffset = computed(() => {
  return positioningStore.getPosition(stageModelSelected.value).y
})

function handleScaleChange(val: number) {
  const current = positioningStore.getPosition(stageModelSelected.value)
  positioningStore.setPosition(stageModelSelected.value, {
    ...current,
    scale: val,
  })
}

function handleOffsetChange(val: { x: number, y: number }) {
  const current = positioningStore.getPosition(stageModelSelected.value)
  positioningStore.setPosition(stageModelSelected.value, {
    ...current,
    x: val.x,
    y: val.y,
  })
}

// Selfie Viewfinder Overlay state
const selfieViewfinderActive = ref(false)
const selfieCountdown = ref<number | null>(null)
const { data: viewfinderSignal } = useBroadcastChannel<{ active: boolean, countdown: number | null }, { active: boolean, countdown: number | null }>({ name: 'airi:stage-selfie-viewfinder' })

watch(viewfinderSignal, (val) => {
  const raw = toRaw(val)
  if (raw) {
    selfieViewfinderActive.value = raw.active || raw.countdown !== null
    selfieCountdown.value = raw.countdown
  }
})

const { width: windowWidth, height: windowHeight } = useWindowSize()

const cropSize = computed(() => {
  return Math.min(windowWidth.value * 0.95, windowHeight.value * 0.95)
})

const cropLeft = computed(() => {
  return (windowWidth.value - cropSize.value) / 2
})

const cropTop = computed(() => {
  return Math.min(windowHeight.value * 0.15, windowHeight.value - cropSize.value)
})

// WhisperDock stub tools
const tools = ref<any[]>([])
function handleSpawnStandalone() {}

// Window Dragging Handle
const context = useElectronEventaContext()
const startDraggingWindowInvoke = useElectronEventaInvoke(electronStartDraggingWindow, context.value)
const getBounds = useElectronEventaInvoke(electron.window.getBounds, context.value)
const setBounds = useElectronEventaInvoke(electron.window.setBounds, context.value)
const applySizePreset = useElectronEventaInvoke(electronApplySizePreset)

function startDraggingWindow() {
  startDraggingWindowInvoke()
}

let isTouchDragging = false
let startTouchScreenX = 0
let startTouchScreenY = 0
let startWindowBounds: { x: number, y: number, width: number, height: number } | null = null

async function onDragStartTouch(e: TouchEvent) {
  isTouchDragging = true
  const touch = e.touches[0]
  startTouchScreenX = touch.screenX
  startTouchScreenY = touch.screenY

  try {
    const b = await getBounds()
    if (b) {
      startWindowBounds = b
    }
  }
  catch (err) {
    console.error('Failed to get window bounds on touch drag start:', err)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('touchmove', onDraggingTouch, { passive: false })
    window.addEventListener('touchend', onDragEndTouch)
  }
}

async function onDraggingTouch(e: TouchEvent) {
  if (!isTouchDragging || !startWindowBounds)
    return

  const touch = e.touches[0]
  const deltaX = touch.screenX - startTouchScreenX
  const deltaY = touch.screenY - startTouchScreenY

  try {
    await setBounds([{
      x: Math.round(startWindowBounds.x + deltaX),
      y: Math.round(startWindowBounds.y + deltaY),
      width: startWindowBounds.width,
      height: startWindowBounds.height,
    }])
  }
  catch (err) {
    console.error('Failed to set window bounds on touch drag:', err)
  }
}

function onDragEndTouch() {
  isTouchDragging = false
  startWindowBounds = null
  if (typeof window !== 'undefined') {
    window.removeEventListener('touchmove', onDraggingTouch)
    window.removeEventListener('touchend', onDragEndTouch)
  }
}

const whisperDockIsOpen = ref(false)

// Fade overlay controls on hover states
const showControls = ref(false)

// Auto-hide (fade-on-hover) for the stage window.
// When enabled, entering the window fades the character to invisible and enables click-through.
// The ControlStrip window always stays visible — only the actor stage window fades.
const setIgnoreMouseEvents = useElectronEventaInvoke(electron.window.setIgnoreMouseEvents)
const stageIsHidden = ref(false)

const { isOutside: isOutsideWindow } = useElectronMouseInWindow()
const isInsideWindow = computed(() => !isOutsideWindow.value)

// Proximity/hover detection for control regions
const dragHandleRef = ref<HTMLDivElement | null>(null)
const stageContainerRef = ref<HTMLDivElement | null>(null)
const whisperDockWrapperRef = ref<HTMLDivElement | null>(null)

const { isOutside: isOutsideDragHandle } = useElectronMouseInElement(dragHandleRef)
const { isOutside: isOutsideWhisperDock } = useElectronMouseInElement(whisperDockWrapperRef)
const { elementY: stageElementY, elementHeight: stageElementHeight, isOutside: isOutsideStage } = useElectronMouseInElement(stageContainerRef)

const isOverControls = computed(() => {
  return !isOutsideDragHandle.value
    || !isOutsideWhisperDock.value
    || whisperDockIsOpen.value
    || controlStripStore.stageMode === 'positionMode'
})

function onStageMouseDown(e: MouseEvent) {
  if (controlStripStore.stageMode === 'positionMode' && e.button === 0) {
    const target = e.target as HTMLElement | null
    if (target?.closest('button, input, select, textarea, .whisper-dock, .center-hub, .radial-menu-root'))
      return
    startDraggingWindow()
  }
}

function onStageTouchStart(e: TouchEvent) {
  if (controlStripStore.stageMode === 'positionMode') {
    const target = e.target as HTMLElement | null
    if (target?.closest('button, input, select, textarea, .whisper-dock, .center-hub, .radial-menu-root'))
      return
    void onDragStartTouch(e)
  }
}

const notchProximity = computed(() => {
  if (whisperDockIsOpen.value)
    return false
  if (isOutsideStage.value)
    return false
  return stageElementHeight.value - stageElementY.value <= 10
})

function handleStageClick(e: MouseEvent) {
  if (!whisperDockIsOpen.value)
    return
  const wrapper = whisperDockWrapperRef.value
  if (wrapper && !wrapper.contains(e.target as Node)) {
    whisperDockRef.value?.dismiss()
  }
}

watch(
  [isInsideWindow, fadeOnHoverEnabled, stageEnabled, isOverControls],
  ([inside, fadeEnabled, stageOn, overControls]) => {
    if (!stageOn) {
      stageIsHidden.value = false
      setIgnoreMouseEvents([false, { forward: true }])
      showControls.value = false
      return
    }

    const shouldHide = fadeEnabled && inside && !overControls
    stageIsHidden.value = shouldHide
    setIgnoreMouseEvents([shouldHide, { forward: true }])
    showControls.value = inside && !shouldHide
  },
  { immediate: true },
)

const { isNearAnyBorder: isAroundWindowBorder } = useElectronMouseAroundWindowBorder({ threshold: 30 })
const isAroundWindowBorderFor250Ms = refDebounced(isAroundWindowBorder, 250)

const stageState = ref<'pending' | 'loading' | 'mounted'>('pending')
const { post: broadcastModelReady } = useBroadcastChannel<string, string>({ name: 'airi-stage-model-ready' })

watch(stageState, (val) => {
  console.log('[Actor Window] stageState changed:', val)
  if (val === 'mounted') {
    broadcastModelReady('ready')
  }
}, { immediate: true })

// --- Magic Wand Suggestions State & Logic ---
const whisperDockRef = ref<any>(null)
const actorSuggestions = ref<any[]>([])
const isGeneratingSuggestions = ref(false)

const suggestionCount = useLocalStorage('airi:producer:suggestion-count', 2)
const cacheAligned = useLocalStorage('airi:producer:cache-aligned', true)
const contextDepth = useLocalStorage('airi:producer:context-depth', 6)
const shortReplies = useLocalStorage('airi:producer:short-replies', true)

const cardStore = useAiriCardStore()
const chatSessionStore = useChatSessionStore()
const userProfileStore = useSettingsUserProfile()

const artistryAutonomousStore = useAutonomousArtistryStore()
const { isProcessing: isArtistryProcessing } = storeToRefs(artistryAutonomousStore)

const isAutonomousArtistryEnabled = computed(() => {
  return cardStore.activeCard?.extensions?.airi?.artistry?.autonomousEnabled ?? false
})

const drawingStartedAt = ref<number>(0)
const drawingElapsed = ref<number>(0)
const showFinished = ref(false)
const finishedTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

watch(isArtistryProcessing, (now, was) => {
  if (now && !was) {
    drawingStartedAt.value = Date.now()
    showFinished.value = false
    if (finishedTimeout.value) {
      clearTimeout(finishedTimeout.value)
      finishedTimeout.value = null
    }
  }
  else if (!now && was) {
    drawingElapsed.value = (Date.now() - drawingStartedAt.value) / 1000
    showFinished.value = true
    finishedTimeout.value = setTimeout(() => {
      showFinished.value = false
    }, 30_000)
  }
})

const { generateSuggestions } = useProducer()
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
    toast.error('No voice profile configured. Go to Settings > System > User Profile in the chat window.')
    return
  }

  if (activePlayingIndex.value === idx) {
    stopActiveAudio()
    return
  }

  stopActiveAudio()

  await playSpeech(text, voiceId, {
    onLoading: () => { loadingIndex.value = idx },
    onPlaying: () => { loadingIndex.value = null; activePlayingIndex.value = idx },
    onDone: () => { activePlayingIndex.value = null },
    onError: () => { loadingIndex.value = null; activePlayingIndex.value = null },
  })
}

async function playAllChoices() {
  if (!actorSuggestions.value.length || isPlayingAll.value)
    return

  stopActiveAudio()
  isPlayingAll.value = true

  for (let i = 0; i < actorSuggestions.value.length; i++) {
    if (!isPlayingAll.value)
      break
    await playChoiceSpeech(i, actorSuggestions.value[i].message)
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

async function handleGetSuggestions(guidance: string) {
  stopPlayAll()
  isGeneratingSuggestions.value = true
  actorSuggestions.value = []

  try {
    const characterNameVal = cardStore.activeCard?.name || 'Companion'
    const messagesVal = chatSessionStore.messages || []

    const choices = await generateSuggestions({
      characterName: characterNameVal,
      messages: messagesVal as any,
      guidance: guidance ? guidance.trim() : undefined,
      contextDepth: cacheAligned.value ? messagesVal.length : contextDepth.value,
      count: suggestionCount.value,
      shortReplies: shortReplies.value,
    })

    actorSuggestions.value = choices.map(c => ({
      title: c.title || 'Option',
      message: c.message || '',
    }))

    // Auto-play respect settings
    const autoPlayAll = (localStorage.getItem('airi:producer:auto-play-all') ?? 'true') === 'true'
    if (autoPlayAll && choices.length > 0) {
      void playAllChoices()
    }
  }
  catch (err) {
    toast.error('Failed to generate suggestions.')
  }
  finally {
    isGeneratingSuggestions.value = false
  }
}

function handleClearSuggestions() {
  stopPlayAll()
  actorSuggestions.value = []
}

function handleSelectSuggestion(messageText: string) {
  if (whisperDockRef.value) {
    whisperDockRef.value.inputText = messageText
  }
}

async function handleSendSuggestion(messageText: string) {
  if (whisperDockRef.value) {
    whisperDockRef.value.inputText = messageText
    await nextTick()
    await whisperDockRef.value.send()
    handleClearSuggestions()
  }
}

function toggleSpeechPreview(idx: number, messageText: string) {
  if (activePlayingIndex.value === idx) {
    stopActiveAudio()
  }
  else {
    void playChoiceSpeech(idx, messageText)
  }
}

// Auto-stop preview when user submits a message successfully
watch(() => chatSessionStore.messages?.length, () => {
  handleClearSuggestions()
})

onBeforeUnmount(() => {
  stopPlayAll()
})
</script>

<template>
  <div
    ref="stageContainerRef"
    :class="[
      'relative h-full w-full flex flex-col overflow-hidden rounded-xl bg-transparent',
      'transition-opacity duration-300 ease-in-out',
      stageIsHidden ? 'opacity-0' : 'opacity-100',
      controlStripStore.stageMode === 'positionMode' ? 'cursor-move' : '',
    ]"
    @mousedown="onStageMouseDown"
    @touchstart="onStageTouchStart"
    @click="handleStageClick"
  >
    <div class="relative h-full w-full overflow-hidden rounded-2xl">
      <!-- Custom Background Image -->
      <div
        v-if="activeBackgroundUrl && showBackgroundLayer"
        :class="[
          'pointer-events-none absolute inset-0 z-0 opacity-100',
          'transition-opacity duration-500',
        ]"
        :style="{
          backgroundImage: `url(${activeBackgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }"
      />

      <!-- Standalone Graphics Model Scene Renderer -->
      <div v-show="showModelLayer" class="absolute inset-0 z-10">
        <RendererStage
          v-model:state="stageState"
          :paused="!stageEnabled || !showModelLayer"
          :focus-at="{ x: live2dLookAtX, y: live2dLookAtY }"
          :x-offset="xOffset"
          :y-offset="yOffset"
          :scale="scale"
          :mouth-open-size="mouthOpenSize"
          :show-background="showBackgroundLayer"
          :show-model="showModelLayer"
          :monitor-count="monitorCount"
          :active-monitor="activeMonitor"
          @update:show-background="(val) => showBackgroundLayer = val"
          @update:show-model="(val) => showModelLayer = val"
          @apply-preset="handleApplyPreset"
          @apply-alignment="handleApplyAlignment"
          @hide-stage="handleHideStage"
          @select-monitor="handleSelectMonitor"
          @scale-change="handleScaleChange"
          @offset-change="handleOffsetChange"
        />
      </div>

      <!-- Autonomous Artistry Generation Loader (Top Left Edge) -->
      <Transition
        enter-active-class="transition-opacity duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isAutonomousArtistryEnabled && (isArtistryProcessing || showFinished)"
          class="pointer-events-none absolute left-2.5 top-2.5 z-50 flex items-center gap-1.5 border border-neutral-200/50 rounded-lg bg-white/80 p-1.5 shadow-sm backdrop-blur-md dark:border-neutral-800/40 dark:bg-neutral-900/70"
        >
          <div v-if="isArtistryProcessing" class="i-ph:paint-brush-broad-duotone size-3.5 animate-pulse text-primary-500" />
          <div v-else class="i-ph:check-circle-duotone size-3.5 text-emerald-500" />
          <span class="select-none pr-0.5 text-[9px] text-neutral-800 font-bold tracking-wider uppercase dark:text-neutral-200">
            {{ isArtistryProcessing ? 'Drawing' : `Done in ${drawingElapsed.toFixed(1)}s` }}
          </span>
        </div>
      </Transition>

      <!-- Floating Window Drag & Visibility Controls (Fades on hover) -->
      <div
        ref="dragHandleRef"
        :class="[
          'pointer-events-auto absolute right-2.5 top-2.5 z-50 transition-opacity duration-300 ease-in-out',
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ]"
      >
        <div class="flex items-center gap-0.5 border border-neutral-200/50 rounded-lg bg-white/80 p-0.5 shadow-sm backdrop-blur-md dark:border-neutral-800/40 dark:bg-neutral-900/70">
          <!-- Drag Handle Button -->
          <button
            class="text-neutral-850 size-6 flex cursor-pointer items-center justify-center rounded-md transition-all duration-200 active:scale-95 hover:bg-neutral-200/60 dark:text-neutral-200 dark:hover:bg-neutral-700/60"
            title="Drag to Reposition Stage"
            @mousedown="startDraggingWindow"
            @touchstart="onDragStartTouch"
          >
            <div class="i-ph:arrows-out-cardinal size-3.5" />
          </button>
          <!-- Stage Config Button -->
          <button
            class="text-neutral-850 size-6 flex cursor-pointer items-center justify-center rounded-md transition-all duration-200 active:scale-95 hover:bg-neutral-200/60 dark:text-neutral-200 dark:hover:bg-neutral-700/60"
            title="Stage Size & Position"
            @click="configOverlayOpen = true"
          >
            <div class="i-ph:gear size-3.5" />
          </button>
        </div>
      </div>

      <!-- Suggestions Floating Overlay -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-2 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 translate-y-2 scale-95"
      >
        <div
          v-if="whisperDockIsOpen && (isGeneratingSuggestions || actorSuggestions.length > 0)"
          class="pointer-events-none absolute bottom-16 left-0 z-50 w-full flex flex-col items-center justify-end px-6 pb-2"
        >
          <!-- The list of suggestion pills -->
          <div class="pointer-events-auto max-w-lg w-full flex flex-col gap-2 border border-neutral-200/40 rounded-2xl bg-white/80 p-2.5 shadow-2xl backdrop-blur-2xl dark:border-neutral-800/40 dark:bg-neutral-950/85">
            <!-- Loading State -->
            <div v-if="isGeneratingSuggestions" class="h-8 flex select-none items-center justify-center gap-2 text-xs text-neutral-600 font-medium dark:text-neutral-300">
              <div class="i-ph:circle-notch-bold size-3.5 animate-spin text-primary-500" />
              <span>Generating {{ suggestionCount }} suggestions...</span>
            </div>

            <!-- Loaded Suggestions State -->
            <div v-else class="animate-in fade-in zoom-in-95 grid gap-2 duration-150" :class="actorSuggestions.length <= 2 ? 'grid-cols-2' : 'grid-cols-2'">
              <button
                v-for="(choice, idx) in actorSuggestions"
                :key="idx"
                :class="[
                  'h-8 px-3 rounded-xl border flex items-center justify-between text-left transition-all duration-200 cursor-pointer active:scale-98 select-none',
                  activePlayingIndex === idx
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20 shadow-[0_0_12px_rgba(139,92,246,0.2)] text-primary-600 dark:text-primary-400 font-semibold'
                    : 'border-neutral-200/50 dark:border-neutral-800/50 bg-white/70 dark:bg-neutral-900/40 hover:bg-white/95 dark:hover:bg-neutral-900/95 hover:border-neutral-300/70 dark:hover:border-neutral-700/60 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white',
                ]"
                @click="handleSelectSuggestion(choice.message)"
              >
                <!-- Left: Status Icon + Title -->
                <div class="mr-2 flex flex-1 items-center gap-2 overflow-hidden">
                  <!-- Play/Pause Status Button -->
                  <div
                    class="size-5 flex cursor-pointer items-center justify-center rounded-lg text-neutral-400 transition-all hover:bg-neutral-200/80 hover:text-neutral-950 dark:hover:bg-neutral-700/40 dark:hover:text-white"
                    @click.stop="toggleSpeechPreview(idx, choice.message)"
                  >
                    <div
                      v-if="loadingIndex === idx"
                      class="i-ph:circle-notch-bold size-3.5 animate-spin text-primary-400"
                    />
                    <div
                      v-else-if="activePlayingIndex === idx"
                      class="i-ph:pause-fill size-3.5 text-primary-400"
                    />
                    <div
                      v-else
                      class="text-neutral-450 dark:hover:text-neutral-250 i-ph:play-fill size-3 hover:text-neutral-600"
                    />
                  </div>
                  <span class="truncate text-xs font-medium">{{ choice.title }}</span>
                </div>

                <!-- Right: Actions (Check indicator + Send instantly button) -->
                <div class="flex flex-shrink-0 items-center gap-1.5">
                  <div v-if="whisperDockRef?.inputText === choice.message" class="i-solar:check-circle-bold text-xs text-primary-400" />
                  <button
                    class="animate-in fade-in size-5 flex cursor-pointer items-center justify-center rounded-md text-neutral-400 transition-all duration-200 hover:bg-primary-500/20 hover:text-primary-500"
                    title="Send suggestion instantly"
                    @click.stop="handleSendSuggestion(choice.message)"
                  >
                    <div class="i-ph:paper-plane-tilt-fill size-3" />
                  </button>
                </div>
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- WhisperDock horizontal input overlay -->
      <div
        ref="whisperDockWrapperRef"
        :class="[
          'absolute bottom-0 left-0 w-full h-16 z-50 transition-opacity duration-300 ease-in-out',
          (showControls || whisperDockIsOpen) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ]"
      >
        <WhisperDock
          ref="whisperDockRef"
          v-model:open="whisperDockIsOpen"
          :tools="tools"
          :proximity="notchProximity"
          @spawn-standalone="handleSpawnStandalone"
          @get-suggestions="handleGetSuggestions"
          @clear-suggestions="handleClearSuggestions"
        />
      </div>

      <!-- Stage Config Overlay (Size & Position) -->
      <StageConfigOverlay
        v-model:open="configOverlayOpen"
        v-model:show-background="showBackgroundLayer"
        v-model:show-model="showModelLayer"
        @apply-preset="handleApplyPreset"
        @apply-alignment="handleApplyAlignment"
        @hide-stage="handleOverlayHide"
      />

      <!-- Selfie Viewfinder Overlay -->
      <div v-if="selfieViewfinderActive" class="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
        <!-- Semi-transparent overlay mask -->
        <div class="absolute inset-0 bg-neutral-950/40" />
        <!-- Glowing Crop Box -->
        <div
          class="absolute border-2 border-sky-400 border-dashed bg-transparent shadow-[0_0_0_9999px_rgba(10,10,10,0.5)] transition-all duration-300"
          :style="{
            width: `${cropSize}px`,
            height: `${cropSize}px`,
            top: `${cropTop}px`,
            left: `${cropLeft}px`,
          }"
        >
          <!-- Corner crop marks -->
          <div class="absolute h-4 w-4 border-l-4 border-t-4 border-sky-400 -left-1 -top-1" />
          <div class="absolute h-4 w-4 border-r-4 border-t-4 border-sky-400 -right-1 -top-1" />
          <div class="absolute h-4 w-4 border-b-4 border-l-4 border-sky-400 -bottom-1 -left-1" />
          <div class="absolute h-4 w-4 border-b-4 border-r-4 border-sky-400 -bottom-1 -right-1" />

          <!-- Countdown text in the center -->
          <div v-if="selfieCountdown !== null" class="absolute inset-0 flex items-center justify-center">
            <span class="animate-pulse text-6xl text-white font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {{ selfieCountdown }}
            </span>
          </div>
        </div>
      </div>

      <!-- Proximity Border Highlight -->
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
  </div>
</template>

<route lang="yaml">
meta:
  layout: stage
</route>
