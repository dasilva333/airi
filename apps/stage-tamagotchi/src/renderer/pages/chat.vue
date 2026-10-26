<script setup lang="ts">
import type { LatestTurnUsage } from '@proj-airi/stage-ui/stores/modules/live-session'
import type { PacingMetrics } from '@proj-airi/stage-ui/types'
import type { VoiceEditorPayload } from '@proj-airi/stage-ui/types/voice-editor'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { ChatOptionsPopover, ChatWorkspacePopover } from '@proj-airi/stage-layouts'
import { resolveAtmosphereComponent } from '@proj-airi/stage-layouts/components/Backgrounds'
import { estimateTokens, formatTokenCount } from '@proj-airi/stage-shared'
import { ChatBrainPopover, ChatSessionModal, VoiceCreatorModal } from '@proj-airi/stage-ui/components'
import { DEFAULT_SANDBOX_WORKSTATION_INSTRUCTION } from '@proj-airi/stage-ui/constants/prompts/character-defaults'
import { useBackgroundStore } from '@proj-airi/stage-ui/stores/background'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useLiveSessionStore } from '@proj-airi/stage-ui/stores/modules/live-session'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { usePositioningStore } from '@proj-airi/stage-ui/stores/settings/positioning'
import { useBroadcastChannel, useLocalStorage, useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, defineAsyncComponent, markRaw, nextTick, onUnmounted, ref, watch } from 'vue'

import LogoDark from '../../../../../packages/stage-layouts/src/assets/logo-dark.svg'
import ChatDashboardPanel from '../components/chat/ChatDashboardPanel.vue'
import ChatWorkspaceCoordinator from '../components/chat/ChatWorkspaceCoordinator.vue'

import { electronApplySizePreset, electronOpenSettings, electronWindowSetTitle } from '../../shared/eventa'

// Code-split workspace sub-surfaces to eliminate heavy initial bundle evaluation
const chat_arcade = defineAsyncComponent(() => import('../components/chat/chat_arcade.vue'))
const chat_director = defineAsyncComponent(() => import('../components/chat/chat_director.vue'))
const chat_event_log = defineAsyncComponent(() => import('../components/chat/chat_event_log.vue'))
const chat_knowledge_graph = defineAsyncComponent(() => import('../components/chat/chat_knowledge_graph.vue'))
const chat_lifetime = defineAsyncComponent(() => import('../components/chat/chat_lifetime.vue'))
const chat_media = defineAsyncComponent(() => import('../components/chat/chat_media.vue'))
const chat_messages = defineAsyncComponent(() => import('../components/chat/chat_messages.vue'))
const chat_music = defineAsyncComponent(() => import('../components/chat/chat_music.vue'))
const chat_rehearsal = defineAsyncComponent(() => import('../components/chat/chat_rehearsal.vue'))
const chat_studio = defineAsyncComponent(() => import('../components/chat/chat_studio.vue'))
const chat_world = defineAsyncComponent(() => import('../components/chat/chat_world.vue'))

// Active Surface Ref
const activeSurfaceRef = ref<any>(null)
// Extract the nested interactiveAreaRef from activeSurfaceRef if available
const interactiveAreaRef = computed(() => activeSurfaceRef.value?.interactiveAreaRef)

const chatSessionStore = useChatSessionStore()
const airiCardStore = useAiriCardStore()
const liveSessionStore = useLiveSessionStore()
const backgroundStore = useBackgroundStore()
const { chatboxActiveBackgroundUrl, chatboxActiveBackgroundColor, chatboxActiveAtmosphereId } = storeToRefs(backgroundStore)
const activeChatAtmosphereComponent = computed(() => resolveAtmosphereComponent(chatboxActiveAtmosphereId.value))

const { activeCard, activeCardId } = storeToRefs(airiCardStore)
const { activeSessionId, sessionMetas, messages } = storeToRefs(chatSessionStore)
const { latestTurnUsage } = storeToRefs(liveSessionStore)

const applySizePreset = useElectronEventaInvoke(electronApplySizePreset)
const openSettings = useElectronEventaInvoke(electronOpenSettings)
const isSettingsOpen = ref(false)

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const isWin = typeof navigator !== 'undefined' && /Win/.test(navigator.platform || navigator.userAgent)

if (!activeCardId.value)
  activeCardId.value = airiCardStore.activeCardId

// Sync activeCardId with current session's character whenever the session activates/changes
watch(
  () => chatSessionStore.sessionMetas[activeSessionId.value]?.characterId,
  (sessionCharId) => {
    if (sessionCharId && sessionCharId !== activeCardId.value && airiCardStore.cards.has(sessionCharId)) {
      console.log('[Chat] Syncing activeCardId to match active session character:', { from: activeCardId.value, to: sessionCharId })
      activeCardId.value = sessionCharId
    }
  },
  { immediate: true },
)

function handleOpenStudio() {
  if (!activeCardId.value)
    return
  void openSettings({
    route: `/settings/airi-card?cardId=${activeCardId.value}&tab=studio`,
  }).catch((err: any) => {
    console.error('Failed to open Studio settings:', err)
  })
}

function handleOpenCharacterConfig() {
  const targetId = activeCardId.value || airiCardStore.activeCardId || airiCardStore.resolveCardId()
  const route = `/settings/airi-card/edit?id=${targetId}`
  void openSettings({
    route,
  }).catch((err: any) => {
    console.error('Failed to open Character Config settings:', err)
  })
}

function handleOpenMemorySettings() {
  void openSettings({
    route: '/settings/memory',
  }).catch((err: any) => {
    console.error('Failed to open Memory settings:', err)
  })
}

function handleOpenStagingSettings() {
  const targetId = activeCardId.value || airiCardStore.activeCardId || airiCardStore.resolveCardId()
  const route = `/settings/airi-card/edit?id=${targetId}&tab=staging`
  void openSettings({
    route,
  }).catch((err: any) => {
    console.error('Failed to open Staging settings:', err)
  })
}

const voiceEditorOpen = ref(false)
const pendingVoiceEditor = ref<VoiceEditorPayload | null>(null)

function handleOpenVoiceEditor(payload: VoiceEditorPayload) {
  pendingVoiceEditor.value = payload
  voiceEditorOpen.value = true
}

function handleVoiceEditorSave(payload: { baseProvider: string, baseModel: string, baseVoice: string }) {
  pendingVoiceEditor.value?.onSave(payload)
  pendingVoiceEditor.value = null
}

function handleOpenVoiceSettings() {
  const targetId = activeCardId.value || airiCardStore.activeCardId || airiCardStore.resolveCardId()
  const route = `/settings/airi-card/edit?id=${targetId}&tab=voice`
  void openSettings({
    route,
  }).catch((err: any) => {
    console.error('Failed to open Voice settings:', err)
  })
}

function handleApplyChatPreset(preset: 'mini' | 'medium' | 'large' | 'full') {
  applySizePreset({ target: 'chat', preset })
  isSettingsOpen.value = false
}

// Pacing & Latency Telemetry from TurnPacingCoordinator
const latestPacingMetrics = useLocalStorage<PacingMetrics | null>('airi:latest-pacing-metrics', null)
const { data: incomingPacingMetrics } = useBroadcastChannel<PacingMetrics, PacingMetrics>({ name: 'airi:pacing-telemetry' })
const { data: incomingTurnUsage } = useBroadcastChannel<LatestTurnUsage, LatestTurnUsage>({ name: 'airi:usage-telemetry' })

// Lipsync: listen to the hub's speaking-state broadcast (single analysis in
// ControlStripHost, all canvases drive locally). No audio processing here.
interface ChatSpeakingState {
  mouthOpenSize: number
  nowSpeaking: boolean
}
const { data: speakingState } = useBroadcastChannel<ChatSpeakingState, ChatSpeakingState>({ name: 'airi-speaking-state' })

