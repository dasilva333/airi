<script setup lang="ts">
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { useCustomVrmAnimationsStore, useModelStore } from '@proj-airi/stage-ui-three'
import { useTheme } from '@proj-airi/ui'
import { onClickOutside, useBroadcastChannel } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
// Ported stores & states for Popovers

import blowKissGlyph from '../../../assets/motions/blow_kiss.avif'
import celebrateGlyph from '../../../assets/motions/celebrate.avif'
import gracefulBowGlyph from '../../../assets/motions/graceful_bow.avif'
import helloGlyph from '../../../assets/motions/hello.avif'
import SelfiesPopover from './popovers/SelfiesPopover.vue'

import { useControlStripAction } from '../../../composables/use-control-strip-action'
import { useControlStripSelfie } from '../../../composables/use-control-strip-selfie'
import { useControlStripSettingsRoute } from '../../../composables/use-control-strip-settings-route'
import { CUSTOMIZER_CATALOG } from '../../../constants'
import { useBackgroundStore } from '../../../stores/background'
import { useDatingSimStore } from '../../../stores/dating-sim'
import { useDisplayModelsStore } from '../../../stores/display-models'
import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useLiveSessionStore } from '../../../stores/modules/live-session'
// ── Voice Switch Popover — state & helpers ─────────────────────────────────
import { useTextToMotionStore } from '../../../stores/modules/text-to-motion'
import { useSettings } from '../../../stores/settings'
import { useSettingsAudioDevice } from '../../../stores/settings/audio-device'
import { useSettingsControlStrip } from '../../../stores/settings/control-strip'
import { useSettingsControlsIsland } from '../../../stores/settings/controls-island'
import { useSettingsStageModel } from '../../../stores/settings/stage-model'
import { STRIP_POPOVER_COMPONENTS } from './popovers/registry'

const props = withDefaults(defineProps<{
  mode?: 'desktop' | 'mobile'
}>(), {
  mode: 'desktop',
})

const { dispatchAction } = useControlStripAction()
const settingsStore = useSettings()
const stageModelSettings = useSettingsStageModel()
const { gunslingerStance } = storeToRefs(stageModelSettings)

console.log('[ControlStrip.vue] Setup loaded with Selfie feature support')
const { themeMode, isDark } = useTheme()
const controlStripStore = useSettingsControlStrip()
const { orientation, buttons, stageEnabled, stageMateEnabled, chatOpen, captionOpen, backgroundTint, stageMode, collapsed, dockedEdge, selfieIncludeBg } = storeToRefs(controlStripStore)
const isHoveredHandle = ref(false)
const displayModelsStore = useDisplayModelsStore()
const datingSimStore = useDatingSimStore()

const autoHideMode = computed(() => dockedEdge.value !== null)

const activePopover = ref<string | null>(null)

// Auto-hide Tab hover states
const hoverExpanded = ref(false)
const hoverTimer = ref<NodeJS.Timeout | null>(null)

const isFullyExpanded = computed(() => {
  if (autoHideMode.value) {
    return !collapsed.value || hoverExpanded.value || activePopover.value !== null
  }
  return !collapsed.value
})

function onContainerMouseEnter() {
  if (autoHideMode.value && collapsed.value) {
    if (hoverTimer.value) {
      clearTimeout(hoverTimer.value)
      hoverTimer.value = null
    }
    hoverExpanded.value = true
  }
}

function onContainerMouseLeave() {
  if (autoHideMode.value && collapsed.value) {
    if (hoverTimer.value)
      clearTimeout(hoverTimer.value)
    hoverTimer.value = setTimeout(() => {
      hoverExpanded.value = false
    }, 400)
  }
}

const autoHideTabClasses = computed(() => {
  if (!autoHideMode.value || isFullyExpanded.value) {
    return ''
  }
  const edge = dockedEdge.value
  const base = 'transition-transform duration-300 ease-out'

  if (edge === 'left') {
    return `${base} rounded-r-full rounded-l-none border-l-0 -translate-x-[calc(100%-14px)]`
  }
  if (edge === 'right') {
    return `${base} rounded-l-full rounded-r-none border-r-0 translate-x-[calc(100%-14px)]`
  }
  if (edge === 'top') {
    return `${base} rounded-b-full rounded-t-none border-t-0 -translate-y-[calc(100%-14px)]`
  }
  if (edge === 'bottom') {
    return `${base} rounded-t-full rounded-b-none border-b-0 translate-y-[calc(100%-14px)]`
  }
  return ''
})

const isSandboxAllowed = computed(() => {
  const tools = cardStore.activeCard?.extensions?.airi?.generation?.known?.allowedTools
  return Boolean(tools && (tools.includes('bash') || tools.includes('mcp_bash')))
})

// Filter for active buttons
const activeButtons = computed(() => {
  const isMobile = props.mode === 'mobile'
  const allCatalog = CUSTOMIZER_CATALOG.flatMap(g => g.items)
  const desktopOnlyMap = new Map(allCatalog.map(i => [i.id, !!i.desktopOnly]))

  return buttons.value.filter((btn) => {
    if (!btn.enabled)
      return false
    if (isMobile && desktopOnlyMap.get(btn.id))
      return false
    if (btn.id === 'workspace' && !isSandboxAllowed.value)
      return false
    return true
  })
})

// Persistent dragging position, defaults to top-right layout bounds
const position = useLocalStorageManualReset<{ x: number, y: number }>('settings/control-strip/position', { x: 20, y: 150 })

const settingsAudioDeviceStore = useSettingsAudioDevice()
const { enabled: micEnabled } = storeToRefs(settingsAudioDeviceStore)

const liveSessionStore = useLiveSessionStore()
const { powerState } = storeToRefs(liveSessionStore)

const controlsIslandStore = useSettingsControlsIsland()
const { fadeOnHoverEnabled, alwaysOnTop } = storeToRefs(controlsIslandStore)

const cardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(cardStore)

const modelStore = useModelStore()

const customVrmAnimationsStore = useCustomVrmAnimationsStore()

// ── Motion Studio (FlowMDM Text-to-Motion Create & Library) ───────────────
const textToMotionStore = useTextToMotionStore()

const motionActiveTab = ref<'create' | 'library'>('create')
const libraryFilter = ref<'all' | 'builtin' | 'saved' | 'uploaded'>('all')
const motionSearchQuery = ref('')

const motionPlaygroundPrompt = ref('')
const motionPlaygroundDuration = ref<'4s' | '6s' | '8s'>('6s')
const isGeneratingMotionPlayground = ref(false)
const motionPlaygroundStatusMessage = ref('')
const currentlyPlayingMotionKey = ref<string | null>(null)

interface LastMotionResultInfo {
  title: string
  prompt: string
  duration: string
  buffer?: Uint8Array
  fileName?: string
  blobUrl: string
  key?: string
  isSaved: boolean
}
const lastMotionResult = ref<LastMotionResultInfo | null>(null)
const quickPresetsCache = new Map<string, { buffer: Uint8Array, blobUrl: string }>()

const quickMotions = [
  {
    id: 'wave-hello',
    title: 'Wave hello',
    prompt: 'A person waving hello with their right hand while facing forward',
    duration: '4 sec',
    durationSeconds: 4,
    glyph: helloGlyph,
  },
  {
    id: 'blow-kiss',
    title: 'Blow a kiss',
    prompt: 'A person blowing a kiss with their right hand and leaning forward',
    duration: '6 sec',
    durationSeconds: 6,
    glyph: blowKissGlyph,
  },
  {
    id: 'graceful-bow',
    title: 'Graceful bow',
    prompt: 'A person bowing gracefully at the waist in greeting',
    duration: '6 sec',
    durationSeconds: 6,
    glyph: gracefulBowGlyph,
  },
  {
    id: 'celebrate',
    title: 'Celebrate',
    prompt: 'A person raising both arms in celebration and cheering',
    duration: '8 sec',
    durationSeconds: 8,
    glyph: celebrateGlyph,
  },
]

