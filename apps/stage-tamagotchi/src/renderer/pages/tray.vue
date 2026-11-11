<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { useLocalStorage } from '@vueuse/core'
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'

import stickerAvatar from '../assets/relu-sticker-wow.avif'

import {
  electronTrayPopoverClose,
  electronTrayPopoverGetPinState,
  electronTrayPopoverTogglePin,
} from '../../shared/eventa'

// Asynchronous component loading for minimal initial memory footprint
const ChatTab = defineAsyncComponent(() => import('../components/tray/ChatTab.vue'))
const ControlsTab = defineAsyncComponent(() => import('../components/tray/ControlsTab.vue'))
const StatusTab = defineAsyncComponent(() => import('../components/tray/StatusTab.vue'))

// Tab state persistence: remembers the last opened tab
const activeTab = useLocalStorage<'chat' | 'controls' | 'status'>('airi:tray:active-tab', 'controls')

const isPinned = ref(false)
const togglePinRpc = useElectronEventaInvoke(electronTrayPopoverTogglePin)
const getPinStateRpc = useElectronEventaInvoke(electronTrayPopoverGetPinState)
const closeRpc = useElectronEventaInvoke(electronTrayPopoverClose)

onMounted(async () => {
  try {
    isPinned.value = await getPinStateRpc()
  }
  catch {
    // Fallback if running standalone outside electron context
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

// Rapid header pills state
const voiceActive = ref(true)
const visionActive = ref(true)
const sleepActive = ref(false)

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
  if (sleepActive.value)
    return 'Sleeping • Engine Idle'
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
      <!-- 1. PERSISTENT COMPANION HEADER -->
      <div
        :class="[
          'px-3.5 pt-2.5 pb-1',
          'border-neutral-200/70 dark:border-neutral-800/70',
          'flex items-start justify-between gap-2',
        ]"
      >
        <!-- Character Avatar & Identity -->
        <div class="min-w-0 flex items-center gap-2.5 pt-0.5">
          <div
            :class="[
              'relative w-18 h-18 rounded-full overflow-hidden flex-shrink-0',
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
            <div class="flex items-center gap-1.5">
              <span class="text-base text-primary-600 font-bold tracking-tight dark:text-primary-400">
                AIRI
              </span>
              <button
                type="button"
                title="Switch Character / Session"
                :class="[
                  'p-0.5 px-1 rounded-md transition flex items-center justify-center',
                  'bg-neutral-100/90 hover:bg-neutral-200/80 dark:bg-neutral-800/90 dark:hover:bg-neutral-700/80',
                  'border border-neutral-200/70 dark:border-neutral-700/70 shadow-xs',
                  'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200',
                ]"
              >
                <div class="i-solar:alt-arrow-down-linear text-xs" />
              </button>
            </div>
            <div class="mt-0.5 text-xs text-neutral-500 leading-tight italic dark:text-neutral-400">
              {{ companionSubtitle }}
            </div>
          </div>
        </div>

        <!-- Right: Pin/Close in top-right corner + Status Toggles Capsule below -->
        <div class="flex flex-shrink-0 flex-col items-end gap-1.5">
          <!-- Top-Right: Pin | Close sitting right on the top-right corner -->
          <div class="flex items-center gap-1 -mr-1">
            <!-- Pin button -->
            <button
              type="button"
              title="Pin window"
              :class="[
                'p-1 rounded-md transition',
                isPinned
                  ? 'text-primary-500 bg-primary-50 dark:bg-primary-950/60'
                  : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200',
              ]"
              @click="handleTogglePin"
            >
              <div class="i-solar:pin-bold text-xs" />
            </button>

            <!-- Close button -->
            <button
              type="button"
              title="Close"
              :class="[
                'p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition',
              ]"
              @click="() => closeRpc()"
            >
              <div class="i-solar:close-square-linear text-xs" />
            </button>
          </div>

          <!-- Rapid Action Pills: Voice | Vision | Sleep -->
          <div
            :class="[
              'flex items-center gap-1 p-0.5 rounded-full',
              'bg-neutral-100/80 dark:bg-neutral-800/80',
              'border border-neutral-200/60 dark:border-neutral-700/60',
            ]"
          >
            <!-- Rapid Pill: Voice -->
            <button
              type="button"
              title="Toggle Voice"
              :class="[
                'p-1.5 rounded-full transition',
                voiceActive
                  ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400'
                  : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500',
              ]"
              @click="voiceActive = !voiceActive"
            >
              <div class="i-solar:volume-loud-bold text-xs" />
            </button>

            <!-- Rapid Pill: Vision -->
            <button
              type="button"
              title="Toggle Vision"
              :class="[
                'p-1.5 rounded-full transition',
                visionActive
                  ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400'
                  : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500',
              ]"
              @click="visionActive = !visionActive"
            >
              <div class="i-solar:eye-bold text-xs" />
            </button>

            <!-- Rapid Pill: Sleep -->
            <button
              type="button"
              title="Toggle Sleep Mode"
              :class="[
                'p-1.5 rounded-full transition',
                sleepActive
                  ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400'
                  : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500',
              ]"
              @click="sleepActive = !sleepActive"
            >
              <div class="i-solar:moon-bold text-xs" />
            </button>
          </div>
        </div>
      </div>

      <!-- 2. SEGMENTED TAB SWITCHER (~38px) -->
      <div
        :class="[
          'px-2 py-1.5',
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
      <div class="flex-1 overflow-y-auto p-3">
        <KeepAlive>
          <component :is="activeTabComponent" />
        </KeepAlive>
      </div>
    </div>
  </div>
</template>