watch(incomingPacingMetrics, (metrics) => {
  if (metrics) {
    console.log('[Chat:Popover] Incoming pacing metrics telemetry:', metrics)
    latestPacingMetrics.value = metrics
  }
})

watch(incomingTurnUsage, (usage) => {
  if (usage) {
    console.log('[Chat:Popover] Incoming turn usage telemetry:', usage)
    latestTurnUsage.value = usage
  }
})

// --- Bridge handlers for ChatMemoryPopover → InteractiveArea ---
function handleViewContext() {
  if (interactiveAreaRef.value)
    interactiveAreaRef.value.showContext = true
}

function handleManageSessions() {
  if (interactiveAreaRef.value)
    interactiveAreaRef.value.showSessions = true
}

function handleSearchMemories() {
  interactiveAreaRef.value?.openSearchModal()
}

function handleClearMessages() {
  interactiveAreaRef.value?.handleTrashClick()
}

const isRightPanelOpen = useLocalStorage('airi:chat:right-panel-open', false)
const { width } = useWindowSize()
const showRightPanel = computed(() => isRightPanelOpen.value && width.value >= 768 && activeSurface.value === 'messages' && isCurrentSurfaceReady.value)

const settingsStore = useSettings()
const positioningStore = usePositioningStore()
const { stageModelRenderer, stageModelSelected } = storeToRefs(settingsStore)

const embeddedStageSupported = computed(() => {
  return stageModelRenderer.value !== 'disabled'
})

const stageScale = computed(() => {
  return positioningStore.getPosition(stageModelSelected.value).scale
})

const stageXOffset = computed(() => {
  return positioningStore.getPosition(stageModelSelected.value).x
})

const stageYOffset = computed(() => {
  const y = positioningStore.getPosition(stageModelSelected.value).y
  if (stageModelRenderer.value === 'live2d') {
    return -y
  }
  return y
})

function handleStageScaleChange(newScale: number) {
  const key = stageModelSelected.value
  const current = positioningStore.getPosition(key)
  positioningStore.setPosition(key, { ...current, scale: newScale })
}

function handleStageOffsetChange(offset: { x: number, y: number }) {
  const key = stageModelSelected.value
  const current = positioningStore.getPosition(key)
  positioningStore.setPosition(key, {
    ...current,
    x: offset.x,
    y: stageModelRenderer.value === 'live2d' ? -offset.y : offset.y,
  })
}

// Nan0 Cognition Pipeline Seam
const isNan0Active = computed(() => {
  const airiExt = activeCard.value?.extensions?.airi as any
  const cognition = airiExt?.modules?.cognition ?? airiExt?.cognition
  const processor = cognition?.processor ?? cognition?.firstHopProcessor ?? airiExt?.firstHopProcessor
  const enabled = cognition?.enabled ?? (processor === 'local_nan0' || processor === 'nan0')
  if (!enabled)
    return false
  return processor === 'local_nan0' || processor === 'nan0'
})

// Left Panel Routing States
const isLeftPanelOpen = useLocalStorage('airi:chat:left-panel-open', true)
const activeSurface = useLocalStorage<'messages' | 'director' | 'world' | 'characters' | 'media' | 'archives' | 'rehearsal' | 'event-log' | 'arcade' | 'music' | 'knowledge-graph'>('airi:chat:left-panel-active', 'messages')

// Guard removed legacy surfaces
if ((activeSurface.value as string) === 'notes') {
  activeSurface.value = 'messages'
}

const SURFACE_LABELS: Record<string, string> = {
  'messages': 'Live Dialog',
  'director': 'Director\'s Monitor',
  'world': 'Stage Directives',
  'characters': 'Cast Review',
  'media': 'Scene Vault',
  'archives': 'Eternal Thread',
  'event-log': 'Production Log',
  'rehearsal': 'Rehearsal Room',
  'arcade': 'Arcade Room',
  'music': 'Sound Studio',
  'knowledge-graph': 'Mind Map',
}

const SURFACE_ICONS: Record<string, string> = {
  'messages': 'i-solar:chat-line-bold-duotone',
  'director': 'i-solar:videocamera-record-bold-duotone',
  'world': 'i-solar:notes-bold-duotone',
  'characters': 'i-solar:users-group-two-rounded-bold-duotone',
  'media': 'i-solar:gallery-bold-duotone',
  'archives': 'i-solar:dna-bold-duotone',
  'event-log': 'i-solar:document-text-bold-duotone',
  'rehearsal': 'i-solar:clapperboard-text-bold-duotone',
  'arcade': 'i-solar:gamepad-bold-duotone',
  'music': 'i-solar:music-notes-bold-duotone',
  'knowledge-graph': 'i-solar:share-circle-bold-duotone',
}

const NAV_SECTIONS = [
  {
    title: 'Main',
    items: [
      { id: 'messages', label: 'Live Dialog', icon: 'i-solar:chat-line-bold-duotone' },
      { id: 'arcade', label: 'Arcade Room', icon: 'i-solar:gamepad-bold-duotone' },
      { id: 'rehearsal', label: 'Rehearsal Room', icon: 'i-solar:clapperboard-text-bold-duotone' },
      { id: 'music', label: 'Sound Studio', icon: 'i-solar:music-notes-bold-duotone' },
    ],
  },
  {
    title: 'Autonomous Artistry',
    items: [
      { id: 'director', label: 'Director\'s Monitor', icon: 'i-solar:videocamera-record-bold-duotone' },
      { id: 'characters', label: 'Cast Review', icon: 'i-solar:users-group-two-rounded-bold-duotone' },
      { id: 'media', label: 'Scene Vault', icon: 'i-solar:gallery-bold-duotone' },
      { id: 'world', label: 'Stage Directives', icon: 'i-solar:notes-bold-duotone' },
    ],
  },
  {
    title: 'Recall',
    items: [
      { id: 'archives', label: 'Eternal Thread', icon: 'i-solar:dna-bold-duotone' },
      { id: 'event-log', label: 'Production Log', icon: 'i-solar:document-text-bold-duotone' },
      { id: 'knowledge-graph', label: 'Mind Map', icon: 'i-solar:share-circle-bold-duotone' },
    ],
  },
] as const

const activeSurfaceLabel = computed(() => SURFACE_LABELS[activeSurface.value] || 'Live Dialog')
const activeSurfaceIcon = computed(() => SURFACE_ICONS[activeSurface.value] || 'i-solar:chat-line-bold-duotone')

// Track loaded sub-surfaces to skip coordinator on subsequent warm visits
const loadedSurfaces = ref<Set<string>>(new Set())
const isCurrentSurfaceReady = computed(() => loadedSurfaces.value.has(activeSurface.value))

const coordinatorProgress = ref(15)
const coordinatorStatus = ref('Connecting to workspace...')

let isSurfaceSignaledReady = false
let pendingSurfaceReadyResolver: (() => void) | null = null
let progressTweenInterval: ReturnType<typeof setInterval> | null = null

function stopProgressTween() {
  if (progressTweenInterval) {
    clearInterval(progressTweenInterval)
    progressTweenInterval = null
  }
}

function startProgressTween(start: number, targetMax: number = 95, durationMs: number = 10000) {
  stopProgressTween()
  coordinatorProgress.value = start
  const startTime = performance.now()

  progressTweenInterval = setInterval(() => {
    const elapsed = performance.now() - startTime
    const ratio = Math.min(1, elapsed / durationMs)
    // Ease-out cubic curve so progress advances dynamically and naturally decelerates near targetMax
    const ease = 1 - (1 - ratio) ** 2.5
    coordinatorProgress.value = Math.round(start + (targetMax - start) * ease)

    // Dynamic contextual status text as it advances through the load
    if (coordinatorProgress.value >= 82 && coordinatorStatus.value.startsWith('Mounting')) {
      coordinatorStatus.value = 'Preparing workspace layout...'
    }
  }, 100)
}