async function handleTriggerQuickMotion(qm: typeof quickMotions[number]) {
  if (isGeneratingMotionPlayground.value)
    return

  motionPlaygroundPrompt.value = qm.prompt

  if (quickPresetsCache.has(qm.id)) {
    const cached = quickPresetsCache.get(qm.id)!
    modelStore.triggerMotion(cached.blobUrl)
    currentlyPlayingMotionKey.value = qm.id
    lastMotionResult.value = {
      title: qm.title,
      prompt: qm.prompt,
      duration: qm.duration,
      buffer: cached.buffer,
      fileName: `${qm.id}.vrma`,
      blobUrl: cached.blobUrl,
      isSaved: false,
    }
    toast.info(`Playing ${qm.title}`)
    return
  }

  isGeneratingMotionPlayground.value = true
  motionPlaygroundStatusMessage.value = 'Diffusing...'

  try {
    const outputLength = Math.min(qm.durationSeconds * 20, 196)
    const result = await textToMotionStore.generateMotion(qm.prompt, {
      format: 'vrma',
      engine: 'flowmdm',
      outputLength,
      onLog: (msg) => { motionPlaygroundStatusMessage.value = msg },
    })

    if (result && result.buffer) {
      const blob = new Blob([result.buffer.buffer as ArrayBuffer], { type: 'model/gltf-binary' })
      const blobUrl = URL.createObjectURL(blob)
      quickPresetsCache.set(qm.id, { buffer: result.buffer, blobUrl })

      modelStore.triggerMotion(blobUrl)
      currentlyPlayingMotionKey.value = qm.id
      lastMotionResult.value = {
        title: qm.title,
        prompt: qm.prompt,
        duration: qm.duration,
        buffer: result.buffer,
        fileName: result.fileName,
        blobUrl,
        isSaved: false,
      }
      toast.success(`${qm.title} playing on stage!`)
    }
  }
  catch (err: any) {
    console.error('[MotionStudio] Quick motion failed:', err)
    toast.error(`Motion failed: ${err.message || String(err)}`)
  }
  finally {
    isGeneratingMotionPlayground.value = false
    motionPlaygroundStatusMessage.value = ''
  }
}

async function handleGenerateAndPlay() {
  const prompt = motionPlaygroundPrompt.value.trim()
  if (!prompt) {
    toast.error('Please describe a motion.')
    return
  }

  isGeneratingMotionPlayground.value = true
  motionPlaygroundStatusMessage.value = 'Preparing motion...'

  try {
    const durationSeconds = Number.parseInt(motionPlaygroundDuration.value, 10) || 6
    const outputLength = Math.min(durationSeconds * 20, 196)

    const result = await textToMotionStore.generateMotion(prompt, {
      format: 'vrma',
      engine: 'flowmdm',
      outputLength,
      onLog: (msg) => { motionPlaygroundStatusMessage.value = msg },
    })

    if (result && result.buffer) {
      const blob = new Blob([result.buffer.buffer as ArrayBuffer], { type: 'model/gltf-binary' })
      const blobUrl = URL.createObjectURL(blob)

      modelStore.triggerMotion(blobUrl)
      currentlyPlayingMotionKey.value = 'last-result'

      const words = prompt.split(/\s+/).slice(0, 4).join(' ')
      const title = words.charAt(0).toUpperCase() + words.slice(1)

      lastMotionResult.value = {
        title,
        prompt,
        duration: `${durationSeconds} sec`,
        buffer: result.buffer,
        fileName: result.fileName,
        blobUrl,
        isSaved: false,
      }
      toast.success('Motion compiled and playing on stage!')
    }
  }
  catch (err: any) {
    console.error('[MotionStudio] Generation failed:', err)
    toast.error(`Motion generation failed: ${err.message || String(err)}`)
  }
  finally {
    isGeneratingMotionPlayground.value = false
    motionPlaygroundStatusMessage.value = ''
  }
}

async function handleSaveToLibrary() {
  if (!lastMotionResult.value || !lastMotionResult.value.buffer)
    return

  try {
    const file = new File(
      [lastMotionResult.value.buffer.buffer as ArrayBuffer],
      lastMotionResult.value.fileName || `flowmdm_${Date.now()}.vrma`,
      { type: 'model/gltf-binary' },
    )
    const key = await customVrmAnimationsStore.addCustomAnimation(file, { source: 'saved' })
    lastMotionResult.value.isSaved = true
    lastMotionResult.value.key = key
    toast.success('Saved to motion library!')
  }
  catch (err: any) {
    console.error('[MotionStudio] Save failed:', err)
    toast.error(`Save failed: ${err.message || String(err)}`)
  }
}

function handleReplayLastMotion() {
  if (lastMotionResult.value?.blobUrl) {
    modelStore.triggerMotion(lastMotionResult.value.blobUrl)
    currentlyPlayingMotionKey.value = 'last-result'
    toast.info(`Replaying "${lastMotionResult.value.title}"`)
  }
}

function handleEditPrompt() {
  if (lastMotionResult.value?.prompt) {
    motionPlaygroundPrompt.value = lastMotionResult.value.prompt
    motionActiveTab.value = 'create'
  }
}

function handleStopMotion() {
  modelStore.triggerMotion('__STOP__')
  currentlyPlayingMotionKey.value = null
  toast.info('Motion stopped')
}

interface LibraryMotionItem {
  key: string
  label: string
  source: 'builtin' | 'saved' | 'uploaded'
  duration: string
}

const libraryMotions = computed<LibraryMotionItem[]>(() => {
  const list: LibraryMotionItem[] = []

  if (settingsStore.stageModelRenderer === 'vrm') {
    const stockKeys = [
      'agent007',
      'aiCatDance',
      'armsSwing',
      'armsUpDownDance',
      'blingBang',
      'confidentPose',
      'cool',
      'crabDance',
      'energetic',
      'flamboyant',
      'grandstand',
      'hitoMania',
      'humansAreJustCylinders',
      'idleLoop',
      'innocent',
      'kawaiiKaiwai',
      'ladylake',
      'magicEyeWink',
      'peaceSign',
      'powerful',
      'showcase',
      'shy',
      'sittingToWave',
      'tetris',
    ]
    for (const key of stockKeys) {
      const formatted = key.replace(/([A-Z0-9])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()
      list.push({
        key,
        label: formatted,
        source: 'builtin',
        duration: '4 sec',
      })
    }

    for (const anim of Object.values(customVrmAnimationsStore.customAnimations)) {
      const isSaved = anim.source === 'saved' || anim.originalFileName.startsWith('flowmdm_')
      list.push({
        key: anim.key,
        label: anim.name,
        source: isSaved ? 'saved' : 'uploaded',
        duration: isSaved ? '6 sec' : '5 sec',
      })
    }
  }

  let filtered = list
  if (libraryFilter.value !== 'all') {
    filtered = filtered.filter(item => item.source === libraryFilter.value)
  }

  if (motionSearchQuery.value.trim()) {
    const query = motionSearchQuery.value.toLowerCase().trim()
    filtered = filtered.filter(item => item.label.toLowerCase().includes(query))
  }

  return filtered
})

function handlePlayLibraryMotion(item: LibraryMotionItem) {
  if (currentlyPlayingMotionKey.value === item.key) {
    handleStopMotion()
    return
  }

  modelStore.triggerMotion(item.key)
  currentlyPlayingMotionKey.value = item.key
}

function getLibraryMotionGlyph(item: LibraryMotionItem): string | undefined {
  const match = quickMotions.find(qm => qm.title.toLowerCase() === item.label.toLowerCase())
  return match?.glyph
}

// Background & Atmosphere state & actions
const backgroundStore = useBackgroundStore()
const {
  activeAtmosphereId,
  activeBackgroundId,
  chatboxActiveAtmosphereId,
  chatboxActiveBackgroundId,
} = storeToRefs(backgroundStore)

// Selfie capture + viewfinder channel ownership stays in the shell: exactly one
// listener per app, and the viewfinder contract is driven by `activePopover`.
const { openSettingsRoute } = useControlStripSettingsRoute()

const { selfies, selfieCountdown, triggerSelfie, selectSelfieBackground } = useControlStripSelfie({
  activeCardId,
  activePopover,
  selfieIncludeBg,
  getCharacterSelfies: characterId => backgroundStore.getCharacterJournalEntries(characterId),
  updateCardBackground: (characterId, bgId) => {
    const card = activeCard.value
    if (!card)
      return
    cardStore.updateCard(characterId, {
      extensions: {
        ...card.extensions,
        airi: {
          ...card.extensions.airi,
          modules: {
            ...card.extensions.airi.modules,
            activeBackgroundId: bgId,
          },
        },
      },
    } as any)
  },
})

const hoveredButtonId = ref<string | null>(null)
const popoverRef = ref<HTMLElement | null>(null)

const isElectron = computed(() => typeof window !== 'undefined' && !!(window as any).electron)

let lastDispatchedStance: string | null = null
watch(gunslingerStance, async (stance) => {
  if (stance === lastDispatchedStance)
    return
  lastDispatchedStance = stance
  if (isElectron.value) {
    try {
      const { useElectronEventaInvoke } = await import('@proj-airi/electron-vueuse')
      const { electronStageMateSetWeapon } = await import('@proj-airi/stage-shared')
      const setWeapon = useElectronEventaInvoke(electronStageMateSetWeapon)
      await setWeapon({
        enabled: stance !== 'off',
        weapon: stance,
      })
    }
    catch (err) {
      console.warn('Failed to dispatch gunslinger weapon to Stage-Mate:', err)
    }
  }
}, { immediate: true })

interface CaptionSegment { text: string, color: string, actorId: string, isActive?: boolean }
type CaptionChannelEvent
  = | { type: 'caption-speaker', text: string }
    | { type: 'caption-assistant', segments: CaptionSegment[] }

const { data: captionChannelData } = useBroadcastChannel<CaptionChannelEvent, CaptionChannelEvent>({ name: 'airi-caption-overlay' })
watch(captionChannelData, async (event) => {
  if (!isElectron.value || !event)
    return
  try {
    const { useElectronEventaInvoke } = await import('@proj-airi/electron-vueuse')
    const { electronStageMateSendCaption } = await import('@proj-airi/stage-shared')
    const sendCaption = useElectronEventaInvoke(electronStageMateSendCaption)

    if (event.type === 'caption-assistant') {
      const active = event.segments?.find(s => s.isActive)
      if (active && active.text?.trim()) {
        await sendCaption({
          text: active.text,
          isActive: true,
          speaker: active.actorId || 'assistant',
        })
      }
    }
  }
  catch (err) {
    console.warn('Failed to relay caption to Stage-Mate:', err)
  }
})

if (typeof window !== 'undefined') {
  (window as any).__AIRI_DEVTOOLS_MATE_SPEECH__ = async (text: string) => {
    const { useElectronEventaInvoke } = await import('@proj-airi/electron-vueuse')
    const { electronStageMateSendCaption } = await import('@proj-airi/stage-shared')
    const sendCaption = useElectronEventaInvoke(electronStageMateSendCaption)
    return await sendCaption({ text, isActive: true, speaker: 'AIRI' })
  }
}

const activeMonitor = ref(1)
const selectedAlignment = ref('center')
// Only pass alignment to apply-size-preset after the user explicitly chose one —
// otherwise every size-preset click silently re-centers the window (selectedAlignment
// defaults to 'center'), which made oversized windows snap to the screen middle.
const alignmentChosen = ref(false)
watch(selectedAlignment, () => alignmentChosen.value = true)
const presetAlignment = computed(() => alignmentChosen.value ? selectedAlignment.value : undefined)
const monitorCount = ref(1)

onMounted(async () => {
  void displayModelsStore.loadDisplayModelsFromIndexedDB(true)
  if (isElectron.value && (window as any).electron?.ipcRenderer) {
    try {
      monitorCount.value = await (window as any).electron.ipcRenderer.invoke('eventa:invoke:electron:windows:get-monitor-count')
    }
    catch (err) {
      console.warn('Failed to get monitor count:', err)
    }
  }
})

function applySizePreset(
  target: 'actor' | 'chat',
  preset?: string,
  alignment?: string,
) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('control-strip:apply-size-preset', {
      detail: {
        target,
        preset,
        monitorIndex: monitorCount.value > 1 ? activeMonitor.value : undefined,
        alignment,
      },
    }))
  }
  if (preset) {
    activePopover.value = null
  }
}

