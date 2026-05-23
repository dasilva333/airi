<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { CUSTOMIZER_CATALOG } from '@proj-airi/stage-ui/constants/control-customizer'
import { useLiveSessionStore } from '@proj-airi/stage-ui/stores/modules/live-session'
import { useSettings, useSettingsAudioDevice, useSettingsControlStrip } from '@proj-airi/stage-ui/stores/settings'
import { useSettingsControlsIsland } from '@proj-airi/stage-ui/stores/settings/controls-island'
import { useBroadcastChannel, useColorMode } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { electronCustomizerToggleVisibility, electronResetWindowPositions } from '../../shared/eventa'

const settingsStore = useSettings()
const controlStripStore = useSettingsControlStrip()
const settingsAudioDeviceStore = useSettingsAudioDevice()
const liveSessionStore = useLiveSessionStore()
const controlsIslandStore = useSettingsControlsIsland()

const { buttons, backgroundTint } = storeToRefs(controlStripStore)
const { powerState } = storeToRefs(liveSessionStore)
const { alwaysOnTop, fadeOnHoverEnabled } = storeToRefs(controlsIslandStore)

const activeButtons = computed(() => {
  return buttons.value.filter(btn => btn.enabled)
})

const colorPresets = [
  { name: 'Slate', value: '#171717' },
  { name: 'Sapphire', value: '#0f172a' },
  { name: 'Crimson', value: '#311010' },
  { name: 'Forest', value: '#062c16' },
  { name: 'Amethyst', value: '#1e1b4b' },
]

const DEFAULT_ORDER = [
  'layout',
  'chat',
  'stage',
  'mic',
  'caption',
  'gemini-session',
  'settings',
  'gemini-witness',
  'gemini-frequency',
  'gemini-tts',
  'gemini-voice',
  'gemini-schedule',
  'gemini-grounding',

  'always-on-top',
  'viewport-tactile',
  'viewport-drag',
  'viewport-positioning',
  'viewport-orbit',
  'viewport-cycle-modes',
  'viewport-reset-coordinates',
  'viewport-auto-hide',

  'exit-app',

  'caption-docking',
  'caption-follow-stage',
  'caption-layout-mode',

  'actor-characters',
  'actor-wardrobe',
  'actor-expressions',
  'actor-idle-animations',
  'actor-motions',
  'actor-all-emotions',

  'gemini-manual-capture',
]

const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(index: number, event: DragEvent) {
  dragIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.dropEffect = 'move'
    event.dataTransfer.setData('text/plain', index.toString())
  }
}

