<script setup lang="ts">
import type { DashboardModuleId } from '@proj-airi/stage-ui/composables'

import { ChatDashboardCard } from '@proj-airi/stage-ui/components'
import { RendererStage } from '@proj-airi/stage-ui/components/scenes'
import { ALL_DASHBOARD_MODULES, useChatDashboard, useControlStripAction } from '@proj-airi/stage-ui/composables'
import { useSandbox } from '@proj-airi/stage-ui/composables/use-sandbox'
import { useSettingsControlStrip, useSettingsStageModel } from '@proj-airi/stage-ui/stores/settings'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger, SwitchRoot, SwitchThumb } from 'reka-ui'
import { computed, onMounted, ref, watch } from 'vue'

import ChatNan0CognitionPanel from './ChatNan0CognitionPanel.vue'
import ChatWorkspaceTerminalPanel from './ChatWorkspaceTerminalPanel.vue'
import ChatWorkspaceWidgetsPanel from './ChatWorkspaceWidgetsPanel.vue'

const props = defineProps<{
  activeCard?: any
  activeCardId?: string | null
  speakingState?: { mouthOpenSize?: number } | null
  stageXOffset?: number
  stageYOffset?: number
  stageScale?: number
  embeddedStageSupported?: boolean
  isNan0Active?: boolean
  isSandboxActive?: boolean
  interactiveAreaRef?: any
  formatMonthDay?: (timestamp: number) => string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'stageOffsetChange', offset: { x: number, y: number }): void
  (e: 'stageScaleChange', scale: number): void
}>()

const dashboard = useChatDashboard()
const { isReady: isSandboxReady, mountedWidgets } = useSandbox()
const effectiveSandboxActive = computed(() => props.isSandboxActive ?? isSandboxReady.value)
const mediaDisplayCount = ref(12)

const activeWidgetsCount = computed(() => mountedWidgets.value.length)

// Drag and drop state
const draggedIndex = ref<number | null>(null)
const dropTargetIndex = ref<number | null>(null)

function handleDragStart(index: number) {
  draggedIndex.value = index
}

function handleDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  dropTargetIndex.value = index
}

function handleDrop(index: number) {
  if (draggedIndex.value !== null && draggedIndex.value !== index) {
    dashboard.moveModule(draggedIndex.value, index)
  }
  draggedIndex.value = null
  dropTargetIndex.value = null
}

function handleDragEnd() {
  draggedIndex.value = null
  dropTargetIndex.value = null
}

const controlStripStore = useSettingsControlStrip()
const stageModelStore = useSettingsStageModel()
const controlStripAction = useControlStripAction()
const isStageWindowsOpen = ref(false)

const isVrmModel = computed(() => stageModelStore.stageModelRenderer === 'vrm')

const interactionModeConfig = computed(() => {
  const mode = controlStripStore.interactionMode
  switch (mode) {
    case 'drag':
      return {
        label: 'Drag',
        icon: 'i-lucide:move',
      }
    case 'positioning':
      return {
        label: 'Positioning',
        icon: 'i-solar:tuning-outline',
      }
    case 'orbit':
      return {
        label: 'Orbit',
        icon: 'i-solar:eye-linear',
      }
    case 'tactile':
    default:
      return {
        label: 'Tactile',
        icon: 'i-solar:magic-stick-linear',
      }
  }
})

function handleCycleInteractionMode() {
  controlStripAction.dispatchAction('viewport-cycle-modes')
}

function handleResetStagePosition() {
  handleStageOffsetChange({ x: 0, y: 0 })
  handleStageScaleChange(1)
}

function handleToggleStageWindow() {
  controlStripAction.dispatchAction('stage')
}

function handleToggleStageMateWindow() {
  controlStripAction.dispatchAction('stage-mate')
}

function handleToggleStage() {
  dashboard.toggleCollapse('stage')
}

function handleStageOffsetChange(offset: { x: number, y: number }) {
  emit('stageOffsetChange', offset)
}

function handleStageScaleChange(scale: number) {
  emit('stageScaleChange', scale)
}

function handleHideModule(id: DashboardModuleId) {
  dashboard.hideModule(id)
}

function handleAddModule(id: DashboardModuleId) {
  dashboard.addModule(id)
}

