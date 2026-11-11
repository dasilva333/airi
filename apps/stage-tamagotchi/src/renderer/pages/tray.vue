<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { useLocalStorage } from '@vueuse/core'
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'

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
const micActive = ref(true)
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

// Dynamic vitality status subtitle based on tab or active engine state
const vitalityStatus = computed(() => {
  if (sleepActive.value) {
    return {
      dotClass: 'bg-neutral-400',
      title: 'Sleeping • Engine Idle',
      desc: '3D/2D animation loops paused to free VRAM.',
    }
  }
  if (activeTab.value === 'chat') {
    return {
      dotClass: 'bg-primary-500 animate-pulse',
      title: 'Listening • Curious ♡',
      desc: 'Ready to chat with you!',
    }
  }
  if (activeTab.value === 'status') {
    return {
      dotClass: 'bg-cyan-400',
      title: 'Thinking • Telemetry Active',
      desc: 'Gemini 2.5 Pro • 420ms ping',
    }
  }
  return {
    dotClass: 'bg-primary-500',
    title: 'Idle • Comfy ♡',
    desc: 'Stage is ready.',
  }
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
      <!-- 1. PERSISTENT COMPANION HEADER (~72px) -->
      <div
        :class="[
          'px-3.5 py-2.5',
          'border-b border-neutral-200/70 dark:border-neutral-800/70',
          'flex items-center justify-between',
        ]"
      >
        <!-- Character Avatar & Status -->
        <div class="flex items-center gap-2.5">
          <div
            :class="[
              'relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0',
              'bg-gradient-to-tr from-primary-500 to-primary-400 p-[1.5px] shadow-sm',
            ]"
          >
            <div
              :class="[
                'w-full h-full rounded-full bg-white dark:bg-neutral-950',
                'flex items-center justify-center text-primary-600 dark:text-primary-400',
              ]"
            >
              <div class="i-solar:ghost-bold text-2xl" />
            </div>
            <span
              :class="[
                'absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2',
                'border-white dark:border-neutral-900',
                vitalityStatus.dotClass,
              ]"
            />
          </div>

          <div>
            <div class="flex items-center gap-1">
              <span class="text-sm text-neutral-900 font-bold tracking-tight dark:text-neutral-100">
                AIRI
              </span>
              <div class="i-solar:alt-arrow-down-linear cursor-pointer text-xs text-neutral-400" />
            </div>
            <div class="flex items-center gap-1 text-[11px] text-primary-600 font-semibold dark:text-primary-400">
              <span>{{ vitalityStatus.title }}</span>
            </div>
            <div class="text-[9px] text-neutral-400 leading-tight dark:text-neutral-500">
              {{ vitalityStatus.desc }}
            </div>
          </div>
        </div>

        <!-- 4 Header Pills + Pin + Settings -->
        <div class="flex items-center gap-1">
          <!-- Rapid Pill 1: Mic -->
          <button
            type="button"
            title="Toggle Mic"
            :class="[
              'p-1.5 rounded-full transition',
              micActive
                ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400'
                : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500',
            ]"
            @click="micActive = !micActive"
          >
            <div class="i-solar:microphone-3-bold text-xs" />
          </button>

          <!-- Rapid Pill 2: Voice -->
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

          <!-- Rapid Pill 3: Vision -->
          <button
            type="button"
            title="Toggle Vision"
            :class="[
              'p-1.5 rounded-full transition',
              visionActive
                ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400'
                : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500',
            ]"
            @click="visionActive = !visionActive"
          >
            <div class="i-solar:eye-bold text-xs" />
          </button>

          <!-- Rapid Pill 4: Sleep -->
          <button
            type="button"
            title="Toggle Sleep Mode"
            :class="[
              'p-1.5 rounded-full transition',
              sleepActive
                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'
                : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500',
            ]"
            @click="sleepActive = !sleepActive"
          >
            <div class="i-solar:moon-bold text-xs" />
          </button>

          <div class="mx-0.5 h-3.5 w-px bg-neutral-200 dark:bg-neutral-800" />

          <!-- Pin button -->
          <button
            type="button"
            title="Pin window"
            :class="[
              'p-1.5 rounded-lg transition',
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
              'p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200',
              'transition',
            ]"
            @click="() => closeRpc()"
          >
            <div class="i-solar:close-square-linear text-xs" />
          </button>
        </div>
      </div>

      <!-- 2. SEGMENTED TAB SWITCHER (~38px) -->
      <div
        :class="[
          'px-3 py-1.5 border-b border-neutral-200/60 dark:border-neutral-800/60',
          'bg-neutral-50/50 dark:bg-neutral-950/30',
        ]"
      >
        <div
          :class="[
            'grid grid-cols-3 gap-1 p-1 rounded-xl',
            'bg-neutral-100 dark:bg-neutral-800/80',
            'text-xs font-semibold',
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