onUnmounted(() => {
  stopProgressTween()
})

function handleSurfaceReady() {
  console.log('[Chat:Coordinator] Surface ready signal received for:', activeSurface.value)
  isSurfaceSignaledReady = true
  if (pendingSurfaceReadyResolver) {
    pendingSurfaceReadyResolver()
    pendingSurfaceReadyResolver = null
  }
}

// Dual detection: watch the exposed ref from the sub-surface to guarantee detection even across async chunk boundaries
watch(
  interactiveAreaRef,
  (instance) => {
    if (instance && activeSurface.value === 'messages') {
      console.log('[Chat:Coordinator] interactiveAreaRef detected in chat.vue')
      handleSurfaceReady()
    }
  },
  { immediate: true },
)

async function coordinateSurfaceLoad(surface: string) {
  if (loadedSurfaces.value.has(surface)) {
    return
  }

  isSurfaceSignaledReady = false
  stopProgressTween()
  const label = SURFACE_LABELS[surface] || 'Workspace'
  coordinatorProgress.value = 20
  coordinatorStatus.value = `Connecting to ${label}...`

  // Yield to the event loop so the coordinator card renders immediately on first frame
  await new Promise(r => setTimeout(r, 60))

  if (surface === 'messages') {
    coordinatorProgress.value = 45
    coordinatorStatus.value = 'Preparing conversation history...'
    if (!chatSessionStore.ready) {
      await chatSessionStore.initialize()
    }
  }
  else if (surface === 'knowledge-graph') {
    coordinatorProgress.value = 40
    coordinatorStatus.value = 'Loading knowledge graph & entity ledger...'
  }

  // Begin smooth simulated progress tweening from 60% towards 95% over the course of chunk fetching & mounting
  startProgressTween(60, 95, 10000)
  coordinatorStatus.value = `Mounting ${label}...`

  // Wait for the sub-surface to mount and signal ready
  await nextTick()
  await new Promise(r => requestAnimationFrame(r))

  if (surface === 'messages' || surface === 'knowledge-graph') {
    if (!isSurfaceSignaledReady && !interactiveAreaRef.value) {
      await new Promise<void>((resolve) => {
        let resolved = false
        const done = () => {
          if (!resolved) {
            resolved = true
            pendingSurfaceReadyResolver = null
            resolve()
          }
        }
        pendingSurfaceReadyResolver = done

        // Bounded deadlock guard: 12s safety timeout to accommodate cold dev module compilation
        setTimeout(() => {
          if (!resolved) {
            console.warn(`[Chat:Coordinator] Surface ${surface} ready timed out after 12s; proceeding with fallback.`)
            done()
          }
        }, 12000)
      })
    }
  }
  else {
    // For other sub-surfaces, yield two frames for chunk evaluation
    await new Promise(r => setTimeout(r, 120))
    await nextTick()
  }

  stopProgressTween()
  coordinatorProgress.value = 100
  coordinatorStatus.value = 'Ready'

  // Allow the progress bar animation (transition-all duration-300) to glide cleanly to 100%
  await new Promise(r => setTimeout(r, 200))
  loadedSurfaces.value.add(surface)
}

watch(
  activeSurface,
  (surface) => {
    void coordinateSurfaceLoad(surface)
  },
  { immediate: true },
)

watch(activeCardId, () => {
  loadedSurfaces.value.clear()
  void coordinateSurfaceLoad(activeSurface.value)
})

const chatOrchestrator = useChatOrchestratorStore()
const { isUserTyping } = storeToRefs(chatOrchestrator)

const reportWindowTitle = useElectronEventaInvoke(electronWindowSetTitle)

watch(
  () => [activeSurface.value, isUserTyping.value] as const,
  ([surface, typing]) => {
    let nextTitle = 'AIRI - Chat Window'
    if (surface === 'messages') {
      nextTitle = typing
        ? 'AIRI - Chat Window - User Typing...'
        : 'AIRI - Chat Window'
    }
    else {
      const label = SURFACE_LABELS[surface] || 'Chat View'
      nextTitle = `AIRI - Chat Window - ${label}`
    }
    document.title = nextTitle
    void reportWindowTitle({ title: nextTitle })
  },
  { immediate: true },
)

const activeSurfaceComponent = computed(() => {
  const map = {
    'messages': chat_messages,
    'director': chat_director,
    'world': chat_world,
    'characters': chat_studio,
    'media': chat_media,
    'archives': chat_lifetime,
    'rehearsal': chat_rehearsal,
    'event-log': chat_event_log,
    'arcade': chat_arcade,
    'music': chat_music,
    'knowledge-graph': chat_knowledge_graph,
  }
  return markRaw(map[activeSurface.value] || chat_messages)
})

// Whether left panel is rendered in persistent or overlay mode
const showLeftSidebar = computed(() => isLeftPanelOpen.value && width.value >= 768)
const showLeftOverlay = computed(() => isLeftPanelOpen.value && width.value < 768)

// --- Grounding toggle helpers ---
function handleToggleGrounding() {
  if (activeCardId.value)
    airiCardStore.toggleGrounding(activeCardId.value)
}

function handleToggleGroundingMemory() {
  if (activeCardId.value)
    airiCardStore.toggleGroundingMemory(activeCardId.value)
}

function handleToggleGroundingDirectorScratchpad() {
  if (activeCardId.value)
    airiCardStore.toggleGroundingDirectorScratchpad(activeCardId.value)
}

async function handleToggleSalienceGate() {
  // NOTICE: Force-disabled for release stability to prevent WebGPU/WASM memory runaway
}

const hasTextJournal = computed(() => {
  const allowed = activeCard.value?.extensions?.airi?.generation?.known?.allowedTools
  return allowed === undefined || allowed.includes('text_journal')
})

const hasImageJournal = computed(() => {
  const allowed = activeCard.value?.extensions?.airi?.generation?.known?.allowedTools
  return allowed === undefined || allowed.includes('image_journal')
})

const isDreamStateEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.dreamState?.enabled ?? false
})

function handleToggleDreamState() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = activeCard.value.extensions?.airi?.dreamState?.enabled ?? false
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        dreamState: {
          ...activeCard.value.extensions?.airi?.dreamState,
          enabled: !current,
        },
      },
    },
  } as any)
}

function handleToggleDreamIntrusion() {
  if (!activeCardId.value || !activeCard.value || !isDreamStateEnabled.value)
    return
  const current = activeCard.value.extensions?.airi?.dreamState?.injectDreamContext ?? false
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        dreamState: {
          ...activeCard.value.extensions?.airi?.dreamState,
          injectDreamContext: !current,
        },
      },
    },
  } as any)
}

function handleToggleJournalIntrusion() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = activeCard.value.extensions?.airi?.textJournal?.injectJournalContext ?? false
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        textJournal: {
          ...activeCard.value.extensions?.airi?.textJournal,
          injectJournalContext: !current,
        },
      },
    },
  } as any)
}

function handleToggleArtistryIntrusion() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = activeCard.value.extensions?.airi?.artistry?.injectArtistryContext ?? false
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        artistry: {
          ...activeCard.value.extensions?.airi?.artistry,
          injectArtistryContext: !current,
        },
      },
    },
  } as any)
}

function handleToggleImageDirector() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = activeCard.value.extensions?.airi?.artistry?.autonomousEnabled ?? false
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        artistry: {
          ...activeCard.value.extensions?.airi?.artistry,
          autonomousEnabled: !current,
        },
      },
    },
  } as any)
}

function handleSetSpawnMode(mode: 'bg' | 'widget' | 'inline') {
  if (!activeCardId.value || !activeCard.value)
    return
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        artistry: {
          ...activeCard.value.extensions?.airi?.artistry,
          spawnMode: mode,
        },
      },
    },
  } as any)
}

