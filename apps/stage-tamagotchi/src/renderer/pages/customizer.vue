<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { estimateTokens } from '@proj-airi/stage-shared'
import { CUSTOMIZER_CATALOG } from '@proj-airi/stage-ui/constants/control-customizer'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useLiveSessionStore } from '@proj-airi/stage-ui/stores/modules/live-session'
import { useSettings, useSettingsAudioDevice, useSettingsControlStrip } from '@proj-airi/stage-ui/stores/settings'
import { useSettingsControlsIsland } from '@proj-airi/stage-ui/stores/settings/controls-island'
import { useBroadcastChannel, useColorMode } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import ColorPicker from '../../../../../packages/stage-ui/src/components/data-pane/color-picker.vue'

import { chatSessionsRepo } from '../../../../../packages/stage-ui/src/database/repos/chat-sessions.repo'
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
  'caption-sync-position',
  'caption-sync-visibility',
  'caption-theme-mode',
  'caption-opacity',
  'caption-layout-mode',

  'actor-characters',
  'actor-wardrobe',
  'actor-expressions',
  'actor-idle-animations',
  'actor-motions',
  'actor-all-emotions',

  'gemini-manual-capture',
]

// ── Preview strip — pointer-event drag-to-sort (HTML5 DnD is broken in Electron) ────────
const stripDragIndex = ref<number | null>(null)
// Insert-before position: 0 = before first, activeButtons.length = after last
const stripInsertAt = ref<number | null>(null)
// Ghost icon position (follows cursor during drag)
const stripGhostPos = ref<{ x: number, y: number } | null>(null)
// Refs to each rendered strip icon, populated by :ref binding in template
const stripIconRefs = ref<(HTMLElement | null)[]>([])

function setStripIconRef(el: HTMLElement | null, index: number) {
  stripIconRefs.value[index] = el
}

/** True when this insert position is a no-op (dragged item stays in place) */
function isNoOp(pos: number): boolean {
  const from = stripDragIndex.value
  if (from === null)
    return false
  return pos === from || pos === from + 1
}

/** Compute insert-before index from cursor X against rendered icon rects */
function computeInsertAt(clientX: number): number {
  const icons = stripIconRefs.value
  for (let i = 0; i < icons.length; i++) {
    const el = icons[i]
    if (!el)
      continue
    const rect = el.getBoundingClientRect()
    if (clientX < rect.left + rect.width / 2)
      return i
  }
  return icons.length
}

function onStripMouseDown(index: number, event: MouseEvent) {
  if (event.button !== 0)
    return
  event.preventDefault()
  stripDragIndex.value = index
  stripInsertAt.value = index // start with no-op position
  stripGhostPos.value = { x: event.clientX, y: event.clientY }
  document.addEventListener('mousemove', onStripMouseMove)
  document.addEventListener('mouseup', onStripMouseUp)
}

function onStripMouseMove(event: MouseEvent) {
  if (stripDragIndex.value === null)
    return
  stripGhostPos.value = { x: event.clientX, y: event.clientY }
  stripInsertAt.value = computeInsertAt(event.clientX)
}