function toggleDatingSimMode() {
  datingSimStore.toggleDatingSim()
}

function selectMonitor(target: 'actor' | 'chat', m: number) {
  activeMonitor.value = m
  applySizePreset(target, undefined, selectedAlignment.value)
}

onClickOutside(popoverRef, (event) => {
  const target = event.target as HTMLElement
  if (target && target.closest('.control-strip-btn')) {
    return
  }
  activePopover.value = null
})

const PRESETS = [
  { name: 'mini', icon: 'i-solar:minimize-square-3-linear', label: 'Mini' },
  { name: 'medium', icon: 'i-solar:maximize-square-2-linear', label: 'Medium' },
  { name: 'large', icon: 'i-solar:maximize-square-3-linear', label: 'Large' },
  { name: 'full', icon: 'i-solar:screencast-linear', label: 'Full' },
] as const

function openPresetPopover(btnId: string) {
  if (btnId === 'stage') {
    activePopover.value = 'stage-preset'
  }
  else if (btnId === 'chat') {
    activePopover.value = 'chat-preset'
  }
  else {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('control-strip:open-customizer'))
    }
  }
}

const popoverPlacement = computed(() => {
  if (props.mode === 'mobile') {
    return dockedEdge.value === 'left' ? 'right' : 'left'
  }
  if (typeof window === 'undefined')
    return 'bottom'

  const screenX = window.screenX || 0
  const screenY = window.screenY || 0
  const screenWidth = window.screen?.width || window.innerWidth
  const screenHeight = window.screen?.height || window.innerHeight

  if (orientation.value === 'vertical') {
    return screenX < screenWidth / 2 ? 'right' : 'left'
  }
  else {
    return screenY < screenHeight / 2 ? 'bottom' : 'top'
  }
})

const stripLength = computed(() => {
  if (!isFullyExpanded.value) {
    return 52
  }
  const N = activeButtons.value.length
  return N === 0 ? 52 : 52 + 44 * N
})

const containerStyle = computed(() => {
  if (props.mode === 'mobile') {
    const styles: Record<string, string> = {
      top: '50%',
      transform: 'translateY(-50%)',
    }
    if (dockedEdge.value === 'left') {
      styles.left = '0px'
    }
    else {
      styles.right = '0px'
    }
    return styles
  }
  if (isElectron.value) {
    const styles: Record<string, string> = {
      backgroundColor: backgroundTint.value || '',
      opacity: '0.85',
    }
    if (activePopover.value) {
      if (orientation.value === 'vertical') {
        const windowHeight = Math.max(500, stripLength.value)
        styles.top = `${(windowHeight - stripLength.value) / 2}px`
        if (popoverPlacement.value === 'right') {
          styles.left = '0px'
        }
        else {
          styles.left = '276px'
        }
      }
      else {
        const windowWidth = Math.max(500, stripLength.value)
        styles.left = `${(windowWidth - stripLength.value) / 2}px`
        if (popoverPlacement.value === 'bottom') {
          styles.top = '0px'
        }
        else {
          styles.top = '452px'
        }
      }
    }
    else {
      styles.left = '0px'
      styles.top = '0px'
    }
    return styles
  }
  else {
    return {
      top: `${position.value.y}px`,
      right: `${position.value.x}px`,
      backgroundColor: backgroundTint.value || '',
      opacity: '0.85',
    }
  }
})

watch(activePopover, (newVal) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('control-strip:popover-changed', {
      detail: {
        activePopover: newVal,
        placement: popoverPlacement.value,
      },
    }))
  }
})

const geminiDotClasses = computed(() => {
  if (powerState.value === 'busy') {
    return 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)] animate-pulse'
  }
  if (powerState.value === 'active') {
    return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]'
  }
  if (powerState.value === 'connecting') {
    return 'bg-sky-400 animate-pulse'
  }
  if (powerState.value === 'ambient') {
    return 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]'
  }
  return 'bg-neutral-400/50'
})

// Dragging states
const isDragging = ref(false)
let isMouseDown = false
let startMouseX = 0
let startMouseY = 0
let startPosX = 0
let startPosY = 0
let dragDistance = 0
let isTouchEventState = false
let startTouchScreenX = 0
let startTouchScreenY = 0
let startWindowBounds: { x: number, y: number, width: number, height: number } | null = null

async function onDragStart(e: MouseEvent | TouchEvent) {
  if (props.mode === 'mobile') {
    collapsed.value = !collapsed.value
    return
  }

  if ('button' in e && e.button !== 0)
    return

  isMouseDown = true
  dragDistance = 0
  isTouchEventState = 'touches' in e

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  startMouseX = clientX
  startMouseY = clientY
  startPosX = position.value.x
  startPosY = position.value.y

  if (isTouchEventState && isElectron.value) {
    const touch = (e as TouchEvent).touches[0]
    startTouchScreenX = touch.screenX
    startTouchScreenY = touch.screenY
    try {
      startWindowBounds = await (window as any).electron.ipcRenderer.invoke('eventa:invoke:electron:window:get-bounds')
    }
    catch (err) {
      console.error('Failed to get bounds for touch drag:', err)
      startWindowBounds = null
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', onDragging)
    window.addEventListener('mouseup', onDragEnd)
    window.addEventListener('touchmove', onDragging, { passive: false })
    window.addEventListener('touchend', onDragEnd)
  }
}

async function onDragging(e: MouseEvent | TouchEvent) {
  if (!isMouseDown)
    return

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  const diffX = clientX - startMouseX
  const diffY = clientY - startMouseY
  dragDistance = Math.sqrt(diffX * diffX + diffY * diffY)

  if (dragDistance >= 4) {
    isDragging.value = true
  }

  if (isElectron.value) {
    if (isTouchEventState) {
      if (dragDistance >= 4 && startWindowBounds) {
        const touch = (e as TouchEvent).touches[0]
        const deltaX = touch.screenX - startTouchScreenX
        const deltaY = touch.screenY - startTouchScreenY
        try {
          await (window as any).electron.ipcRenderer.invoke('eventa:invoke:electron:window:set-bounds', [{
            x: Math.round(startWindowBounds.x + deltaX),
            y: Math.round(startWindowBounds.y + deltaY),
            width: startWindowBounds.width,
            height: startWindowBounds.height,
          }])
        }
        catch (err) {
          console.error('Failed to set bounds on touch drag:', err)
        }
      }
    }
    else {
      if (dragDistance >= 4) {
        cleanupDragListeners()
        isMouseDown = false
        isDragging.value = false
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('control-strip:drag-start'))
        }
      }
    }
  }
  else {
    if (isDragging.value) {
      const deltaX = startMouseX - clientX
      const deltaY = startMouseY - clientY
      position.value.x = Math.max(10, Math.min(window.innerWidth - 72, startPosX + deltaX))
      position.value.y = Math.max(10, Math.min(window.innerHeight - 300, startPosY + deltaY))
    }
  }
}