function handleToggleHeartbeats() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = activeCard.value.extensions?.airi?.heartbeats?.enabled ?? false
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        heartbeats: {
          ...activeCard.value.extensions?.airi?.heartbeats,
          enabled: !current,
        },
      },
    },
  } as any)
}

const isAgentScreenshotAllowed = computed(() =>
  Boolean(activeCard.value?.extensions?.airi?.generation?.known?.allowedTools?.includes('take_screenshot')),
)

function handleToggleAgentScreenshot() {
  if (!activeCardId.value || !activeCard.value)
    return
  const generation = activeCard.value.extensions?.airi?.generation
  // An unset allowlist means the default journal tools, same as the card editor's Tools tab.
  const current = generation?.known?.allowedTools ?? ['text_journal', 'image_journal']
  const allowedTools = isAgentScreenshotAllowed.value
    ? current.filter(t => t !== 'take_screenshot')
    : [...current, 'take_screenshot']
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        generation: {
          ...generation,
          known: {
            ...generation?.known,
            allowedTools,
          },
        },
      },
    },
  } as any)
}

function handleToggleScreenWatching() {
  if (!activeCardId.value || !activeCard.value)
    return
  const current = activeCard.value.extensions?.airi?.screenWatching?.enabled ?? false
  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        screenWatching: {
          deliveryMode: 'both',
          sourceType: 'displays',
          sourceId: '',
          captureIntervalMs: 2000,
          downscalePercent: 100,
          workload: 'attention-guard',
          publishToContext: true,
          interestTags: ['antigravity', 'terminal_error', 'youtube', 'discord'],
          deferWhileSpeaking: true,
          maxPerHour: 4,
          hysteresisMinutes: 3,
          enableVlm: false,
          ...activeCard.value.extensions?.airi?.screenWatching,
          enabled: !current,
        },
      },
    },
  } as any)
}

const isSandboxActive = computed(() => {
  const allowed = activeCard.value?.extensions?.airi?.generation?.known?.allowedTools
  if (allowed && allowed.includes('bash'))
    return true
  return activeCard.value?.extensions?.airi?.sandbox?.enabled ?? false
})

function handleToggleSandbox() {
  if (!activeCardId.value || !activeCard.value)
    return
  const currentTools = activeCard.value.extensions?.airi?.generation?.known?.allowedTools
    ?? ['text_journal', 'image_journal']
  const currentlyActive = currentTools.includes('bash') || (activeCard.value.extensions?.airi?.sandbox?.enabled ?? false)
  const nextActive = !currentlyActive
  const nextTools = nextActive
    ? (currentTools.includes('bash') ? currentTools : [...currentTools, 'bash'])
    : currentTools.filter(t => t !== 'bash')

  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions?.airi,
        sandbox: {
          ...activeCard.value.extensions?.airi?.sandbox,
          enabled: nextActive,
          widgetInstruction: activeCard.value.extensions?.airi?.sandbox?.widgetInstruction ?? DEFAULT_SANDBOX_WORKSTATION_INSTRUCTION,
        },
        generation: {
          ...activeCard.value.extensions?.airi?.generation,
          known: {
            ...activeCard.value.extensions?.airi?.generation?.known,
            allowedTools: nextTools,
          },
        },
      },
    },
  } as any)
}

// --- Active Session Info ---
const activeSessionMeta = computed(() => {
  if (!activeSessionId.value)
    return undefined
  return sessionMetas.value[activeSessionId.value]
})

// Character name & active timeline badge for header switcher
const activeCharacterName = computed(() => {
  return activeCard.value?.nickname || activeCard.value?.name || 'AIRI'
})

const activeTimelineTag = computed(() => {
  const meta = activeSessionMeta.value
  if (!meta)
    return ''

  const universe = meta.universeId && meta.universeId !== 'global' ? meta.universeId : ''
  const hasCustomTitle = meta.title && meta.title !== 'Untitled Timeline'
  const title = hasCustomTitle ? meta.title : ''

  if (universe && title)
    return `${universe} › ${title}`
  if (title)
    return title
  if (universe)
    return universe
  return ''
})

// --- Generation Stats Popover & Token Output Limits ---
const isStatsPopoverOpen = ref(false)

interface ProseBracket {
  min: number
  max: number
  defaultTokens: number
  label: string
  sublabel: string
  directive: string
}

const PROSE_BRACKETS: ProseBracket[] = [
  {
    min: 60,
    max: 90,
    defaultTokens: 75,
    label: '60–90t',
    sublabel: '1 short sent',
    directive: 'Respond in an extremely short, single-sentence reply (approx. 5–12 words). Keep your output direct, concise, and absolute without second thoughts or follow-up questions.',
  },
  {
    min: 91,
    max: 160,
    defaultTokens: 125,
    label: '91–160t',
    sublabel: '2 sentences',
    directive: 'Respond in exactly two conversational sentences (approx. 20–35 words total). Deliver a complete thought in the first sentence, and a natural reaction or follow-up in the second.',
  },
  {
    min: 161,
    max: 280,
    defaultTokens: 220,
    label: '161–280t',
    sublabel: '1 paragraph',
    directive: 'Respond in a single cohesive paragraph of 3 to 4 sentences (approx. 50–80 words). Provide clear context and depth, but keep everything unified in one single paragraph without line breaks.',
  },
  {
    min: 281,
    max: 450,
    defaultTokens: 360,
    label: '281–450t',
    sublabel: '2 paragraphs',
    directive: 'Respond in two descriptive paragraphs separated by a line break (approx. 90–140 words total). Use the first paragraph to address the core subject, and the second paragraph to expand with rich nuance, background detail, or creative commentary.',
  },
]

function resolveProsePreset(tokens: number): string {
  const bracket = PROSE_BRACKETS.find(b => tokens >= b.min && tokens <= b.max)
  if (bracket)
    return bracket.directive
  if (tokens > 450)
    return PROSE_BRACKETS[3].directive
  return PROSE_BRACKETS[0].directive
}

function resolveProseBracket(tokens: number): ProseBracket {
  const bracket = PROSE_BRACKETS.find(b => tokens >= b.min && tokens <= b.max)
  if (bracket)
    return bracket
  if (tokens > 450)
    return PROSE_BRACKETS[3]
  return PROSE_BRACKETS[0]
}

const LIMITS_REGEX = /\[TOKEN_OUTPUT_LIMITS:\s*(\d+)\][\s\S]*?- STYLE INSTRUCTION:\s*([\s\S]*?)\[\/TOKEN_OUTPUT_LIMITS\]\n*/

const popoverOverrideEnabled = ref(false)
const popoverContextWidth = ref<number | undefined>(undefined)
const popoverMaxTokens = ref<number>(220)
const popoverCustomProse = ref('')
const isProseEditing = ref(false)

function loadPopoverState() {
  if (!activeCard.value)
    return

  const airiExt = activeCard.value.extensions?.airi
  popoverOverrideEnabled.value = airiExt?.generation?.enabled ?? false
  popoverContextWidth.value = airiExt?.generation?.known?.contextWidth
  popoverMaxTokens.value = airiExt?.generation?.known?.maxTokens ?? 220

  const parsed = parseTokenLimits(activeCard.value.systemPrompt || '')
  if (parsed) {
    popoverMaxTokens.value = parsed.tokens
    popoverCustomProse.value = parsed.prose
  }
  else {
    popoverCustomProse.value = resolveProsePreset(popoverMaxTokens.value)
  }
}

function parseTokenLimits(prompt: string = '') {
  const match = prompt.match(LIMITS_REGEX)
  if (match) {
    return {
      tokens: Number.parseInt(match[1], 10),
      prose: match[2].trim(),
    }
  }
  return null
}

