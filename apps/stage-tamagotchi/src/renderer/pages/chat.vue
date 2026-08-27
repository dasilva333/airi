<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { estimateTokens, formatTokenCount } from '@proj-airi/stage-shared'
import { ChatBrainPopover, ChatMemoryPopover } from '@proj-airi/stage-ui/components'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useLiveSessionStore } from '@proj-airi/stage-ui/stores/modules/live-session'
import { useLocalStorage, useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, markRaw, ref, watch } from 'vue'

import LogoDark from '../../../../../packages/stage-layouts/src/assets/logo-dark.svg'
import chat_director from '../components/chat/chat_director.vue'
import chat_event_log from '../components/chat/chat_event_log.vue'
import chat_lifetime from '../components/chat/chat_lifetime.vue'
import chat_media from '../components/chat/chat_media.vue'
// Import Sub-Surfaces
import chat_messages from '../components/chat/chat_messages.vue'
import chat_notes from '../components/chat/chat_notes.vue'
import chat_rehearsal from '../components/chat/chat_rehearsal.vue'
import chat_studio from '../components/chat/chat_studio.vue'
import chat_world from '../components/chat/chat_world.vue'
import WindowTitleBar from '../components/Window/TitleBar.vue'

import { electronApplySizePreset, electronOpenSettings } from '../../shared/eventa'

// Active Surface Ref
const activeSurfaceRef = ref<any>(null)
// Extract the nested interactiveAreaRef from activeSurfaceRef if available
const interactiveAreaRef = computed(() => activeSurfaceRef.value?.interactiveAreaRef)

const chatSessionStore = useChatSessionStore()
const airiCardStore = useAiriCardStore()
const liveSessionStore = useLiveSessionStore()

const applySizePreset = useElectronEventaInvoke(electronApplySizePreset)
const openSettings = useElectronEventaInvoke(electronOpenSettings)
const isSettingsOpen = ref(false)

function handleOpenStudio() {
  if (!activeCardId.value)
    return
  void openSettings({
    route: `/settings/airi-card?cardId=${activeCardId.value}&tab=studio`,
  }).catch((err: any) => {
    console.error('Failed to open Studio settings:', err)
  })
}

function handleApplyChatPreset(preset: 'mini' | 'medium' | 'large' | 'full') {
  applySizePreset({ target: 'chat', preset })
  isSettingsOpen.value = false
}

const { activeCard, activeCardId } = storeToRefs(airiCardStore)
const { activeSessionId, sessionMetas, messages } = storeToRefs(chatSessionStore)

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

function handleOpenJournal() {
  if (interactiveAreaRef.value)
    interactiveAreaRef.value.showJournalModal = true
}

const isRightPanelOpen = useLocalStorage('airi:chat:right-panel-open', false)
const { width } = useWindowSize()
const showRightPanel = computed(() => isRightPanelOpen.value && width.value >= 768 && activeSurface.value === 'messages')
const mediaDisplayCount = ref(12)
const rightPanelMemoriesCollapsed = useLocalStorage('airi:chat:rp-memories-collapsed', false)
const rightPanelCurrentSceneCollapsed = useLocalStorage('airi:chat:rp-current-scene-collapsed', false)
const rightPanelMediaCollapsed = useLocalStorage('airi:chat:rp-media-collapsed', false)

// Left Panel Routing States
const isLeftPanelOpen = useLocalStorage('airi:chat:left-panel-open', true)
const activeSurface = useLocalStorage<'messages' | 'director' | 'world' | 'characters' | 'media' | 'archives' | 'notes' | 'rehearsal' | 'event-log'>('airi:chat:left-panel-active', 'messages')

const SURFACE_LABELS: Record<string, string> = {
  'messages': 'Chat View',
  'director': 'Director\'s Monitor',
  'world': 'World Bible',
  'characters': 'Studio',
  'media': 'Media Library',
  'archives': 'Eternal Thread',
  'event-log': 'Event Ledger',
  'notes': 'Notes',
  'rehearsal': 'Rehearsal',
}

const activeSurfaceLabel = computed(() => SURFACE_LABELS[activeSurface.value] || 'Chat View')

const chatOrchestrator = useChatOrchestratorStore()
const { isUserTyping } = storeToRefs(chatOrchestrator)

