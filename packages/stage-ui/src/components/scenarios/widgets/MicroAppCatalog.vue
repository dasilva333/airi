<script setup lang="ts">
import type { PersistedWidget } from '../../../libs/sandbox'
import type { WidgetExportManifest } from '../../../libs/sandbox/export'

import { useLocalStorage } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import starterDailyChecklistIcon from '../../../assets/widgets/starter-daily-checklist.avif'
import starterFocusTimerIcon from '../../../assets/widgets/starter-focus-timer.avif'
import starterHavenWeatherIcon from '../../../assets/widgets/starter-haven-weather.avif'
import starterHoneyNotesIcon from '../../../assets/widgets/starter-honey-notes.avif'
import starterStrawberryPetIcon from '../../../assets/widgets/starter-strawberry-pet.avif'

import { useSandbox } from '../../../composables/use-sandbox'
import {
  copyWidgetManifestToClipboard,
  downloadWidgetManifestFile,
} from '../../../libs/sandbox'
import { BUNDLED_STARTER_WIDGETS } from '../../../libs/sandbox/starters'

const props = withDefaults(defineProps<{
  compact?: boolean
  showHeader?: boolean
  showCloseButton?: boolean
  defaultSurface?: 'panel' | 'widget'
}>(), {
  compact: false,
  showHeader: true,
  showCloseButton: false,
  defaultSurface: 'panel',
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', widgetId: string): void
  (e: 'mount', widgetId: string): void
}>()

const {
  mountedWidgets,
  unmountWidget,
  mountPersistedWidget,
  getPersistedWidgets,
  deletePersistedWidget,
  importWidget,
  setWidgetSurface,
} = useSandbox()

const selectedWidgetId = useLocalStorage<string>('airi:widgets:selected-id', '')
const isCatalogLoading = ref(false)
const persistedCatalog = ref<PersistedWidget[]>([])
const importFileInputRef = ref<HTMLInputElement | null>(null)
const isDraggingOver = ref(false)
const searchQuery = ref('')
const activeMenuWidgetId = ref<string | null>(null)
const activeStarterMenuId = ref<string | null>(null)

interface StarterSlot {
  id: string
  title: string
  subtitle: string
  iconUrl?: string
  iconClass?: string
  accentBg: string
  manifest?: WidgetExportManifest
  isCustomSlot?: boolean
}

/**
 * Presentation metadata for known starters, keyed by manifest id.
 *
 * The slot list itself is derived from `BUNDLED_STARTER_WIDGETS`, so adding a
 * starter never requires editing this component again — an unlisted starter
 * still appears, just with a default icon and its manifest title.
 */
const STARTER_META: Record<string, Omit<StarterSlot, 'id' | 'manifest' | 'isCustomSlot'>> = {
  'starter-live2d-menu-driver': {
    title: 'Live2D Controller (Generic)',
    subtitle: 'Model gimmick deck',
    iconClass: 'i-carbon:game-wireless text-cyan-500',
    accentBg: 'bg-cyan-100/70 dark:bg-cyan-950/40 border border-cyan-200/50 dark:border-cyan-900/30',
  },
  'starter-strawberry-pet': {
    title: 'Strawberry Pet',
    subtitle: 'Desk companion',
    iconUrl: starterStrawberryPetIcon,
    accentBg: 'bg-pink-100/70 dark:bg-pink-950/40 border border-pink-200/50 dark:border-pink-900/30',
  },
  'starter-focus-timer': {
    title: 'Focus Timer',
    subtitle: 'Focus countdown',
    iconUrl: starterFocusTimerIcon,
    accentBg: 'bg-amber-100/70 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-900/30',
  },
  'starter-daily-checklist': {
    title: 'Daily Checklist',
    subtitle: 'Daily task list',
    iconUrl: starterDailyChecklistIcon,
    accentBg: 'bg-sky-100/70 dark:bg-sky-950/40 border border-sky-200/50 dark:border-sky-900/30',
  },
  'starter-honey-notes': {
    title: 'Honey Notes',
    subtitle: 'Quick memos',
    iconUrl: starterHoneyNotesIcon,
    accentBg: 'bg-yellow-100/70 dark:bg-yellow-950/40 border border-yellow-200/50 dark:border-yellow-900/30',
  },
  'starter-haven-weather': {
    title: 'Haven Weather',
    subtitle: 'Local forecast',
    iconUrl: starterHavenWeatherIcon,
    accentBg: 'bg-blue-100/70 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-900/30',
  },
  'starter-glyphs-audio-works': {
    title: 'Glyph\'s Audio Works',
    subtitle: 'Music order tracker',
    iconClass: 'i-solar:music-notes-bold-duotone text-fuchsia-500',
    accentBg: 'bg-fuchsia-100/70 dark:bg-fuchsia-950/40 border border-fuchsia-200/50 dark:border-fuchsia-900/30',
  },
}

const STARTER_SLOTS: StarterSlot[] = [
  ...BUNDLED_STARTER_WIDGETS.map((manifest) => {
    const meta = STARTER_META[manifest.id]
    return {
      id: manifest.id,
      title: meta?.title || manifest.title,
      subtitle: meta?.subtitle || 'Starter widget',
      iconUrl: meta?.iconUrl,
      iconClass: meta?.iconClass || 'i-solar:widget-5-bold-duotone text-fuchsia-500',
      accentBg: meta?.accentBg || 'bg-neutral-100/70 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-800/30',
      manifest,
    }
  }),
  {
    id: 'starter-custom-widget',
    title: 'Custom Widget',
    subtitle: 'Import your own',
    accentBg: 'bg-[#eaf6ec] dark:bg-emerald-950/40 border border-[#cbe8cf] dark:border-emerald-800/40 text-[#2b7a3e] dark:text-emerald-400',
    isCustomSlot: true,
  },
]

const filteredPersistedCatalog = computed(() => {
  if (!searchQuery.value.trim())
    return persistedCatalog.value
  const q = searchQuery.value.toLowerCase().trim()
  return persistedCatalog.value.filter(w =>
    (w.title && w.title.toLowerCase().includes(q))
    || (w.sourcePath && w.sourcePath.toLowerCase().includes(q))
    || (w.path && w.path.toLowerCase().includes(q)),
  )
})

function closeAllMenus() {
  activeMenuWidgetId.value = null
  activeStarterMenuId.value = null
}

function toggleWidgetMenu(id: string) {
  activeStarterMenuId.value = null
  activeMenuWidgetId.value = activeMenuWidgetId.value === id ? null : id
}

function toggleStarterMenu(id: string) {
  activeMenuWidgetId.value = null
  activeStarterMenuId.value = activeStarterMenuId.value === id ? null : id
}

async function refreshCatalog() {
  isCatalogLoading.value = true
  try {
    persistedCatalog.value = await getPersistedWidgets()
  }
  finally {
    isCatalogLoading.value = false
  }
}

onMounted(() => {
  void refreshCatalog()
})

function isStarterMounted(starter?: WidgetExportManifest): boolean {
  if (!starter)
    return false
  return mountedWidgets.value.some(m =>
    m.id === starter.id
    || m.title === starter.title
    || m.path === starter.sourcePath?.replace(/\.ts$/, '.js'),
  )
}

function isWidgetMounted(widget: PersistedWidget): boolean {
  return mountedWidgets.value.some(m => m.id === widget.id || m.path === widget.path)
}

async function handleInstallStarter(starter?: WidgetExportManifest) {
  closeAllMenus()
  if (!starter)
    return
  const found = mountedWidgets.value.find(m =>
    m.id === starter.id
    || m.title === starter.title
    || m.path === starter.sourcePath?.replace(/\.ts$/, '.js'),
  )
  if (found) {
    selectedWidgetId.value = found.id
    emit('select', found.id)
    emit('close')
    return
  }
  try {
    const targetSurface = props.defaultSurface === 'widget' ? 'widget' : (starter.surface || 'panel')
    const imported = await importWidget({
      ...starter,
      surface: targetSurface,
    }, { mount: true })
    selectedWidgetId.value = imported.id
    await refreshCatalog()
    emit('mount', imported.id)
    emit('close')
    toast.success(`Added "${starter.title}"`)
  }
  catch (err: any) {
    toast.error(`Failed to add starter: ${err.message}`)
  }
}

async function handleUnmountStarter(starter?: WidgetExportManifest) {
  closeAllMenus()
  if (!starter)
    return
  const found = mountedWidgets.value.find(m =>
    m.id === starter.id
    || m.title === starter.title
    || m.path === starter.sourcePath?.replace(/\.ts$/, '.js'),
  )
  if (found) {
    unmountWidget(found.id)
    await refreshCatalog()
    toast.info(`Unmounted "${starter.title}"`)
  }
}

async function handleMountWidget(widget: PersistedWidget) {
  closeAllMenus()
  const targetSurface = props.defaultSurface === 'widget' ? 'widget' : (widget.surface || 'panel')
  await mountPersistedWidget(widget.id, targetSurface)
  if (props.defaultSurface === 'widget') {
    await setWidgetSurface(widget.id, 'widget')
  }
  selectedWidgetId.value = widget.id
  await refreshCatalog()
  emit('mount', widget.id)
  emit('close')
}

async function handleSelectWidget(widget: PersistedWidget) {
  closeAllMenus()
  selectedWidgetId.value = widget.id
  emit('select', widget.id)
  emit('close')
}

async function handleUnmountWidget(widget: PersistedWidget) {
  closeAllMenus()
  unmountWidget(widget.id)
  await refreshCatalog()
}

async function handleDeleteWidget(widget: PersistedWidget) {
  closeAllMenus()
  await deletePersistedWidget(widget.id)
  await refreshCatalog()
  toast.success(`Deleted "${widget.title || 'Widget'}"`)
}

function triggerImportFilePicker() {
  closeAllMenus()
  importFileInputRef.value?.click()
}

async function handleImportFiles(files: FileList | File[]) {
  closeAllMenus()
  if (!files || files.length === 0)
    return
  let lastImported: PersistedWidget | null = null
  let successCount = 0
  for (const file of Array.from(files)) {
    if (!file.name.endsWith('.json') && file.type !== 'application/json')
      continue
    try {
      const text = await file.text()
      const imported = await importWidget(text, { mount: true })
      if (props.defaultSurface === 'widget') {
        await setWidgetSurface(imported.id, 'widget')
      }
      lastImported = imported
      successCount++
    }
    catch (err: any) {
      console.error('[MicroAppCatalog] Failed to import widget file:', file.name, err)
      toast.error(`Failed to import "${file.name}": ${err.message || 'Invalid format'}`)
    }
  }
  if (lastImported) {
    selectedWidgetId.value = lastImported.id
    await refreshCatalog()
    emit('mount', lastImported.id)
    emit('close')
    if (successCount === 1) {
      toast.success(`Imported and mounted "${lastImported.title}"`)
    }
    else {
      toast.success(`Successfully imported ${successCount} widgets`)
    }
  }
}

async function handleImportFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files) {
    await handleImportFiles(input.files)
    input.value = ''
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDraggingOver.value = true
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  isDraggingOver.value = false
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDraggingOver.value = false
  if (e.dataTransfer?.files) {
    await handleImportFiles(e.dataTransfer.files)
  }
}