function onDragOver(index: number, event: DragEvent) {
  event.preventDefault()
  if (dragIndex.value === null)
    return
  dragOverIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function onDragLeave(index: number) {
  if (dragOverIndex.value === index) {
    dragOverIndex.value = null
  }
}

function onDrop(index: number, event: DragEvent) {
  event.preventDefault()
  if (dragIndex.value !== null && dragIndex.value !== index) {
    const activeList = [...activeButtons.value]
    const draggedItem = activeList[dragIndex.value]
    activeList.splice(dragIndex.value, 1)
    activeList.splice(index, 0, draggedItem)

    const disabledList = buttons.value.filter(btn => !btn.enabled)
    buttons.value = [...activeList, ...disabledList]
  }
  dragIndex.value = null
  dragOverIndex.value = null
}

function onDragEnd() {
  dragIndex.value = null
  dragOverIndex.value = null
}

function resetOrderOnly() {
  const orderMap = new Map(DEFAULT_ORDER.map((id, index) => [id, index]))
  const sorted = [...buttons.value].sort((a, b) => {
    const aIndex = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999
    const bIndex = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999
    return aIndex - bIndex
  })
  buttons.value = sorted
}

function disableButton(id: string) {
  buttons.value = buttons.value.map(b => b.id === id ? { ...b, enabled: false } : b)
}

const toggleCustomizerVisibility = useElectronEventaInvoke(electronCustomizerToggleVisibility)
const resetWindowPositions = useElectronEventaInvoke(electronResetWindowPositions)
const { post: postControlStripAction } = useBroadcastChannel<string, string>({ name: 'airi-control-strip-actions' })
const colorMode = useColorMode()

function getButtonIcon(btnId: string, defaultIcon: string): string {
  if (btnId === 'theme-mode') {
    return colorMode.value === 'light' ? 'i-solar:moon-linear' : 'i-solar:sun-linear'
  }
  if (btnId === 'caption-docking') {
    return settingsStore.captionDocking === 'top' ? 'i-solar:align-top-line-duotone' : 'i-solar:align-bottom-line-duotone'
  }
  if (btnId === 'caption-layout-mode') {
    return settingsStore.captionLayoutMode === 'multi' ? 'i-solar:layers-linear' : 'i-solar:window-frame-linear'
  }
  return defaultIcon
}

const modelSelected = computed(() => settingsStore.stageModelSelected || 'default')

// Navigation state
const activeGroupId = ref('stage-view')

const activeGroup = computed(() => {
  return CUSTOMIZER_CATALOG.find(g => g.id === activeGroupId.value) || CUSTOMIZER_CATALOG[0]
})

// Bound state resolvers (for items with a catalog binding field)
function isBoundActive(binding: 'chatOpen' | 'stageEnabled' | 'micEnabled' | 'captionOpen' | 'geminiSession' | undefined): boolean {
  if (!binding)
    return false
  if (binding === 'chatOpen')
    return controlStripStore.chatOpen
  if (binding === 'stageEnabled')
    return controlStripStore.stageEnabled
  if (binding === 'captionOpen')
    return controlStripStore.captionOpen
  if (binding === 'micEnabled')
    return settingsAudioDeviceStore.enabled
  if (binding === 'geminiSession')
    return powerState.value !== 'off'
  return false
}

function toggleBoundState(binding: 'chatOpen' | 'stageEnabled' | 'micEnabled' | 'captionOpen' | 'geminiSession' | undefined) {
  if (!binding)
    return
  if (binding === 'chatOpen')
    postControlStripAction('chat')
  else if (binding === 'stageEnabled')
    postControlStripAction('stage')
  else if (binding === 'captionOpen')
    postControlStripAction('caption')
  else if (binding === 'micEnabled')
    postControlStripAction('mic')
  else if (binding === 'geminiSession')
    postControlStripAction('gemini-session')
}

// Un-bound toggle state resolvers (always-on-top, viewport-auto-hide, etc.)
// These catalog items have no binding field but still expose a live toggle state.
function isUnboundToggleActive(itemId: string): boolean {
  if (itemId === 'always-on-top')
    return alwaysOnTop.value
  if (itemId === 'viewport-auto-hide')
    return fadeOnHoverEnabled.value
  if (itemId === 'theme-mode')
    return colorMode.value === 'dark'
  if (itemId === 'caption-follow-stage')
    return settingsStore.captionFollowStage
  if (itemId === 'caption-docking')
    return settingsStore.captionDocking === 'bottom'
  if (itemId === 'caption-layout-mode')
    return settingsStore.captionLayoutMode === 'multi'
  return false
}

function toggleUnboundState(itemId: string) {
  // Dispatch the action event locally
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('control-strip:action', { detail: { action: itemId } }))
  }
  postControlStripAction(itemId)
}

function hasToggleButton(item: (typeof CUSTOMIZER_CATALOG)[0]['items'][0]): boolean {
  if (item.type !== 'toggle' && item.id !== 'caption-layout-mode')
    return false
  // Show toggle button for bound items and for known unbound toggles
  if (item.binding)
    return true
  return ['always-on-top', 'viewport-auto-hide', 'theme-mode', 'caption-follow-stage', 'caption-docking', 'caption-layout-mode'].includes(item.id)
}

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

// Control strip items inclusion getters
function isItemOnStrip(itemId: string): boolean {
  const btn = buttons.value.find(b => b.id === itemId)
  return btn ? btn.enabled : false
}