function onStripMouseUp() {
  const from = stripDragIndex.value
  const to = stripInsertAt.value
  if (from !== null && to !== null && !isNoOp(to)) {
    const activeList = [...activeButtons.value]
    const [draggedItem] = activeList.splice(from, 1)
    // Adjust target index since we removed one item before it
    const adjustedTo = from < to ? to - 1 : to
    activeList.splice(adjustedTo, 0, draggedItem)
    const disabledList = buttons.value.filter(btn => !btn.enabled)
    buttons.value = [...activeList, ...disabledList]
  }
  stripDragIndex.value = null
  stripInsertAt.value = null
  stripGhostPos.value = null
  document.removeEventListener('mousemove', onStripMouseMove)
  document.removeEventListener('mouseup', onStripMouseUp)
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
// NOTICE: this union must mirror the `binding` union in `control-customizer.ts`.
function isBoundActive(binding: 'chatOpen' | 'stageEnabled' | 'stageMateEnabled' | 'micEnabled' | 'captionOpen' | 'geminiSession' | 'headTetheredCaptionEnabled' | undefined): boolean {
  if (!binding)
    return false
  if (binding === 'chatOpen')
    return controlStripStore.chatOpen
  if (binding === 'stageEnabled')
    return controlStripStore.stageEnabled
  if (binding === 'stageMateEnabled')
    return controlStripStore.stageMateEnabled
  if (binding === 'captionOpen')
    return controlStripStore.captionOpen
  if (binding === 'micEnabled')
    return settingsAudioDeviceStore.enabled
  if (binding === 'geminiSession')
    return powerState.value !== 'off'
  if (binding === 'headTetheredCaptionEnabled')
    return settingsStore.headTetheredCaptionEnabled
  return false
}

function toggleBoundState(binding: 'chatOpen' | 'stageEnabled' | 'stageMateEnabled' | 'micEnabled' | 'captionOpen' | 'geminiSession' | 'headTetheredCaptionEnabled' | undefined) {
  if (!binding)
    return
  if (binding === 'chatOpen')
    postControlStripAction('chat')
  else if (binding === 'stageEnabled')
    postControlStripAction('stage')
  else if (binding === 'stageMateEnabled')
    postControlStripAction('stage-mate')
  else if (binding === 'captionOpen')
    postControlStripAction('caption')
  else if (binding === 'micEnabled')
    postControlStripAction('mic')
  else if (binding === 'geminiSession')
    postControlStripAction('gemini-session')
  else if (binding === 'headTetheredCaptionEnabled')
    postControlStripAction('head-tethered-caption')
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
  if (itemId === 'caption-sync-position')
    return settingsStore.captionFollowStagePosition
  if (itemId === 'caption-sync-visibility')
    return settingsStore.captionFollowStageVisibility
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
  return ['always-on-top', 'viewport-auto-hide', 'theme-mode', 'caption-sync-position', 'caption-sync-visibility', 'caption-docking', 'caption-layout-mode'].includes(item.id)
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

function resetStats() {
  liveSessionStore.voiceTokens = 0
  liveSessionStore.inferenceTokens = 0
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

// Cleanup pointer listeners if component is unmounted mid-drag
onUnmounted(() => {
  document.removeEventListener('mousemove', onStripMouseMove)
  document.removeEventListener('mouseup', onStripMouseUp)
})

// ── Usage Report & Statistics Logic ─────────────────────────────
const isLoading = ref(false)
const timePeriod = ref('last_week')
const timeSlice = ref('day')

interface ReportData {
  timeSeries: { label: string, value: number }[]
  topCharacters: { id: string, name: string, value: number }[]
  totalMessages: number
  totalTokens: number
}

const reportData = ref<ReportData | null>(null)

function getNewYorkDateInfo(timestamp: number) {
  const date = new Date(timestamp)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(date)

  const info: Record<string, string> = {}
  for (const part of parts) {
    info[part.type] = part.value
  }
  const y = info.year
  const m = info.month.padStart(2, '0')
  const d = info.day.padStart(2, '0')
  const h = info.hour.padStart(2, '0')
  return {
    dayStr: `${y}-${m}-${d}`,
    hourStr: `${y}-${m}-${d} ${h}:00`,
    hour: Number.parseInt(h, 10),
  }
}

function getMessageTokens(message: any) {
  if (typeof message.content === 'string') {
    return estimateTokens(message.content)
  }
  if (Array.isArray(message.content)) {
    const textOnly = message.content
      .map((part: any) => {
        if (typeof part === 'string')
          return part
        if (part && typeof part === 'object' && 'text' in part && !('image_url' in part))
          return String(part.text ?? '')
        return ''
      })
      .join('')
    return estimateTokens(textOnly)
  }
  return 0
}

async function generateReport() {
  if (isLoading.value)
    return
  isLoading.value = true

  try {
    const cardStore = useAiriCardStore()
    if (cardStore.cards.size === 0 && typeof cardStore.initialize === 'function') {
      await cardStore.initialize()
    }

    const index = await chatSessionsRepo.getIndex('local')
    const sessionIds: string[] = []
    if (index && index.characters) {
      for (const charId of Object.keys(index.characters)) {
        const charSessions = index.characters[charId]
        if (charSessions && charSessions.sessions) {
          for (const sid of Object.keys(charSessions.sessions)) {
            sessionIds.push(sid)
          }
        }
      }
    }

    const now = new Date()
    let startLimit = 0
    let endLimit = now.getTime()
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

    if (timePeriod.value === 'today') {
      startLimit = todayMidnight.getTime()
    }
    else if (timePeriod.value === 'yesterday') {
      const yesterdayMidnight = new Date(todayMidnight.getTime() - 24 * 3600 * 1000)
      startLimit = yesterdayMidnight.getTime()
      endLimit = todayMidnight.getTime() - 1
    }
    else if (timePeriod.value === 'last_week') {
      startLimit = todayMidnight.getTime() - 7 * 24 * 3600 * 1000
    }
    else if (timePeriod.value === 'last_month') {
      startLimit = todayMidnight.getTime() - 30 * 24 * 3600 * 1000
    }

    const slices: { label: string, timestamp: number }[] = []
    if (timeSlice.value === 'day') {
      let current = startLimit
      while (current <= endLimit) {
        const info = getNewYorkDateInfo(current)
        slices.push({ label: info.dayStr, timestamp: current })
        current += 24 * 3600 * 1000
      }
    }
    else {
      let current = startLimit
      while (current <= endLimit) {
        const info = getNewYorkDateInfo(current)
        slices.push({ label: info.hourStr, timestamp: current })
        current += 3600 * 1000
      }
    }

    const timeSeriesMap: Record<string, number> = {}
    for (const slice of slices) {
      timeSeriesMap[slice.label] = 0
    }

    const characterUsage: Record<string, number> = {}
    let totalMessages = 0
    let totalTokens = 0

    const BATCH_SIZE = 10
    for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
      const batch = sessionIds.slice(i, i + BATCH_SIZE)
      const records = await Promise.all(batch.map(sid => chatSessionsRepo.getSession(sid)))

      for (const session of records) {
        if (!session)
          continue
        const characterId = session.meta?.characterId || 'unknown'
        if (session.messages && Array.isArray(session.messages)) {
          for (const msg of session.messages) {
            const msgTime = msg.createdAt || session.meta?.createdAt
            if (!msgTime || msgTime < startLimit || msgTime > endLimit) {
              continue
            }

            const info = getNewYorkDateInfo(msgTime)
            const label = timeSlice.value === 'day' ? info.dayStr : info.hourStr

            if (label in timeSeriesMap) {
              const tokens = getMessageTokens(msg)
              timeSeriesMap[label] += tokens
              characterUsage[characterId] = (characterUsage[characterId] || 0) + tokens
              totalTokens += tokens
              totalMessages++
            }
          }
        }
      }
      await new Promise(resolve => setTimeout(resolve, 0))
    }

    const timeSeries = slices.map(slice => ({
      label: slice.label,
      value: timeSeriesMap[slice.label],
    }))

    const topCharacters = Object.entries(characterUsage)
      .map(([id, val]) => {
        const card = cardStore.cards.get(id)
        return {
          id,
          name: card?.name || id,
          value: val,
        }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)

    reportData.value = {
      timeSeries,
      topCharacters,
      totalMessages,
      totalTokens,
    }
  }
  catch (error) {
    console.error('Failed to generate token usage report:', error)
  }
  finally {
    isLoading.value = false
  }
}

const chartSvgPath = computed(() => {
  if (!reportData.value || reportData.value.timeSeries.length === 0)
    return ''
  const vals = reportData.value.timeSeries.map(d => d.value)
  const max = Math.max(...vals, 1)
  const len = vals.length

  const points = vals.map((val, idx) => {
    const x = len > 1 ? (idx / (len - 1)) * 100 : 50
    const y = 90 - (val / max) * 80
    return { x, y }
  })

  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
})

const chartAreaPath = computed(() => {
  const linePath = chartSvgPath.value
  if (!linePath || !reportData.value)
    return ''
  const len = reportData.value.timeSeries.length
  const lastX = len > 1 ? 100 : 50
  return `${linePath} L ${lastX} 90 L 0 90 Z`
})

const chartTicks = computed(() => {
  if (!reportData.value || reportData.value.timeSeries.length === 0)
    return []
  const series = reportData.value.timeSeries
  const len = series.length
  if (len <= 7) {
    return series.map((d, i) => {
      const cleanLabel = formatTickLabel(d.label)
      const leftVal = len > 1 ? (i / (len - 1)) * 100 : 50
      return { label: cleanLabel, left: `${leftVal}%` }
    })
  }
  const ticks = []
  for (let i = 0; i < 7; i++) {
    const idx = Math.round((i / 6) * (len - 1))
    if (series[idx]) {
      ticks.push({
        label: formatTickLabel(series[idx].label),
        left: `${(i / 6) * 100}%`,
      })
    }
  }
  return ticks
})

function formatTickLabel(label: string) {
  if (label.includes(' ')) {
    const parts = label.split(' ')
    const dateParts = parts[0].split('-')
    return `${dateParts[1]}-${dateParts[2]} ${parts[1]}`
  }
  else {
    const dateParts = label.split('-')
    return `${dateParts[1]}-${dateParts[2]}`
  }
}

// Generate the initial report on mount
onMounted(() => {
  generateReport()
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
              activeGroupId === 'stats'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:bg-white/5 hover:text-neutral-200',
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200 cursor-pointer text-xs',
            ]"
            @click="activeGroupId = 'stats'"
          >
            <div class="i-solar:chart-linear shrink-0 text-base" />
            <span class="truncate">Usage Stats</span>
          </button>
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
                  class="h-14 flex flex-row select-none items-center gap-2.5 border border-white/25 rounded-full px-4 py-2 shadow-2xl backdrop-blur-xl transition-all duration-300 dark:border-neutral-800/60"
                  :style="{
                    backgroundColor: backgroundTint,
                    opacity: 0.85,
                  }"
                >
                  <!-- Mock Drag Endcap Handle (non-interactive) -->
                  <div class="pointer-events-none h-8 w-8 flex shrink-0 items-center justify-center border border-white/5 rounded-full bg-white/10 text-neutral-400">
                    <span class="i-solar:double-alt-arrow-down-linear rotate-90 text-base" />
                  </div>

                  <!-- Pointer-draggable strip icons with insertion indicator -->
                  <div class="flex flex-row items-center gap-1.5">
                    <!-- Indicator: before first item -->
                    <transition name="insert-indicator">
                      <div
                        v-if="stripInsertAt === 0 && stripDragIndex !== null && !isNoOp(0)"
                        class="h-7 w-0.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]"
                      />
                    </transition>

                    <template v-for="(btn, index) in activeButtons" :key="btn.id">
                      <div
                        :ref="(el) => setStripIconRef(el as HTMLElement | null, index)"
                        class="relative h-8 w-8 flex shrink-0 select-none items-center justify-center border rounded-full bg-white/10 text-neutral-200 transition-all duration-150"
                        :class="[
                          stripDragIndex === index
                            ? 'opacity-20 scale-75 border-white/10 cursor-grabbing'
                            : stripDragIndex !== null
                              ? 'border-white/25 cursor-grabbing ring-1 ring-emerald-400/25'
                              : 'border-white/15 cursor-grab hover:border-emerald-400/50 hover:bg-white/15',
                        ]"
                        @mousedown="onStripMouseDown(index, $event)"
                      >
                        <span :class="[getButtonIcon(btn.id, btn.icon), 'text-base pointer-events-none']" />
                      </div>

                      <!-- Indicator: after this item -->
                      <transition name="insert-indicator">
                        <div
                          v-if="stripInsertAt === index + 1 && stripDragIndex !== null && !isNoOp(index + 1)"
                          class="h-7 w-0.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]"
                        />
                      </transition>
                    </template>
                  </div>
                </div>

                <div class="pointer-events-none mt-3 flex items-center gap-1.5 text-[9px] text-neutral-500 font-medium">
                  <span class="i-solar:hand-shake-linear text-xs" />
                  Drag the icons above to reorder your strip
                </div>

                <!-- Ghost icon that follows the cursor during drag -->
                <Teleport to="body">
                  <transition name="ghost">
                    <div
                      v-if="stripGhostPos && stripDragIndex !== null && activeButtons[stripDragIndex]"
                      class="pointer-events-none fixed z-[9999] h-8 w-8 flex items-center justify-center border border-emerald-400/70 rounded-full bg-neutral-900/95 text-neutral-100 shadow-lg ring-1 ring-emerald-400/40"
                      :style="{
                        left: `${stripGhostPos.x - 16}px`,
                        top: `${stripGhostPos.y - 16}px`,
                        transform: 'scale(1.2)',
                        transition: 'transform 0.1s ease',
                      }"
                    >
                      <span :class="[getButtonIcon(activeButtons[stripDragIndex].id, activeButtons[stripDragIndex].icon), 'text-base']" />
                    </div>
                  </transition>
                </Teleport>
              </div>

              <!-- Two-Column Grid -->
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <!-- Left Column: Active Items Sorting -->
                <div class="relative flex flex-col gap-2 border border-white/5 rounded-2xl bg-white/5 p-4 dark:bg-neutral-900/40">
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

                  <!-- Sub-blurb -->
                  <p class="text-[9px] text-neutral-500 leading-relaxed">
                    Quickly remove unused buttons
                  </p>

                  <!-- Toggle-only Active Slots List -->
                  <div class="scrollbar-hide max-h-[300px] overflow-y-auto pr-1 space-y-1">
                    <transition-group name="list">
                      <div
                        v-for="btn in activeButtons"
                        :key="btn.id"
                        class="flex items-center justify-between border border-white/5 rounded-lg bg-black/25 px-2.5 py-1.5 transition-all duration-200 hover:border-white/10 hover:bg-black/40"
                      >
                        <!-- Icon and Label -->
                        <div class="flex items-center gap-2">
                          <div :class="[getButtonIcon(btn.id, btn.icon), 'text-neutral-400 text-sm shrink-0']" />
                          <span class="text-xs text-neutral-300 font-medium">{{ btn.label }}</span>
                        </div>

                        <!-- Right ✕ to Disable -->
                        <button
                          class="cursor-pointer rounded p-0.5 text-neutral-600 transition-colors hover:text-red-400"
                          title="Remove from strip"
                          @click="disableButton(btn.id)"
                        >
                          <span class="i-lucide:x block text-sm" />
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

                  <!-- Presets Grid + Custom swatch in one row -->
                  <div class="space-y-2">
                    <span class="text-[10px] text-neutral-400 font-medium">Color Presets</span>
                    <div class="grid grid-cols-6 gap-2">
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
                        <span v-if="backgroundTint === preset.value" class="i-solar:check-circle-bold absolute rounded-full bg-neutral-950 text-xs text-emerald-400 -right-1 -top-1" />
                      </button>

                      <!-- Custom swatch slot (6th column) -->
                      <div
                        class="relative aspect-square"
                        :class="[
                          !colorPresets.some(p => p.value === backgroundTint)
                            ? 'scale-105'
                            : '',
                        ]"
                      >
                        <ColorPicker
                          v-model="backgroundTint"
                          :alpha="false"
                          :compact="true"
                          class="h-full w-full"
                          :class="[
                            !colorPresets.some(p => p.value === backgroundTint)
                              ? 'border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.25)]'
                              : 'border-white/10',
                          ]"
                        />
                      </div>
                    </div>

                    <!-- Current hex below grid -->
                    <p class="text-[9px] text-neutral-500 tracking-wider font-mono uppercase">
                      Active: {{ backgroundTint }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <template v-else-if="activeGroupId === 'stats'">
            <div class="space-y-4">
              <!-- Category Banner Header -->
              <div class="border-b border-white/5 pb-2.5 space-y-1">
                <h2 class="flex items-center gap-2 text-xs text-neutral-100 font-bold tracking-wide">
                  <div class="i-solar:chart-linear text-sm text-emerald-400" />
                  Usage Stats
                </h2>
                <p class="text-[10px] text-neutral-400/80 leading-relaxed">
                  Lifetime LLM usage metrics, voice session token accumulation, and historical visualization.
                </p>
              </div>

              <!-- Stats Cards Grid -->
              <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                <!-- Card 1: Global Inference Tokens -->
                <div class="flex flex-col justify-between border border-white/5 rounded-2xl bg-white/5 p-4 dark:bg-neutral-900/40">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase">Inference Tokens</span>
                    <span class="i-solar:chat-square-linear text-base text-emerald-400" />
                  </div>
                  <div class="mt-4">
                    <span class="text-2xl text-neutral-100 font-bold tracking-tight">
                      {{ Number(liveSessionStore.inferenceTokens || 0).toLocaleString() }}
                    </span>
                    <p class="mt-1 text-[9px] text-neutral-500">
                      Global accumulated chat tokens
                    </p>
                  </div>
                </div>

                <!-- Card 2: Voice Tokens -->
                <div class="flex flex-col justify-between border border-white/5 rounded-2xl bg-white/5 p-4 dark:bg-neutral-900/40">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase">Voice Tokens</span>
                    <span class="i-solar:microphone-large-linear text-base text-sky-400" />
                  </div>
                  <div class="mt-4">
                    <span class="text-2xl text-neutral-100 font-bold tracking-tight">
                      {{ Number(liveSessionStore.voiceTokens || 0).toLocaleString() }}
                    </span>
                    <p class="mt-1 text-[9px] text-neutral-500">
                      Gemini Live Bidi session tokens
                    </p>
                  </div>
                </div>

                <!-- Card 3: Total Combined Tokens -->
                <div class="flex flex-col justify-between border border-white/5 rounded-2xl bg-white/5 p-4 dark:bg-neutral-900/40">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase">Total Tokens</span>
                    <span class="i-solar:calculator-linear text-base text-purple-400" />
                  </div>
                  <div class="mt-4">
                    <span class="text-2xl text-neutral-100 font-bold tracking-tight">
                      {{ Number(liveSessionStore.totalTokens || 0).toLocaleString() }}
                    </span>
                    <p class="mt-1 text-[9px] text-neutral-500">
                      Combined token usage
                    </p>
                  </div>
                </div>
              </div>

              <!-- Usage Report Config Controls -->
              <div class="border border-white/5 rounded-2xl bg-white/5 p-4 space-y-3 dark:bg-neutral-900/40">
                <div class="flex items-center justify-between border-b border-white/5 pb-2">
                  <span class="text-xs text-neutral-200 font-bold tracking-wider uppercase">Report Controls</span>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1">
                    <label class="text-[10px] text-neutral-400 font-medium uppercase">Time Period</label>
                    <select
                      v-model="timePeriod"
                      class="w-full border border-white/10 rounded-xl bg-neutral-950/60 px-2.5 py-1.5 text-xs text-neutral-200 font-medium focus:border-emerald-500/50 focus:outline-none"
                    >
                      <option value="today">
                        Today
                      </option>
                      <option value="yesterday">
                        Yesterday
                      </option>
                      <option value="last_week">
                        Last Week
                      </option>
                      <option value="last_month">
                        Last Month
                      </option>
                    </select>
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] text-neutral-400 font-medium uppercase">Time Slices</label>
                    <select
                      v-model="timeSlice"
                      class="w-full border border-white/10 rounded-xl bg-neutral-950/60 px-2.5 py-1.5 text-xs text-neutral-200 font-medium focus:border-emerald-500/50 focus:outline-none"
                    >
                      <option value="hour">
                        By Hour
                      </option>
                      <option value="day">
                        By Day
                      </option>
                    </select>
                  </div>
                </div>
                <div class="pt-1">
                  <button
                    class="w-full flex cursor-pointer items-center justify-center gap-2 border border-emerald-500/20 rounded-xl bg-emerald-500/10 px-4 py-2 text-xs text-emerald-400 font-bold tracking-wide uppercase transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed hover:bg-emerald-500/20 disabled:opacity-50"
                    :disabled="isLoading"
                    @click="generateReport"
                  >
                    <span v-if="isLoading" class="i-svg-spinners:ring-resize text-sm" />
                    <span>Generate Report Now</span>
                  </button>
                </div>
              </div>

              <!-- Usage Chart Visualization -->
              <div class="border border-white/5 rounded-2xl bg-white/5 p-4 dark:bg-neutral-900/40">
                <div class="flex items-center justify-between border-b border-white/5 pb-2">
                  <span class="text-xs text-neutral-200 font-bold tracking-wider uppercase">Usage Over Time</span>
                  <span v-if="reportData" class="text-[9px] text-neutral-400 font-mono">
                    {{ reportData.totalTokens.toLocaleString() }} tokens / {{ reportData.totalMessages.toLocaleString() }} msgs
                  </span>
                </div>

                <div v-if="isLoading" class="mt-4 h-48 w-full flex flex-col items-center justify-center gap-2">
                  <span class="i-svg-spinners:ring-resize text-2xl text-emerald-400" />
                  <span class="text-[10px] text-neutral-500">Analyzing sessions database...</span>
                </div>
                <div v-else-if="!reportData || reportData.timeSeries.length === 0" class="mt-4 h-48 w-full flex items-center justify-center">
                  <span class="text-[10px] text-neutral-500 font-medium">No usage data found for this period.</span>
                </div>
                <div v-else class="mt-4">
                  <!-- Beautiful SVG Line Chart -->
                  <div class="relative h-44 w-full">
                    <svg class="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stop-color="#10b981" stop-opacity="0.25" />
                          <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
                        </linearGradient>
                      </defs>
                      <!-- Grid Lines -->
                      <line x1="0" y1="10" x2="100" y2="10" stroke="rgba(255,255,255,0.03)" stroke-width="0.5" />
                      <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.03)" stroke-width="0.5" />
                      <line x1="0" y1="90" x2="100" y2="90" stroke="rgba(255,255,255,0.03)" stroke-width="0.5" />

                      <!-- Area Under Curve -->
                      <path :d="chartAreaPath" fill="url(#chartGrad)" />

                      <!-- Line Path -->
                      <path :d="chartSvgPath" fill="none" stroke="#10b981" stroke-width="1.5" stroke-linecap="round" />
                    </svg>
                  </div>

                  <div class="relative mt-3 h-4 w-full text-[8px] text-neutral-500 font-medium font-mono">
                    <div
                      v-for="(tick, idx) in chartTicks"
                      :key="idx"
                      class="absolute whitespace-nowrap -translate-x-1/2"
                      :style="{ left: tick.left }"
                    >
                      {{ tick.label }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Most Popular Characters Bar Chart -->
              <div class="border border-white/5 rounded-2xl bg-white/5 p-4 dark:bg-neutral-900/40">
                <div class="flex items-center justify-between border-b border-white/5 pb-2">
                  <span class="text-xs text-neutral-200 font-bold tracking-wider uppercase">Most Popular Characters</span>
                </div>
                <div v-if="isLoading" class="mt-4 flex flex-col items-center justify-center gap-2 py-8">
                  <span class="i-svg-spinners:ring-resize text-2xl text-emerald-400" />
                </div>
                <div v-else-if="!reportData || reportData.topCharacters.length === 0" class="mt-4 flex items-center justify-center py-8">
                  <span class="text-[10px] text-neutral-500 font-medium">No character usage data.</span>
                </div>
                <div v-else class="mt-4 space-y-3">
                  <div
                    v-for="(char, idx) in reportData.topCharacters"
                    :key="char.id"
                    class="space-y-1"
                  >
                    <div class="flex items-center justify-between text-[10px] font-medium">
                      <span class="flex items-center gap-1.5 text-neutral-200">
                        <span class="text-[9px] text-neutral-500 font-bold font-mono">#{{ idx + 1 }}</span>
                        {{ char.name }}
                      </span>
                      <span class="text-neutral-400 font-mono">{{ char.value.toLocaleString() }} tokens</span>
                    </div>
                    <div class="h-2 w-full overflow-hidden border border-white/5 rounded-full bg-neutral-950/60">
                      <div
                        class="h-full rounded-full from-emerald-500 to-teal-400 bg-gradient-to-r transition-all duration-500"
                        :style="{ width: `${(char.value / Math.max(...reportData.topCharacters.map(c => c.value), 1)) * 100}%` }"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Reset Actions -->
              <div class="flex justify-end border-t border-white/5 pt-4">
                <button
                  class="cursor-pointer border border-red-500/20 rounded-xl bg-red-500/10 px-4 py-2.5 text-xs text-red-400 font-bold tracking-wide uppercase transition-all duration-200 active:scale-95 hover:bg-red-500/20"
                  @click="resetStats"
                >
                  Reset Counters
                </button>
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

.insert-indicator-enter-active,
.insert-indicator-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.insert-indicator-enter-from,
.insert-indicator-leave-to {
  opacity: 0;
  transform: scaleY(0.4);
}

.ghost-enter-active,
.ghost-leave-active {
  transition: opacity 0.08s ease;
}
.ghost-enter-from,
.ghost-leave-to {
  opacity: 0;
}
</style>

<route lang="yaml">
meta:
  layout: stage
</route>