let clickTimer: NodeJS.Timeout | null = null

function handlePerpendicularClick() {
  if (clickTimer) {
    clearTimeout(clickTimer)
    clickTimer = null
    toggleOrientation()
  }
  else {
    clickTimer = setTimeout(() => {
      clickTimer = null
      collapsed.value = !collapsed.value
    }, 250)
  }
}

function onDragEnd() {
  const wasDown = isMouseDown
  const wasDragging = isDragging.value
  cleanupDragListeners()
  isMouseDown = false
  isDragging.value = false
  isTouchEventState = false
  startWindowBounds = null

  if (wasDown && !wasDragging) {
    handlePerpendicularClick()
  }
}

function cleanupDragListeners() {
  if (typeof window !== 'undefined') {
    window.removeEventListener('mousemove', onDragging)
    window.removeEventListener('mouseup', onDragEnd)
    window.removeEventListener('touchmove', onDragging)
    window.removeEventListener('touchend', onDragEnd)
  }
}

function handleAction(actionId: string) {
  console.info(`[Control Strip] Button clicked: "${actionId}".`)

  const menuButtons = ['actor-characters', 'actor-avatars', 'actor-wardrobe', 'actor-motions', 'actor-motion-playground', 'actor-all-emotions', 'actor-vfx', 'actor-selfies', 'actor-macaron', 'gemini-voice', 'stage-atmosphere']
  if (menuButtons.includes(actionId)) {
    if (activePopover.value === actionId) {
      activePopover.value = null
    }
    else {
      activePopover.value = actionId
    }
    return
  }

  activePopover.value = null
  dispatchAction(actionId)
}

function handleRightClick(e: MouseEvent) {
  e.preventDefault()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('control-strip:open-customizer'))
  }
}

function handleContainerClick() {
  if (autoHideMode.value && !isFullyExpanded.value) {
    collapsed.value = false
  }
}

function toggleOrientation() {
  if (props.mode === 'mobile')
    return
  controlStripStore.toggleOrientation()
}

function getButtonIcon(btnId: string, defaultIcon: string): string {
  if (btnId === 'actor-gunslinger') {
    return 'i-ph:crosshair-bold'
  }
  if (btnId === 'viewport-cycle-modes') {
    return 'i-solar:cursor-bold-duotone'
  }
  if (btnId === 'theme-mode') {
    if (themeMode.value === 'auto')
      return 'i-solar:laptop-minimalistic-linear'
    return isDark.value ? 'i-solar:moon-linear' : 'i-solar:sun-linear'
  }
  if (btnId === 'caption-docking') {
    return settingsStore.captionDocking === 'top' ? 'i-solar:align-top-line-duotone' : 'i-solar:align-bottom-line-duotone'
  }
  if (btnId === 'caption-layout-mode') {
    return settingsStore.captionLayoutMode === 'multi' ? 'i-solar:layers-linear' : 'i-solar:window-frame-linear'
  }
  if (btnId === 'stage-atmosphere') {
    return 'i-solar:magic-stick-3-bold-duotone'
  }
  return defaultIcon
}

function getButtonIconColor(btnId: string): string {
  if (btnId === 'actor-gunslinger') {
    const stance = stageModelSettings.gunslingerStance
    if (stance === 'cat')
      return 'text-pink-400 dark:text-pink-300'
    if (stance === 'blk')
      return 'text-emerald-400 dark:text-emerald-300'
    if (stance === 'gray')
      return 'text-cyan-400 dark:text-cyan-300'
    return 'text-neutral-500 opacity-50'
  }
  if (btnId === 'viewport-cycle-modes') {
    const mode = settingsStore.controlStripInteractionMode
    if (mode === 'tactile')
      return 'text-rose-500 dark:text-rose-400'
    if (mode === 'drag')
      return 'text-orange-500 dark:text-orange-400'
    if (mode === 'positioning')
      return 'text-emerald-500 dark:text-emerald-400'
    if (mode === 'orbit')
      return 'text-indigo-500 dark:text-indigo-400'
  }
  if (btnId === 'stage-atmosphere') {
    const hasStageActive = activeAtmosphereId.value !== 'none' || activeBackgroundId.value !== 'none'
    const hasChatboxActive = isStageTamagotchi() && (chatboxActiveAtmosphereId.value !== 'none' || chatboxActiveBackgroundId.value !== 'none')
    if (hasStageActive || hasChatboxActive) {
      return 'text-amber-500 dark:text-amber-400'
    }
    return 'text-neutral-500 opacity-50'
  }
  if (btnId === 'workspace') {
    return controlStripStore.workspaceOpen ? 'text-primary-500 dark:text-primary-400' : 'text-neutral-500 opacity-70'
  }
  return ''
}

function getButtonTitle(btnId: string, defaultLabel: string): string {
  if (btnId === 'actor-gunslinger') {
    const stance = stageModelSettings.gunslingerStance
    const stanceLabels: Record<string, string> = {
      off: 'Disabled (Safe)',
      cat: 'Cat Gun (Rapid Spray)',
      blk: 'M1911 Black (.45 ACP)',
      gray: 'M1911 Silver (Steel Custom)',
    }
    return `Gunslinger Stance: ${stanceLabels[stance] || 'Disabled'}`
  }
  if (btnId === 'viewport-cycle-modes') {
    const mode = settingsStore.controlStripInteractionMode
    const modeLabels: Record<string, string> = {
      tactile: 'Tactile (Rose)',
      drag: 'Drag (Orange)',
      positioning: 'Positioning (Emerald)',
      orbit: 'Orbit (Indigo)',
    }
    return `Cycle Viewport Modes: ${modeLabels[mode] || 'Tactile'}`
  }
  if (btnId === 'chat') {
    return `Chat Toggle: ${chatOpen.value ? 'Open (Green)' : 'Closed (Red)'}`
  }
  if (btnId === 'stage') {
    if (controlStripStore.stageDisabled) {
      return 'Actor Stage: Disabled (--disable-webgl-stage)'
    }
    return `Actor Stage: ${stageEnabled.value ? 'Visible (Green)' : 'Hidden (Red)'}`
  }
  if (btnId === 'stage-mate') {
    return `Stage Mate: ${stageMateEnabled.value ? 'Active (Green)' : 'Disabled (Red)'}`
  }
  if (btnId === 'mic') {
    return `Microphone: ${micEnabled.value ? 'Active (Green)' : 'Muted (Red)'}`
  }
  if (btnId === 'caption') {
    return `Captions: ${captionOpen.value ? 'Active (Green)' : 'Disabled (Red)'}`
  }
  if (btnId === 'gemini-session') {
    const stateLabels: Record<string, string> = {
      off: 'Disconnected (Gray)',
      connecting: 'Connecting (Sky Blue)',
      active: 'Listening / Idle (Red)',
      busy: 'Transmitting / Speaking (Purple)',
      ambient: 'Witness Mode Active (Amber)',
    }
    return `Speech Session: ${stateLabels[powerState.value] || 'Disconnected (Gray)'}`
  }
  if (btnId === 'caption-docking') {
    const labels: Record<string, string> = {
      none: 'Caption Docking: NONE',
      bottom: 'Caption Docking: BOTTOM',
      top: 'Caption Docking: TOP',
      head: 'Caption Docking: HEAD',
    }
    return labels[settingsStore.captionDocking ?? 'none'] ?? 'Caption Docking: NONE'
  }
  if (btnId === 'caption-layout-mode') {
    return `Caption Layout: ${settingsStore.captionLayoutMode === 'multi' ? 'Multi-line History (Indigo)' : 'Standard Bubble (Teal)'}`
  }
  if (btnId === 'caption-sync-position') {
    return `Caption Sync Position: ${settingsStore.captionFollowStagePosition ? 'ON (Green)' : 'OFF (Red)'}`
  }
  if (btnId === 'caption-sync-visibility') {
    return `Caption Sync Visibility: ${settingsStore.captionFollowStageVisibility ? 'ON (Green)' : 'OFF (Red)'}`
  }
  if (btnId === 'head-tethered-caption') {
    return `Head-Tethered Caption: ${settingsStore.headTetheredCaptionEnabled ? 'ON (Green)' : 'OFF (Red)'}`
  }
  if (btnId === 'stage-atmosphere') {
    if (isStageTamagotchi()) {
      return `Theme & Atmosphere (Stage: ${activeAtmosphereId.value}, Chat: ${chatboxActiveAtmosphereId.value})`
    }
    return `Stage Theme & Atmosphere (${activeAtmosphereId.value}, ${activeBackgroundId.value !== 'none' ? 'Wallpaper' : 'No Wallpaper'})`
  }
  return defaultLabel
}