function toggleItemOnStrip(itemId: string) {
  if (itemId === 'layout')
    return
  const idx = buttons.value.findIndex(b => b.id === itemId)
  if (idx !== -1) {
    buttons.value = buttons.value.map((btn, i) =>
      i === idx ? { ...btn, enabled: !btn.enabled } : btn,
    )
  }
  else {
    const catalogItem = CUSTOMIZER_CATALOG.flatMap(g => g.items).find(i => i.id === itemId)
    if (catalogItem) {
      buttons.value = [...buttons.value, {
        id: catalogItem.id,
        enabled: true,
        label: catalogItem.label,
        icon: catalogItem.icon,
      }]
    }
  }
}

// Action triggers
function handleAction(actionId: string) {
  console.info(`[Control Customizer] Triggering action direct dispatch: "${actionId}"`)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('control-strip:action', { detail: { action: actionId } }))
  }
  postControlStripAction(actionId)
}

async function closeWindow() {
  await toggleCustomizerVisibility(false)
}

onMounted(() => {
  if (window.electron?.ipcRenderer) {
    const handleSetGroup = (_event: any, group: string) => {
      if (CUSTOMIZER_CATALOG.some(g => g.id === group)) {
        activeGroupId.value = group
      }
    }
    window.electron.ipcRenderer.on('set-customizer-group', handleSetGroup)
    onUnmounted(() => {
      window.electron.ipcRenderer.removeListener('set-customizer-group', handleSetGroup)
    })
  }
})
</script>

