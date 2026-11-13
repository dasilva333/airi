<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { ChatWorkspacePopover } from '@proj-airi/stage-layouts'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useDark, useLocalStorage, useToggle } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'

import stickerAvatar from '../assets/relu-sticker-wow.avif'

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

const activeCharacterName = computed(() => {
  const card = airiCardStore.cards.get(activeCardId.value) || activeCard.value
  return card?.name || activeCardId.value || 'Character'
})

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
      <!-- Top Utility Bar (Always Visible, ~35px) -->
      <div
        :class="[
          'px-3.5 py-1.5 min-h-[35px]',
          'flex items-center justify-between',
        ]"
      >
        <!-- Left: blank for now as requested -->
        <div />

        <!-- Right Button Cluster: [Collapse Chevron] [Pin] [Settings] [Close] -->
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
      </div>

      <!-- Collapsible Section: Identity Header & Tab Switcher -->
      <div v-show="!isCollapsed" class="flex flex-shrink-0 flex-col">
        <!-- 1. COMPANION IDENTITY & RAPID ACTION PILLS -->
        <div
          :class="[
            'px-3.5 pb-2.5',
            'border-neutral-200/70 dark:border-neutral-800/70',
            'flex items-center justify-between gap-2',
          ]"
        >
          <!-- Character Avatar & Identity -->
          <div class="min-w-0 flex items-center gap-2.5">
            <div
              :class="[
                'relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0',
                'border-2 border-primary-500/70 shadow-sm',
                'bg-neutral-100 dark:bg-neutral-800',
              ]"
            >
              <img
                :src="stickerAvatar"
                alt="AIRI"
                class="h-full w-full object-cover object-center"
              >
            </div>

            <div class="min-w-0 flex-1">
              <ChatWorkspacePopover
                v-model:open="isWorkspaceOpen"
                :character-id="activeCardId"
              >
                <template #trigger>
                  <button
                    type="button"
                    title="Switch Character / Session"
                    :class="[
                      'flex items-center gap-1.5 cursor-pointer select-none text-left rounded-lg p-0.5 -ml-1 transition',
                      'hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80',
                    ]"
                  >
                    <span class="text-base text-primary-600 font-bold tracking-tight dark:text-primary-400">
                      {{ activeCharacterName }}
                    </span>
                    <div
                      :class="[
                        'p-0.5 px-1 rounded-md transition flex items-center justify-center',
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
          </div>
        </div>

        <!-- 2. SEGMENTED TAB SWITCHER (~38px) -->
        <div
          :class="[
            'px-2 pb-1.5',
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
