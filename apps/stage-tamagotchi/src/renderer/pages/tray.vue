<script setup lang="ts">
import { useElectronEventaInvoke, useElectronRelativeMouse } from '@proj-airi/electron-vueuse'
import { ChatWorkspacePopover } from '@proj-airi/stage-layouts'
import { CharacterAvatar } from '@proj-airi/stage-ui/components'
import { RendererStage } from '@proj-airi/stage-ui/components/scenes'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useSettings, useSettingsTheme } from '@proj-airi/stage-ui/stores/settings'
import { BeamAvatar } from '@proj-airi/ui'
import { useDark, useLocalStorage, usePreferredReducedMotion, useToggle } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'

import {
  electronOpenSettings,
  electronTrayPopoverClose,
  electronTrayPopoverGetPinState,
  electronTrayPopoverSetCollapsed,
  electronTrayPopoverTogglePin,
} from '../../shared/eventa'

// Asynchronous component loading for minimal initial memory footprint
const ChatTab = defineAsyncComponent(() => import('../components/tray/ChatTab.vue'))
const ControlsTab = defineAsyncComponent(() => import('../components/tray/ControlsTab.vue'))
const StatusTab = defineAsyncComponent(() => import('../components/tray/StatusTab.vue'))

// Tab state persistence: remembers the last opened tab
const activeTab = useLocalStorage<'chat' | 'controls' | 'status'>('airi:tray:active-tab', 'controls')

// Collapsed focus mode state
const isCollapsed = useLocalStorage('airi:tray:is-collapsed', false)
const setCollapsedRpc = useElectronEventaInvoke(electronTrayPopoverSetCollapsed)

async function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
  try {
    await setCollapsedRpc({ collapsed: isCollapsed.value })
  }
  catch (err) {
    console.error('[Tray] setCollapsedRpc failed (ensure main process was restarted):', err)
  }
}

const isPinned = ref(false)
const togglePinRpc = useElectronEventaInvoke(electronTrayPopoverTogglePin)
const getPinStateRpc = useElectronEventaInvoke(electronTrayPopoverGetPinState)
const closeRpc = useElectronEventaInvoke(electronTrayPopoverClose)
const openSettingsRpc = useElectronEventaInvoke(electronOpenSettings)

function handleOpenSettings() {
  void openSettingsRpc()
}

// Active character & workspace switcher
const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)
const isWorkspaceOpen = ref(false)

const effectiveCardId = computed(() => {
  return airiCardStore.resolveCardId(activeCardId.value)
})

const effectiveDisplayModelId = computed(() => {
  return airiCardStore.getCardDisplayModelId(effectiveCardId.value)
})

const activeCharacterName = computed(() => {
  const card = airiCardStore.cards.get(effectiveCardId.value) || activeCard.value
  return card?.name || effectiveCardId.value || 'Character'
})

// Avatar display mode: Static | Gaze (Beam) | Stage (WebGL)
type TrayAvatarMode = 'static' | 'gaze' | 'stage'
const avatarMode = useLocalStorage<TrayAvatarMode>('airi:tray:avatar-mode', 'static')
const isAvatarModeOpen = ref(false)
const stageState = ref<'pending' | 'loading' | 'mounted'>('pending')

const settingsStore = useSettings()
const { stageModelRenderer } = storeToRefs(settingsStore)

const AVATAR_MODE_OPTIONS: Array<{ id: TrayAvatarMode, label: string, icon: string }> = [
  { id: 'static', label: 'Static', icon: 'i-solar:gallery-bold' },
  { id: 'gaze', label: 'Gaze', icon: 'i-solar:eye-bold' },
  { id: 'stage', label: 'Stage', icon: 'i-solar:layers-bold' },
]

const activeAvatarModeOption = computed(() => {
  return AVATAR_MODE_OPTIONS.find(opt => opt.id === avatarMode.value) ?? AVATAR_MODE_OPTIONS[0]
})

// Never boot a tiny WebGL stage in collapsed mode; fall back to Static when Stage is selected
const effectiveCollapsedAvatarMode = computed<'static' | 'gaze'>(() => {
  return avatarMode.value === 'gaze' ? 'gaze' : 'static'
})