watch(
  () => [activeSurface.value, isUserTyping.value] as const,
  ([surface, typing]) => {
    if (surface === 'messages') {
      document.title = typing
        ? 'AIRI - Chat Window - User Typing...'
        : 'AIRI - Chat Window'
    }
    else {
      const label = SURFACE_LABELS[surface] || 'Chat View'
      document.title = `AIRI - Chat Window - ${label}`
    }
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
    'notes': chat_notes,
    'rehearsal': chat_rehearsal,
    'event-log': chat_event_log,
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
  if (!activeCardId.value)
    return
  await airiCardStore.toggleSalienceGate(activeCardId.value)
  const isEnabled = !!activeCard.value?.extensions?.airi?.salienceGateEnabled
  if (isEnabled) {
    const { getWebRwkvAdapter } = await import('@proj-airi/stage-ui/libs/inference/adapters/web-rwkv')
    const { DEFAULT_WEB_RWKV_MODEL } = await import('@proj-airi/stage-ui/libs/inference/constants')
    const { useProvidersStore } = await import('@proj-airi/stage-ui/stores/providers')
    const adapter = await getWebRwkvAdapter()
    if (adapter.state === 'idle') {
      const providersStore = useProvidersStore()
      const config = providersStore.getProviderConfig('web-rwkv')
      const modelUrl = (config?.model as string) || DEFAULT_WEB_RWKV_MODEL
      const vocab = (config?.vocab as string) || undefined
      void adapter.loadModel(modelUrl, vocab).catch(err => console.error('[SalienceGate] Error loading web-rwkv model on toggle:', err))
    }
  }
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
          ...activeCard.value.extensions?.airi?.screenWatching,
          enabled: !current,
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

// Formatting active session switcher label
const activeSessionLabel = computed(() => {
  const baseName = activeCard.value?.nickname || activeCard.value?.name || 'AIRI'
  const meta = activeSessionMeta.value
  if (!meta)
    return baseName

  const universe = meta.universeId && meta.universeId !== 'global' ? meta.universeId : ''
  const title = meta.title && meta.title !== 'Untitled Timeline' ? meta.title : ''

  if (universe && title) {
    return `${baseName} (${universe}>${title})`
  }
  else if (universe) {
    return `${baseName} (${universe})`
  }
  else if (title) {
    return `${baseName} (${title})`
  }
  return baseName
})

// --- Generation Stats Popover & Token Output Limits ---
const isStatsPopoverOpen = ref(false)

const PROSE_PRESETS: Record<number, string> = {
  80: 'Respond in extremely short, single-sentence replies. Keep your output direct, concise, and absolute.',
  120: 'Respond in concise replies, typically one or two sentences. Avoid unnecessary detail.',
  200: 'Respond in moderate, conversational paragraphs (approx. 2-3 sentences). Keep it natural and punchy.',
  350: 'Respond in detailed paragraphs (approx. 1-2 short paragraphs). Provide depth but stay focused.',
  600: 'Respond in descriptive, long-form paragraphs (up to 2 paragraphs of rich context and detail).',
}

const LIMITS_REGEX = /\[TOKEN_OUTPUT_LIMITS:\s*(\d+)\][\s\S]*?- STYLE INSTRUCTION:\s*([\s\S]*?)\[\/TOKEN_OUTPUT_LIMITS\]\n*/

const popoverOverrideEnabled = ref(false)
const popoverContextWidth = ref<number | undefined>(undefined)
const popoverMaxTokens = ref<number>(200)
const popoverCustomProse = ref('')
const isProseEditing = ref(false)

function loadPopoverState() {
  if (!activeCard.value)
    return

  const airiExt = activeCard.value.extensions?.airi
  popoverOverrideEnabled.value = airiExt?.generation?.enabled ?? false
  popoverContextWidth.value = airiExt?.generation?.known?.contextWidth
  popoverMaxTokens.value = airiExt?.generation?.known?.maxTokens ?? 200

  const parsed = parseTokenLimits(activeCard.value.systemPrompt || '')
  if (parsed) {
    popoverMaxTokens.value = parsed.tokens
    popoverCustomProse.value = parsed.prose
  }
  else {
    popoverCustomProse.value = PROSE_PRESETS[popoverMaxTokens.value] || PROSE_PRESETS[200]
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
  const matchingPreset = PROSE_PRESETS[popoverMaxTokens.value]
  if (matchingPreset) {
    popoverCustomProse.value = matchingPreset
  }
  saveCardGenerationSettings()
}

function handleResetToDefaults() {
  if (!activeCardId.value || !activeCard.value)
    return

  const airiExt = activeCard.value.extensions?.airi
  const cleanedPrompt = stripTokenLimitsFromPrompt(activeCard.value.systemPrompt || '')

  popoverMaxTokens.value = 200
  popoverCustomProse.value = PROSE_PRESETS[200]
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

// List of sessions for dropdown
const characterSessions = computed(() => {
  if (!activeCardId.value)
    return []
  const characterIndex = chatSessionStore.getCharacterIndex(activeCardId.value)
  if (!characterIndex)
    return []
  return Object.values(characterIndex.sessions).sort((a, b) => b.updatedAt - a.updatedAt)
})

function handleSelectSession(sessionId: string) {
  chatSessionStore.setActiveSession(sessionId)
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
  <div class="h-full w-full flex flex-col overflow-hidden pt-[44px]">
    <WindowTitleBar
      :title="activeSurface === 'messages' ? 'Chat' : activeSurfaceLabel"
      icon="i-solar:chat-line-bold"
    >
      <div class="relative w-full flex items-center justify-between px-2" drag-region>
        <!-- Left: Brand Logo, Hamburger Toggle, & Premium Session Selector -->
        <div class="no-drag flex select-none items-center gap-3 outline-none">
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

          <PopoverRoot>
            <PopoverTrigger as-child>
              <div
                class="flex cursor-pointer select-none items-center gap-2 border border-neutral-200/50 rounded-xl bg-neutral-100/30 px-3 py-1 text-xs font-bold transition-all duration-200 ease-in-out dark:border-neutral-800 dark:bg-neutral-900/40 hover:bg-neutral-200/50 hover:dark:bg-neutral-800/40"
              >
                <span class="max-w-64 truncate text-neutral-700 dark:text-neutral-300">{{ activeSessionLabel }}</span>
                <div class="i-solar:alt-arrow-down-bold text-[10px] text-neutral-400 opacity-60 dark:text-neutral-500" />
              </div>
            </PopoverTrigger>
            <PopoverPortal>
              <PopoverContent
                side="bottom"
                :side-offset="6"
                align="center"
                class="animate-in fade-in slide-in-from-top-1 z-[10000] w-64 border border-neutral-200/60 rounded-2xl bg-white/95 p-2 shadow-2xl backdrop-blur-xl duration-150 dark:border-neutral-800 dark:bg-neutral-950/95"
              >
                <div class="mb-1 select-none border-b border-neutral-100 px-2 py-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:border-neutral-900">
                  Switch Timeline
                </div>
                <div class="max-h-60 overflow-y-auto scrollbar-thin space-y-1">
                  <div
                    v-for="session in characterSessions"
                    :key="session.sessionId"
                    class="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200"
                    :class="activeSessionId === session.sessionId ? 'bg-primary-50/50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/60 dark:hover:bg-neutral-900/40'"
                    @click="handleSelectSession(session.sessionId)"
                  >
                    <div class="flex flex-col">
                      <span class="max-w-44 truncate">{{ session.title || 'Untitled Timeline' }}</span>
                      <span v-if="session.universeId && session.universeId !== 'global'" class="mt-0.5 text-[9px] text-neutral-400 font-medium dark:text-neutral-500">
                        Universe: {{ session.universeId }}
                      </span>
                    </div>
                    <span class="ml-3 text-[10px] text-neutral-400 font-bold dark:text-neutral-500">
                      {{ session.messageCount || 0 }}
                    </span>
                  </div>
                </div>
              </PopoverContent>
            </PopoverPortal>
          </PopoverRoot>
        </div>

        <!-- Right: Stacked Metrics, Memory & Context placeholder, Brain LLM Icon -->
        <div class="no-drag flex items-center gap-3">
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
                class="animate-in fade-in slide-in-from-top-1 z-[10000] w-72 flex flex-col gap-3 border border-neutral-200/60 rounded-2xl bg-white/95 p-3.5 shadow-2xl backdrop-blur-xl duration-150 dark:border-neutral-800 dark:bg-neutral-950/95"
                side="bottom"
                align="end"
                :side-offset="8"
              >
                <!-- Section Header -->
                <div class="flex items-center justify-between border-b border-neutral-200/40 pb-1.5 dark:border-neutral-800/40">
                  <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">Limits & Context</span>
                  <button
                    v-if="popoverOverrideEnabled"
                    class="text-[10px] text-red-500 font-bold tracking-tight transition dark:text-red-400 hover:text-red-600 hover:dark:text-red-300"
                    @click="handleResetToDefaults"
                  >
                    Reset defaults
                  </button>
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
                      <span class="text-neutral-400 font-bold tracking-tight uppercase">Response Token Limit</span>
                      <span class="text-primary-500 font-bold dark:text-primary-400">{{ popoverMaxTokens }} tokens</span>
                    </div>
                    <input
                      v-model.number="popoverMaxTokens"
                      type="range"
                      min="80"
                      max="600"
                      step="1"
                      class="h-1 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-500 dark:bg-neutral-800"
                      @input="handleTokensSliderChange"
                    >
                    <div class="flex justify-between px-0.5 text-[8px] text-neutral-400 font-bold">
                      <span>80t</span>
                      <span>120t</span>
                      <span>200t</span>
                      <span>350t</span>
                      <span>600t</span>
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
              </PopoverContent>
            </PopoverPortal>
          </PopoverRoot>

          <!-- Memory & Context Popover (moved from bottom toolbar) -->
          <ChatMemoryPopover
            show-cache-status
            :title="`Memory & Context for ${activeCard?.name || 'Character'}`"
            @view-context="handleViewContext"
            @manage-sessions="handleManageSessions"
            @search-memories="handleSearchMemories"
            @clear-messages="handleClearMessages"
            @open-studio="handleOpenStudio"
          />

          <!-- Brain LLM Icon Button (opens downwards) -->
          <ChatBrainPopover side="bottom" />

          <!-- Settings Ellipsis Menu (Send Mode + Grounding Modes) -->
          <PopoverRoot v-model:open="isSettingsOpen">
            <PopoverTrigger as-child>
              <button
                class="flex cursor-pointer items-center justify-center rounded-xl p-1.5 text-neutral-500 transition-all duration-200 ease-in-out hover:bg-neutral-200 dark:text-neutral-400 hover:text-neutral-700 hover:dark:bg-neutral-800 dark:hover:text-neutral-200"
                title="Options"
              >
                <div class="i-solar:menu-dots-bold text-base" />
              </button>
            </PopoverTrigger>
            <PopoverPortal>
              <PopoverContent
                class="animate-in fade-in slide-in-from-top-1 z-[10000] w-64 flex flex-col gap-1 border border-neutral-200/60 rounded-2xl bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl duration-150 dark:border-neutral-800 dark:bg-neutral-950/95"
                side="bottom"
                align="end"
                :side-offset="8"
              >
                <!-- Toggle: Heartbeats -->
                <div
                  class="w-full flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  @click="handleToggleHeartbeats"
                >
                  <div class="flex items-center gap-2.5">
                    <div
                      class="text-base"
                      :class="activeCard?.extensions?.airi?.heartbeats?.enabled
                        ? 'text-primary-500 i-solar:heart-pulse-bold-duotone'
                        : 'text-neutral-400 dark:text-neutral-500 i-solar:heart-pulse-linear'"
                    />
                    <div class="flex flex-col">
                      <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Heartbeats</span>
                      <span class="text-[9px] text-neutral-400">Activates character periodically</span>
                    </div>
                  </div>
                  <div
                    :class="activeCard?.extensions?.airi?.heartbeats?.enabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
                    class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
                  >
                    <span
                      :class="activeCard?.extensions?.airi?.heartbeats?.enabled ? 'translate-x-3.5' : 'translate-x-0.5'"
                      class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </div>
                </div>

                <!-- Toggle: Screen Watching -->
                <div
                  class="w-full flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  @click="handleToggleScreenWatching"
                >
                  <div class="flex items-center gap-2.5">
                    <div
                      class="text-base"
                      :class="activeCard?.extensions?.airi?.screenWatching?.enabled
                        ? 'text-primary-500 i-solar:eye-bold-duotone'
                        : 'text-neutral-400 dark:text-neutral-500 i-solar:eye-linear'"
                    />
                    <div class="flex flex-col">
                      <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Screen Watching</span>
                      <span class="text-[9px] text-neutral-400">Visual event-driven commentary</span>
                    </div>
                  </div>
                  <div
                    :class="activeCard?.extensions?.airi?.screenWatching?.enabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
                    class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
                  >
                    <span
                      :class="activeCard?.extensions?.airi?.screenWatching?.enabled ? 'translate-x-3.5' : 'translate-x-0.5'"
                      class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </div>
                </div>

                <!-- Toggle: Dreams -->
                <div
                  class="w-full flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  @click="handleToggleDreamState"
                >
                  <div class="flex items-center gap-2.5">
                    <div
                      class="text-base"
                      :class="isDreamStateEnabled
                        ? 'text-indigo-500 i-solar:sleeping-bold-duotone'
                        : 'text-neutral-400 dark:text-neutral-500 i-solar:sleeping-linear'"
                    />
                    <div class="flex flex-col">
                      <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Dreams</span>
                      <span class="text-[9px] text-neutral-400">Offline memory consolidation</span>
                    </div>
                  </div>
                  <div
                    :class="isDreamStateEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
                    class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
                  >
                    <span
                      :class="isDreamStateEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
                      class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </div>
                </div>

                <!-- Toggle: Visual Novel (replaces Image Director) -->
                <div
                  class="w-full flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  @click="handleToggleImageDirector"
                >
                  <div class="flex items-center gap-2.5">
                    <div
                      class="text-base"
                      :class="activeCard?.extensions?.airi?.artistry?.autonomousEnabled
                        ? 'text-primary-500 i-solar:gallery-wide-bold-duotone'
                        : 'text-neutral-400 dark:text-neutral-500 i-solar:gallery-wide-linear'"
                    />
                    <div class="flex flex-col">
                      <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Visual Novel</span>
                      <span class="text-[9px] text-neutral-400">Generates a new image for every turn</span>
                    </div>
                  </div>
                  <div
                    :class="activeCard?.extensions?.airi?.artistry?.autonomousEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
                    class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
                  >
                    <span
                      :class="activeCard?.extensions?.airi?.artistry?.autonomousEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
                      class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </div>
                </div>

                <!-- Section: Image Spawn Mode -->
                <div class="select-none px-2 py-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
                  Image Spawn Mode
                </div>
                <div class="mx-2 mb-1.5 flex gap-0.5 rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-900">
                  <button
                    v-for="mode in (['bg', 'widget', 'inline'] as const)"
                    :key="mode"
                    :class="[
                      'flex-1 py-1 text-[10px] font-bold rounded-md transition-all text-center whitespace-nowrap',
                      activeCard?.extensions?.airi?.artistry?.spawnMode === mode
                        ? 'bg-white dark:bg-neutral-800 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
                    ]"
                    @click="handleSetSpawnMode(mode)"
                  >
                    {{ mode === 'bg' ? 'Background' : mode === 'widget' ? 'Widget' : 'Inline' }}
                  </button>
                </div>

                <!-- Section: Chat Layout -->
                <div class="select-none px-2 py-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
                  Chat Layout
                </div>
                <div class="mx-2 mb-1.5 flex border border-neutral-200/20 rounded-lg bg-neutral-100 p-0.5 divide-x divide-neutral-200/50 dark:border-neutral-800/30 dark:bg-neutral-900 dark:divide-neutral-800/80">
                  <button
                    v-for="preset in (['mini', 'medium', 'large', 'full'] as const)"
                    :key="preset"
                    class="flex-1 cursor-pointer rounded-md py-1 text-center text-[10px] text-neutral-600 font-bold transition-all active:scale-95 hover:bg-white/45 dark:text-neutral-400 hover:text-sky-500 dark:hover:bg-neutral-800/40 dark:hover:text-sky-400"
                    @click="handleApplyChatPreset(preset)"
                  >
                    {{ preset === 'medium' ? 'Med.' : preset.charAt(0).toUpperCase() + preset.slice(1) }}
                  </button>
                </div>

                <!-- Section: Context Injections -->
                <div class="select-none px-2 py-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
                  Context Injections
                </div>

                <!-- Toggle: System Sensors -->
                <div
                  class="w-full flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  @click="handleToggleGrounding"
                >
                  <div class="flex items-center gap-2.5">
                    <div
                      class="text-base"
                      :class="activeCard?.extensions?.airi?.groundingEnabled
                        ? 'text-amber-500 i-solar:cpu-bolt-bold-duotone'
                        : 'text-neutral-400 dark:text-neutral-500 i-solar:cpu-bold-duotone'"
                    />
                    <div class="flex flex-col">
                      <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">System Sensors</span>
                      <span class="text-[9px] text-neutral-400">Inject real-time OS telemetry</span>
                    </div>
                  </div>
                  <div
                    :class="activeCard?.extensions?.airi?.groundingEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
                    class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
                  >
                    <span
                      :class="activeCard?.extensions?.airi?.groundingEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
                      class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </div>
                </div>

                <!-- Toggle: Universe Memory (RAG) -->
                <div
                  class="w-full flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  @click="handleToggleGroundingMemory"
                >
                  <div class="flex items-center gap-2.5">
                    <div
                      class="text-base"
                      :class="activeCard?.extensions?.airi?.groundingMemoryEnabled
                        ? 'text-amber-500 i-solar:database-bold-duotone'
                        : 'text-neutral-400 dark:text-neutral-500 i-solar:database-linear'"
                    />
                    <div class="flex flex-col">
                      <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Universe Memory (RAG)</span>
                      <span class="text-[9px] text-neutral-400">Semantic long-term memory lookup</span>
                    </div>
                  </div>
                  <div
                    :class="activeCard?.extensions?.airi?.groundingMemoryEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
                    class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
                  >
                    <span
                      :class="activeCard?.extensions?.airi?.groundingMemoryEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
                      class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </div>
                </div>

                <!-- Toggle: Visual Scene State -->
                <div
                  class="w-full flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  @click="handleToggleGroundingDirectorScratchpad"
                >
                  <div class="flex items-center gap-2.5">
                    <div
                      class="text-base"
                      :class="activeCard?.extensions?.airi?.groundingDirectorScratchpadEnabled
                        ? 'text-amber-500 i-solar:gallery-bold-duotone'
                        : 'text-neutral-400 dark:text-neutral-500 i-solar:gallery-linear'"
                    />
                    <div class="flex flex-col">
                      <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Visual Scene State</span>
                      <span class="text-[9px] text-neutral-400">Attach Director's latest scratchpad</span>
                    </div>
                  </div>
                  <div
                    :class="activeCard?.extensions?.airi?.groundingDirectorScratchpadEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
                    class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
                  >
                    <span
                      :class="activeCard?.extensions?.airi?.groundingDirectorScratchpadEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
                      class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </div>
                </div>

                <!-- Toggle: Salience Gating (RWKV 0.1B) -->
                <div
                  class="w-full flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  @click="handleToggleSalienceGate"
                >
                  <div class="flex items-center gap-2.5">
                    <div
                      class="text-base"
                      :class="activeCard?.extensions?.airi?.salienceGateEnabled
                        ? 'text-amber-500 i-solar:pulse-bold-duotone'
                        : 'text-neutral-400 dark:text-neutral-500 i-solar:pulse-linear'"
                    />
                    <div class="flex flex-col">
                      <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Salience Gating (RWKV)</span>
                      <span class="text-[9px] text-neutral-400">Flag high-intensity turns for grounding</span>
                    </div>
                  </div>
                  <div
                    :class="activeCard?.extensions?.airi?.salienceGateEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
                    class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
                  >
                    <span
                      :class="activeCard?.extensions?.airi?.salienceGateEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
                      class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </div>
                </div>

                <!-- Section Divider for Intrusions -->
                <div class="mx-2 my-1 border-t border-neutral-200/20 dark:border-neutral-800/40" />

                <!-- Toggle: Dream Intrusion -->
                <div
                  class="w-full flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  :class="[!isDreamStateEnabled ? 'opacity-50 pointer-events-none' : '']"
                  @click="handleToggleDreamIntrusion"
                >
                  <div class="flex items-center gap-2.5">
                    <div
                      class="text-base"
                      :class="activeCard?.extensions?.airi?.dreamState?.injectDreamContext && isDreamStateEnabled
                        ? 'text-indigo-500 i-solar:sleeping-bold-duotone'
                        : 'text-neutral-400 dark:text-neutral-500 i-solar:sleeping-linear'"
                    />
                    <div class="flex flex-col">
                      <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Dream Intrusion</span>
                      <span class="text-[9px] text-neutral-400">
                        Inject offline consolidated dreams
                        <span v-if="!isDreamStateEnabled" class="text-red-500 font-semibold dark:text-red-400"> (Requires Dreams)</span>
                      </span>
                    </div>
                  </div>
                  <div
                    :class="activeCard?.extensions?.airi?.dreamState?.injectDreamContext && isDreamStateEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
                    class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
                  >
                    <span
                      :class="activeCard?.extensions?.airi?.dreamState?.injectDreamContext && isDreamStateEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
                      class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </div>
                </div>

                <!-- Toggle: Journal Intrusion -->
                <div
                  v-if="hasTextJournal"
                  class="w-full flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  @click="handleToggleJournalIntrusion"
                >
                  <div class="flex items-center gap-2.5">
                    <div
                      class="text-base"
                      :class="activeCard?.extensions?.airi?.textJournal?.injectJournalContext
                        ? 'text-cyan-500 i-solar:notebook-bold-duotone'
                        : 'text-neutral-400 dark:text-neutral-500 i-solar:notebook-linear'"
                    />
                    <div class="flex flex-col">
                      <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Journal Intrusion</span>
                      <span class="text-[9px] text-neutral-400">Reference latest journal entry</span>
                    </div>
                  </div>
                  <div
                    :class="activeCard?.extensions?.airi?.textJournal?.injectJournalContext ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
                    class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
                  >
                    <span
                      :class="activeCard?.extensions?.airi?.textJournal?.injectJournalContext ? 'translate-x-3.5' : 'translate-x-0.5'"
                      class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </div>
                </div>

                <!-- Toggle: Artistry Intrusion -->
                <div
                  v-if="hasImageJournal"
                  class="w-full flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  @click="handleToggleArtistryIntrusion"
                >
                  <div class="flex items-center gap-2.5">
                    <div
                      class="text-base"
                      :class="activeCard?.extensions?.airi?.artistry?.injectArtistryContext
                        ? 'text-pink-500 i-solar:gallery-bold-duotone'
                        : 'text-neutral-400 dark:text-neutral-500 i-solar:gallery-linear'"
                    />
                    <div class="flex flex-col">
                      <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">Artistry Intrusion</span>
                      <span class="text-[9px] text-neutral-400">Reference latest image creations</span>
                    </div>
                  </div>
                  <div
                    :class="activeCard?.extensions?.airi?.artistry?.injectArtistryContext ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
                    class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
                  >
                    <span
                      :class="activeCard?.extensions?.airi?.artistry?.injectArtistryContext ? 'translate-x-3.5' : 'translate-x-0.5'"
                      class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    />
                  </div>
                </div>
              </PopoverContent>
            </PopoverPortal>
          </PopoverRoot>

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
    </WindowTitleBar>
    <div class="relative flex flex-1 overflow-hidden">
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

          <!-- Navigation Links -->
          <div class="flex-1 space-y-1">
            <button
              v-for="item in ([
                { id: 'messages', label: 'Chat View', icon: 'i-solar:chat-line-bold-duotone' },
                { id: 'director', label: 'Director\'s Monitor', icon: 'i-solar:videocamera-record-bold-duotone' },
                { id: 'world', label: 'World Bible', icon: 'i-solar:notes-bold-duotone' },
                { id: 'characters', label: 'Studio', icon: 'i-solar:layers-minimalistic-bold-duotone' },
                { id: 'media', label: 'Media Library', icon: 'i-solar:gallery-bold-duotone' },
                { id: 'archives', label: 'Eternal Thread', icon: 'i-solar:dna-bold-duotone' },
                { id: 'event-log', label: 'Event Ledger', icon: 'i-solar:document-text-bold-duotone' },
                { id: 'notes', label: 'Notes', icon: 'i-solar:document-text-bold-duotone' },
                { id: 'rehearsal', label: 'Rehearsal', icon: 'i-solar:clapperboard-text-bold-duotone' },
              ] as const)"
              :key="item.id"
              class="w-full flex items-center gap-3 rounded-xl p-2.5 text-left text-xs font-semibold transition-all"
              :class="activeSurface === item.id
                ? 'bg-primary-50/70 text-primary-600 dark:bg-primary-950/20 dark:text-primary-400 ring-1 ring-primary-500/10'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900/50'"
              @click="selectSurface(item.id)"
            >
              <div :class="[item.icon, 'text-base']" />
              <span>{{ item.label }}</span>
            </button>
          </div>

          <!-- Settings Footer -->
          <div class="border-t border-neutral-200/40 pt-2 dark:border-neutral-800/40">
            <button
              class="w-full flex items-center justify-between rounded-xl p-2 text-left text-xs text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
              @click="selectSurface('messages')"
            >
              <div class="flex items-center gap-2">
                <div class="i-solar:settings-minimalistic-linear text-base" />
                <span>Settings</span>
              </div>
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

        <div class="flex-1 space-y-1">
          <button
            v-for="item in ([
              { id: 'messages', label: 'Chat View', icon: 'i-solar:chat-line-bold-duotone' },
              { id: 'director', label: 'Director\'s Monitor', icon: 'i-solar:videocamera-record-bold-duotone' },
              { id: 'world', label: 'World Bible', icon: 'i-solar:notes-bold-duotone' },
              { id: 'characters', label: 'Studio', icon: 'i-solar:layers-minimalistic-bold-duotone' },
              { id: 'media', label: 'Media Library', icon: 'i-solar:gallery-bold-duotone' },
              { id: 'archives', label: 'Eternal Thread', icon: 'i-solar:dna-bold-duotone' },
              { id: 'event-log', label: 'Event Ledger', icon: 'i-solar:document-text-bold-duotone' },
              { id: 'notes', label: 'Notes', icon: 'i-solar:document-text-bold-duotone' },
              { id: 'rehearsal', label: 'Rehearsal', icon: 'i-solar:clapperboard-text-bold-duotone' },
            ] as const)"
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

        <div class="border-t border-neutral-200/45 pt-2 dark:border-neutral-800/45">
          <button
            class="w-full flex items-center justify-between rounded-xl p-2 text-left text-xs text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
            @click="selectSurface('messages')"
          >
            <div class="flex items-center gap-2">
              <div class="i-solar:settings-minimalistic-linear text-base" />
              <span>Settings</span>
            </div>
          </button>
        </div>
      </div>

      <!-- 3. Dynamic Center Content Workspace Slot -->
      <div class="h-full flex flex-1 flex-row overflow-hidden">
        <component
          :is="activeSurfaceComponent"
          ref="activeSurfaceRef"
          class="h-full flex-1 overflow-hidden"
        />

        <!-- Right Context Panel (Exclusive to Chat View) -->
        <Transition name="slide-right">
          <div
            v-if="showRightPanel"
            class="w-3/12 flex flex-col overflow-y-auto border-l border-neutral-200/50 bg-neutral-50/30 dark:border-neutral-800/50 dark:bg-neutral-950/30"
          >
            <!-- Panel Body -->
            <div class="flex flex-col gap-4 p-4">
              <!-- Memories Section -->
              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <span
                    :class="['flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase transition-colors',
                             rightPanelMemoriesCollapsed
                               ? 'bg-neutral-100/50 text-neutral-400 dark:bg-neutral-800/50'
                               : 'bg-primary-50/50 text-primary-500 dark:bg-primary-950/30 dark:text-primary-400']"
                    @click="rightPanelMemoriesCollapsed = !rightPanelMemoriesCollapsed"
                  >
                    Memories
                    <span :class="rightPanelMemoriesCollapsed ? 'i-solar:eye-closed-linear' : 'i-solar:eye-linear'" class="text-xs" />
                  </span>
                  <button
                    class="select-none text-[10px] text-primary-500 font-bold transition-colors hover:text-primary-600"
                    @click="handleOpenJournal"
                  >
                    + New
                  </button>
                </div>
                <div v-if="!rightPanelMemoriesCollapsed" class="flex flex-col gap-1">
                  <template v-for="entry in (interactiveAreaRef?.allTextEntries ?? [])" :key="entry.id">
                    <!-- Echo chip -->
                    <div
                      v-if="entry.type === 'echo'"
                      class="h-[26px] w-full flex cursor-pointer items-center gap-2 border rounded-lg px-2 py-1 text-[10px] font-bold leading-none transition-all"
                      :class="entry.echoType === 'mood'
                        ? 'border-rose-200/60 bg-rose-50/50 text-rose-600 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-400'
                        : entry.echoType === 'flavor'
                          ? 'border-amber-200/60 bg-amber-50/50 text-amber-600 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-400'
                          : 'border-indigo-200/60 bg-indigo-50/50 text-indigo-600 dark:border-indigo-800/60 dark:bg-indigo-900/20 dark:text-indigo-400'"
                      @click="interactiveAreaRef?.openTextPreview?.(entry)"
                    >
                      <span class="shrink-0 opacity-70">{{ formatMonthDay(entry.timestamp) }}</span>
                      <span
                        :class="entry.echoType === 'mood'
                          ? 'i-solar:heart-bold-duotone'
                          : entry.echoType === 'flavor'
                            ? 'i-solar:tag-bold-duotone'
                            : 'i-solar:magic-stick-3-bold-duotone'"
                        class="shrink-0 text-[10px]"
                      />
                      <span class="truncate">{{ entry.content }}</span>
                    </div>

                    <!-- STMM auto entry card -->
                    <div
                      v-else-if="entry.type === 'auto'"
                      class="flex flex-col cursor-pointer gap-1 border border-primary-200/30 rounded-lg bg-primary-50/30 p-2.5 transition-colors dark:border-primary-800/30 hover:border-primary-300 dark:bg-primary-950/20 dark:hover:border-primary-700"
                      @click="interactiveAreaRef?.openTextPreview?.(entry)"
                    >
                      <div class="flex items-center gap-1.5 text-[10px] text-primary-500 font-bold uppercase dark:text-primary-400">
                        <span>{{ formatMonthDay(entry.timestamp) }}</span>
                        <span class="i-solar:dna-bold-duotone text-[10px]" />
                        <span>Daily Summary Block</span>
                      </div>
                      <div class="flex items-center gap-2 text-[9px] text-neutral-400 font-medium">
                        <span>{{ entry.messageCount }} messages</span>
                        <span>·</span>
                        <span>{{ entry.sessionCount }} sessions</span>
                        <span v-if="entry.estimatedTokens">·</span>
                        <span v-if="entry.estimatedTokens">{{ entry.estimatedTokens }} tokens</span>
                      </div>
                      <p class="line-clamp-2 text-[10px] text-neutral-600 leading-relaxed dark:text-neutral-400">
                        {{ entry.content }}
                      </p>
                    </div>

                    <!-- Manual journal entry card -->
                    <div
                      v-else-if="entry.type === 'manual'"
                      class="flex flex-col cursor-pointer gap-1 border border-emerald-200/30 rounded-lg bg-emerald-50/30 p-2.5 transition-colors dark:border-emerald-800/30 hover:border-emerald-300 dark:bg-emerald-950/20 dark:hover:border-emerald-700"
                      @click="interactiveAreaRef?.openTextPreview?.(entry)"
                    >
                      <div class="flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold uppercase dark:text-emerald-400">
                        <span>{{ formatMonthDay(entry.timestamp) }}</span>
                        <span class="i-solar:notebook-bold-duotone text-[10px]" />
                        <span>Journal Entry</span>
                      </div>
                      <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">{{ entry.title }}</span>
                      <p class="line-clamp-2 text-[10px] text-neutral-500 leading-relaxed dark:text-neutral-400">
                        {{ entry.content }}
                      </p>
                    </div>
                  </template>
                </div>
              </div>

              <!-- Current Scene Section -->
              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <span
                    :class="['flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase transition-colors',
                             rightPanelCurrentSceneCollapsed
                               ? 'bg-neutral-100/50 text-neutral-400 dark:bg-neutral-800/50'
                               : 'bg-primary-50/50 text-primary-500 dark:bg-primary-950/30 dark:text-primary-400']"
                    @click="rightPanelCurrentSceneCollapsed = !rightPanelCurrentSceneCollapsed"
                  >
                    Current Scene
                    <span :class="rightPanelCurrentSceneCollapsed ? 'i-solar:eye-closed-linear' : 'i-solar:eye-linear'" class="text-xs" />
                  </span>
                </div>
                <div v-if="!rightPanelCurrentSceneCollapsed">
                  <template v-if="(interactiveAreaRef?.allImageEntries ?? []).length > 0">
                    <div
                      class="group relative aspect-[3/2] w-full cursor-pointer overflow-hidden border border-neutral-200/60 rounded-xl bg-neutral-200/50 transition-all dark:border-neutral-800/60 hover:border-primary-400 dark:bg-neutral-800/50 dark:hover:border-primary-500"
                      @click="interactiveAreaRef?.openImagePreview?.((interactiveAreaRef?.allImageEntries ?? [])[0])"
                    >
                      <img
                        v-if="(interactiveAreaRef?.allImageEntries ?? [])[0]?.url"
                        :src="(interactiveAreaRef?.allImageEntries ?? [])[0]?.url"
                        class="h-full w-full object-cover"
                      >
                      <div v-else class="h-full w-full" />
                      <div class="absolute inset-0 flex items-end from-black/60 to-transparent bg-gradient-to-t p-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <span class="truncate text-[9px] text-white font-medium leading-tight">
                          {{ (interactiveAreaRef?.allImageEntries ?? [])[0]?.title }}
                        </span>
                      </div>
                    </div>
                  </template>
                  <div
                    v-else
                    class="h-20 w-full flex items-center justify-center border border-neutral-200/60 rounded-xl border-dashed bg-neutral-100/40 text-[10px] text-neutral-400 dark:border-neutral-800/60 dark:bg-neutral-900/30"
                  >
                    No scene yet
                  </div>
                </div>
              </div>

              <!-- Media Gallery Section -->
              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <span
                    :class="['flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase transition-colors',
                             rightPanelMediaCollapsed
                               ? 'bg-neutral-100/50 text-neutral-400 dark:bg-neutral-800/50'
                               : 'bg-primary-50/50 text-primary-500 dark:bg-primary-950/30 dark:text-primary-400']"
                    @click="rightPanelMediaCollapsed = !rightPanelMediaCollapsed"
                  >
                    Media Gallery
                    <span :class="rightPanelMediaCollapsed ? 'i-solar:eye-closed-linear' : 'i-solar:eye-linear'" class="text-xs" />
                  </span>
                  <div class="flex items-center gap-2">
                    <button
                      class="select-none text-[10px] text-primary-500 font-bold transition-colors hover:text-primary-600"
                      @click="interactiveAreaRef?.openImagineDialog()"
                    >
                      + Add
                    </button>
                    <button
                      class="select-none text-[10px] text-neutral-400 font-bold transition-colors hover:text-neutral-600"
                      @click="interactiveAreaRef?.openBackgroundDialog()"
                    >
                      View All
                    </button>
                  </div>
                </div>
                <div v-if="!rightPanelMediaCollapsed" class="flex flex-col gap-1.5">
                  <div class="grid grid-cols-3 gap-1.5">
                    <div
                      v-for="entry in (interactiveAreaRef?.allImageEntries ?? []).slice(0, mediaDisplayCount)"
                      :key="entry.id"
                      :class="[
                        'group relative aspect-square cursor-pointer overflow-hidden rounded-lg',
                        'border border-neutral-200/60 transition-all hover:border-primary-400',
                        'dark:border-neutral-800/60 dark:hover:border-primary-500',
                        'bg-neutral-200/50 dark:bg-neutral-800/50',
                      ]"
                      @click="interactiveAreaRef?.openImagePreview?.(entry)"
                    >
                      <img
                        v-if="entry.url"
                        :src="entry.url"
                        class="h-full w-full object-cover"
                      >
                      <!-- Placeholder square when no url -->
                      <div v-else class="h-full w-full" />
                      <!-- Hover overlay -->
                      <div class="absolute inset-0 flex items-end from-black/50 to-transparent bg-gradient-to-t p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <span class="truncate text-[8px] text-white font-medium leading-tight">{{ entry.title }}</span>
                      </div>
                    </div>
                    <!-- Fill remaining slots with placeholders -->
                    <div
                      v-for="n in Math.max(0, mediaDisplayCount - (interactiveAreaRef?.allImageEntries?.length ?? 0))"
                      :key="`fill-${n}`"
                      class="aspect-square border border-neutral-200/60 rounded-lg bg-neutral-100/50 dark:border-neutral-800/60 dark:bg-neutral-800/30"
                    />
                  </div>

                  <!-- View More -->
                  <button
                    class="w-full flex items-center justify-center gap-1.5 border border-neutral-200/60 rounded-xl bg-neutral-50/50 py-2 text-[10px] text-neutral-500 font-bold tracking-wider uppercase transition-all dark:border-neutral-800/60 hover:border-primary-200 dark:bg-neutral-950/50 dark:text-neutral-400 hover:text-primary-500 dark:hover:border-primary-800 dark:hover:text-primary-400"
                    @click="mediaDisplayCount += 12"
                  >
                    View More
                    <span class="i-solar:alt-arrow-down-bold text-[8px]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