function getModuleUnavailableReason(moduleId: DashboardModuleId): string | null {
  if (moduleId === 'stage' && !(props.embeddedStageSupported ?? true)) {
    return 'Won\'t be shown in view mode: Stage model is disabled or not set.'
  }
  if (moduleId === 'terminal' && !effectiveSandboxActive.value) {
    return 'Won\'t be shown in view mode: Sandbox / bash is disabled for this character.'
  }
  if (moduleId === 'nan0' && !props.isNan0Active) {
    return 'Won\'t be shown in view mode: Nan0 Cognition is not active for this character.'
  }
  return null
}

function handleOpenJournal() {
  if (props.interactiveAreaRef) {
    props.interactiveAreaRef.showJournalModal = true
  }
}

function formatMemorySnippet(content?: string): string {
  if (!content)
    return ''

  let text = content.trim()

  // 1. Strip code fences if present (```markdown ... ``` or ~~~)
  text = text.replace(/^(?:`{3,}|~{3,})[\w-]*\n?([\s\S]*?)\n?(?:`{3,}|~{3,})$/g, '$1').trim()

  // 2. If the text starts with a top-level markdown heading (# Title), strip that leading heading line
  text = text.replace(/^#+\s+(?:\S[^\n]*|[\t\v\f\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF])(?:\n+|$)/, '').trim()

  // 3. Format subheadings nicely (e.g. "## Tone Arc" -> "Tone Arc:")
  text = text.replace(/^#+\s+([^\n]+)$/gm, '$1:')

  // 4. Strip markdown formatting syntax (bold, italic, strikethrough, backticks, blockquotes, bullets)
  text = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    // Replace multiple newlines and spaces with single space
    .replace(/\s+/g, ' ')
    .trim()

  return text
}

function getMemoryEntryTitle(entry: { type?: string, title?: string, content?: string }): string {
  if (entry.type === 'auto') {
    const headingMatch = entry.content?.match(/^#+\s+([^\n]+)/)
    if (headingMatch) {
      return headingMatch[1].trim()
    }
  }
  return entry.title || 'Daily Summary'
}

// Ensure widgets module is added & expanded when new widget arrives
watch(() => mountedWidgets.value.length, (newCount, oldCount) => {
  if (newCount > (oldCount ?? 0)) {
    dashboard.setCollapsed('widgets', false)
    dashboard.addModule('widgets')
  }
})

// Smart initialization on mount
onMounted(() => {
  const hasDisplayModel = Boolean(props.activeCard?.extensions?.airi?.displayModelId)
  const hasMedia = (props.interactiveAreaRef?.allImageEntries ?? []).length > 0
  const hasMemories = (props.interactiveAreaRef?.allTextEntries ?? []).length > 0

  dashboard.initializeIfFresh({
    hasDisplayModel,
    isNan0Active: props.isNan0Active,
    hasMemories,
    hasMedia,
    hasScene: hasMedia,
    isSandboxActive: effectiveSandboxActive.value,
  })
})

function getModuleDef(id: DashboardModuleId) {
  return ALL_DASHBOARD_MODULES.find(m => m.id === id)
}

function handleRestoreDefaults() {
  const hasDisplayModel = Boolean(props.activeCard?.extensions?.airi?.displayModelId)
  const hasMedia = (props.interactiveAreaRef?.allImageEntries ?? []).length > 0
  const hasMemories = (props.interactiveAreaRef?.allTextEntries ?? []).length > 0

  dashboard.restoreDefaults({
    hasDisplayModel,
    isNan0Active: props.isNan0Active,
    hasMemories,
    hasMedia,
    hasScene: hasMedia,
    isSandboxActive: effectiveSandboxActive.value,
  })
}
</script>

<template>
  <div class="h-full w-full flex flex-col select-none overflow-hidden">
    <!-- ================= DASHBOARD HEADER ================= -->
    <div
      class="flex shrink-0 items-center justify-between border-b border-neutral-200/50 bg-white/40 px-3.5 py-2.5 backdrop-blur-md dark:border-neutral-800/50 dark:bg-neutral-950/40"
    >
      <!-- Title & Icon -->
      <div class="flex items-center gap-2">
        <div class="i-solar:widget-5-bold-duotone text-base text-primary-500 dark:text-primary-400" />
        <span class="text-xs text-neutral-800 font-bold dark:text-neutral-100">
          {{ dashboard.mode.value === 'customize' ? 'Customize dashboard' : 'Dashboard' }}
        </span>
      </div>

      <!-- Header Actions -->
      <div class="flex items-center gap-1.5">
        <!-- Done Button (Customize Mode) -->
        <button
          v-if="dashboard.mode.value === 'customize'"
          type="button"
          :class="[
            'rounded-lg px-2.5 py-0.5 text-[11px] font-bold text-white transition-all cursor-pointer',
            'bg-primary-500 hover:bg-primary-600 active:scale-95 shadow-xs',
          ]"
          @click="dashboard.mode.value = 'view'"
        >
          Done
        </button>

        <!-- Sliders / Tune Button (View Mode) -->
        <button
          v-else
          type="button"
          :class="[
            'size-7 flex cursor-pointer items-center justify-center rounded-lg text-neutral-500 transition-colors',
            'hover:bg-neutral-200/60 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-200',
          ]"
          title="Customize Dashboard"
          @click="dashboard.mode.value = 'customize'"
        >
          <div class="i-solar:tuning-2-linear text-sm" />
        </button>

        <!-- Collapse Right Panel Button -->
        <button
          type="button"
          :class="[
            'size-7 flex cursor-pointer items-center justify-center rounded-lg text-neutral-500 transition-colors',
            'hover:bg-neutral-200/60 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-200',
          ]"
          title="Close panel"
          @click="emit('close')"
        >
          <div class="i-solar:alt-arrow-right-linear text-xs" />
        </button>
      </div>
    </div>

    <!-- ================= DASHBOARD SCROLLABLE BODY ================= -->
    <div class="flex-1 overflow-y-auto p-2 scrollbar-none">
      <!-- ================= RUNTIME VIEW MODE ================= -->
      <div v-if="dashboard.mode.value === 'view'" class="flex flex-col gap-1">
        <!-- Dynamic Module Loop -->
        <template v-for="moduleId in dashboard.activeModuleIds.value" :key="moduleId">
          <!-- 1. STAGE MODULE -->
          <ChatDashboardCard
            v-if="moduleId === 'stage' && (embeddedStageSupported ?? true)"
            title="Stage"
            icon="i-solar:smile-circle-bold-duotone"
            icon-color-class="text-pink-500 dark:text-pink-400"
            body-class="mt-0.5 flex flex-col p-1"
            :collapsed="dashboard.isCollapsed('stage')"
            @toggle="handleToggleStage"
          >
            <template #title-extra>
              <button
                type="button"
                :class="[
                  'rounded-full px-2 py-0.5 flex items-center gap-1 text-[11px] font-semibold cursor-pointer select-none transition-all',
                  'bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 hover:bg-teal-500/20 dark:hover:bg-teal-500/30 active:scale-95',
                ]"
                :title="`Interaction mode: ${interactionModeConfig.label}. Click to cycle.`"
                @click.stop="handleCycleInteractionMode"
              >
                <div :class="[interactionModeConfig.icon, 'text-xs shrink-0']" />
                <span>{{ interactionModeConfig.label }}</span>
              </button>
            </template>

            <template #actions>
              <!-- Reset Position Button -->
              <button
                type="button"
                :class="[
                  'size-6 flex cursor-pointer items-center justify-center rounded-lg text-neutral-400 transition-colors',
                  'hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200',
                ]"
                title="Reset model position"
                @click.stop="handleResetStagePosition"
              >
                <div class="i-solar:history-linear text-xs" />
              </button>

              <!-- Stage Windows Popover -->
              <PopoverRoot v-model:open="isStageWindowsOpen">
                <PopoverTrigger as-child>
                  <button
                    type="button"
                    :class="[
                      'size-6 flex cursor-pointer items-center justify-center rounded-lg text-neutral-400 transition-colors',
                      'hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200',
                      'data-[state=open]:bg-neutral-200/80 dark:data-[state=open]:bg-neutral-800 data-[state=open]:text-neutral-800 dark:data-[state=open]:text-neutral-100',
                    ]"
                    title="Stage windows"
                    @click.stop
                  >
                    <div class="i-solar:export-linear text-xs" />
                  </button>
                </PopoverTrigger>
                <PopoverPortal>
                  <PopoverContent
                    side="bottom"
                    align="end"
                    :side-offset="6"
                    :collision-padding="8"
                    :class="[
                      'z-50 w-56 rounded-xl p-2.5 shadow-xl backdrop-blur-md outline-none text-xs',
                      'border border-neutral-200/90 bg-white/95 dark:border-neutral-800/90 dark:bg-neutral-900/95',
                    ]"
                    @click.stop
                  >
                    <div class="flex flex-col gap-2">
                      <!-- Actor Stage Row -->
                      <div class="flex items-center justify-between gap-3">
                        <div class="flex flex-col">
                          <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-100">
                            Actor Stage
                          </span>
                          <span class="text-[10px] text-neutral-500 dark:text-neutral-400">
                            Standalone window
                          </span>
                        </div>
                        <SwitchRoot
                          :model-value="controlStripStore.stageEnabled"
                          :disabled="controlStripStore.stageDisabled"
                          :class="[
                            'relative h-5 w-9 inline-flex cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none',
                            'data-[state=checked]:bg-teal-500 data-[state=unchecked]:bg-neutral-300 dark:data-[state=unchecked]:bg-neutral-700',
                            controlStripStore.stageDisabled ? 'cursor-not-allowed opacity-50' : '',
                          ]"
                          @update:model-value="handleToggleStageWindow"
                        >
                          <SwitchThumb
                            class="pointer-events-none block size-3.5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 data-[state=checked]:translate-x-4.5 data-[state=unchecked]:translate-x-0.5"
                          />
                        </SwitchRoot>
                      </div>

                      <template v-if="isVrmModel">
                        <div class="h-px bg-neutral-200/60 dark:bg-neutral-800/80" />

                        <!-- Mate Engine Row -->
                        <div class="flex items-center justify-between gap-3">
                          <div class="flex flex-col">
                            <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-100">
                              Mate Engine
                            </span>
                            <span class="text-[10px] text-neutral-500 dark:text-neutral-400">
                              3D companion window
                            </span>
                          </div>
                          <SwitchRoot
                            :model-value="controlStripStore.stageMateEnabled"
                            class="relative h-5 w-9 inline-flex cursor-pointer items-center rounded-full transition-colors duration-200 data-[state=checked]:bg-teal-500 data-[state=unchecked]:bg-neutral-300 focus:outline-none dark:data-[state=unchecked]:bg-neutral-700"
                            @update:model-value="handleToggleStageMateWindow"
                          >
                            <SwitchThumb
                              class="pointer-events-none block size-3.5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 data-[state=checked]:translate-x-4.5 data-[state=unchecked]:translate-x-0.5"
                            />
                          </SwitchRoot>
                        </div>
                      </template>
                    </div>
                  </PopoverContent>
                </PopoverPortal>
              </PopoverRoot>
            </template>

            <div class="relative aspect-[3/4] w-full overflow-hidden border border-neutral-200/40 rounded-xl bg-transparent dark:border-neutral-800/40">
              <RendererStage
                :paused="dashboard.isCollapsed('stage')"
                :focus-at="{ x: 0, y: 0 }"
                :x-offset="stageXOffset"
                :y-offset="stageYOffset"
                :scale="stageScale"
                :show-background="false"
                :radial-menu-enabled="false"
                :draggable="true"
                :mouth-open-size="speakingState?.mouthOpenSize || 0"
                class="absolute inset-0 h-full w-full"
                @offset-change="handleStageOffsetChange"
                @scale-change="handleStageScaleChange"
              />
            </div>
          </ChatDashboardCard>

          <!-- 2. NAN0 COGNITION MODULE -->
          <ChatDashboardCard
            v-else-if="moduleId === 'nan0' && isNan0Active"
            title="Nan0 Cognition"
            icon="i-solar:cpu-bolt-bold-duotone"
            icon-color-class="text-cyan-500 dark:text-cyan-400"
            :collapsed="dashboard.isCollapsed('nan0')"
            @toggle="dashboard.toggleCollapse('nan0')"
          >
            <template #actions>
              <span class="text-[9px] text-neutral-400 font-mono uppercase">
                Active
              </span>
            </template>
            <ChatNan0CognitionPanel />
          </ChatDashboardCard>

          <!-- 3. MEMORIES MODULE -->
          <ChatDashboardCard
            v-else-if="moduleId === 'memories'"
            title="Memories"
            icon="i-solar:book-2-bold-duotone"
            icon-color-class="text-amber-500 dark:text-amber-400"
            :collapsed="dashboard.isCollapsed('memories')"
            @toggle="dashboard.toggleCollapse('memories')"
          >
            <template #actions>
              <button
                type="button"
                class="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-primary-500 font-bold transition hover:bg-primary-50 dark:hover:bg-primary-950/30"
                @click.stop="handleOpenJournal"
              >
                <div class="i-solar:add-circle-linear text-[10px]" />
                <span>New</span>
              </button>
            </template>

            <!-- Memories Content List -->
            <div class="flex flex-col gap-1.5">
              <template v-if="(interactiveAreaRef?.allTextEntries ?? []).length > 0">
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
                    <span class="shrink-0 opacity-70">{{ formatMonthDay ? formatMonthDay(entry.timestamp ?? 0) : '' }}</span>
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

                  <!-- Topic chip -->
                  <div
                    v-else-if="entry.type === 'topic'"
                    class="flex cursor-pointer items-center gap-1.5 border border-amber-200/30 rounded-lg bg-amber-50/30 px-2 py-1 text-[10px] text-amber-700 font-medium transition-colors dark:border-amber-800/30 hover:border-amber-300 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:border-amber-700"
                    @click="interactiveAreaRef?.openTextPreview?.(entry)"
                  >
                    <div class="i-solar:tag-bold-duotone shrink-0 text-[10px]" />
                    <span class="truncate">{{ entry.content }}</span>
                  </div>

                  <!-- STMM Daily Summary card -->
                  <div
                    v-else-if="entry.type === 'auto'"
                    class="flex flex-col cursor-pointer gap-1 border border-primary-200/30 rounded-lg bg-primary-50/30 p-2 transition-colors dark:border-primary-800/30 hover:border-primary-300 dark:bg-primary-950/20 dark:hover:border-primary-700"
                    @click="interactiveAreaRef?.openTextPreview?.({
                      ...entry,
                      title: getMemoryEntryTitle(entry),
                    })"
                  >
                    <div class="flex items-center gap-1.5 text-[10px] text-primary-500 font-bold uppercase dark:text-primary-400">
                      <span>{{ formatMonthDay ? formatMonthDay(entry.timestamp ?? 0) : '' }}</span>
                      <span class="i-solar:dna-bold-duotone text-[10px]" />
                      <span>Daily Summary</span>
                    </div>
                    <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">
                      {{ getMemoryEntryTitle(entry) }}
                    </span>
                    <p class="line-clamp-2 text-[10px] text-neutral-600 leading-relaxed dark:text-neutral-400">
                      {{ formatMemorySnippet(entry.content) }}
                    </p>
                  </div>

                  <!-- Manual Journal card -->
                  <div
                    v-else-if="entry.type === 'manual'"
                    class="flex flex-col cursor-pointer gap-1 border border-emerald-200/30 rounded-lg bg-emerald-50/30 p-2 transition-colors dark:border-emerald-800/30 hover:border-emerald-300 dark:bg-emerald-950/20 dark:hover:border-emerald-700"
                    @click="interactiveAreaRef?.openTextPreview?.(entry)"
                  >
                    <div class="flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold uppercase dark:text-emerald-400">
                      <span>{{ formatMonthDay ? formatMonthDay(entry.timestamp ?? 0) : '' }}</span>
                      <span class="i-solar:notebook-bold-duotone text-[10px]" />
                      <span>Journal</span>
                    </div>
                    <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">{{ entry.title }}</span>
                    <p class="line-clamp-2 text-[10px] text-neutral-500 leading-relaxed dark:text-neutral-400">
                      {{ formatMemorySnippet(entry.content) }}
                    </p>
                  </div>
                </template>
              </template>
              <div v-else class="py-3 text-center text-[10px] text-neutral-400 italic">
                No memories recorded yet
              </div>
            </div>
          </ChatDashboardCard>

          <!-- 4. CURRENT SCENE MODULE -->
          <ChatDashboardCard
            v-else-if="moduleId === 'scene'"
            title="Current Scene"
            icon="i-solar:gallery-bold-duotone"
            icon-color-class="text-sky-500 dark:text-sky-400"
            :collapsed="dashboard.isCollapsed('scene')"
            @toggle="dashboard.toggleCollapse('scene')"
          >
            <div v-if="(interactiveAreaRef?.allImageEntries ?? []).length > 0" class="flex flex-col">
              <div
                class="group relative aspect-[3/2] w-full cursor-pointer overflow-hidden border border-neutral-200/60 rounded-xl bg-neutral-200/50 transition-all dark:border-neutral-800/60 hover:border-primary-400 dark:bg-neutral-800/50 dark:hover:border-primary-500"
                @click="interactiveAreaRef?.openImagePreview?.((interactiveAreaRef?.allImageEntries ?? [])[0])"
              >
                <img
                  v-if="(interactiveAreaRef?.allImageEntries ?? [])[0]?.url"
                  :src="(interactiveAreaRef?.allImageEntries ?? [])[0]?.url"
                  class="h-full w-full object-cover"
                >
                <div class="absolute inset-0 flex items-end from-black/60 to-transparent bg-gradient-to-t p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <span class="truncate text-[9px] text-white font-medium leading-tight">
                    {{ (interactiveAreaRef?.allImageEntries ?? [])[0]?.title }}
                  </span>
                </div>
              </div>
            </div>
            <div
              v-else
              class="h-16 w-full flex items-center justify-center border border-neutral-200/60 rounded-xl border-dashed bg-neutral-100/40 text-[10px] text-neutral-400 dark:border-neutral-800/60 dark:bg-neutral-900/30"
            >
              No scene set
            </div>
          </ChatDashboardCard>

          <!-- 5. MEDIA GALLERY MODULE -->
          <ChatDashboardCard
            v-else-if="moduleId === 'media'"
            title="Media Gallery"
            icon="i-solar:album-bold-duotone"
            icon-color-class="text-violet-500 dark:text-violet-400"
            :collapsed="dashboard.isCollapsed('media')"
            @toggle="dashboard.toggleCollapse('media')"
          >
            <template #actions>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  class="select-none text-[10px] text-primary-500 font-bold transition-colors hover:text-primary-600"
                  @click.stop="interactiveAreaRef?.openImagineDialog?.()"
                >
                  + Add
                </button>
                <button
                  type="button"
                  class="select-none text-[10px] text-neutral-400 font-bold transition-colors hover:text-neutral-600"
                  @click.stop="interactiveAreaRef?.openBackgroundDialog?.()"
                >
                  View All
                </button>
              </div>
            </template>

            <!-- Media Grid -->
            <div class="flex flex-col gap-2">
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
                  <div class="absolute inset-0 flex items-end from-black/50 to-transparent bg-gradient-to-t p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <span class="truncate text-[8px] text-white font-medium leading-tight">{{ entry.title }}</span>
                  </div>
                </div>
              </div>

              <button
                v-if="(interactiveAreaRef?.allImageEntries ?? []).length > mediaDisplayCount"
                type="button"
                class="w-full flex cursor-pointer items-center justify-center gap-1 border border-neutral-200/60 rounded-xl bg-neutral-50/50 py-1.5 text-[10px] text-neutral-500 font-bold tracking-wider uppercase transition-all dark:border-neutral-800/60 hover:text-primary-500"
                @click="mediaDisplayCount += 12"
              >
                <span>View More</span>
                <span class="i-solar:alt-arrow-down-bold text-[8px]" />
              </button>
            </div>
          </ChatDashboardCard>

          <!-- 6. WIDGETS MODULE -->
          <ChatDashboardCard
            v-else-if="moduleId === 'widgets'"
            title="Widgets"
            icon="i-solar:widget-5-bold-duotone"
            icon-color-class="text-emerald-500 dark:text-emerald-400"
            :badge="activeWidgetsCount > 0 ? activeWidgetsCount : undefined"
            :collapsed="dashboard.isCollapsed('widgets')"
            @toggle="dashboard.toggleCollapse('widgets')"
          >
            <ChatWorkspaceWidgetsPanel />
          </ChatDashboardCard>

          <!-- 7. VIRTUAL TERMINAL MODULE -->
          <ChatDashboardCard
            v-else-if="moduleId === 'terminal' && effectiveSandboxActive"
            title="Virtual Terminal"
            :image="getModuleDef('terminal')?.image"
            icon="i-solar:code-square-bold-duotone"
            icon-color-class="text-emerald-600 dark:text-emerald-400"
            :collapsed="dashboard.isCollapsed('terminal')"
            @toggle="dashboard.toggleCollapse('terminal')"
          >
            <template #actions>
              <span class="text-[9px] text-neutral-400 font-mono uppercase">
                /workspace
              </span>
            </template>
            <ChatWorkspaceTerminalPanel />
          </ChatDashboardCard>
        </template>

        <!-- '+ Add Module' Footer Action -->
        <button
          type="button"
          :class="[
            'flex cursor-pointer items-center justify-center gap-1.5 py-2.5 rounded-2xl',
            'border border-dashed border-neutral-300/80 dark:border-neutral-700/80',
            'bg-white/40 dark:bg-neutral-900/40 text-xs font-semibold text-neutral-500',
            'hover:border-primary-400 hover:text-primary-600 dark:hover:border-primary-500 dark:hover:text-primary-400',
            'transition-all duration-150 active:scale-[0.98]',
          ]"
          @click="dashboard.mode.value = 'customize'"
        >
          <div class="i-solar:add-circle-linear text-sm" />
          <span>Add module</span>
        </button>
      </div>

      <!-- ================= CUSTOMIZE VIEW MODE ================= -->
      <div v-else class="flex flex-col gap-4">
        <p class="px-0.5 text-[11px] text-neutral-400 font-medium dark:text-neutral-500">
          Drag to reorder. Hide what you don't use.
        </p>

        <!-- SECTION: ON YOUR DASHBOARD -->
        <div class="flex flex-col gap-2">
          <span class="select-none px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
            On Your Dashboard
          </span>

          <div class="flex flex-col gap-2">
            <template v-for="(moduleId, index) in dashboard.activeModuleIds.value" :key="moduleId">
              <!-- Live Drop Insertion Bar -->
              <div
                v-if="dropTargetIndex === index"
                class="relative my-0.5 h-1 w-full flex items-center justify-center rounded-full bg-primary-500"
              >
                <div class="absolute size-2 rounded-full bg-primary-600" />
              </div>

              <!-- Reorderable Module Row -->
              <div
                draggable="true"
                :class="[
                  'group flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-move',
                  'border-neutral-200/60 dark:border-neutral-800/60 bg-white/80 dark:bg-neutral-900/80 shadow-xs backdrop-blur-sm',
                  draggedIndex === index ? 'opacity-40 scale-95 border-dashed border-primary-500' : 'hover:border-neutral-300 dark:hover:border-neutral-700',
                ]"
                @dragstart="handleDragStart(index)"
                @dragover="e => handleDragOver(e, index)"
                @drop="handleDrop(index)"
                @dragend="handleDragEnd"
              >
                <!-- Drag handle & Module Info -->
                <div class="flex items-center gap-2.5">
                  <div class="i-solar:menu-dots-circle-bold-duotone shrink-0 text-sm text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-200" />
                  <img
                    v-if="getModuleDef(moduleId)?.image"
                    :src="getModuleDef(moduleId)?.image"
                    class="size-4 shrink-0 rounded object-contain"
                  >
                  <div
                    v-else
                    :class="[getModuleDef(moduleId)?.icon, getModuleDef(moduleId)?.iconColorClass || 'text-primary-500', 'text-base shrink-0']"
                  />
                  <div class="flex flex-col text-left">
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs text-neutral-800 font-bold leading-tight dark:text-neutral-100">
                        {{ getModuleDef(moduleId)?.title }}
                      </span>
                      <div
                        v-if="getModuleUnavailableReason(moduleId)"
                        class="size-3.5 flex cursor-help items-center justify-center rounded-full bg-amber-500/15 text-amber-500 dark:bg-amber-500/25 dark:text-amber-400"
                        :title="getModuleUnavailableReason(moduleId)!"
                      >
                        <div class="i-solar:danger-triangle-bold text-[10px]" />
                      </div>
                    </div>
                    <span class="text-[10px] text-neutral-400 leading-tight dark:text-neutral-500">
                      {{ getModuleDef(moduleId)?.subtitle }}
                    </span>
                  </div>
                </div>

                <!-- Move & Hide Actions -->
                <div class="flex items-center gap-1">
                  <!-- Keyboard accessible Up / Down -->
                  <button
                    type="button"
                    :disabled="index === 0"
                    class="size-6 flex cursor-pointer items-center justify-center rounded text-neutral-400 disabled:cursor-not-allowed hover:text-neutral-600 disabled:opacity-30 dark:hover:text-neutral-200"
                    title="Move up"
                    @click="dashboard.moveModuleByStep(moduleId, 'up')"
                  >
                    <div class="i-solar:alt-arrow-up-linear text-[10px]" />
                  </button>
                  <button
                    type="button"
                    :disabled="index === dashboard.activeModuleIds.value.length - 1"
                    class="size-6 flex cursor-pointer items-center justify-center rounded text-neutral-400 disabled:cursor-not-allowed hover:text-neutral-600 disabled:opacity-30 dark:hover:text-neutral-200"
                    title="Move down"
                    @click="dashboard.moveModuleByStep(moduleId, 'down')"
                  >
                    <div class="i-solar:alt-arrow-down-linear text-[10px]" />
                  </button>

                  <!-- Eye-off / Hide button -->
                  <button
                    type="button"
                    :class="[
                      'size-7 flex cursor-pointer items-center justify-center rounded-lg text-neutral-400 transition-colors',
                      'hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200',
                    ]"
                    title="Hide module"
                    @click="handleHideModule(moduleId)"
                  >
                    <div class="i-solar:eye-closed-linear text-sm" />
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- SECTION: AVAILABLE MODULES -->
        <div v-if="dashboard.availableModules.value.length > 0" class="flex flex-col gap-2 pt-2">
          <span class="select-none px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
            Available Modules
          </span>

          <div class="flex flex-col gap-2">
            <div
              v-for="mod in dashboard.availableModules.value"
              :key="mod.id"
              class="shadow-2xs flex items-center justify-between border border-neutral-200/50 rounded-xl bg-white/50 p-2.5 backdrop-blur-sm dark:border-neutral-800/50 dark:bg-neutral-900/50"
            >
              <div class="flex items-center gap-2.5">
                <div class="size-8 flex shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
                  <img
                    v-if="mod.image"
                    :src="mod.image"
                    class="size-5 rounded object-contain"
                  >
                  <div
                    v-else
                    :class="[mod.icon, mod.iconColorClass || 'text-primary-500', 'text-base']"
                  />
                </div>
                <div class="flex flex-col text-left">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs text-neutral-800 font-bold leading-tight dark:text-neutral-100">
                      {{ mod.title }}
                    </span>
                    <div
                      v-if="getModuleUnavailableReason(mod.id)"
                      class="size-3.5 flex cursor-help items-center justify-center rounded-full bg-amber-500/15 text-amber-500 dark:bg-amber-500/25 dark:text-amber-400"
                      :title="getModuleUnavailableReason(mod.id)!"
                    >
                      <div class="i-solar:danger-triangle-bold text-[10px]" />
                    </div>
                  </div>
                  <span class="text-[10px] text-neutral-400 leading-tight dark:text-neutral-500">
                    {{ mod.subtitle }}
                  </span>
                </div>
              </div>

              <!-- + Add Button -->
              <button
                type="button"
                :class="[
                  'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                  'border border-neutral-200/60 text-neutral-700 hover:border-primary-400 hover:text-primary-600',
                  'dark:border-neutral-700/60 dark:text-neutral-300 dark:hover:border-primary-500 dark:hover:text-primary-400',
                  'hover:bg-primary-50/50 dark:hover:bg-primary-950/20 active:scale-95',
                ]"
                @click="handleAddModule(mod.id)"
              >
                <div class="i-solar:add-circle-linear text-xs" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Restore Default Layout Action -->
        <div class="flex items-center justify-center pt-2">
          <button
            type="button"
            class="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-400 font-medium transition hover:text-neutral-600 dark:hover:text-neutral-300"
            @click="handleRestoreDefaults"
          >
            <div class="i-solar:restart-linear text-xs" />
            <span>Restore default layout</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