async function handleExportCatalogWidget(widget: PersistedWidget, event?: MouseEvent) {
  closeAllMenus()
  if (event?.shiftKey || event?.altKey) {
    downloadWidgetManifestFile(widget)
    toast.success(`Downloaded "${widget.title || 'Widget'}" manifest (.json)`)
    return
  }

  const copied = await copyWidgetManifestToClipboard(widget)
  if (copied) {
    toast.success(`Copied "${widget.title || 'Widget'}" JSON to clipboard!`, {
      action: {
        label: 'Download .json',
        onClick: () => downloadWidgetManifestFile(widget),
      },
    })
  }
  else {
    downloadWidgetManifestFile(widget)
    toast.info(`Downloaded "${widget.title || 'Widget'}" manifest (.json)`)
  }
}

function getWidgetIcon(widget: PersistedWidget) {
  const name = (widget.title || widget.sourcePath || widget.path || '').toLowerCase()
  if (name.includes('strawberry') || name.includes('pet'))
    return { type: 'img', url: starterStrawberryPetIcon, bg: 'bg-pink-100/70 dark:bg-pink-950/40 border border-pink-200/50' }
  if (name.includes('timer') || name.includes('focus'))
    return { type: 'img', url: starterFocusTimerIcon, bg: 'bg-amber-100/70 dark:bg-amber-950/40 border border-amber-200/50' }
  if (name.includes('check') || name.includes('task'))
    return { type: 'img', url: starterDailyChecklistIcon, bg: 'bg-sky-100/70 dark:bg-sky-950/40 border border-sky-200/50' }
  if (name.includes('honey') || name.includes('note'))
    return { type: 'img', url: starterHoneyNotesIcon, bg: 'bg-yellow-100/70 dark:bg-yellow-950/40 border border-yellow-200/50' }
  if (name.includes('weather'))
    return { type: 'img', url: starterHavenWeatherIcon, bg: 'bg-blue-100/70 dark:bg-blue-950/40 border border-blue-200/50' }
  return { type: 'icon', icon: 'i-solar:widget-bold-duotone', bg: 'bg-emerald-100/60 dark:bg-emerald-950/40 border border-emerald-200/50 text-emerald-600 dark:text-emerald-400' }
}