const canRenderStage = computed(() => {
  return !isCollapsed.value && avatarMode.value === 'stage' && stageModelRenderer.value !== 'disabled'
})

watch(canRenderStage, (enabled) => {
  if (!enabled)
    stageState.value = 'pending'
})

const stageHeadFraming = computed(() => {
  switch (stageModelRenderer.value) {
    case 'vrm':
      return { xOffset: 0, yOffset: -18, scale: 0.7 }
    case 'live2d':
      return { xOffset: 0, yOffset: 56, scale: 2.8 }
    default:
      return { xOffset: 0, yOffset: 0, scale: 1.8 }
  }
})

function selectAvatarMode(mode: TrayAvatarMode) {
  avatarMode.value = mode
  isAvatarModeOpen.value = false
}

// Global cursor tracking relative to the tray window
const prefersReducedMotion = usePreferredReducedMotion()
const { x: cursorX, y: cursorY } = useElectronRelativeMouse({ initialValue: { x: 52, y: 52 } })

const normalizedGaze = computed(() => {
  if (prefersReducedMotion.value === 'reduce') {
    return { x: 0, y: 0 }
  }
  const centerX = isCollapsed.value ? 28 : 52
  const centerY = isCollapsed.value ? 24 : 52
  const range = 360
  return {
    x: Math.max(-1, Math.min(1, (cursorX.value - centerX) / range)),
    y: Math.max(-1, Math.min(1, (cursorY.value - centerY) / range)),
  }
})

// Accent palette picker (shared with SettingsThemeHeaderWidget)
const settingsTheme = useSettingsTheme()
const colorSpectrumRows = [
  [
    { name: 'Crimson', color: '#E11D48' },
    { name: 'Coral', color: '#F43F5E' },
    { name: 'Tangerine', color: '#EA580C' },
    { name: 'Marigold', color: '#F59E0B' },
    { name: 'Amber', color: '#EAB308' },
    { name: 'Lemon', color: '#84CC16' },
  ],
  [
    { name: 'Lime', color: '#65A30D' },
    { name: 'Emerald', color: '#16A34A' },
    { name: 'Mint', color: '#10B981' },
    { name: 'Jade', color: '#059669' },
    { name: 'Viridian', color: '#0D9488' },
    { name: 'Teal', color: '#0891B2' },
  ],
  [
    { name: 'Turquoise', color: '#06B6D4' },
    { name: 'Cyan', color: undefined },
    { name: 'Cerulean', color: '#2563EB' },
    { name: 'Cobalt', color: '#3B82F6' },
    { name: 'Sapphire', color: '#4F46E5' },
    { name: 'Denim', color: '#6366F1' },
  ],
  [
    { name: 'Indigo', color: '#7C3AED' },
    { name: 'Amethyst', color: '#9333EA' },
    { name: 'Violet', color: '#A855F7' },
    { name: 'Fuchsia', color: '#C026D3' },
    { name: 'Magenta', color: '#DB2777' },
    { name: 'Rose', color: '#E11D74' },
  ],
]

// Voice output master mute
const chatOrchestrator = useChatOrchestratorStore()
const chatSession = useChatSessionStore()
const isVoiceMuted = useLocalStorage('airi:audio:voice-muted', false)

function toggleVoiceMute() {
  isVoiceMuted.value = !isVoiceMuted.value
  if (isVoiceMuted.value) {
    void chatOrchestrator.stopCurrentGeneration(chatSession.activeSessionId)
  }
}

// Theme toggle
const isDark = useDark({ disableTransition: false })
const toggleDark = useToggle(isDark)

onMounted(async () => {
  try {
    isPinned.value = await getPinStateRpc()
  }
  catch {
    // Fallback if running standalone outside electron context
  }
  if (isCollapsed.value) {
    void setCollapsedRpc({ collapsed: true }).catch((err: unknown) => {
      console.warn('[Tray] Initial setCollapsedRpc failed (ensure main process was restarted):', err)
    })
  }
})

async function handleTogglePin() {
  try {
    isPinned.value = await togglePinRpc(!isPinned.value)
  }
  catch {
    isPinned.value = !isPinned.value
  }
}