function saveCardGenerationSettings() {
  if (!activeCardId.value || !activeCard.value)
    return

  const airiExt = activeCard.value.extensions?.airi
  let updatedSystemPrompt = activeCard.value.systemPrompt || ''

  if (popoverOverrideEnabled.value) {
    updatedSystemPrompt = updateTokenLimitsInPrompt(
      updatedSystemPrompt,
      popoverMaxTokens.value,
      popoverCustomProse.value,
    )
  }
  else {
    updatedSystemPrompt = stripTokenLimitsFromPrompt(updatedSystemPrompt)
  }

  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...airiExt,
        generation: {
          ...airiExt?.generation,
          enabled: popoverOverrideEnabled.value,
          known: {
            ...airiExt?.generation?.known,
            contextWidth: popoverContextWidth.value,
            maxTokens: popoverOverrideEnabled.value ? popoverMaxTokens.value : undefined,
          },
        },
      },
    },
    systemPrompt: updatedSystemPrompt,
  } as any)
}

function updateTokenLimitsInPrompt(prompt: string = '', tokens: number, prose: string): string {
  const newBlock = `[TOKEN_OUTPUT_LIMITS: ${tokens}]
### SYSTEM DIRECTIVE: STRICT STRUCTURAL COMPLIANCE REQUIRED
You must format all outward speech to conform to the following token limit constraint:
- TARGET LIMIT: Max ${tokens} tokens.
- STYLE INSTRUCTION: ${prose}
[/TOKEN_OUTPUT_LIMITS]\n\n`

  if (prompt.match(LIMITS_REGEX)) {
    return prompt.replace(LIMITS_REGEX, newBlock)
  }
  return newBlock + prompt
}

function stripTokenLimitsFromPrompt(prompt: string = ''): string {
  return prompt.replace(LIMITS_REGEX, '').trim()
}

function handleContextPresetClick(width: number) {
  popoverContextWidth.value = width
  saveCardGenerationSettings()
}

function handleTokensSliderChange() {
  if (!isProseEditing.value) {
    popoverCustomProse.value = resolveProsePreset(popoverMaxTokens.value)
  }
  saveCardGenerationSettings()
}

function handleSnapToBracket(bracket: ProseBracket) {
  popoverMaxTokens.value = bracket.defaultTokens
  popoverCustomProse.value = bracket.directive
  isProseEditing.value = false
  saveCardGenerationSettings()
}

function handleResetToDefaults() {
  if (!activeCardId.value || !activeCard.value)
    return

  const airiExt = activeCard.value.extensions?.airi
  const cleanedPrompt = stripTokenLimitsFromPrompt(activeCard.value.systemPrompt || '')

  popoverMaxTokens.value = 220
  popoverCustomProse.value = resolveProsePreset(220)
  isProseEditing.value = false
  popoverOverrideEnabled.value = false

  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...airiExt,
        generation: {
          ...airiExt?.generation,
          enabled: false,
          known: {
            ...airiExt?.generation?.known,
            maxTokens: undefined,
          },
        },
      },
    },
    systemPrompt: cleanedPrompt,
  } as any)
}

watch(isStatsPopoverOpen, (open: boolean) => {
  if (open) {
    loadPopoverState()
  }
})
watch(popoverOverrideEnabled, () => {
  saveCardGenerationSettings()
})
watch(popoverContextWidth, () => {
  saveCardGenerationSettings()
})

const saturationPercent = computed(() => {
  if (!popoverContextWidth.value)
    return 0
  return Math.min(100, Math.max(0, (sessionTokenCount.value / popoverContextWidth.value) * 100))
})

const saturationColorClass = computed(() => {
  const percent = saturationPercent.value
  if (percent >= 90)
    return 'text-red-500 bg-red-500'
  if (percent >= 75)
    return 'text-amber-500 bg-amber-500'
  return 'text-green-500 bg-emerald-500'
})

// Timeline Switcher & Management State
const isSessionPopoverOpen = ref(false)
const showManageModal = ref(false)

function handleOpenManage() {
  isSessionPopoverOpen.value = false
  showManageModal.value = true
}

function handleBrowseCards() {
  void openSettings({
    route: '/settings/airi-card',
  }).catch((err: any) => {
    console.error('Failed to open cards settings:', err)
  })
}

function handleCreateCard() {
  void openSettings({
    route: '/settings/airi-card',
  }).catch((err: any) => {
    console.error('Failed to open create card settings:', err)
  })
}

function handleManageAvatars() {
  void openSettings({
    route: '/settings/models',
  }).catch((err: any) => {
    console.error('Failed to open models settings:', err)
  })
}

// --- Token Calculations ---
const sessionTokenCount = computed(() => {
  let total = 0
  for (const msg of messages.value) {
    if (typeof msg.content === 'string') {
      total += estimateTokens(msg.content)
    }
    else if (Array.isArray(msg.content)) {
      const textOnly = msg.content
        .map((part: any) => {
          if (typeof part === 'string')
            return part
          if (part && typeof part === 'object' && 'text' in part && !('image_url' in part))
            return String(part.text ?? '')
          return ''
        })
        .join('')
      total += estimateTokens(textOnly)
    }
  }
  return total
})

const formattedSessionTokenCount = computed(() => formatTokenCount(sessionTokenCount.value))

function formatAbbreviatedCount(num: number): string {
  if (num >= 1_000_000_000)
    return `${(num / 1_000_000_000).toFixed(1)}B`
  if (num >= 1_000_000)
    return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1000)
    return `${(num / 1000).toFixed(1)}K`
  return String(num)
}