<template>
  <div class="h-screen w-screen flex flex-col select-none overflow-hidden bg-transparent p-3 font-sans">
    <!-- Premium Container with intense glassmorphism -->
    <div class="relative h-full w-full flex flex-col overflow-hidden border border-white/10 rounded-2xl bg-neutral-950/90 shadow-2xl backdrop-blur-2xl dark:border-neutral-800/80">
      <!-- Radial background glowing anomalies -->
      <div class="pointer-events-none absolute h-44 w-44 rounded-full bg-emerald-500/10 blur-3xl -left-16 -top-16" />
      <div class="pointer-events-none absolute h-44 w-44 rounded-full bg-sky-500/10 blur-3xl -bottom-16 -right-16" />

      <!-- Draggable Header -->
      <div class="[-webkit-app-region:drag] flex items-center justify-between border-b border-white/5 px-4 py-3.5">
        <div class="flex items-center gap-2.5">
          <div class="i-solar:widget-linear animate-pulse text-lg text-emerald-400" />
          <span class="text-xs text-neutral-100 font-bold tracking-widest uppercase">Control Customizer</span>
        </div>
        <!-- Action Buttons (non-draggable) -->
        <div class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
          <button
            class="pointer-events-auto cursor-pointer border border-neutral-700/50 rounded-lg bg-neutral-900/60 px-2.5 py-1 text-[10px] text-neutral-300 font-bold tracking-wide uppercase transition-all duration-200 active:scale-95 dark:border-neutral-800 hover:bg-white/10 hover:text-neutral-100"
            @click="resetWindowPositions"
          >
            Reset Positions
          </button>
          <button
            class="pointer-events-auto cursor-pointer rounded-lg p-1.5 text-neutral-400 transition-all duration-200 active:scale-95 hover:bg-white/10 hover:text-neutral-100 dark:hover:bg-neutral-800/60"
            @click="closeWindow"
          >
            <div class="i-solar:close-circle-outline text-lg" />
          </button>
        </div>
      </div>

      <!-- Option B: Main Workspace Splitter -->
      <div class="flex flex-1 overflow-hidden">
        <!-- Left Sidebar Navigation Menu -->
        <div class="scrollbar-hide w-[200px] flex flex-col gap-1.5 overflow-y-auto border-r border-white/5 bg-black/20 p-3">
          <button
            v-for="group in CUSTOMIZER_CATALOG"
            :key="group.id"
            :class="[
              activeGroupId === group.id
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:bg-white/5 hover:text-neutral-200',
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200 cursor-pointer text-xs',
            ]"
            @click="activeGroupId = group.id"
          >
            <div :class="[group.icon, 'text-base shrink-0']" />
            <span class="truncate">{{ group.name }}</span>
          </button>

          <!-- Divider & Preview Option -->
          <hr class="my-2 border-white/10">
          <button
            :class="[
              activeGroupId === 'preview'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:bg-white/5 hover:text-neutral-200',
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200 cursor-pointer text-xs',
            ]"
            @click="activeGroupId = 'preview'"
          >
            <div class="i-solar:eye-linear shrink-0 text-base" />
            <span class="truncate">Preview</span>
          </button>
        </div>

        <!-- Right Content Details Container -->
        <div class="scrollbar-hide flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <template v-if="activeGroupId === 'preview'">
            <!-- Preview Dashboard Layout (Two-Column Grid) -->
            <div class="space-y-4">
              <!-- Category Banner Header -->
              <div class="border-b border-white/5 pb-2.5 space-y-1">
                <h2 class="flex items-center gap-2 text-xs text-neutral-100 font-bold tracking-wide">
                  <div class="i-solar:eye-linear text-sm text-emerald-400" />
                  Preview
                </h2>
                <p class="text-[10px] text-neutral-400/80 leading-relaxed">
                  Live mockup and interactive tuning of the Control Strip buttons, custom sorting, and color tinting.
                </p>
              </div>

              <!-- Top Block: Control Strip Mock Preview (Spans 2 columns / full width here) -->
              <div class="relative min-h-[120px] flex flex-col items-center justify-center overflow-hidden border border-white/10 rounded-2xl bg-neutral-900/50 p-6 backdrop-blur-md">
                <!-- Background grid decoration -->
                <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:16px_16px]" />

                <!-- Interactive Strip Mockup -->
                <div
                  class="pointer-events-none h-14 flex flex-row items-center gap-2.5 border border-white/25 rounded-full px-4 py-2 shadow-2xl backdrop-blur-xl transition-all duration-300 dark:border-neutral-800/60"
                  :style="{
                    backgroundColor: backgroundTint,
                    opacity: 0.85,
                  }"
                >
                  <!-- Mock Drag Endcap Handle -->
                  <div class="h-8 w-8 flex items-center justify-center border border-white/5 rounded-full bg-white/10 text-neutral-400">
                    <span class="i-solar:double-alt-arrow-down-linear rotate-90 text-base" />
                  </div>

                  <!-- Render active buttons -->
                  <div class="flex flex-row items-center gap-2.5">
                    <div
                      v-for="btn in activeButtons"
                      :key="btn.id"
                      class="relative h-8 w-8 flex items-center justify-center border border-white/15 rounded-full bg-white/10 text-neutral-200"
                    >
                      <span :class="[getButtonIcon(btn.id, btn.icon), 'text-base']" />
                    </div>
                  </div>
                </div>

                <div class="pointer-events-none mt-3 text-[9px] text-neutral-500 font-medium tracking-wide">
                  Control Strip Real-Time Mock
                </div>
              </div>

              <!-- Two-Column Grid -->
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <!-- Left Column: Active Items Sorting -->
                <div class="relative flex flex-col gap-3 border border-white/5 rounded-2xl bg-white/5 p-4 dark:bg-neutral-900/40">
                  <div class="flex items-center justify-between border-b border-white/5 pb-2">
                    <span class="text-xs text-neutral-200 font-bold tracking-wider uppercase">Active Buttons</span>

                    <!-- Helper Buttons in corner -->
                    <div class="flex items-center gap-1.5">
                      <button
                        class="cursor-pointer border border-white/10 rounded-md bg-white/5 px-2 py-0.5 text-[9px] text-neutral-300 font-semibold transition-all active:scale-95 hover:bg-white/10"
                        @click="resetOrderOnly"
                      >
                        Reset Order
                      </button>
                      <button
                        class="cursor-pointer border border-emerald-500/20 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[9px] text-emerald-400 font-semibold transition-all active:scale-95 hover:bg-emerald-500/20"
                        @click="controlStripStore.resetButtons()"
                      >
                        Reset Buttons
                      </button>
                    </div>
                  </div>

                  <!-- Draggable Active Slots List -->
                  <div class="scrollbar-hide max-h-[300px] overflow-y-auto py-1 pr-1 space-y-2">
                    <transition-group name="list">
                      <div
                        v-for="(btn, index) in activeButtons"
                        :key="btn.id"
                        draggable="true"
                        class="group flex items-center justify-between border border-white/5 rounded-xl bg-black/25 px-3 py-2 transition-all duration-200 hover:border-white/10 hover:bg-black/45"
                        :class="{
                          'opacity-50 border-emerald-500/30 bg-emerald-500/5': dragIndex === index,
                          'border-t-2 border-t-emerald-400/80': dragOverIndex === index && dragIndex !== null && index < dragIndex,
                          'border-b-2 border-b-emerald-400/80': dragOverIndex === index && dragIndex !== null && index > dragIndex,
                        }"
                        @dragstart="onDragStart(index, $event)"
                        @dragover="onDragOver(index, $event)"
                        @dragleave="onDragLeave(index)"
                        @drop="onDrop(index, $event)"
                        @dragend="onDragEnd"
                      >
                        <!-- Left Handlebar -->
                        <div class="flex items-center gap-2">
                          <div
                            class="flex cursor-grab items-center justify-center px-0.5 py-1 text-neutral-500 transition-colors hover:text-neutral-300"
                          >
                            <span class="i-lucide:grip-vertical text-sm" />
                          </div>

                          <!-- Icon and Label -->
                          <div class="flex items-center gap-2">
                            <div :class="[getButtonIcon(btn.id, btn.icon), 'text-neutral-300 text-sm shrink-0']" />
                            <span class="text-xs text-neutral-200 font-medium">{{ btn.label }}</span>
                          </div>
                        </div>

                        <!-- Right Close "x" to Disable -->
                        <button
                          class="cursor-pointer p-1 text-red-500 transition-colors hover:text-red-400"
                          title="Disable button"
                          @click="disableButton(btn.id)"
                        >
                          <span class="i-lucide:x block text-base" />
                        </button>
                      </div>
                    </transition-group>

                    <!-- Empty State -->
                    <div v-if="activeButtons.length === 0" class="flex flex-col items-center justify-center py-8 text-center opacity-40">
                      <span class="i-solar:widget-linear mb-1.5 text-2xl" />
                      <span class="text-[10px] font-medium">No active buttons on strip</span>
                      <span class="mt-0.5 text-[9px] text-neutral-500">Enable buttons in other tabs to preview them here.</span>
                    </div>
                  </div>
                </div>

                <!-- Right Column: Visual Theme Tinting -->
                <div class="flex flex-col gap-4 border border-white/5 rounded-2xl bg-white/5 p-4 dark:bg-neutral-900/40">
                  <div class="border-b border-white/5 pb-2">
                    <span class="text-xs text-neutral-200 font-bold tracking-wider uppercase">Theme & Tint</span>
                  </div>

                  <!-- Presets Grid -->
                  <div class="space-y-2">
                    <span class="text-[10px] text-neutral-400 font-medium">Color Presets</span>
                    <div class="grid grid-cols-5 gap-2">
                      <button
                        v-for="preset in colorPresets"
                        :key="preset.value"
                        class="relative aspect-square flex cursor-pointer items-center justify-center border rounded-xl transition-all duration-200 hover:scale-105"
                        :class="[
                          backgroundTint === preset.value
                            ? 'border-emerald-400 scale-105 shadow-[0_0_12px_rgba(52,211,153,0.25)]'
                            : 'border-white/10 hover:border-white/20',
                        ]"
                        :style="{ backgroundColor: preset.value }"
                        :title="preset.name"
                        @click="backgroundTint = preset.value"
                      >
                        <!-- Checked Indicator if active -->
                        <span v-if="backgroundTint === preset.value" class="i-solar:check-circle-bold absolute rounded-full bg-neutral-950 text-xs text-emerald-400 -right-1 -top-1" />
                      </button>
                    </div>
                  </div>

                  <!-- Custom Color Picker -->
                  <div class="mt-2 space-y-2">
                    <span class="text-[10px] text-neutral-400 font-medium">Custom Tint</span>
                    <div class="flex items-center gap-3 border border-white/5 rounded-xl bg-black/25 p-3">
                      <div class="relative h-10 w-10 shrink-0 overflow-hidden border border-white/10 rounded-lg">
                        <input
                          v-model="backgroundTint"
                          type="color"
                          class="absolute inset-0 h-full w-full scale-150 cursor-pointer border-0 p-0"
                        >
                      </div>
                      <div class="flex flex-1 flex-col gap-0.5">
                        <span class="text-[10px] text-neutral-200 font-medium">Custom Color Picker</span>
                        <span class="text-[9px] text-neutral-500 font-mono uppercase">{{ backgroundTint }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <template v-else>
            <!-- Category Banner Header -->
            <div class="border-b border-white/5 pb-2.5 space-y-1">
              <h2 class="flex items-center gap-2 text-xs text-neutral-100 font-bold tracking-wide">
                <div :class="[activeGroup.icon, 'text-emerald-400 text-sm']" />
                {{ activeGroup.name }}
              </h2>
              <p class="text-[10px] text-neutral-400/80 leading-relaxed">
                {{ activeGroup.description }}
              </p>
            </div>

            <!-- Render List of Items in the Active Category -->
            <div class="border border-white/5 rounded-xl bg-white/5 p-3 space-y-4 dark:bg-neutral-900/40">
              <div
                v-for="item in activeGroup.items"
                :key="item.id"
                class="flex items-start justify-between gap-4 border-b border-white/5 pb-3 last:border-0 last:pb-0"
              >
                <div class="space-y-0.5">
                  <div class="flex items-center gap-2">
                    <div :class="[getButtonIcon(item.id, item.icon), 'text-neutral-300 text-sm shrink-0']" />
                    <span class="text-xs text-neutral-200 font-semibold">{{ item.label }}</span>

                    <!-- State Indicator Dot for bound items -->
                    <span v-if="item.binding" class="flex items-center gap-1">
                      <span
                        :class="[
                          'h-2 w-2 rounded-full inline-block',
                          item.binding === 'geminiSession' ? geminiDotClasses : (isBoundActive(item.binding) ? 'bg-green-500' : 'bg-red-500'),
                        ]"
                      />
                      <span class="text-[9px] text-neutral-500 font-mono">
                        {{ item.binding === 'geminiSession' ? powerState : (isBoundActive(item.binding) ? 'active' : 'inactive') }}
                      </span>
                    </span>

                    <!-- State Indicator Dot for unbound toggles (always-on-top, viewport-auto-hide) -->
                    <span v-else-if="item.type === 'toggle' && hasToggleButton(item)" class="flex items-center gap-1">
                      <span
                        :class="[
                          'h-2 w-2 rounded-full inline-block',
                          isUnboundToggleActive(item.id) ? 'bg-green-500' : 'bg-red-500',
                        ]"
                      />
                      <span class="text-[9px] text-neutral-500 font-mono">
                        {{ isUnboundToggleActive(item.id) ? 'active' : 'inactive' }}
                      </span>
                    </span>
                  </div>
                  <p class="text-[10px] text-neutral-400 leading-normal">
                    {{ item.description }}
                  </p>
                </div>

                <!-- Action Controls -->
                <div class="flex shrink-0 items-center gap-2">
                  <!-- Control Strip Inclusion Switch -->
                  <div v-if="item.id !== 'layout'" class="flex items-center gap-1.5 border border-white/5 rounded-lg bg-black/30 px-2 py-1">
                    <span class="text-[9px] text-neutral-500 font-bold tracking-wider uppercase">Strip</span>
                    <button
                      :class="[
                        isItemOnStrip(item.id) ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-neutral-800/25 border-neutral-700/20',
                        'relative inline-flex h-4.5 w-8.5 shrink-0 cursor-pointer rounded-full border transition-all duration-300 ease-out active:scale-95',
                      ]"
                      @click="toggleItemOnStrip(item.id)"
                    >
                      <span
                        :class="[
                          isItemOnStrip(item.id) ? 'translate-x-4 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'translate-x-0.5 bg-neutral-500',
                          'pointer-events-none inline-block h-3 w-3 transform rounded-full transition-all duration-300 ease-out mt-[1.5px]',
                        ]"
                      />
                    </button>
                  </div>

                  <!-- Toggle button: bound items -->
                  <button
                    v-if="item.type === 'toggle' && item.binding"
                    :class="[
                      isBoundActive(item.binding) ? 'bg-sky-500/20 border-sky-500/40 text-sky-400' : 'bg-neutral-800/40 border-neutral-700/20 text-neutral-400',
                      'px-2 py-0.5 rounded-md border text-[9px] font-semibold active:scale-95 transition-all',
                    ]"
                    @click="toggleBoundState(item.binding)"
                  >
                    {{ isBoundActive(item.binding) ? 'ACTIVE' : 'MUTED' }}
                  </button>

                  <!-- Toggle button: unbound items (always-on-top, viewport-auto-hide) -->
                  <button
                    v-else-if="hasToggleButton(item)"
                    :class="[
                      item.id === 'caption-docking'
                        ? (settingsStore.captionDocking === 'bottom' ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-sky-500/20 border-sky-500/40 text-sky-400')
                        : item.id === 'caption-layout-mode'
                          ? (settingsStore.captionLayoutMode === 'multi' ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-teal-500/20 border-teal-500/40 text-teal-400')
                          : (isUnboundToggleActive(item.id) ? 'bg-sky-500/20 border-sky-500/40 text-sky-400' : 'bg-neutral-800/40 border-neutral-700/20 text-neutral-400'),
                      'px-2 py-0.5 rounded-md border text-[9px] font-semibold active:scale-95 transition-all',
                    ]"
                    @click="toggleUnboundState(item.id)"
                  >
                    <template v-if="item.id === 'theme-mode'">
                      {{ isUnboundToggleActive(item.id) ? 'DARK' : 'LIGHT' }}
                    </template>
                    <template v-else-if="item.id === 'caption-docking'">
                      {{ isUnboundToggleActive(item.id) ? 'BOTTOM' : 'TOP' }}
                    </template>
                    <template v-else-if="item.id === 'caption-layout-mode'">
                      {{ isUnboundToggleActive(item.id) ? 'MULTI' : 'SINGLE' }}
                    </template>
                    <template v-else>
                      {{ isUnboundToggleActive(item.id) ? 'ACTIVE' : 'MUTED' }}
                    </template>
                  </button>

                  <!-- Trigger generic action / menu overlay -->
                  <button
                    v-else-if="item.type === 'action' || item.type === 'cycler'"
                    class="border border-white/10 rounded-md bg-white/5 px-2.5 py-0.5 text-[9px] text-neutral-200 font-semibold transition-all active:scale-95 hover:bg-white/10"
                    @click="handleAction(item.id)"
                  >
                    {{ item.type === 'cycler' ? 'Cycle' : 'Run' }}
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Footer Info -->
      <div class="flex items-center justify-between border-t border-white/5 bg-black/25 px-4 py-3.5 text-[10px] text-neutral-500 font-medium">
        <span>Model: <span class="text-neutral-400 font-mono">{{ modelSelected }}</span></span>
        <span class="flex items-center gap-1.5">
          <span class="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
          Live Synced View
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>

<route lang="yaml">
meta:
  layout: stage
</route>