function formatDate(timestamp?: number): string {
  if (!timestamp)
    return ''
  const date = new Date(timestamp)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <div
    :class="[
      'relative flex flex-col h-full min-h-0 w-full overflow-hidden select-none text-neutral-800 dark:text-neutral-100 transition-all',
    ]"
    @click="closeAllMenus"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- Hidden file input for widget JSON import -->
    <input
      ref="importFileInputRef"
      type="file"
      accept=".json,application/json"
      multiple
      class="hidden"
      @change="handleImportFileChange"
    >

    <!-- Drag overlay indicator -->
    <div
      v-if="isDraggingOver"
      class="backdrop-blur-xs pointer-events-none absolute inset-0 z-50 flex items-center justify-center border-2 border-primary-500 rounded-3xl border-dashed bg-primary-500/10"
    >
      <div class="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-primary-600 font-bold shadow-lg dark:bg-neutral-900 dark:text-primary-300">
        <span class="i-solar:import-bold-duotone text-lg" />
        <span>Drop .json manifest to import</span>
      </div>
    </div>

    <!-- Header Area -->
    <div
      v-if="props.showHeader"
      class="flex shrink-0 items-center justify-between px-5 pb-3 pt-4"
    >
      <div class="flex items-center gap-3">
        <div class="size-9.5 flex shrink-0 items-center justify-center border border-[#d2ead7] rounded-2xl bg-[#e6f4ea] text-[#2b7a3e] dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span class="i-solar:widget-add-bold text-lg" />
        </div>
        <div>
          <h3 class="text-sm text-neutral-900 font-bold leading-tight dark:text-neutral-100">
            Micro-App Library
          </h3>
          <p class="text-xs text-neutral-500 leading-tight dark:text-neutral-400">
            Start with a widget, then make it your own.
          </p>
        </div>
      </div>
      <div class="flex items-center gap-1.5">
        <button
          v-if="props.showCloseButton"
          type="button"
          class="size-7.5 flex cursor-pointer items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-colors dark:bg-neutral-800/80 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
          @click="emit('close')"
        >
          <div class="i-carbon:close text-sm" />
        </button>
      </div>
    </div>

    <!-- Scrollable Main Content -->
    <div
      :class="[
        'flex-1 min-h-0 overflow-y-auto space-y-4 sm:space-y-5',
        props.showHeader ? 'px-4 sm:px-5 py-2' : 'px-0 py-1',
      ]"
    >
      <!-- Starter Widgets Section (3x2 Desktop, 2-Col Mobile) -->
      <div class="space-y-2.5">
        <div class="flex items-center justify-between px-0.5">
          <span class="text-sm text-neutral-900 font-bold dark:text-neutral-100">
            Starter widgets
          </span>
          <span class="text-xs text-neutral-400 font-normal dark:text-neutral-500">
            {{ STARTER_SLOTS.filter(s => !s.isCustomSlot).length }} ready to try
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
          <div
            v-for="item in STARTER_SLOTS"
            :key="item.id"
            :class="[
              'relative flex flex-col justify-between rounded-2xl p-2.5 sm:p-3 transition-all duration-200 select-none group',
              item.isCustomSlot
                ? 'border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/50 hover:bg-neutral-100/70 dark:bg-neutral-900/30 dark:hover:bg-neutral-800/40 cursor-pointer'
                : isStarterMounted(item.manifest)
                  ? 'border-2 border-[#7fc98b] dark:border-emerald-500/60 bg-[#f7fcf8] dark:bg-emerald-950/15 shadow-2xs'
                  : 'border border-neutral-200/80 dark:border-neutral-800/80 bg-white hover:bg-neutral-50/70 dark:bg-neutral-900/90 dark:hover:bg-neutral-800/60 shadow-2xs',
            ]"
            @click="item.isCustomSlot ? triggerImportFilePicker() : undefined"
          >
            <!-- Top: Icon Badge -->
            <div class="flex items-start justify-between">
              <div
                :class="[
                  'size-10 sm:size-11 flex items-center justify-center rounded-xl sm:rounded-2xl p-1.5 sm:p-2 shrink-0 transition-transform duration-200 group-hover:scale-105',
                  item.accentBg,
                ]"
              >
                <template v-if="item.isCustomSlot">
                  <div class="i-carbon:add text-xl font-bold sm:text-2xl" />
                </template>
                <template v-else-if="item.iconUrl">
                  <img
                    :src="item.iconUrl"
                    :alt="item.title"
                    class="pointer-events-none size-full select-none object-contain"
                    loading="lazy"
                  >
                </template>
                <template v-else-if="item.iconClass">
                  <div :class="[item.iconClass, 'text-xl sm:text-2xl']" />
                </template>
              </div>
            </div>

            <!-- Middle: Title & Subtitle -->
            <div class="my-2 min-w-0 flex-1">
              <div
                :class="[
                  'text-xs sm:text-[13px] text-neutral-900 font-bold leading-snug dark:text-neutral-100',
                  'line-clamp-1 break-words',
                ]"
                :title="item.title"
              >
                {{ item.title }}
              </div>
              <div
                :class="[
                  'mt-0.5 text-[11px] text-neutral-500 leading-tight dark:text-neutral-400',
                  'line-clamp-1',
                ]"
                :title="item.subtitle"
              >
                {{ item.subtitle }}
              </div>
            </div>

            <!-- Bottom: Action Controls -->
            <div class="pt-1">
              <template v-if="!item.isCustomSlot">
                <!-- If Unmounted: Softer + Add Button -->
                <button
                  v-if="!isStarterMounted(item.manifest)"
                  type="button"
                  :class="[
                    'w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors duration-150',
                    'border border-[#d2ead7] bg-[#f0f9f2] text-[#2b7a3e] hover:bg-[#e4f4e7] dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40',
                  ]"
                  @click.stop="handleInstallStarter(item.manifest)"
                >
                  <div class="i-carbon:add shrink-0 text-xs font-bold" />
                  <span>Add</span>
                </button>

                <!-- If Active: Clean View + Overflow ... Button -->
                <div v-else class="relative flex items-center gap-1.5">
                  <button
                    type="button"
                    :class="[
                      'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors duration-150',
                      'border border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700',
                    ]"
                    @click.stop="handleInstallStarter(item.manifest)"
                  >
                    <span class="i-solar:eye-bold text-sm text-[#2b7a3e] dark:text-emerald-400" />
                    <span>View</span>
                  </button>

                  <button
                    type="button"
                    title="Widget options"
                    :class="[
                      'size-8 flex items-center justify-center rounded-xl text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 cursor-pointer transition-colors shrink-0',
                      'border border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700',
                    ]"
                    @click.stop="toggleStarterMenu(item.id)"
                  >
                    <span class="i-solar:menu-dots-bold text-xs" />
                  </button>

                  <!-- Popover Menu for Starter -->
                  <div
                    v-if="activeStarterMenuId === item.id"
                    class="absolute bottom-full right-0 z-30 mb-1 w-32 select-none border border-neutral-200 rounded-xl bg-white py-1 text-xs shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
                    @click.stop
                  >
                    <button
                      type="button"
                      class="w-full flex cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      @click="handleUnmountStarter(item.manifest)"
                    >
                      <span class="i-solar:close-circle-linear text-sm" />
                      <span>Unmount</span>
                    </button>
                  </div>
                </div>
              </template>

              <!-- Custom Widget Slot Button -->
              <template v-else>
                <button
                  type="button"
                  :class="[
                    'w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors duration-150',
                    'border border-[#d2ead7] bg-[#f0f9f2] text-[#2b7a3e] hover:bg-[#e4f4e7] dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40',
                  ]"
                  @click.stop="triggerImportFilePicker"
                >
                  <div class="i-solar:upload-minimalistic-linear shrink-0 text-xs" />
                  <span class="truncate">Import</span>
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Saved Widgets Section -->
      <div class="space-y-3">
        <!-- Section Header with Search Bar -->
        <div class="flex items-center justify-between gap-3 px-0.5">
          <div class="flex items-center gap-2">
            <span class="text-sm text-neutral-900 font-bold dark:text-neutral-100">
              Saved widgets
            </span>
            <span class="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 font-medium dark:bg-neutral-800 dark:text-neutral-400">
              {{ persistedCatalog.length }}
            </span>
          </div>

          <!-- Search widgets input -->
          <div class="relative w-44 sm:w-56">
            <span class="i-solar:magnifer-linear pointer-events-none absolute left-2.5 top-1/2 text-xs text-neutral-400 -translate-y-1/2" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search widgets..."
              class="w-full border border-neutral-200 rounded-xl bg-white py-1.5 pl-7.5 pr-2.5 text-xs text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-[#7fc98b] placeholder-neutral-400"
            >
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="isCatalogLoading" class="flex flex-col items-center justify-center gap-2 py-8 text-neutral-400">
          <span class="i-solar:refresh-linear animate-spin text-xl text-primary-500" />
          <span class="text-xs">Loading widgets...</span>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="filteredPersistedCatalog.length === 0"
          class="flex flex-col items-center justify-center border border-neutral-200 rounded-2xl border-dashed py-6 text-center text-neutral-400 space-y-1 dark:border-neutral-800"
        >
          <p class="text-xs text-neutral-600 font-medium dark:text-neutral-400">
            {{ searchQuery ? 'No widgets match your search' : 'No custom micro-apps yet' }}
          </p>
          <p class="max-w-[240px] text-[11px] text-neutral-500">
            {{ searchQuery ? 'Try another search term or clear the filter' : 'Add a starter above or bring your own JSON widget.' }}
          </p>
        </div>

        <!-- Saved Widgets List -->
        <div v-else class="space-y-2.5">
          <div
            v-for="widget in filteredPersistedCatalog"
            :key="widget.id"
            :class="[
              'relative flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all duration-200 shadow-2xs',
              isWidgetMounted(widget)
                ? 'border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-neutral-900/90'
                : 'border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/80',
            ]"
          >
            <!-- Left: Icon & Meta -->
            <div class="min-w-0 flex flex-1 items-center gap-3">
              <div
                :class="[
                  'size-10 flex items-center justify-center rounded-2xl shrink-0 p-1.5',
                  getWidgetIcon(widget).bg,
                ]"
              >
                <img
                  v-if="getWidgetIcon(widget).type === 'img'"
                  :src="getWidgetIcon(widget).url"
                  :alt="widget.title"
                  class="pointer-events-none size-full select-none object-contain"
                >
                <span
                  v-else
                  :class="[getWidgetIcon(widget).icon, 'text-lg']"
                />
              </div>

              <div class="min-w-0 flex-1 space-y-0.5">
                <div class="truncate text-xs text-neutral-900 font-bold dark:text-neutral-100">
                  {{ widget.title || widget.path.split('/').pop() }}
                </div>
                <div class="truncate text-[11px] text-neutral-500 font-mono dark:text-neutral-400">
                  <span>{{ widget.sourcePath || widget.path }}</span>
                  <span v-if="widget.updatedAt" class="shrink-0 text-neutral-400 dark:text-neutral-500">
                    • {{ formatDate(widget.updatedAt) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Right: Action Buttons & Overflow Menu -->
            <div class="relative flex shrink-0 items-center gap-1.5">
              <!-- Add button if not mounted -->
              <button
                v-if="!isWidgetMounted(widget)"
                type="button"
                :class="[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors duration-150',
                  'border border-[#d2ead7] bg-[#f0f9f2] text-[#2b7a3e] hover:bg-[#e4f4e7] dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40',
                ]"
                @click="handleMountWidget(widget)"
              >
                <div class="i-carbon:add shrink-0 text-xs font-bold" />
                <span>Add</span>
              </button>

              <!-- View button if mounted -->
              <button
                v-else
                type="button"
                :class="[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors duration-150',
                  'border border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700',
                ]"
                @click="handleSelectWidget(widget)"
              >
                <span class="i-solar:eye-bold text-sm text-[#2b7a3e] dark:text-emerald-400" />
                <span>View</span>
              </button>

              <!-- Overflow Menu Button (...) -->
              <button
                type="button"
                title="More actions"
                :class="[
                  'size-8 flex items-center justify-center rounded-xl text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 cursor-pointer transition-colors',
                  'border border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700',
                ]"
                @click.stop="toggleWidgetMenu(widget.id)"
              >
                <span class="i-solar:menu-dots-bold text-xs" />
              </button>

              <!-- Overflow Menu Dropdown -->
              <div
                v-if="activeMenuWidgetId === widget.id"
                class="absolute bottom-full right-0 z-30 mb-1 w-38 select-none border border-neutral-200 rounded-xl bg-white py-1 text-xs shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
                @click.stop
              >
                <button
                  v-if="isWidgetMounted(widget)"
                  type="button"
                  class="w-full flex cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  @click="handleUnmountWidget(widget)"
                >
                  <span class="i-solar:close-circle-linear text-sm" />
                  <span>Unmount</span>
                </button>

                <button
                  type="button"
                  class="w-full flex cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  @click="handleExportCatalogWidget(widget, $event)"
                >
                  <span class="i-solar:copy-linear text-sm" />
                  <span>Copy JSON</span>
                </button>

                <button
                  type="button"
                  class="w-full flex cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  @click="downloadWidgetManifestFile(widget); closeAllMenus()"
                >
                  <span class="i-solar:download-linear text-sm" />
                  <span>Download .json</span>
                </button>

                <div class="my-1 border-t border-neutral-100 dark:border-neutral-800" />

                <button
                  type="button"
                  class="w-full flex cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-950/30"
                  @click="handleDeleteWidget(widget)"
                >
                  <span class="i-solar:trash-bin-trash-linear text-sm" />
                  <span>Delete widget</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