const activeTabComponent = computed(() => {
  switch (activeTab.value) {
    case 'chat':
      return ChatTab
    case 'status':
      return StatusTab
    case 'controls':
    default:
      return ControlsTab
  }
})

// Companion subtitle
const companionSubtitle = computed(() => {
  return 'Ready to chat with you!'
})
</script>

<template>
  <div
    :class="[
      'w-full h-full p-2 select-none',
      'flex flex-col relative bg-transparent',
    ]"
  >
    <!-- Speech-Bubble Pointer / Caret Notch (points up to the tray icon) -->
    <div
      :class="[
        'w-3.5 h-3.5 rotate-45 mx-auto -mb-2 z-20',
        'bg-white dark:bg-neutral-900',
        'border-t border-l border-neutral-200/90 dark:border-neutral-800/90 shadow-sm',
      ]"
    />

    <!-- Main Card Body Container -->
    <div
      :class="[
        'flex-1 flex flex-col overflow-hidden',
        'bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl',
        'border border-neutral-200/90 dark:border-neutral-800/90',
        'rounded-2xl shadow-xl z-10',
      ]"
    >
      <!-- 1. COMPANION HEADER (Expanded: avatar + identity + controls; Collapsed: compact bar) -->
      <div
        :class="[
          'flex justify-between gap-2 flex-shrink-0',
          isCollapsed
            ? 'px-3.5 py-1.5 min-h-[35px] items-center'
            : 'px-3.5 pt-2.5 pb-1.5 items-start',
        ]"
      >
        <!-- Left: Expanded Identity -->
        <div v-if="!isCollapsed" class="min-w-0 flex items-center gap-2.5 pt-0.5">
          <div
            :class="[
              'relative w-18 h-18 overflow-hidden flex-shrink-0',
              'border-2 border-primary-500/70 shadow-sm',
              'bg-neutral-100 dark:bg-neutral-800',
              avatarMode === 'stage' ? 'rounded-xl' : 'rounded-full',
            ]"
          >
            <!-- Static mode OR Stage backdrop while WebGL initializes / disabled -->
            <CharacterAvatar
              v-if="avatarMode === 'static' || (avatarMode === 'stage' && (!canRenderStage || stageState !== 'mounted'))"
              :card-id="effectiveCardId"
              :name="activeCharacterName"
              :display-model-id="effectiveDisplayModelId"
              :shape="avatarMode === 'stage' ? 'square' : 'circle'"
              size-class="h-full w-full"
            />

            <!-- Gaze (Beam) mode -->
            <BeamAvatar
              v-else-if="avatarMode === 'gaze'"
              :name="activeCharacterName"
              :gaze-x="normalizedGaze.x"
              :gaze-y="normalizedGaze.y"
            />

            <!-- Live WebGL Stage mode -->
            <RendererStage
              v-if="canRenderStage"
              v-model:state="stageState"
              :focus-at="{ x: cursorX, y: cursorY }"
              :show-background="false"
              :radial-menu-enabled="false"
              :draggable="false"
              :x-offset="stageHeadFraming.xOffset"
              :y-offset="stageHeadFraming.yOffset"
              :scale="stageHeadFraming.scale"
              class="absolute inset-0 h-full w-full"
            />
          </div>

          <div class="min-w-0 flex-1">
            <ChatWorkspacePopover
              v-model:open="isWorkspaceOpen"
              :character-id="effectiveCardId"
            >
              <template #trigger>
                <button
                  type="button"
                  title="Switch Character / Session"
                  :class="[
                    'flex items-center gap-1.5 cursor-pointer select-none text-left rounded-lg p-0.5 -ml-1 transition max-w-full',
                    'hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80',
                  ]"
                >
                  <span class="truncate text-base text-primary-600 font-bold tracking-tight dark:text-primary-400">
                    {{ activeCharacterName }}
                  </span>
                  <div
                    :class="[
                      'p-0.5 px-1 rounded-md transition flex items-center justify-center flex-shrink-0',
                      'bg-neutral-100/90 hover:bg-neutral-200/80 dark:bg-neutral-800/90 dark:hover:bg-neutral-700/80',
                      'border border-neutral-200/70 dark:border-neutral-700/70 shadow-xs',
                      'text-neutral-500 dark:text-neutral-400',
                    ]"
                  >
                    <div class="i-solar:alt-arrow-down-linear text-xs" />
                  </div>
                </button>
              </template>
            </ChatWorkspacePopover>
            <div class="mt-0.5 text-xs text-neutral-500 leading-tight italic dark:text-neutral-400">
              {{ companionSubtitle }}
            </div>
          </div>
        </div>

        <!-- Left: Collapsed Compact Identity -->
        <div v-else class="min-w-0 flex flex-1 items-center">
          <ChatWorkspacePopover
            v-model:open="isWorkspaceOpen"
            :character-id="effectiveCardId"
          >
            <template #trigger>
              <button
                type="button"
                title="Switch Character / Session"
                :class="[
                  'flex items-center gap-2 cursor-pointer select-none text-left rounded-lg px-1 py-0.5 -ml-1 transition max-w-full',
                  'hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80',
                ]"
              >
                <div class="shadow-xs relative h-6 w-6 flex-shrink-0 overflow-hidden border border-primary-500/70 rounded-full">
                  <BeamAvatar
                    v-if="effectiveCollapsedAvatarMode === 'gaze'"
                    :name="activeCharacterName"
                    :gaze-x="normalizedGaze.x"
                    :gaze-y="normalizedGaze.y"
                  />
                  <CharacterAvatar
                    v-else
                    :card-id="effectiveCardId"
                    :name="activeCharacterName"
                    :display-model-id="effectiveDisplayModelId"
                    size-class="h-full w-full"
                  />
                </div>
                <span class="truncate text-xs text-primary-600 font-bold tracking-tight dark:text-primary-400">
                  {{ activeCharacterName }}
                </span>
                <div class="i-solar:alt-arrow-down-linear flex-shrink-0 text-[10px] text-neutral-400" />
              </button>
            </template>
          </ChatWorkspacePopover>
        </div>

        <!-- Right: Top-Right Window Controls + Rapid Action Pills (when expanded) -->
        <div class="flex flex-shrink-0 flex-col items-end gap-1.5">
          <!-- Top-Right: [Collapse Chevron] [Pin] [Settings] [Close] -->
          <div class="flex items-center gap-1 -mr-1">
            <!-- Chevron collapse/expand button -->
            <button
              type="button"
              :title="isCollapsed ? 'Expand Header' : 'Collapse Header'"
              :class="[
                'p-1 rounded-md transition cursor-pointer',
                isCollapsed
                  ? 'text-primary-500 bg-primary-50 dark:bg-primary-950/60'
                  : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200',
              ]"
              @click="toggleCollapse"
            >
              <div :class="[isCollapsed ? 'i-solar:alt-arrow-down-linear' : 'i-solar:alt-arrow-up-linear', 'text-xs']" />
            </button>

            <!-- Pin button -->
            <button
              type="button"
              title="Pin window"
              :class="[
                'p-1 rounded-md transition cursor-pointer',
                isPinned
                  ? 'text-primary-500 bg-primary-50 dark:bg-primary-950/60'
                  : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200',
              ]"
              @click="handleTogglePin"
            >
              <div class="i-solar:pin-bold text-xs" />
            </button>

            <!-- Settings (Cog) button -->
            <button
              type="button"
              title="Settings"
              class="cursor-pointer rounded-md p-1 text-neutral-400 transition hover:text-neutral-700 dark:hover:text-neutral-200"
              @click="handleOpenSettings"
            >
              <div class="i-solar:settings-linear text-xs" />
            </button>

            <!-- Close button -->
            <button
              type="button"
              title="Close"
              class="cursor-pointer rounded-md p-1 text-neutral-400 transition hover:text-neutral-700 dark:hover:text-neutral-200"
              @click="() => closeRpc()"
            >
              <div class="i-solar:close-square-linear text-xs" />
            </button>
          </div>

          <!-- Rapid Actions Row: Avatar Mode Selector + Voice/Theme Capsule (Expanded only) -->
          <div v-show="!isCollapsed" class="flex flex-shrink-0 items-center gap-1.5">
            <!-- Avatar Mode Selector Popover -->
            <PopoverRoot v-model:open="isAvatarModeOpen">
              <PopoverTrigger as-child>
                <button
                  type="button"
                  :title="`Avatar Mode: ${activeAvatarModeOption.label}`"
                  :class="[
                    'w-7 h-7 flex items-center justify-center rounded-full transition cursor-pointer',
                    'bg-neutral-100/80 dark:bg-neutral-800/80',
                    'border',
                    isAvatarModeOpen
                      ? 'border-primary-500/70 text-primary-600 dark:text-primary-400 bg-primary-50/70 dark:bg-primary-950/50'
                      : 'border-neutral-200/60 dark:border-neutral-700/60 text-neutral-600 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400',
                  ]"
                >
                  <div :class="[activeAvatarModeOption.icon, 'text-xs']" />
                </button>
              </PopoverTrigger>
              <PopoverPortal>
                <PopoverContent
                  side="bottom"
                  align="end"
                  :side-offset="6"
                  :collision-padding="8"
                  :class="[
                    'z-[10000] w-32 p-1 rounded-xl',
                    'bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl',
                    'border border-neutral-200/80 dark:border-neutral-800/80 shadow-xl',
                    'flex flex-col gap-0.5',
                  ]"
                >
                  <button
                    v-for="option in AVATAR_MODE_OPTIONS"
                    :key="option.id"
                    type="button"
                    :class="[
                      'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer',
                      avatarMode === option.id
                        ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                    ]"
                    @click="selectAvatarMode(option.id)"
                  >
                    <span class="flex items-center gap-2">
                      <div :class="[option.icon, 'text-xs']" />
                      <span>{{ option.label }}</span>
                    </span>
                    <div
                      v-if="avatarMode === option.id"
                      class="i-solar:check-read-linear text-xs text-primary-500"
                    />
                  </button>
                </PopoverContent>
              </PopoverPortal>
            </PopoverRoot>

            <!-- Rapid Action Pills: Voice Mute | Theme -->
            <div
              :class="[
                'flex items-center gap-1 p-0.5 rounded-full flex-shrink-0',
                'bg-neutral-100/80 dark:bg-neutral-800/80',
                'border border-neutral-200/60 dark:border-neutral-700/60',
              ]"
            >
              <!-- Rapid Pill: Voice Mute -->
              <button
                type="button"
                :title="isVoiceMuted ? 'Unmute Voice' : 'Mute Voice'"
                :class="[
                  'p-1.5 rounded-full transition cursor-pointer',
                  !isVoiceMuted
                    ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400'
                    : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500 hover:text-neutral-600',
                ]"
                @click="toggleVoiceMute"
              >
                <div :class="[!isVoiceMuted ? 'i-solar:volume-loud-bold' : 'i-solar:volume-cross-bold', 'text-xs']" />
              </button>

              <!-- Rapid Pill: Theme Toggle (Moon / Sun) -->
              <button
                type="button"
                :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
                :class="[
                  'p-1.5 rounded-full transition cursor-pointer',
                  isDark
                    ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400'
                    : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500 hover:text-neutral-600',
                ]"
                @click="toggleDark()"
              >
                <div :class="[isDark ? 'i-solar:moon-bold' : 'i-solar:sun-2-bold', 'text-xs']" />
              </button>

              <!-- Rapid Pill: Accent Palette Picker -->
              <PopoverRoot>
                <PopoverTrigger as-child>
                  <button
                    type="button"
                    title="Accent Palette"
                    class="group flex cursor-pointer items-center justify-center rounded-full p-1 transition hover:bg-neutral-200/70 dark:hover:bg-neutral-700/70"
                  >
                    <div class="shadow-xs h-3.5 w-3.5 rounded-full bg-primary-500 ring-1 ring-black/15 transition-transform group-hover:scale-110 dark:ring-white/25" />
                  </button>
                </PopoverTrigger>
                <PopoverPortal>
                  <PopoverContent
                    side="bottom"
                    align="end"
                    :side-offset="8"
                    :collision-padding="10"
                    :class="[
                      'z-[10050] max-w-[260px] w-auto p-3 rounded-2xl',
                      'bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl shadow-2xl',
                      'border border-neutral-200/90 dark:border-neutral-800/90',
                    ]"
                  >
                    <div class="mb-2.5 flex items-center justify-between border-b border-neutral-100 pb-2 dark:border-neutral-800">
                      <div class="flex items-center gap-1.5">
                        <div class="i-solar:palette-round-bold-duotone text-xs text-primary-500" />
                        <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                          Accent Palette
                        </span>
                      </div>
                      <button
                        type="button"
                        :class="[
                          'flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer',
                          'border border-amber-500/40 text-amber-600 dark:border-amber-400/40 dark:text-amber-400',
                          'hover:bg-amber-500/10 active:scale-95',
                        ]"
                        @click="settingsTheme.setThemeColorsHue()"
                      >
                        <div class="i-solar:restart-linear text-[10px]" />
                        <span>Reset</span>
                      </button>
                    </div>

                    <div class="flex flex-col gap-1.5">
                      <div
                        v-for="(row, rowIdx) in colorSpectrumRows"
                        :key="rowIdx"
                        class="grid grid-cols-6 gap-1.5"
                      >
                        <button
                          v-for="swatch in row"
                          :key="swatch.name"
                          type="button"
                          :title="swatch.name"
                          :class="[
                            'relative h-6 w-6 rounded-md transition-all duration-150 cursor-pointer',
                            'hover:scale-115 hover:z-10 hover:shadow-md focus:outline-none',
                            settingsTheme.isColorSelectedForPrimary(swatch.color)
                              ? 'ring-2 ring-primary-500 ring-offset-1 dark:ring-offset-neutral-900 scale-105 z-5 shadow-xs'
                              : 'ring-1 ring-black/10 dark:ring-white/10',
                          ]"
                          :style="{
                            backgroundColor: swatch.color || 'oklch(65% 0.18 220.44)',
                          }"
                          @click="settingsTheme.applyPrimaryColorFrom(swatch.color)"
                        >
                          <div
                            v-if="settingsTheme.isColorSelectedForPrimary(swatch.color)"
                            class="shadow-xs absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-white"
                          />
                        </button>
                      </div>
                    </div>
                  </PopoverContent>
                </PopoverPortal>
              </PopoverRoot>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. SEGMENTED TAB SWITCHER (~38px, Expanded only) -->
      <div
        v-show="!isCollapsed"
        :class="[
          'px-2 pb-1.5 flex-shrink-0',
          'bg-neutral-50/50 dark:bg-neutral-950/30',
        ]"
      >
        <div
          :class="[
            'grid grid-cols-3 gap-1 p-1 rounded-xl',
            'bg-neutral-100 dark:bg-neutral-800/80',
            'text-sm font-semibold',
          ]"
        >
          <button
            type="button"
            :class="[
              'py-1 rounded-lg transition flex items-center justify-center gap-1.5',
              activeTab === 'chat'
                ? 'bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200',
            ]"
            @click="activeTab = 'chat'"
          >
            <div class="i-solar:chat-round-line-bold text-xs" />
            Chat
          </button>

          <button
            type="button"
            :class="[
              'py-1 rounded-lg transition flex items-center justify-center gap-1.5',
              activeTab === 'controls'
                ? 'bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200',
            ]"
            @click="activeTab = 'controls'"
          >
            <div class="i-solar:widget-2-bold text-xs" />
            Controls
          </button>

          <button
            type="button"
            :class="[
              'py-1 rounded-lg transition flex items-center justify-center gap-1.5',
              activeTab === 'status'
                ? 'bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200',
            ]"
            @click="activeTab = 'status'"
          >
            <div class="i-solar:chart-square-bold text-xs" />
            Status
          </button>
        </div>
      </div>

      <!-- 3. TAB CONTENT BODY (Scrollable with KeepAlive) -->
      <div class="flex-1 overflow-y-auto p-0.5">
        <KeepAlive>
          <component :is="activeTabComponent" />
        </KeepAlive>
      </div>
    </div>
  </div>
</template>