function formatMonthDay(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function selectSurface(surface: typeof activeSurface.value) {
  activeSurface.value = surface
  if (width.value < 768) {
    isLeftPanelOpen.value = false
  }
}
</script>

<template>
  <div class="relative h-full w-full flex flex-col overflow-hidden bg-[#FAF9F6] transition-colors duration-300 dark:bg-[#18181B]">
    <!-- Layer 1: Chatbox Background (Wallpaper or Solid) -->
    <Transition
      enter-active-class="transition-opacity duration-700 ease-in-out will-change-opacity"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-700 ease-in-out will-change-opacity"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
      mode="out-in"
    >
      <div
        v-if="chatboxActiveBackgroundUrl"
        :key="`url-${chatboxActiveBackgroundUrl}`"
        class="pointer-events-none absolute inset-0 z-0"
        :style="{
          backgroundImage: `url(${chatboxActiveBackgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }"
      >
        <!-- Subtle readability scrim so message bubbles remain clear and distinct -->
        <div class="absolute inset-0 bg-white/75 backdrop-blur-[1px] dark:bg-neutral-950/75" />
      </div>
      <div
        v-else-if="chatboxActiveBackgroundColor"
        :key="`color-${chatboxActiveBackgroundColor}`"
        class="pointer-events-none absolute inset-0 z-0"
        :style="{
          backgroundColor: chatboxActiveBackgroundColor,
        }"
      />
    </Transition>

    <!-- Layer 2: Animated Ambient Atmosphere Particles -->
    <Transition
      enter-active-class="transition-opacity duration-700 ease-in-out will-change-opacity"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-700 ease-in-out will-change-opacity"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <component
        :is="activeChatAtmosphereComponent"
        v-if="activeChatAtmosphereComponent"
        :key="chatboxActiveAtmosphereId"
        :transparent-bg="true"
        class="pointer-events-none absolute inset-0 z-1"
      />
    </Transition>

    <!-- Header Toolbar: Flush to top, frosted glass translucent -->
    <header
      class="relative z-10 w-full shrink-0 select-none border-b border-neutral-200/40 bg-white/30 py-1.5 shadow-sm backdrop-blur-md dark:border-neutral-800/40 dark:bg-neutral-950/20"
      :class="[
        isMac ? 'pl-20 pr-3' : isWin ? 'pl-3 pr-36' : 'px-3',
      ]"
      style="-webkit-app-region: drag;"
    >
      <div class="relative w-full flex items-center justify-between" style="-webkit-app-region: drag;">
        <!-- Left: Brand Logo, Hamburger Toggle, & Premium Session Selector -->
        <div class="flex select-none items-center gap-3 outline-none" style="-webkit-app-region: no-drag;">
          <!-- Hamburger menu toggle -->
          <button
            class="flex cursor-pointer items-center justify-center rounded-xl p-1.5 text-neutral-500 transition-all duration-200 ease-in-out hover:bg-neutral-200 dark:text-neutral-400 hover:text-neutral-700 hover:dark:bg-neutral-800 dark:hover:text-neutral-200"
            :class="{ 'text-primary-500 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-950/30': isLeftPanelOpen }"
            title="Toggle Navigation Menu"
            @click="isLeftPanelOpen = !isLeftPanelOpen"
          >
            <div class="i-solar:hamburger-menu-bold text-base" />
          </button>

          <div class="flex items-center gap-2">
            <img
              :src="LogoDark"
              class="theme-colored h-7 w-7"
            >
            <div class="translate-y-[1px] text-lg text-primary-500 font-semibold font-quicksand dark:text-primary-300">
              <span>AIRI</span>
            </div>
          </div>

          <ChatWorkspacePopover
            v-model:open="isSessionPopoverOpen"
            :character-id="activeCardId"
            :character-name="activeCharacterName"
            @open-card-settings="handleOpenCharacterConfig"
            @open-manage-sessions="handleOpenManage"
            @browse-cards="handleBrowseCards"
            @create-card="handleCreateCard"
            @manage-avatars="handleManageAvatars"
          >
            <template #trigger>
              <button
                type="button"
                class="flex cursor-pointer select-none items-center gap-2 border border-neutral-200/50 rounded-xl bg-neutral-100/30 px-3 py-1 text-xs font-bold transition-all duration-200 ease-in-out dark:border-neutral-800 dark:bg-neutral-900/40 hover:bg-neutral-200/50 hover:dark:bg-neutral-800/40"
                :class="isSessionPopoverOpen ? 'ring-2 ring-primary-500/30' : ''"
              >
                <div class="i-solar:notebook-bookmark-bold-duotone size-3.5 shrink-0 text-primary-500" />
                <span class="max-w-48 truncate text-neutral-700 dark:text-neutral-300">{{ activeCharacterName }}</span>
                <span
                  v-if="activeTimelineTag"
                  class="shrink-0 rounded-md bg-primary-500/10 px-1.5 py-0.5 text-[10px] text-primary-600 font-semibold dark:bg-primary-950/50 dark:text-primary-400"
                >
                  {{ activeTimelineTag }}
                </span>
                <div
                  class="i-solar:alt-arrow-down-bold text-[10px] text-neutral-400 opacity-60 transition-transform duration-200 dark:text-neutral-500"
                  :class="isSessionPopoverOpen ? 'rotate-180' : ''"
                />
              </button>
            </template>
          </ChatWorkspacePopover>
        </div>

        <!-- Right: Stacked Metrics, Memory & Context placeholder, Brain LLM Icon -->
        <div class="flex items-center gap-3" style="-webkit-app-region: no-drag;">
          <!-- Stacked Metrics: one icon, two stats vertically (opens Response Limit Settings) -->
          <PopoverRoot v-model:open="isStatsPopoverOpen">
            <PopoverTrigger as-child>
              <button
                class="flex cursor-pointer select-none items-center gap-1.5 rounded-lg px-1.5 py-1 text-left outline-none transition-all duration-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50"
                :title="`Global: ${Number(liveSessionStore.totalTokens || 0).toLocaleString()} · Session: ${formattedSessionTokenCount}`"
              >
                <div class="i-solar:chart-linear text-xs text-neutral-400 dark:text-neutral-500" />
                <div class="flex flex-col gap-[2px] leading-none">
                  <span class="text-[9px] text-neutral-400 font-bold tracking-tight uppercase dark:text-neutral-500">
                    {{ formatAbbreviatedCount(liveSessionStore.totalTokens || 0) }}
                  </span>
                  <span class="text-[9px] text-primary-400 font-bold tracking-tight uppercase dark:text-primary-400">
                    {{ formattedSessionTokenCount }}
                  </span>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverPortal>
              <PopoverContent
                class="animate-in fade-in slide-in-from-top-1 z-[10000] w-80 flex flex-col gap-3 border border-neutral-200/80 rounded-2xl bg-white/95 p-3.5 shadow-2xl backdrop-blur-xl duration-150 dark:border-neutral-800 dark:bg-neutral-900/95"
                side="bottom"
                align="end"
                :side-offset="8"
              >
                <!-- Section Header -->
                <div class="flex items-center justify-between border-b border-neutral-100 pb-1 dark:border-neutral-800/80">
                  <div class="flex items-center gap-2">
                    <div class="i-solar:chart-2-bold-duotone text-lg text-neutral-800 dark:text-neutral-100" />
                    <span class="text-sm text-neutral-900 font-bold font-sans-rounded dark:text-neutral-100">Limits &amp; telemetry</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <button
                      v-if="popoverOverrideEnabled"
                      type="button"
                      class="cursor-pointer text-[10px] text-red-500 font-semibold tracking-tight transition dark:text-red-400 hover:text-red-600 hover:dark:text-red-300"
                      @click="handleResetToDefaults"
                    >
                      Reset defaults
                    </button>
                    <button
                      type="button"
                      class="flex cursor-pointer items-center justify-center rounded-full p-0.5 text-neutral-400 transition-colors dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
                      aria-label="Close"
                      @click="isStatsPopoverOpen = false"
                    >
                      <div class="i-solar:close-circle-linear text-lg" />
                    </button>
                  </div>
                </div>

                <!-- Overrides Enable Toggle -->
                <div
                  class="flex cursor-pointer items-center justify-between rounded-xl px-2 py-1.5 transition-all hover:bg-neutral-100/50 dark:hover:bg-neutral-800/30"
                  @click="popoverOverrideEnabled = !popoverOverrideEnabled"
                >
                  <div class="flex flex-col">
                    <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Override Limits</span>
                    <span class="text-[9px] text-neutral-400">Enforce custom token & context rules</span>
                  </div>
                  <div
                    :class="popoverOverrideEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
                    class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
                  >
                    <span
                      :class="popoverOverrideEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
                      class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </div>
                </div>

                <!-- Interactive Settings (active only if override enabled) -->
                <div
                  class="flex flex-col gap-3 transition-opacity duration-200"
                  :class="[!popoverOverrideEnabled ? 'pointer-events-none opacity-40' : '']"
                >
                  <!-- Context Width Limits -->
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] text-neutral-400 font-bold tracking-tight uppercase">Context Width Threshold</label>
                    <div class="flex items-center gap-2">
                      <input
                        v-model.number="popoverContextWidth"
                        type="number"
                        placeholder="4096"
                        class="w-24 border border-neutral-200 rounded-lg bg-neutral-50 px-2 py-1 text-xs text-neutral-800 outline-none dark:border-neutral-800 focus:border-primary-300 dark:bg-neutral-900 dark:text-neutral-200"
                        @change="saveCardGenerationSettings"
                      >
                      <div class="flex gap-1">
                        <button
                          v-for="widthPreset in [65536, 204800, 1048576]"
                          :key="widthPreset"
                          class="border border-neutral-200/50 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-600 font-bold dark:border-neutral-800 dark:bg-neutral-900 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-800"
                          @click="handleContextPresetClick(widthPreset)"
                        >
                          {{ widthPreset >= 1048576 ? '1M' : widthPreset >= 204800 ? '200K' : '64K' }}
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Context Saturation Progress Bar (Minimalist) -->
                  <div
                    v-if="popoverContextWidth && popoverContextWidth > 0"
                    class="flex flex-col gap-1.5"
                  >
                    <div class="flex items-center justify-between text-[9px] text-neutral-400 font-bold tracking-tight uppercase dark:text-neutral-500">
                      <span>Context Saturation</span>
                      <span :class="saturationColorClass.split(' ')[0]">{{ saturationPercent.toFixed(0) }}%</span>
                    </div>
                    <div class="h-1 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                      <div
                        :style="{ width: `${saturationPercent}%` }"
                        :class="saturationColorClass.split(' ')[1]"
                        class="h-full rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>

                  <!-- Token Limits Slider -->
                  <div class="flex flex-col gap-1.5">
                    <div class="flex items-center justify-between text-[10px]">
                      <div class="flex items-center gap-1.5">
                        <span class="text-neutral-400 font-bold tracking-tight uppercase">Response Token Limit</span>
                        <span class="rounded bg-primary-500/10 px-1.5 py-0.2 text-[9px] text-primary-600 font-medium dark:text-primary-400">
                          {{ resolveProseBracket(popoverMaxTokens).sublabel }}
                        </span>
                      </div>
                      <span class="text-primary-500 font-bold dark:text-primary-400">{{ popoverMaxTokens }} tokens</span>
                    </div>
                    <input
                      v-model.number="popoverMaxTokens"
                      type="range"
                      min="60"
                      max="450"
                      step="5"
                      class="h-1 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-500 dark:bg-neutral-800"
                      @input="handleTokensSliderChange"
                    >
                    <div class="flex justify-between px-0.5 text-[8px] text-neutral-400 font-bold">
                      <button
                        v-for="b in PROSE_BRACKETS"
                        :key="b.label"
                        type="button"
                        class="cursor-pointer transition hover:text-primary-500"
                        :class="{ 'text-primary-600 dark:text-primary-400 font-extrabold': popoverMaxTokens >= b.min && popoverMaxTokens <= b.max }"
                        @click="handleSnapToBracket(b)"
                      >
                        {{ b.label }}
                      </button>
                    </div>
                  </div>

                  <!-- Dynamic Prose Indicator & Inline Editor -->
                  <div class="flex flex-col gap-1.5 border-t border-neutral-200/40 pt-2 dark:border-neutral-800/40">
                    <div class="flex items-center justify-between">
                      <span class="text-[9px] text-neutral-400 font-bold tracking-tight uppercase">Compliance Instruction</span>
                      <button
                        class="flex items-center justify-center rounded p-1 text-neutral-500 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                        title="Edit Instruction"
                        @click="isProseEditing = !isProseEditing"
                      >
                        <div :class="isProseEditing ? 'i-solar:check-read-linear text-xs text-green-500' : 'i-solar:pen-linear text-xs'" />
                      </button>
                    </div>

                    <!-- Read-Only Prose Preview / Text Area Editor -->
                    <div v-if="!isProseEditing" class="max-h-16 select-text overflow-y-auto border border-neutral-200/30 rounded-lg bg-neutral-50 p-2 text-[10px] text-neutral-500 leading-relaxed italic dark:border-neutral-800/30 dark:bg-neutral-900/60 dark:text-neutral-400">
                      "{{ popoverCustomProse }}"
                    </div>
                    <textarea
                      v-else
                      v-model="popoverCustomProse"
                      rows="3"
                      class="w-full border border-neutral-200 rounded-lg bg-neutral-50 p-2 text-[10px] text-neutral-700 dark:border-neutral-800 focus:border-primary-300 dark:bg-neutral-900 dark:text-neutral-300 focus:outline-none"
                      @change="saveCardGenerationSettings"
                    />
                  </div>
                </div>

                <!-- Section: Latest Turn Telemetry (Live Observation) -->
                <div class="flex flex-col gap-1.5 border-t border-neutral-200/40 pt-2 dark:border-neutral-800/40">
                  <div class="flex items-center justify-between">
                    <span class="text-[9px] text-neutral-400 font-bold tracking-tight uppercase dark:text-neutral-500">Latest Turn Telemetry</span>
                    <span v-if="latestPacingMetrics?.fillersSpokenCount" class="text-[9px] text-primary-500 font-semibold font-mono dark:text-primary-400">
                      {{ latestPacingMetrics.fillersSpokenCount }} {{ latestPacingMetrics.fillersSpokenCount === 1 ? 'filler' : 'fillers' }}
                    </span>
                    <span v-else class="text-[9px] text-neutral-400 font-medium">
                      Direct Turn
                    </span>
                  </div>

                  <div class="grid grid-cols-2 gap-1.5 border border-neutral-200/40 rounded-xl bg-neutral-50/60 p-2 text-[10px] dark:border-neutral-800/40 dark:bg-neutral-900/40">
                    <!-- Latency / TTFT -->
                    <div class="flex flex-col">
                      <span class="text-[8px] text-neutral-400 font-bold uppercase dark:text-neutral-500">Latency (TTFT)</span>
                      <span class="text-neutral-700 font-semibold font-mono dark:text-neutral-200">
                        {{ latestPacingMetrics?.ttftMs != null ? `${latestPacingMetrics.ttftMs}ms (${(latestPacingMetrics.ttftMs / 1000).toFixed(2)}s)` : '—' }}
                      </span>
                    </div>

                    <!-- Handoff Gap -->
                    <div class="flex flex-col">
                      <span class="text-[8px] text-neutral-400 font-bold uppercase dark:text-neutral-500">Handoff Gap</span>
                      <span class="text-neutral-700 font-semibold font-mono dark:text-neutral-200">
                        <template v-if="latestPacingMetrics?.handoffGapMs != null">
                          {{ latestPacingMetrics.handoffGapMs <= 0 ? `${latestPacingMetrics.handoffGapMs}ms (seamless)` : `+${latestPacingMetrics.handoffGapMs}ms` }}
                        </template>
                        <template v-else-if="latestPacingMetrics?.fillersSpokenCount">
                          <span class="text-[9px] text-neutral-400 italic dark:text-neutral-500">syncing...</span>
                        </template>
                        <template v-else>
                          —
                        </template>
                      </span>
                    </div>

                    <!-- Model Token Usage -->
                    <div class="col-span-2 flex items-center justify-between border-t border-neutral-200/30 pt-1 text-[9px] dark:border-neutral-800/30">
                      <span class="text-[8px] text-neutral-400 font-bold uppercase dark:text-neutral-500">Turn Tokens</span>
                      <span v-if="latestTurnUsage && (latestTurnUsage.total || latestTurnUsage.prompt || latestTurnUsage.completion)" class="text-primary-500 font-semibold font-mono dark:text-primary-400">
                        {{ latestTurnUsage.total || ((latestTurnUsage.prompt || 0) + (latestTurnUsage.completion || 0)) }} tok ({{ latestTurnUsage.prompt || 0 }} in / {{ latestTurnUsage.completion || 0 }} out)
                      </span>
                      <span v-else class="text-neutral-400 italic dark:text-neutral-500">
                        Awaiting next turn
                      </span>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </PopoverPortal>
          </PopoverRoot>

          <!-- Brain LLM Icon Button (opens downwards) -->
          <ChatBrainPopover side="bottom" />

          <!-- Settings Options Menu (Hierarchical Drill-Down Popover) -->
          <ChatOptionsPopover
            trigger-variant="dots"
            :show-chat-layout="true"
            :character-id="chatSessionStore.sessionMetas[activeSessionId]?.characterId || activeCardId"
            :on-apply-chat-preset="handleApplyChatPreset"
            @open-staging-settings="handleOpenStagingSettings"
            @open-voice-settings="handleOpenVoiceSettings"
            @open-voice-editor="handleOpenVoiceEditor"
            @open-memory-settings="handleOpenMemorySettings"
            @open-card-settings="handleOpenCharacterConfig"
            @search-memories="handleSearchMemories"
          />

          <!-- Right Context Panel Toggle (md+) -->
          <button
            class="cursor-pointer items-center justify-center rounded-xl p-1.5 text-neutral-500 transition-all duration-200 ease-in-out hidden md:inline-flex hover:bg-neutral-200 dark:text-neutral-400 hover:text-neutral-700 hover:dark:bg-neutral-800 dark:hover:text-neutral-200"
            :class="{ 'text-primary-500 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-950/30': isRightPanelOpen }"
            :title="isRightPanelOpen ? 'Close context panel' : 'Open context panel'"
            @click="isRightPanelOpen = !isRightPanelOpen"
          >
            <div class="i-solar:sidebar-minimalistic-bold-duotone text-base" />
          </button>
        </div>
      </div>
    </header>
    <div class="relative z-2 flex flex-1 overflow-hidden">
      <!-- 1. Left Panel Mobile Overlay Drawer -->
      <Transition name="fade">
        <div
          v-if="showLeftOverlay"
          class="absolute inset-0 z-[999] bg-black/40 md:hidden"
          @click="isLeftPanelOpen = false"
        />
      </Transition>
      <Transition name="slide-left">
        <div
          v-if="showLeftOverlay"
          class="absolute bottom-0 left-0 top-0 z-[1000] w-60 flex flex-col border-r border-neutral-200/50 bg-neutral-50 p-3 shadow-2xl dark:border-neutral-800/50 dark:bg-neutral-950 md:hidden"
        >
          <!-- Sidebar Navigation Header -->
          <div class="mb-4 flex items-center justify-between border-b border-neutral-200/40 px-2 py-1.5 dark:border-neutral-800/40">
            <span class="text-xs text-neutral-400 font-bold tracking-wider uppercase">Workspace Routes</span>
          </div>

          <!-- Navigation Sections -->
          <div class="flex-1 overflow-y-auto pr-1 space-y-4">
            <div
              v-for="section in NAV_SECTIONS"
              :key="section.title"
              class="space-y-1"
            >
              <div class="px-2 pb-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
                {{ section.title }}
              </div>
              <button
                v-for="item in section.items"
                :key="item.id"
                class="w-full flex items-center gap-3 rounded-xl p-2.5 text-left text-xs font-semibold transition-all"
                :class="activeSurface === item.id
                  ? 'bg-primary-50/70 text-primary-600 dark:bg-primary-950/20 dark:text-primary-400 ring-1 ring-primary-500/10'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900/50'"
                @click="selectSurface(item.id)"
              >
                <div :class="[item.icon, 'text-base']" />
                <span class="truncate">{{ item.label }}</span>
              </button>
            </div>
          </div>

          <!-- Character Config Footer -->
          <div class="border-t border-neutral-200/40 pt-2 dark:border-neutral-800/40">
            <button
              class="w-full flex items-center justify-between rounded-xl p-2 text-left text-xs text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
              title="Open Character Config"
              @click="handleOpenCharacterConfig"
            >
              <div class="flex items-center gap-2">
                <div class="i-solar:user-id-bold-duotone text-base text-primary-500" />
                <span class="font-medium">Character Config</span>
              </div>
              <div class="i-solar:arrow-right-up-linear text-xs opacity-60" />
            </button>
          </div>
        </div>
      </Transition>

      <!-- 2. Left Panel Persistent Sidebar (Desktop md+) -->
      <div
        :class="[
          'h-full flex flex-col bg-neutral-50/40 dark:bg-neutral-950/20 border-r border-neutral-200/50 dark:border-neutral-800/50 transition-all duration-300 ease-in-out overflow-hidden hidden md:flex',
          showLeftSidebar ? 'w-2/12 p-3' : 'w-0 border-r-0 p-0',
        ]"
      >
        <div class="mb-4 flex items-center justify-between border-b border-neutral-200/45 px-2 py-1.5 dark:border-neutral-800/45">
          <span class="text-xs text-neutral-400 font-bold tracking-wider uppercase">Workspace</span>
        </div>

        <div class="flex-1 overflow-y-auto pr-1 space-y-4">
          <div
            v-for="section in NAV_SECTIONS"
            :key="section.title"
            class="space-y-1"
          >
            <div class="px-2 pb-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
              {{ section.title }}
            </div>
            <button
              v-for="item in section.items"
              :key="item.id"
              class="w-full flex items-center gap-3 rounded-xl p-2.5 text-left text-xs font-semibold transition-all"
              :class="activeSurface === item.id
                ? 'bg-primary-50/70 text-primary-600 dark:bg-primary-950/20 dark:text-primary-400 ring-1 ring-primary-500/10'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900/50'"
              @click="selectSurface(item.id)"
            >
              <div :class="[item.icon, 'text-base']" />
              <span class="truncate">{{ item.label }}</span>
            </button>
          </div>
        </div>

        <!-- Character Config Footer -->
        <div class="border-t border-neutral-200/45 pt-2 dark:border-neutral-800/45">
          <button
            class="w-full flex items-center justify-between rounded-xl p-2 text-left text-xs text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
            title="Open Character Config"
            @click="handleOpenCharacterConfig"
          >
            <div class="flex items-center gap-2">
              <div class="i-solar:user-id-bold-duotone text-base text-primary-500" />
              <span class="truncate font-medium">Character Config</span>
            </div>
            <div class="i-solar:arrow-right-up-linear text-xs opacity-60" />
          </button>
        </div>
      </div>

      <!-- 3. Dynamic Center Content Workspace Slot -->
      <div class="relative h-full flex flex-1 flex-row overflow-hidden">
        <!-- Sub-surface Component -->
        <component
          :is="activeSurfaceComponent"
          :key="`surface-${activeSurface}`"
          ref="activeSurfaceRef"
          class="h-full flex-1 overflow-hidden"
          @ready="handleSurfaceReady"
        />

        <!-- Ambient Workspace Coordinator Overlay (Covers viewport while sub-surface mounts) -->
        <Transition name="fade">
          <ChatWorkspaceCoordinator
            v-if="!isCurrentSurfaceReady"
            :key="`coord-${activeSurface}`"
            :character-name="activeCard?.name || 'AIRI'"
            :card-id="activeCardId"
            :surface-label="activeSurfaceLabel"
            :surface-icon="activeSurfaceIcon"
            :progress="coordinatorProgress"
            :status-text="coordinatorStatus"
            class="absolute inset-0 z-20"
          />
        </Transition>

        <!-- Right Context Panel (Exclusive to Chat View) -->
        <Transition name="slide-right">
          <div
            v-if="showRightPanel"
            class="w-3/12 flex flex-col border-l border-neutral-200/50 bg-neutral-50/30 dark:border-neutral-800/50 dark:bg-neutral-950/30"
          >
            <ChatDashboardPanel
              :active-card="activeCard"
              :active-card-id="activeCardId"
              :speaking-state="speakingState"
              :stage-x-offset="stageXOffset"
              :stage-y-offset="stageYOffset"
              :stage-scale="stageScale"
              :embedded-stage-supported="embeddedStageSupported"
              :is-nan0-active="isNan0Active"
              :is-sandbox-active="isSandboxActive"
              :interactive-area-ref="interactiveAreaRef"
              :format-month-day="formatMonthDay"
              @close="isRightPanelOpen = false"
              @stage-offset-change="handleStageOffsetChange"
              @stage-scale-change="handleStageScaleChange"
            />
          </div>
        </Transition>
      </div>
    </div>
    <!-- Full Timeline Management Modal -->
    <ChatSessionModal v-model="showManageModal" />

    <VoiceCreatorModal
      v-model="voiceEditorOpen"
      :character-name="pendingVoiceEditor?.characterName"
      :initial-provider="pendingVoiceEditor?.initial.provider"
      :initial-model="pendingVoiceEditor?.initial.model"
      :initial-voice="pendingVoiceEditor?.initial.voice"
      @save="handleVoiceEditorSave"
    />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease-in-out;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s ease;
}
.slide-right-enter-from,
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(1rem);
}
</style>

<route lang="yaml">
meta:
  layout: stage
</route>
