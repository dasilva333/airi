<script setup lang="ts">
import type { MountedWidget, PersistedWidget } from '../../../libs/sandbox'

import { useLocalStorage } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useSandbox } from '../../../composables/use-sandbox'
import { buildWidgetIframeSrcdoc, copyWidgetManifestToClipboard, downloadWidgetManifestFile } from '../../../libs/sandbox'
import { tryGetMcpToolBridge } from '../../../stores/mcp-tool-bridge'

const props = withDefaults(defineProps<{
  fillContainer?: boolean
}>(), {
  fillContainer: false,
})

const {
  isReady,
  mountedWidgets,
  unmountWidget,
  clearWidgets,
  setWidgetSurface,
  readFile,
  mountPersistedWidget,
  getPersistedWidgets,
  deletePersistedWidget,
} = useSandbox()

const selectedWidgetId = useLocalStorage<string>('airi:widgets:selected-id', '')
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const iframeKey = ref(0)
const iframeHeight = ref(240)

// Micro-App Library State
const isLibraryOpen = ref(false)
const isCatalogLoading = ref(false)
const persistedCatalog = ref<PersistedWidget[]>([])

const activeWidget = computed<MountedWidget | null>(() => {
  if (mountedWidgets.value.length === 0)
    return null
  const found = mountedWidgets.value.find(w => w.id === selectedWidgetId.value)
  return found || mountedWidgets.value[mountedWidgets.value.length - 1]
})

// Auto-select newly added widget on mount or when a new widget arrives
const previousWidgetIds = ref<Set<string>>(new Set())

watch(() => mountedWidgets.value, (list) => {
  if (list.length > 0) {
    const hasCurrent = list.some(w => w.id === selectedWidgetId.value)
    const newWidget = list.find(w => !previousWidgetIds.value.has(w.id))

    if (newWidget && previousWidgetIds.value.size > 0) {
      selectedWidgetId.value = newWidget.id
    }
    else if (!hasCurrent) {
      selectedWidgetId.value = list[list.length - 1].id
    }
  }
  else if (isReady.value) {
    selectedWidgetId.value = ''
  }
  previousWidgetIds.value = new Set(list.map(w => w.id))
}, { immediate: true, deep: true })

async function openLibrary() {
  isLibraryOpen.value = true
  isCatalogLoading.value = true
  try {
    persistedCatalog.value = await getPersistedWidgets()
  }
  finally {
    isCatalogLoading.value = false
  }
}

function closeLibrary() {
  isLibraryOpen.value = false
}

function isWidgetMounted(widget: PersistedWidget): boolean {
  return mountedWidgets.value.some(m => m.id === widget.id || m.path === widget.path)
}

async function handleMountWidget(widget: PersistedWidget) {
  await mountPersistedWidget(widget.id)
  selectedWidgetId.value = widget.id
  closeLibrary()
}

async function handleSelectOrUnmount(widget: PersistedWidget) {
  if (selectedWidgetId.value === widget.id) {
    unmountWidget(widget.id)
    persistedCatalog.value = await getPersistedWidgets()
  }
  else {
    selectedWidgetId.value = widget.id
    closeLibrary()
  }
}

async function handleDeleteWidget(widget: PersistedWidget) {
  await deletePersistedWidget(widget.id)
  persistedCatalog.value = await getPersistedWidgets()
}