function getShortLabel(btnId: string): string {
  const map: Record<string, string> = {
    'stage-atmosphere': 'Theme',
    'chat': 'Chat',
    'mic': 'Mic',
    'stage': 'Stage',
    'stage-mate': 'Mate',
    'caption': 'CC',
    'gemini-session': 'Live',
    'settings': 'Set',
    'layout': 'Edit',
    'viewport-auto-hide': 'Hide',
    'always-on-top': 'Pin',
    'viewport-tactile': 'Touch',
    'viewport-drag': 'Drag',
    'viewport-positioning': 'Pos',
    'viewport-orbit': 'Orbit',
    'viewport-cycle-modes': settingsStore.controlStripInteractionMode === 'tactile'
      ? 'Tact'
      : settingsStore.controlStripInteractionMode === 'drag'
        ? 'Drag'
        : settingsStore.controlStripInteractionMode === 'positioning'
          ? 'Pos'
          : settingsStore.controlStripInteractionMode === 'orbit' ? 'Orbt' : 'Modes',
    'viewport-reset-coordinates': 'Reset',
    'actor-characters': 'Char',
    'actor-avatars': 'Avtr',
    'actor-wardrobe': 'Wear',
    'actor-motions': 'Move',
    'actor-motion-playground': 'Move',
    'actor-all-emotions': 'Mood',
    'actor-vfx': 'VFX',
    'actor-selfies': 'Self',
    'actor-macaron': 'Snack',
    'workspace': 'Work',
    'theme-mode': 'Color',
    'caption-docking': settingsStore.captionDocking === 'none'
      ? 'None'
      : settingsStore.captionDocking === 'bottom'
        ? 'Bot'
        : settingsStore.captionDocking === 'top'
          ? 'Top'
          : settingsStore.captionDocking === 'head' ? 'Head' : 'Dock',
    'caption-layout-mode': 'Rows',
    'caption-sync-position': 'Pos↔',
    'caption-sync-visibility': 'Vis↔',
    'head-tethered-caption': 'HeadCC',
    'caption-theme-mode': 'Theme',
    'caption-opacity': 'Opac',
    'exit-app': 'Quit',
  }
  return map[btnId] || btnId.substring(0, 4)
}
</script>

<template>
  <div
    :class="[
      'absolute pointer-events-auto select-none',
      props.mode === 'mobile' ? 'z-45' : '',
      'bg-white/95 dark:bg-neutral-900/85',
      'backdrop-blur-xl border border-neutral-300/80 dark:border-neutral-800/80',
      'shadow-2xl shadow-black/10 rounded-full',
      isDragging ? 'scale-102 border-primary-500/30 shadow-primary-500/5' : '',
      orientation === 'vertical' ? 'flex flex-col items-center py-2 px-1 gap-2 w-12' : 'flex flex-row items-center px-2 py-1 gap-2 h-12',
      autoHideTabClasses,
    ]"
    :style="containerStyle"
    @click="handleContainerClick"
    @contextmenu="handleRightClick"
    @mouseenter="onContainerMouseEnter"
    @mouseleave="onContainerMouseLeave"
  >
    <!-- AUTO-HIDE TAB HANDLE -->
    <div
      v-if="autoHideMode && !isFullyExpanded"
      class="h-9 w-9 flex cursor-pointer items-center justify-center text-neutral-800 dark:text-neutral-100"
      title="Click to Pin Control Strip"
      @click="collapsed = false"
    >
      <span
        :class="[
          'text-2xl transition-all duration-200',
          (dockedEdge === 'left' || dockedEdge === 'right') ? 'i-solar:double-alt-arrow-right-linear' : 'i-solar:double-alt-arrow-down-linear',
          dockedEdge === 'right' ? 'rotate-180' : '',
          dockedEdge === 'bottom' ? 'rotate-180' : '',
        ]"
      />
    </div>

    <!-- TOP/LEFT ENDCAP: Perpendicular Drag & Layout Handle -->
    <button
      v-else
      :class="[
        'relative flex items-center justify-center overflow-hidden',
        'w-9 h-9 rounded-full',
        'bg-neutral-100 hover:bg-neutral-200 dark:bg-white/10 dark:hover:bg-white/20',
        'border border-neutral-200 dark:border-white/10',
        'text-neutral-800 dark:text-neutral-100',
        'transition-all duration-200',
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
      ]"
      title="Drag to Reposition | Click to Collapse/Expand | Double Click to Toggle Layout"
      @mousedown="onDragStart"
      @touchstart="onDragStart"
      @mouseenter="isHoveredHandle = true"
      @mouseleave="isHoveredHandle = false"
      @click.stop
    >
      <!-- Icon fades out on hover -->
      <span
        :class="[
          'text-lg absolute transition-all duration-200 ease-in-out',
          collapsed ? 'i-ph:dots-six-bold scale-110' : (orientation === 'vertical' ? 'i-solar:double-alt-arrow-right-linear' : 'i-solar:double-alt-arrow-down-linear'),
          isHoveredHandle ? 'opacity-0 scale-75' : 'opacity-100 scale-100',
        ]"
      />

      <!-- Short label fades in on hover -->
      <span
        :class="[
          'text-[9px] font-extrabold uppercase tracking-wider text-center px-0.5 leading-none absolute transition-all duration-200 ease-in-out',
          isHoveredHandle ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
        ]"
      >
        {{ collapsed ? 'Show' : 'Hide' }}
      </span>
    </button>

    <!-- CORE INTERACTIVE BUTTONS -->
    <div
      v-if="isFullyExpanded"
      :class="[
        orientation === 'vertical' ? 'flex flex-col items-center gap-2' : 'flex flex-row items-center gap-2',
      ]"
    >
      <button
        v-for="btn in activeButtons"
        :key="btn.id"
        :class="[
          'relative flex items-center justify-center overflow-hidden',
          'w-9 h-9 rounded-full border border-neutral-200 dark:border-white/10',
          'bg-neutral-100 hover:bg-neutral-200 dark:bg-white/10 dark:hover:bg-white/20 text-neutral-800 dark:text-neutral-100',
          'transition-all duration-200 hover:scale-105 cursor-pointer control-strip-btn shadow-sm',
          btn.id === 'stage' && controlStripStore.stageDisabled ? 'opacity-40 grayscale cursor-not-allowed' : '',
          activePopover === btn.id ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-transparent dark:ring-primary-400 bg-primary-500/15' : '',
        ]"
        :title="getButtonTitle(btn.id, btn.label)"
        @mouseenter="hoveredButtonId = btn.id"
        @mouseleave="hoveredButtonId = null"
        @click="handleAction(btn.id)"
        @contextmenu.prevent.stop="openPresetPopover(btn.id)"
      >
        <!-- Icon fades out on hover -->
        <span
          :class="[
            getButtonIcon(btn.id, btn.icon),
            getButtonIconColor(btn.id),
            'text-lg absolute transition-all duration-200 ease-in-out',
            hoveredButtonId === btn.id ? 'opacity-0 scale-75' : 'opacity-100 scale-100',
          ]"
        />

        <!-- Short label fades in on hover -->
        <span
          :class="[
            'text-[9px] font-extrabold uppercase tracking-wider text-center px-0.5 leading-none absolute transition-all duration-200 ease-in-out',
            hoveredButtonId === btn.id ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
          ]"
        >
          {{ getShortLabel(btn.id) }}
        </span>

        <!-- Status dot badge for Stage (Actor Stage) -->
        <span
          v-if="btn.id === 'stage'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            controlStripStore.stageDisabled ? 'bg-neutral-400 dark:bg-neutral-600' : stageEnabled ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Stage Mate -->
        <span
          v-if="btn.id === 'stage-mate'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            stageMateEnabled ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Chat (Chat Toggle) -->
        <span
          v-if="btn.id === 'chat'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            chatOpen ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Microphone (Microphone Toggle) -->
        <span
          v-if="btn.id === 'mic'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            micEnabled ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Captions (CC Toggle) -->
        <span
          v-if="btn.id === 'caption'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            captionOpen ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Stage Atmosphere / Theme -->
        <span
          v-if="btn.id === 'stage-atmosphere'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            (activeAtmosphereId !== 'none' || activeBackgroundId !== 'none' || (isStageTamagotchi() && (chatboxActiveAtmosphereId !== 'none' || chatboxActiveBackgroundId !== 'none')))
              ? 'bg-amber-400 dark:bg-amber-300'
              : 'bg-neutral-400 opacity-50',
          ]"
        />

        <!-- Status dot badge for Gemini Session (Sparkle Toggle) -->
        <span
          v-if="btn.id === 'gemini-session'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-all duration-300',
            geminiDotClasses,
          ]"
        />

        <!-- Status dot badge for Auto-Hide toggle -->
        <span
          v-if="btn.id === 'viewport-auto-hide'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            fadeOnHoverEnabled ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Always-on-Top toggle -->
        <span
          v-if="btn.id === 'always-on-top'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            alwaysOnTop ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Tactile Mode -->
        <span
          v-if="btn.id === 'viewport-tactile'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            stageMode === 'tactileMode' ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Drag Mode -->
        <span
          v-if="btn.id === 'viewport-drag'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            stageMode === 'dragMode' ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Positioning Mode -->
        <span
          v-if="btn.id === 'viewport-positioning'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            stageMode === 'positionMode' ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for Orbit Mode -->
        <span
          v-if="btn.id === 'viewport-orbit'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            stageMode === 'orbitMode' ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for caption-sync-position -->
        <span
          v-if="btn.id === 'caption-sync-position'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            settingsStore.captionFollowStagePosition ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for caption-sync-visibility -->
        <span
          v-if="btn.id === 'caption-sync-visibility'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            settingsStore.captionFollowStageVisibility ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for head-tethered-caption -->
        <span
          v-if="btn.id === 'head-tethered-caption'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            settingsStore.headTetheredCaptionEnabled ? 'bg-green-500' : 'bg-red-500',
          ]"
        />

        <!-- Status dot badge for theme-mode -->
        <span
          v-if="btn.id === 'theme-mode'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            themeMode === 'auto' ? 'bg-cyan-500' : isDark ? 'bg-green-500' : 'bg-amber-500',
          ]"
        />

        <!-- Status dot badge for caption-docking -->
        <span
          v-if="btn.id === 'caption-docking'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-all duration-200',
            settingsStore.captionDocking === 'none' ? 'bg-neutral-400 shadow-[0_0_6px_rgba(163,163,163,0.5)]' : '',
            settingsStore.captionDocking === 'bottom' ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]' : '',
            settingsStore.captionDocking === 'top' ? 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.5)]' : '',
            settingsStore.captionDocking === 'head' ? 'bg-fuchsia-400 shadow-[0_0_6px_rgba(232,121,249,0.5)]' : '',
          ]"
        />

        <!-- Status dot badge for viewport-cycle-modes -->
        <span
          v-if="btn.id === 'viewport-cycle-modes'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-all duration-200',
            settingsStore.controlStripInteractionMode === 'tactile' ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]' : '',
            settingsStore.controlStripInteractionMode === 'drag' ? 'bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.5)]' : '',
            settingsStore.controlStripInteractionMode === 'positioning' ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : '',
            settingsStore.controlStripInteractionMode === 'orbit' ? 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)]' : '',
          ]"
        />

        <!-- Status dot badge for actor-gunslinger -->
        <span
          v-if="btn.id === 'actor-gunslinger'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-all duration-200',
            stageModelSettings.gunslingerStance === 'off' ? 'bg-neutral-500/40' : '',
            stageModelSettings.gunslingerStance === 'cat' ? 'bg-pink-400 shadow-[0_0_6px_rgba(244,114,182,0.6)]' : '',
            stageModelSettings.gunslingerStance === 'blk' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : '',
            stageModelSettings.gunslingerStance === 'gray' ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]' : '',
          ]"
        />

        <!-- Status dot badge for caption-layout-mode -->
        <span
          v-if="btn.id === 'caption-layout-mode'"
          :class="[
            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full transition-colors duration-200',
            settingsStore.captionLayoutMode === 'multi' ? 'bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.5)]' : 'bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.5)]',
          ]"
        />
      </button>
    </div>

    <!-- POPOVERS -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 translate-y-2 scale-95"
      leave-to-class="opacity-0 translate-y-2 scale-95"
    >
      <div
        v-if="activePopover"
        ref="popoverRef"
        :class="[
          'absolute z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-3 text-neutral-800 dark:text-neutral-200',
          popoverPlacement === 'bottom' ? 'top-full mt-3 left-1/2 -translate-x-1/2' : '',
          popoverPlacement === 'top' ? 'bottom-full mb-3 left-1/2 -translate-x-1/2' : '',
          popoverPlacement === 'right' ? 'left-full ml-3 top-1/2 -translate-y-1/2' : '',
          popoverPlacement === 'left' ? 'right-full mr-3 top-1/2 -translate-y-1/2' : '',
          activePopover === 'actor-motion-playground'
            ? 'w-[360px] sm:w-[380px] max-w-[92vw] max-h-[85vh] overflow-y-auto scrollbar-thin'
            : 'w-64 max-w-xs max-h-[440px] overflow-y-auto scrollbar-thin',
        ]"
        @click.stop
      >
        <!-- REGISTRY-DRIVEN POPOVERS (extracted so far) -->
        <component
          :is="STRIP_POPOVER_COMPONENTS[activePopover as string]"
          v-if="activePopover && STRIP_POPOVER_COMPONENTS[activePopover]"
          @close="activePopover = null"
        />

        <!-- STAGE PRESETS POPOVER -->
        <div v-if="activePopover === 'stage-preset'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-1.5 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Stage Layout & Presets</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>

          <!-- Dating Sim Mode Toggle Row -->
          <div class="flex items-center justify-between border border-rose-500/10 rounded-xl bg-rose-500/5 p-2 dark:border-rose-500/20 dark:bg-rose-950/10">
            <div class="flex items-center gap-2">
              <span class="i-solar:heart-bold text-base text-rose-500" :class="{ 'animate-pulse': datingSimStore.enabled }" />
              <span class="text-[11px] text-neutral-700 font-bold dark:text-neutral-300">Dating Sim Mode</span>
            </div>
            <button
              :class="[
                'px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all active:scale-95 border cursor-pointer',
                datingSimStore.enabled
                  ? 'bg-gradient-to-r from-rose-500 to-fuchsia-600 border-rose-400 text-white shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                  : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200/60 dark:border-neutral-750 text-neutral-500 hover:border-rose-400/40 hover:text-rose-400',
              ]"
              @click="toggleDatingSimMode"
            >
              {{ datingSimStore.enabled ? 'On' : 'Off' }}
            </button>
          </div>

          <!-- Monitor Selection -->
          <div v-if="monitorCount > 1" class="flex items-center justify-between gap-2 rounded-xl bg-neutral-200/30 p-1.5 dark:bg-neutral-800/30">
            <span class="px-1 text-[10px] text-neutral-500 font-bold tracking-wide uppercase">Monitor</span>
            <div class="flex gap-1">
              <button
                v-for="m in monitorCount"
                :key="m"
                :class="[
                  'w-6 h-6 flex items-center justify-center text-xs font-semibold rounded-lg transition-all active:scale-95',
                  activeMonitor === m
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="selectMonitor('actor', m)"
              >
                {{ m }}
              </button>
            </div>
          </div>

          <!-- Size Presets horizontal compact list -->
          <div class="grid grid-cols-4 gap-1.5 py-1">
            <button
              v-for="p in PRESETS"
              :key="p.name"
              class="flex flex-col cursor-pointer items-center justify-center gap-1.5 border border-neutral-200/50 rounded-xl bg-neutral-50/50 px-1 py-2.5 text-[11px] text-neutral-700 font-semibold transition-all duration-200 active:scale-95 dark:border-neutral-800/20 hover:border-sky-400/50 dark:bg-neutral-800/40 hover:bg-sky-500/10 dark:text-neutral-300 hover:text-sky-600 dark:hover:bg-sky-500/20 dark:hover:text-sky-300"
              @click="applySizePreset('actor', p.name, presetAlignment)"
            >
              <span :class="[p.icon, 'text-lg']" />
              <span class="text-[10px]">{{ p.label }}</span>
            </button>
          </div>

          <!-- Symmetrical Alignment Grid mockup (9-button layout) -->
          <div class="flex flex-col items-center gap-1.5 border-t border-neutral-200 pt-2 dark:border-neutral-800">
            <div class="grid grid-cols-3 mx-auto h-26 w-26 gap-1.5">
              <!-- Top-Left -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'top-left'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('actor', undefined, 'top-left'); selectedAlignment = 'top-left'"
              >
                <span class="i-solar:arrow-left-up-linear text-base" />
              </button>

              <!-- Top -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'top'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('actor', undefined, 'top'); selectedAlignment = 'top'"
              >
                <span class="i-solar:arrow-up-linear text-base" />
              </button>

              <!-- Top-Right -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'top-right'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('actor', undefined, 'top-right'); selectedAlignment = 'top-right'"
              >
                <span class="i-solar:arrow-right-up-linear text-base" />
              </button>

              <!-- Left -->
              <button
                :class="[
                  'w-8 h-8 flex items-xl items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'left'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('actor', undefined, 'left'); selectedAlignment = 'left'"
              >
                <span class="i-solar:arrow-left-linear text-base" />
              </button>

              <!-- Center -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'center'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('actor', undefined, 'center'); selectedAlignment = 'center'"
              >
                <span class="i-solar:record-linear text-base" />
              </button>

              <!-- Right -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'right'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('actor', undefined, 'right'); selectedAlignment = 'right'"
              >
                <span class="i-solar:arrow-right-linear text-base" />
              </button>

              <!-- Bottom-Left -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'bottom-left'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('actor', undefined, 'bottom-left'); selectedAlignment = 'bottom-left'"
              >
                <span class="i-solar:arrow-left-down-linear text-base" />
              </button>

              <!-- Bottom -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'bottom'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('actor', undefined, 'bottom'); selectedAlignment = 'bottom'"
              >
                <span class="i-solar:arrow-down-linear text-base" />
              </button>

              <!-- Bottom-Right -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'bottom-right'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('actor', undefined, 'bottom-right'); selectedAlignment = 'bottom-right'"
              >
                <span class="i-solar:arrow-right-down-linear text-base" />
              </button>
            </div>
          </div>
        </div>

        <!-- CHAT PRESETS POPOVER -->
        <div v-if="activePopover === 'chat-preset'" class="flex flex-col gap-2">
          <div class="flex items-center justify-between border-b border-neutral-200 pb-1.5 dark:border-neutral-800">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase">Chat Layout</span>
            <button class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" @click="activePopover = null">
              <span class="i-solar:close-circle-outline text-lg" />
            </button>
          </div>

          <!-- Monitor Selection -->
          <div v-if="monitorCount > 1" class="flex items-center justify-between gap-2 rounded-xl bg-neutral-200/30 p-1.5 dark:bg-neutral-800/30">
            <span class="px-1 text-[10px] text-neutral-500 font-bold tracking-wide uppercase">Monitor</span>
            <div class="flex gap-1">
              <button
                v-for="m in monitorCount"
                :key="m"
                :class="[
                  'w-6 h-6 flex items-center justify-center text-xs font-semibold rounded-lg transition-all active:scale-95',
                  activeMonitor === m
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="selectMonitor('chat', m)"
              >
                {{ m }}
              </button>
            </div>
          </div>

          <!-- Size Presets Stateless Action Strip -->
          <div class="mx-0.5 my-1 flex border border-neutral-200/20 rounded-xl bg-neutral-200/40 p-0.5 divide-x divide-neutral-200/50 dark:border-neutral-800/30 dark:bg-neutral-900/60 dark:divide-neutral-800/80">
            <button
              v-for="p in PRESETS"
              :key="p.name"
              class="flex-1 cursor-pointer rounded-lg py-1.5 text-center text-[10px] text-neutral-600 font-bold transition-all active:scale-95 hover:bg-white/40 dark:text-neutral-400 hover:text-sky-500 dark:hover:bg-neutral-800/40 dark:hover:text-sky-400"
              @click="applySizePreset('chat', p.name, presetAlignment)"
            >
              {{ p.label === 'Medium' ? 'Med.' : p.label }}
            </button>
          </div>

          <!-- Symmetrical Alignment Grid mockup (9-button layout) -->
          <div class="flex flex-col items-center gap-1.5 border-t border-neutral-200 pt-2 dark:border-neutral-800">
            <div class="grid grid-cols-3 mx-auto h-26 w-26 gap-1.5">
              <!-- Top-Left -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'top-left'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('chat', undefined, 'top-left'); selectedAlignment = 'top-left'"
              >
                <span class="i-solar:arrow-left-up-linear text-base" />
              </button>

              <!-- Top -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'top'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('chat', undefined, 'top'); selectedAlignment = 'top'"
              >
                <span class="i-solar:arrow-up-linear text-base" />
              </button>

              <!-- Top-Right -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'top-right'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('chat', undefined, 'top-right'); selectedAlignment = 'top-right'"
              >
                <span class="i-solar:arrow-right-up-linear text-base" />
              </button>

              <!-- Left -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'left'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('chat', undefined, 'left'); selectedAlignment = 'left'"
              >
                <span class="i-solar:arrow-left-linear text-base" />
              </button>

              <!-- Center -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'center'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('chat', undefined, 'center'); selectedAlignment = 'center'"
              >
                <span class="i-solar:record-linear text-base" />
              </button>

              <!-- Right -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'right'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('chat', undefined, 'right'); selectedAlignment = 'right'"
              >
                <span class="i-solar:arrow-right-linear text-base" />
              </button>

              <!-- Bottom-Left -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'bottom-left'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('chat', undefined, 'bottom-left'); selectedAlignment = 'bottom-left'"
              >
                <span class="i-solar:arrow-left-down-linear text-base" />
              </button>

              <!-- Bottom -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'bottom'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('chat', undefined, 'bottom'); selectedAlignment = 'bottom'"
              >
                <span class="i-solar:arrow-down-linear text-base" />
              </button>

              <!-- Bottom-Right -->
              <button
                :class="[
                  'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
                  selectedAlignment === 'bottom-right'
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
                ]"
                @click="applySizePreset('chat', undefined, 'bottom-right'); selectedAlignment = 'bottom-right'"
              >
                <span class="i-solar:arrow-right-down-linear text-base" />
              </button>
            </div>
          </div>
        </div>

        <!-- UNIFIED MOTION POPOVER (Create & Library) -->
        <div v-if="activePopover === 'actor-motion-playground'" class="flex flex-col gap-3">
          <!-- Header: Walking icon + "Motion" + Close button -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="i-solar:walking-round-linear text-xl text-neutral-800 dark:text-neutral-100" />
              <h3 class="text-base text-neutral-900 font-bold dark:text-neutral-100">
                Motion
              </h3>
            </div>
            <button
              class="flex cursor-pointer items-center justify-center rounded-full p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              @click="activePopover = null"
            >
              <span class="i-solar:close-circle-outline text-xl" />
            </button>
          </div>

          <!-- Top Segmented Tabs: Create | Library -->
          <div class="grid grid-cols-2 border border-neutral-200/80 rounded-xl bg-neutral-100/90 p-1 dark:border-neutral-800 dark:bg-neutral-950/70">
            <button
              type="button"
              :class="[
                'py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer',
                motionActiveTab === 'create'
                  ? 'bg-primary-500 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
              ]"
              @click="motionActiveTab = 'create'"
            >
              Create
            </button>
            <button
              type="button"
              :class="[
                'py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer',
                motionActiveTab === 'library'
                  ? 'bg-primary-500 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
              ]"
              @click="motionActiveTab = 'library'"
            >
              Library
            </button>
          </div>

          <!-- TAB 1: CREATE -->
          <div v-if="motionActiveTab === 'create'" class="flex flex-col gap-3">
            <!-- Quick motions section -->
            <div class="flex flex-col gap-1.5">
              <span class="text-[11px] text-neutral-600 font-bold dark:text-neutral-400">
                Quick motions
              </span>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="qm in quickMotions"
                  :key="qm.id"
                  type="button"
                  :disabled="isGeneratingMotionPlayground"
                  :class="[
                    'group flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer active:scale-98',
                    'bg-neutral-50/70 hover:bg-neutral-100/90 dark:bg-neutral-800/40 dark:hover:bg-neutral-800/80',
                    'border-neutral-200/70 hover:border-primary-500/60 dark:border-neutral-800 dark:hover:border-primary-500/50',
                    isGeneratingMotionPlayground ? 'opacity-50 cursor-not-allowed' : '',
                  ]"
                  @click="handleTriggerQuickMotion(qm)"
                >
                  <div class="h-9 w-9 flex shrink-0 items-center justify-center transition-transform group-hover:scale-105">
                    <img :src="qm.glyph" :alt="qm.title" class="pointer-events-none max-h-full max-w-full select-none object-contain">
                  </div>
                  <span class="text-xs text-neutral-800 font-semibold leading-snug dark:text-neutral-200">
                    {{ qm.title }}
                  </span>
                </button>
              </div>
            </div>

            <!-- Describe a motion section -->
            <div class="flex flex-col gap-1.5">
              <span class="text-[11px] text-neutral-600 font-bold dark:text-neutral-400">
                Describe a motion
              </span>
              <div class="relative">
                <textarea
                  v-model="motionPlaygroundPrompt"
                  :disabled="isGeneratingMotionPlayground"
                  rows="2"
                  maxlength="200"
                  placeholder="Take two small steps sideways, then wave with your right hand."
                  :class="[
                    'w-full resize-none rounded-xl p-2.5 pb-6 text-xs transition-colors',
                    'bg-neutral-100/80 dark:bg-neutral-950/60 border border-neutral-300 dark:border-neutral-800',
                    'text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600',
                    'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
                  ]"
                  @keydown.enter.prevent="handleGenerateAndPlay"
                />
                <span class="absolute bottom-2 right-2 text-[10px] text-neutral-400 font-mono">
                  {{ motionPlaygroundPrompt.length }}/200
                </span>
              </div>
            </div>

            <!-- Duration Selector -->
            <div class="flex items-center justify-between">
              <span class="text-xs text-neutral-600 font-medium dark:text-neutral-400">Duration</span>
              <div class="flex items-center gap-1 border border-neutral-200 rounded-lg bg-neutral-100 p-0.5 dark:border-neutral-800 dark:bg-neutral-950">
                <button
                  v-for="dur in (['4s', '6s', '8s'] as const)"
                  :key="dur"
                  type="button"
                  :class="[
                    'px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer',
                    motionPlaygroundDuration === dur
                      ? 'bg-primary-500 text-white shadow-xs font-semibold'
                      : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200',
                  ]"
                  @click="motionPlaygroundDuration = dur"
                >
                  {{ dur }}
                </button>
              </div>
            </div>

            <!-- Primary CTA Button -->
            <div class="flex flex-col gap-1">
              <button
                type="button"
                :disabled="isGeneratingMotionPlayground || !motionPlaygroundPrompt.trim()"
                :class="[
                  'w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs transition-all shadow-md cursor-pointer',
                  isGeneratingMotionPlayground || !motionPlaygroundPrompt.trim()
                    ? 'bg-primary-500/50 text-white/70 cursor-not-allowed shadow-none'
                    : 'bg-primary-500 hover:bg-primary-600 text-white shadow-primary-500/25 active:scale-[0.99]',
                ]"
                @click="handleGenerateAndPlay"
              >
                <span
                  v-if="isGeneratingMotionPlayground"
                  class="i-solar:restart-linear animate-spin text-base"
                />
                <span
                  v-else
                  class="i-solar:walking-round-linear text-base"
                />
                <span>
                  {{ isGeneratingMotionPlayground ? (motionPlaygroundStatusMessage || 'Generating...') : 'Generate & play' }}
                </span>
              </button>
              <p class="text-center text-[10px] text-neutral-400 dark:text-neutral-500">
                Try freely. Save only what you like.
              </p>
            </div>
          </div>

          <!-- TAB 2: LIBRARY -->
          <div v-if="motionActiveTab === 'library'" class="flex flex-col gap-2.5">
            <!-- Search bar -->
            <div class="relative flex items-center">
              <span class="i-solar:magnifer-linear absolute left-2.5 text-sm text-neutral-400" />
              <input
                v-model="motionSearchQuery"
                type="text"
                placeholder="Search motions..."
                :class="[
                  'w-full pl-8 pr-3 py-1.5 text-xs rounded-xl transition-colors',
                  'bg-neutral-100/80 dark:bg-neutral-950/60 border border-neutral-300 dark:border-neutral-800',
                  'text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600',
                  'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
                ]"
              >
            </div>

            <!-- Filter pills: All | Built-in | Saved | Uploaded -->
            <div class="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                v-for="flt in ([{ id: 'all', label: 'All' }, { id: 'builtin', label: 'Built-in' }, { id: 'saved', label: 'Saved' }, { id: 'uploaded', label: 'Uploaded' }] as const)"
                :key="flt.id"
                type="button"
                :class="[
                  'px-2.5 py-1 text-[11px] font-semibold rounded-full transition-all shrink-0 cursor-pointer',
                  libraryFilter === flt.id
                    ? 'bg-primary-500 text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700',
                ]"
                @click="libraryFilter = flt.id"
              >
                {{ flt.label }}
              </button>
            </div>

            <!-- Motion Item List -->
            <div class="max-h-52 flex flex-col gap-1.5 overflow-y-auto py-0.5 scrollbar-thin">
              <div
                v-for="item in libraryMotions"
                :key="item.key"
                :class="[
                  'flex items-center justify-between p-2 rounded-xl border text-xs transition-all',
                  currentlyPlayingMotionKey === item.key
                    ? 'border-primary-500/80 bg-primary-500/10 text-primary-900 dark:text-primary-100 ring-1 ring-primary-500/50'
                    : 'border-neutral-200/70 bg-neutral-50/50 hover:bg-neutral-100/70 dark:border-neutral-800/80 dark:bg-neutral-950/40 dark:hover:bg-neutral-800/50 text-neutral-800 dark:text-neutral-200',
                ]"
              >
                <div class="min-w-0 flex flex-1 items-center gap-2.5">
                  <img
                    v-if="getLibraryMotionGlyph(item)"
                    :src="getLibraryMotionGlyph(item)"
                    class="pointer-events-none size-5 shrink-0 select-none object-contain opacity-80"
                  >
                  <span
                    v-else
                    class="i-solar:walking-round-linear shrink-0 text-base text-neutral-400 dark:text-neutral-500"
                  />
                  <div class="min-w-0 flex-1">
                    <h5 class="truncate text-xs text-neutral-900 font-semibold dark:text-neutral-100">
                      {{ item.label }}
                    </h5>
                    <p class="text-[10px] text-neutral-400 capitalize">
                      {{ item.source === 'builtin' ? 'Built-in' : item.source === 'saved' ? 'Saved' : 'Uploaded' }} • {{ item.duration }}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  :class="[
                    'flex shrink-0 items-center justify-center p-1.5 rounded-lg transition-all cursor-pointer',
                    currentlyPlayingMotionKey === item.key
                      ? 'bg-primary-500 text-white shadow-xs'
                      : 'text-neutral-400 hover:bg-neutral-200/80 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200',
                  ]"
                  @click="handlePlayLibraryMotion(item)"
                >
                  <span
                    :class="currentlyPlayingMotionKey === item.key ? 'i-solar:stop-bold size-3.5' : 'i-solar:play-bold size-3.5'"
                  />
                </button>
              </div>

              <!-- Empty state -->
              <div
                v-if="libraryMotions.length === 0"
                class="flex flex-col items-center justify-center py-6 text-center opacity-40"
              >
                <span class="i-solar:magic-stick-3-bold-duotone text-2xl" />
                <span class="mt-1 text-[10px]">No motions found</span>
              </div>
            </div>

            <!-- Manage motions link -->
            <button
              type="button"
              class="inline-flex cursor-pointer items-center justify-center gap-1 text-[11px] text-neutral-500 font-medium transition-colors hover:text-primary-500"
              @click="openSettingsRoute('/settings/airi-card')"
            >
              <span>Manage motions</span>
              <span class="i-solar:arrow-right-up-linear text-xs" />
            </button>
          </div>

          <!-- LAST RESULT CARD (Rendered on both tabs if available) -->
          <div
            v-if="lastMotionResult"
            class="flex flex-col gap-2 border border-neutral-200/80 rounded-xl bg-neutral-50/80 p-2.5 dark:border-neutral-800 dark:bg-neutral-950/60"
          >
            <div class="flex items-center justify-between">
              <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
                Last Result
              </span>
              <span
                :class="[
                  'px-2 py-0.2 rounded-full text-[9px] font-bold border',
                  lastMotionResult.isSaved
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-neutral-300 dark:border-neutral-700 text-neutral-500',
                ]"
              >
                {{ lastMotionResult.isSaved ? 'Saved' : 'Unsaved' }}
              </span>
            </div>

            <div class="min-w-0">
              <h4 class="truncate text-xs text-neutral-900 font-bold dark:text-neutral-100">
                {{ lastMotionResult.title }}
              </h4>
              <p class="text-[10px] text-neutral-400">
                {{ lastMotionResult.duration }}
              </p>
            </div>

            <!-- Action buttons: Replay, Edit prompt, Save to library -->
            <div class="flex items-center gap-1.5 pt-0.5">
              <button
                type="button"
                class="shadow-2xs flex flex-1 cursor-pointer items-center justify-center gap-1 border border-neutral-300 rounded-lg bg-white py-1.5 text-xs text-neutral-700 font-semibold transition active:scale-98 dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
                @click="handleReplayLastMotion"
              >
                <span class="i-solar:play-bold text-xs" />
                <span>Replay</span>
              </button>

              <button
                type="button"
                class="shadow-2xs flex flex-1 cursor-pointer items-center justify-center gap-1 border border-neutral-300 rounded-lg bg-white py-1.5 text-xs text-neutral-700 font-semibold transition active:scale-98 dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
                @click="handleEditPrompt"
              >
                <span class="i-solar:pen-linear text-xs" />
                <span>Edit prompt</span>
              </button>

              <button
                v-if="!lastMotionResult.isSaved"
                type="button"
                class="shadow-2xs flex flex-1 cursor-pointer items-center justify-center gap-1 border border-neutral-300 rounded-lg bg-white py-1.5 text-xs text-neutral-700 font-semibold transition active:scale-98 dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
                @click="handleSaveToLibrary"
              >
                <span class="i-solar:bookmark-linear text-xs" />
                <span>Save to library</span>
              </button>
            </div>
          </div>

          <!-- ALWAYS ACCESSIBLE BOTTOM FOOTER: STOP MOTION -->
          <div class="border-t border-neutral-200/60 pt-1 dark:border-neutral-800/80">
            <button
              type="button"
              class="w-full flex cursor-pointer items-center justify-center gap-2 py-1.5 text-xs text-neutral-600 font-semibold transition-colors dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              @click="handleStopMotion"
            >
              <span class="i-solar:stop-bold size-3.5" />
              <span>Stop motion</span>
            </button>
          </div>
        </div>

        <!-- Selfies stays shell-rendered: it needs the capture channel, which must
             stay single-owner. The cast covers useControlStripSelfie typing its
             provider as `{ type: string }`, dropping id/url/title. -->
        <SelfiesPopover
          v-if="activePopover === 'actor-selfies'"
          :selfies="selfies as any"
          :countdown="selfieCountdown"
          @take-selfie="triggerSelfie"
          @select-background="selectSelfieBackground"
          @close="activePopover = null"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.3);
  border-radius: 2px;
}
</style>