function formatDate(timestamp?: number): string {
  if (!timestamp)
    return ''
  const date = new Date(timestamp)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function handleExportWidget(event?: MouseEvent) {
  if (!activeWidget.value)
    return

  const target = activeWidget.value
  if (event?.shiftKey || event?.altKey) {
    downloadWidgetManifestFile(target)
    toast.success(`Downloaded "${target.title || 'Widget'}" manifest (.json)`)
    return
  }

  const copied = await copyWidgetManifestToClipboard(target)
  if (copied) {
    toast.success(`Copied "${target.title || 'Widget'}" JSON to clipboard!`, {
      action: {
        label: 'Download .json',
        onClick: () => downloadWidgetManifestFile(target),
      },
    })
  }
  else {
    downloadWidgetManifestFile(target)
    toast.info(`Downloaded "${target.title || 'Widget'}" manifest (.json)`)
  }
}

async function handleExportCatalogWidget(widget: PersistedWidget, event?: MouseEvent) {
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

async function toggleActiveWidgetSurface() {
  if (!activeWidget.value)
    return
  const nextSurface = activeWidget.value.surface === 'widget' ? 'panel' : 'widget'
  await setWidgetSurface(activeWidget.value.id, nextSurface)
}

const iframeSrcdoc = ref('')

async function refreshActiveWidget() {
  if (!activeWidget.value) {
    iframeSrcdoc.value = ''
    return
  }
  // Floated widgets render in FloatingWidgetsLayer; keep panel srcdoc empty.
  if (activeWidget.value.surface === 'widget') {
    iframeSrcdoc.value = ''
    return
  }
  isLoading.value = true
  errorMessage.value = null
  try {
    iframeSrcdoc.value = await buildWidgetIframeSrcdoc(activeWidget.value, readFile)
    iframeKey.value++
  }
  catch (err: any) {
    errorMessage.value = err.message || 'Failed to render widget'
  }
  finally {
    isLoading.value = false
  }
}

function handleIframeMessage(e: MessageEvent) {
  if (e.data?.type === 'widget-resize' && typeof e.data.height === 'number') {
    if (!props.fillContainer) {
      const targetHeight = Math.max(160, Math.min(Math.ceil(e.data.height), 520))
      if (Math.abs(iframeHeight.value - targetHeight) > 2) {
        iframeHeight.value = targetHeight
      }
    }
  }
  else if (e.data?.type === 'mcp-call') {
    const { id, name, args } = e.data
    const bridge = tryGetMcpToolBridge()
    const target = e.source as WindowProxy | null
    if (!bridge) {
      target?.postMessage({ type: 'mcp-call-result', id, error: 'MCP tool bridge not available' }, '*')
      return
    }
    bridge.callTool({ name, arguments: args })
      .then((res) => {
        if (res.isError) {
          target?.postMessage({ type: 'mcp-call-result', id, error: String(res.toolResult || 'MCP tool execution failed') }, '*')
        }
        else {
          target?.postMessage({ type: 'mcp-call-result', id, result: res.structuredContent ?? res.toolResult ?? res.content }, '*')
        }
      })
      .catch((err: any) => {
        target?.postMessage({ type: 'mcp-call-result', id, error: err.message || 'MCP tool error' }, '*')
      })
  }
}

watch([activeWidget, selectedWidgetId], () => {
  void refreshActiveWidget()
}, { immediate: true })

onMounted(() => {
  window.addEventListener('message', handleIframeMessage)
  void refreshActiveWidget()
})

onUnmounted(() => {
  window.removeEventListener('message', handleIframeMessage)
})
</script>

<template>
  <div
    :class="[
      'flex flex-col overflow-hidden text-neutral-800 dark:text-neutral-100 transition-all',
      props.fillContainer
        ? 'h-full w-full flex-1 min-h-0 bg-transparent'
        : 'border border-neutral-200/60 dark:border-primary-500/20 rounded-2xl bg-white/70 dark:bg-neutral-900/80 backdrop-blur-md shadow-xl p-2.5 gap-2',
    ]"
  >
    <!-- Active Widgets Header / Tabs & Action Bar -->
    <div
      :class="[
        'flex items-center justify-between gap-1 select-none shrink-0',
        props.fillContainer
          ? 'px-3 py-2 border-b border-neutral-200/40 dark:border-white/5 bg-transparent'
          : 'border-b border-neutral-200/40 dark:border-neutral-800/40 pb-1.5',
      ]"
    >
      <!-- Widget switcher pills -->
      <div class="no-scrollbar min-w-0 flex flex-1 items-center gap-1.5 overflow-x-auto py-0.5">
        <template v-if="mountedWidgets.length > 0">
          <button
            v-for="w in mountedWidgets"
            :key="w.id"
            type="button"
            :class="[
              'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono transition-all shrink-0 cursor-pointer select-none',
              (selectedWidgetId === w.id || (!selectedWidgetId && activeWidget?.id === w.id))
                ? 'bg-primary-500/15 text-primary-600 dark:text-primary-300 font-bold border border-primary-500/30 shadow-xs'
                : 'bg-neutral-100 hover:bg-neutral-200/60 dark:bg-neutral-800/40 dark:hover:bg-neutral-800/70 text-neutral-600 dark:text-neutral-400 border border-transparent',
            ]"
            @click="selectedWidgetId = w.id"
          >
            <span class="i-solar:widget-5-bold-duotone shrink-0 text-xs" />
            <span class="max-w-[120px] truncate">{{ w.title || w.path.split('/').pop() }}</span>
            <span
              v-if="w.surface === 'widget'"
              class="ml-0.5 rounded bg-primary-500/20 px-1 py-0.2 text-[8px] text-primary-600 font-bold dark:text-primary-300"
              title="Floating on stage"
            >
              FLOAT
            </span>
          </button>
        </template>
        <span
          v-else
          class="flex items-center gap-1.5 px-1 text-xs text-neutral-500 font-medium dark:text-neutral-400"
        >
          <span class="i-solar:widget-2-bold-duotone shrink-0 text-xs text-primary-500/80" />
          <span>Widgets Sandbox</span>
        </span>
      </div>

      <!-- Action buttons -->
      <div class="flex shrink-0 items-center gap-1">
        <button
          title="Browse widget library"
          type="button"
          :class="[
            'flex items-center justify-center rounded-lg p-1.5 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
            'hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer',
          ]"
          @click="openLibrary"
        >
          <span class="i-solar:widget-add-bold-duotone text-sm" />
        </button>

        <button
          v-if="activeWidget"
          title="Reload widget canvas"
          type="button"
          :class="[
            'flex items-center justify-center rounded-lg p-1.5 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
            'hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer',
          ]"
          @click="refreshActiveWidget"
        >
          <span class="i-solar:refresh-linear text-sm" :class="{ 'animate-spin': isLoading }" />
        </button>

        <button
          v-if="activeWidget"
          title="Export widget as JSON (Shift+Click to download)"
          type="button"
          :class="[
            'flex items-center justify-center rounded-lg p-1.5 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
            'hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer',
          ]"
          @click="handleExportWidget"
        >
          <span class="i-solar:diskette-bold text-sm text-primary-500/90" />
        </button>

        <button
          v-if="activeWidget"
          :title="activeWidget.surface === 'widget' ? 'Dock back to panel' : 'Pop out into floating widget'"
          type="button"
          :class="[
            'flex items-center justify-center rounded-lg p-1.5 transition-colors cursor-pointer',
            activeWidget.surface === 'widget'
              ? 'bg-primary-500/15 text-primary-600 dark:text-primary-300 hover:bg-primary-500/25 border border-primary-500/30'
              : 'text-neutral-500 hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50',
          ]"
          @click="toggleActiveWidgetSurface"
        >
          <span :class="activeWidget.surface === 'widget' ? 'i-solar:minimize-square-3-bold-duotone text-sm' : 'i-solar:square-top-down-broken text-sm'" />
        </button>

        <button
          v-if="activeWidget"
          title="Unmount this widget"
          type="button"
          :class="[
            'flex items-center justify-center rounded-lg p-1.5 text-neutral-500 hover:text-rose-600 dark:text-neutral-400 dark:hover:text-rose-400',
            'hover:bg-rose-500/10 dark:hover:bg-rose-950/30 transition-colors cursor-pointer',
          ]"
          @click="unmountWidget(activeWidget.id)"
        >
          <span class="i-solar:close-circle-bold-duotone text-sm" />
        </button>

        <button
          v-if="mountedWidgets.length > 1"
          title="Clear all widgets"
          type="button"
          :class="[
            'flex items-center justify-center rounded-lg p-1.5 text-neutral-500 hover:text-rose-600 dark:text-neutral-400 dark:hover:text-rose-400',
            'hover:bg-rose-500/10 dark:hover:bg-rose-950/30 transition-colors cursor-pointer',
          ]"
          @click="clearWidgets"
        >
          <span class="i-solar:trash-bin-trash-bold-duotone text-sm" />
        </button>
      </div>
    </div>

    <!-- Active Widget Viewport -->
    <div
      v-if="mountedWidgets.length > 0 && activeWidget"
      :class="[
        'relative overflow-hidden transition-all',
        props.fillContainer
          ? 'flex-1 min-h-0 w-full flex flex-col p-2'
          : 'w-full border border-neutral-200/60 dark:border-neutral-800/50 rounded-lg',
      ]"
    >
      <!-- NOTICE: floated widgets render in FloatingWidgetsLayer, not here.
        Without this guard the same widget renders twice (panel iframe + floating
        card), which showed as a black box with a FLOAT tag and no floating div. -->
      <div
        v-if="activeWidget.surface === 'widget'"
        class="flex flex-col items-center justify-center gap-2 px-4 py-6 text-center"
      >
        <span class="i-solar:widget-5-bold-duotone text-xl text-primary-500" />
        <p class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
          Floating on stage
        </p>
        <p class="max-w-[280px] text-[11px] text-neutral-500 leading-normal dark:text-neutral-400">
          {{ activeWidget.title || activeWidget.path.split('/').pop() }} is popped out. Close the Workspace sheet to see it.
        </p>
        <button
          type="button"
          class="inline-flex cursor-pointer items-center gap-1.5 border border-primary-500/30 rounded-xl bg-primary-500/15 px-3 py-1.5 text-xs text-primary-600 font-semibold transition-all hover:bg-primary-500/25 dark:text-primary-300"
          @click="toggleActiveWidgetSurface"
        >
          <span class="i-solar:minimize-square-3-bold-duotone text-sm" />
          <span>Dock back to panel</span>
        </button>
      </div>

      <template v-else>
        <div
          :class="[
            'relative w-full overflow-hidden rounded-xl border border-neutral-200/60 dark:border-white/5 bg-white/40 dark:bg-neutral-950/40 backdrop-blur-md',
            props.fillContainer ? 'flex-1 h-full min-h-0' : '',
          ]"
        >
          <iframe
            :key="iframeKey"
            :srcdoc="iframeSrcdoc"
            allowtransparency="true"
            sandbox="allow-scripts allow-forms allow-same-origin"
            :class="[
              'block w-full border-0 bg-transparent transition-[height] duration-200',
              props.fillContainer ? 'h-full' : '',
            ]"
            :style="props.fillContainer ? { backgroundColor: 'transparent' } : { height: `${iframeHeight}px`, backgroundColor: 'transparent' }"
          />
        </div>

        <div
          v-if="errorMessage"
          class="mt-2 flex items-center gap-2 border border-rose-500/30 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400"
        >
          <span class="i-solar:danger-triangle-bold-duotone shrink-0 text-sm" />
          <span class="truncate">{{ errorMessage }}</span>
        </div>
      </template>
    </div>

    <!-- Empty State -->
    <div
      v-else
      :class="[
        'flex flex-col items-center justify-center text-center transition-colors cursor-pointer group',
        props.fillContainer
          ? 'flex-1 min-h-0 m-3 p-6 border border-dashed border-neutral-300/80 dark:border-neutral-700/60 rounded-2xl bg-neutral-50/40 dark:bg-neutral-900/20 hover:border-primary-500/40 space-y-3'
          : 'border border-dashed border-neutral-300/80 dark:border-neutral-800/50 rounded-lg bg-neutral-50/50 dark:bg-neutral-950/40 px-4 py-6 space-y-3 hover:border-neutral-400 dark:hover:border-neutral-700/70',
      ]"
      @click="openLibrary"
    >
      <div class="h-10 w-10 flex items-center justify-center border border-primary-500/20 rounded-2xl bg-primary-500/10 text-primary-600 transition-transform group-hover:scale-105 dark:text-primary-400">
        <span class="i-solar:widget-5-bold-duotone text-xl" />
      </div>
      <div class="space-y-1">
        <p class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
          No Active Micro-App
        </p>
        <p class="max-w-[280px] text-[11px] text-neutral-500 leading-normal dark:text-neutral-400">
          Click to browse saved widgets, or run <code class="border border-neutral-200 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-primary-600 font-mono dark:border-neutral-800 dark:bg-neutral-800/80 dark:text-primary-300">mount_widget &lt;file.ts|file.js&gt;</code> in the terminal.
        </p>
      </div>

      <button
        type="button"
        :class="[
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer',
          'bg-primary-500/15 text-primary-600 dark:text-primary-300 hover:bg-primary-500/25 border border-primary-500/30',
          'transition-all duration-200 shadow-xs',
        ]"
        @click.stop="openLibrary"
      >
        <span class="i-solar:widget-add-bold-duotone text-sm" />
        <span>Browse Widget Library</span>
      </button>
    </div>

    <!-- Micro-App Library Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="isLibraryOpen"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          @click.self="closeLibrary"
        >
          <div
            :class="[
              'relative max-w-md w-full overflow-hidden rounded-2xl',
              'bg-white/95 dark:bg-neutral-900/95 border border-neutral-200/80 dark:border-neutral-700/60 shadow-2xl backdrop-blur-xl',
              'flex flex-col max-h-[85vh] text-neutral-800 dark:text-neutral-100',
            ]"
          >
            <!-- Modal Header -->
            <div class="flex items-center justify-between border-b border-neutral-200/80 px-4 py-3 dark:border-neutral-800/80">
              <div class="flex items-center gap-2.5">
                <div class="h-8 w-8 flex items-center justify-center border border-primary-500/20 rounded-xl bg-primary-500/15 text-primary-600 dark:text-primary-400">
                  <span class="i-solar:widget-add-bold-duotone text-lg" />
                </div>
                <div>
                  <h3 class="text-xs text-neutral-900 font-bold dark:text-neutral-100">
                    Micro-App Library
                  </h3>
                  <p class="text-[10px] text-neutral-500 dark:text-neutral-400">
                    Persisted widgets in local storage
                  </p>
                </div>
              </div>
              <button
                type="button"
                class="flex cursor-pointer items-center justify-center rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                @click="closeLibrary"
              >
                <span class="i-solar:close-circle-bold-duotone text-lg" />
              </button>
            </div>

            <!-- Modal Content List -->
            <div class="flex-1 overflow-y-auto p-4 space-y-2">
              <div v-if="isCatalogLoading" class="flex flex-col items-center justify-center gap-2 py-12 text-neutral-400">
                <span class="i-solar:refresh-linear animate-spin text-xl text-primary-500" />
                <span class="text-xs">Loading widgets...</span>
              </div>

              <div
                v-else-if="persistedCatalog.length === 0"
                class="flex flex-col items-center justify-center py-10 text-center text-neutral-400 space-y-2"
              >
                <div class="h-10 w-10 flex items-center justify-center border border-neutral-200/80 rounded-xl bg-neutral-100/60 text-neutral-400 dark:border-neutral-700/30 dark:bg-neutral-800/50 dark:text-neutral-500">
                  <span class="i-solar:box-minimalistic-bold-duotone text-xl" />
                </div>
                <div class="space-y-0.5">
                  <p class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                    No Saved Micro-Apps
                  </p>
                  <p class="max-w-[240px] text-[10px] text-neutral-500">
                    Widgets created by companions or mounted in terminal will appear here automatically.
                  </p>
                </div>
              </div>

              <div
                v-for="widget in persistedCatalog"
                v-else
                :key="widget.id"
                :class="[
                  'flex items-center justify-between gap-3 p-3 rounded-xl border transition-all duration-200',
                  isWidgetMounted(widget)
                    ? 'bg-primary-500/10 border-primary-500/30 shadow-xs'
                    : 'bg-neutral-50 hover:bg-neutral-100/80 dark:bg-neutral-800/40 dark:hover:bg-neutral-800/60 border-neutral-200/70 dark:border-neutral-700/40',
                ]"
              >
                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-xs text-neutral-900 font-bold dark:text-neutral-100">
                      {{ widget.title || widget.path.split('/').pop() }}
                    </span>
                    <span
                      v-if="isWidgetMounted(widget)"
                      class="border border-primary-500/30 rounded bg-primary-500/20 px-1.5 py-0.2 text-[9px] text-primary-600 font-bold font-mono dark:text-primary-300"
                    >
                      ACTIVE
                    </span>
                  </div>
                  <div class="flex items-center gap-2 truncate text-[10px] text-neutral-500 font-mono dark:text-neutral-400">
                    <span class="truncate">{{ widget.sourcePath || widget.path }}</span>
                    <span v-if="widget.updatedAt" class="shrink-0 text-neutral-400 dark:text-neutral-500">
                      • {{ formatDate(widget.updatedAt) }}
                    </span>
                  </div>
                </div>

                <div class="flex shrink-0 items-center gap-1.5">
                  <button
                    v-if="!isWidgetMounted(widget)"
                    type="button"
                    :class="[
                      'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer',
                      'bg-primary-500 hover:bg-primary-600 text-white transition-all shadow-xs',
                    ]"
                    @click="handleMountWidget(widget)"
                  >
                    <span class="i-solar:play-bold-duotone text-xs" />
                    <span>Mount</span>
                  </button>

                  <button
                    v-else
                    type="button"
                    :class="[
                      'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer',
                      selectedWidgetId === widget.id
                        ? 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 border border-neutral-300 dark:border-neutral-700/50'
                        : 'bg-primary-500/20 text-primary-600 dark:text-primary-300 hover:bg-primary-500/30 border border-primary-500/40',
                    ]"
                    @click="handleSelectOrUnmount(widget)"
                  >
                    <span :class="selectedWidgetId === widget.id ? 'i-solar:close-circle-bold-duotone text-xs' : 'i-solar:eye-bold-duotone text-xs'" />
                    <span>{{ selectedWidgetId === widget.id ? 'Unmount' : 'View' }}</span>
                  </button>

                  <button
                    title="Export widget as JSON (Shift+Click to download)"
                    type="button"
                    class="flex cursor-pointer items-center justify-center rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-200/50 hover:text-primary-600 dark:hover:bg-neutral-800/50 dark:hover:text-primary-400"
                    @click.stop="handleExportCatalogWidget(widget, $event)"
                  >
                    <span class="i-solar:diskette-bold text-sm" />
                  </button>

                  <button
                    title="Delete widget from storage"
                    type="button"
                    class="flex cursor-pointer items-center justify-center rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                    @click="handleDeleteWidget(widget)"
                  >
                    <span class="i-solar:trash-bin-trash-linear text-sm" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="flex items-center justify-between border-t border-neutral-200/80 bg-neutral-50/80 px-4 py-3 dark:border-neutral-800/80 dark:bg-neutral-950/40">
              <span class="text-[10px] text-neutral-500 font-mono">
                {{ persistedCatalog.length }} widget{{ persistedCatalog.length === 1 ? '' : 's' }} registered
              </span>
              <button
                type="button"
                class="cursor-pointer rounded-lg bg-neutral-200 px-3 py-1 text-xs text-neutral-800 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-300 dark:text-neutral-200 dark:hover:bg-neutral-700"
                @click="closeLibrary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
