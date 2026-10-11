<script setup lang="ts">
import type { MountedWidget, PersistedWidget } from '@proj-airi/stage-ui/libs/sandbox'

import { useSandbox } from '@proj-airi/stage-ui/composables/use-sandbox'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const {
  mountedWidgets,
  unmountWidget,
  clearWidgets,
  readFile,
  mountPersistedWidget,
  getPersistedWidgets,
  deletePersistedWidget,
} = useSandbox()

const selectedWidgetId = ref<string>('')
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
    const newWidget = list.find(w => !previousWidgetIds.value.has(w.id))
    if (newWidget) {
      selectedWidgetId.value = newWidget.id
    }
    else {
      const exists = list.some(w => w.id === selectedWidgetId.value)
      if (!exists) {
        selectedWidgetId.value = list[list.length - 1].id
      }
    }
  }
  else {
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

async function buildIframeSrcdoc(widget: MountedWidget): Promise<string> {
  let sessionData: any = {}
  let telemetryData: any = {}
  let cognitionData: any = {}

  try {
    const rawSession = await readFile('/workspace/.airi/session.json')
    sessionData = JSON.parse(rawSession)
  }
  catch {}

  try {
    const rawTelemetry = await readFile('/workspace/.airi/telemetry.json')
    telemetryData = JSON.parse(rawTelemetry)
  }
  catch {}

  try {
    const rawCognition = await readFile('/workspace/.airi/cognition.json')
    cognitionData = JSON.parse(rawCognition)
  }
  catch {}

  // High-resilience normalization for Telemetry
  const cpu1m = Array.isArray(telemetryData.cpuLoad) ? telemetryData.cpuLoad[0] : (telemetryData.cpuLoad?.['1m'] ?? 0)
  const cpu5m = Array.isArray(telemetryData.cpuLoad) ? telemetryData.cpuLoad[1] : (telemetryData.cpuLoad?.['5m'] ?? 0)
  const cpu15m = Array.isArray(telemetryData.cpuLoad) ? telemetryData.cpuLoad[2] : (telemetryData.cpuLoad?.['15m'] ?? 0)

  const normalizedCpuLoad = Object.assign([cpu1m, cpu5m, cpu15m], {
    '1m': cpu1m,
    '5m': cpu5m,
    '15m': cpu15m,
  })

  const normalizedTelemetry = {
    ...telemetryData,
    idleSeconds: telemetryData.idleTimeSec ?? telemetryData.idleSeconds ?? 0,
    idleTimeSec: telemetryData.idleTimeSec ?? telemetryData.idleSeconds ?? 0,
    activeApp: telemetryData.activeProgram || telemetryData.activeWindowTitle || 'AIRI',
    activeProgram: telemetryData.activeProgram || telemetryData.activeWindowTitle || 'AIRI',
    activeWindowTitle: telemetryData.activeWindowTitle || telemetryData.activeProgram || 'AIRI',
    isAfk: (telemetryData.idleTimeSec ?? 0) > 60,
    cpuLoad: normalizedCpuLoad,
  }

  // High-resilience normalization for Cognition
  const normalizedCognition = {
    ...cognitionData,
    emotion: cognitionData.emotion || 'focused',
    valence: cognitionData.valence ?? 0.8,
    energy: cognitionData.energy ?? 0.85,
    somaticState: cognitionData.somaticState || 'engaged',
    characterName: cognitionData.character?.name || sessionData.characterName || 'AIRI',
    provider: cognitionData.consciousness?.activeProvider || 'local',
    model: cognitionData.consciousness?.activeModel || 'default',
  }

  // High-resilience normalization for Session
  const normalizedSession = {
    ...sessionData,
    id: sessionData.activeSessionId || sessionData.id || 'default',
    activeSessionId: sessionData.activeSessionId || sessionData.id || 'default',
    activeCardName: sessionData.characterName || sessionData.activeCardName || 'AIRI',
    messageCount: sessionData.messageCount ?? 0,
    lastUserMessageAt: sessionData.lastMessageAt || sessionData.lastUserMessageAt || new Date().toISOString(),
    hoursSinceLastMessage: sessionData.hoursSinceLastMessage ?? 0,
  }

  const sidecar = {
    session: normalizedSession,
    telemetry: normalizedTelemetry,
    cognition: normalizedCognition,
  }

  if (widget.path.endsWith('.html')) {
    return `<!DOCTYPE html>
<html class="dark" style="background: transparent !important; color-scheme: dark;">
<head>
  <meta charset="UTF-8">
  <${'script'} src="https://cdn.tailwindcss.com"></${'script'}>
  <style>
    * { box-sizing: border-box; }
    html, body {
      background: transparent !important;
      color: #f8fafc;
      font-family: ui-sans-serif, system-ui, sans-serif;
      margin: 0;
      padding: 0;
      width: 100%;
      overflow-x: hidden;
    }
  </style>
</head>
<body class="antialiased">
  <div id="root" class="w-full">${widget.code}</div>
  <${'script'}>
    function reportH() {
      const h = document.getElementById('root')?.scrollHeight || document.body.scrollHeight;
      window.parent.postMessage({ type: 'widget-resize', height: h }, '*');
    }
    window.addEventListener('load', reportH);
    if (window.ResizeObserver) new ResizeObserver(reportH).observe(document.body);
  </${'script'}>
</body>
</html>`
  }

  // ES Module (.js)
  return `<!DOCTYPE html>
<html class="dark" style="background: transparent !important; color-scheme: dark;">
<head>
  <meta charset="UTF-8">
  <${'script'} src="https://cdn.tailwindcss.com"></${'script'}>
  <style>
    * { box-sizing: border-box; }
    html, body {
      background: transparent !important;
      color: #f8fafc;
      font-family: ui-sans-serif, system-ui, sans-serif;
      margin: 0;
      padding: 0;
      width: 100%;
      overflow-x: hidden;
    }
    #root {
      width: 100%;
      display: block;
    }
  </style>
</head>
<body class="antialiased">
  <div id="root" class="w-full"></div>
  <${'script'} type="module">
    const sidecarData = ${JSON.stringify(sidecar)};
    const root = document.getElementById('root');

    function reportH() {
      const h = root.scrollHeight || document.body.scrollHeight;
      window.parent.postMessage({ type: 'widget-resize', height: h }, '*');
    }
    window.addEventListener('load', reportH);
    if (window.ResizeObserver) new ResizeObserver(reportH).observe(document.body);

    const baseContext = {
      container: root,
      sidecar: sidecarData,
      data: sidecarData,
      onUpdate: (cb) => {
        window.addEventListener('message', (e) => {
          if (e.data && e.data.type === 'sidecar-update') cb(e.data.sidecar);
        });
        return () => {};
      }
    };

    // Proxy so context acts seamlessly as both AiriWidgetContext and HTMLElement container
    const context = new Proxy(baseContext, {
      get(target, prop, receiver) {
        if (prop in target) {
          return Reflect.get(target, prop, receiver);
        }
        const val = Reflect.get(root, prop);
        if (typeof val === 'function') {
          return val.bind(root);
        }
        return val;
      },
      set(target, prop, value, receiver) {
        if (prop in target) {
          return Reflect.set(target, prop, value, receiver);
        }
        const res = Reflect.set(root, prop, value);
        if (prop === 'innerHTML' || prop === 'style') {
          setTimeout(reportH, 50);
        }
        return res;
      }
    });

    try {
      const code = ${JSON.stringify(widget.code)};
      const blob = new Blob([code], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      const mod = await import(blobUrl);
      URL.revokeObjectURL(blobUrl);

      if (typeof mod.default === 'function') {
        mod.default(context, context.sidecar);
      } else if (typeof mod.mount === 'function') {
        mod.mount(context, context.sidecar);
      } else if (typeof mod.render === 'function') {
        const res = mod.render(context, context.sidecar);
        if (typeof res === 'string') root.innerHTML = res;
      }
      setTimeout(reportH, 100);
    } catch (err) {
      console.error('[GenerativeWidget] Execution Error:', err);
      root.innerHTML = \`
        <div class="rounded-xl border border-rose-800/80 bg-rose-950/70 p-3 text-rose-200 w-full text-xs space-y-1 shadow-lg">
          <div class="font-bold flex items-center gap-1.5 text-rose-300">
            <span>⚠️ Widget Execution Error</span>
          </div>
          <pre class="mt-1 text-[11px] font-mono whitespace-pre-wrap text-rose-300 overflow-x-auto">\${err.stack || err.message}</pre>
        </div>
      \`;
      setTimeout(reportH, 50);
    }
  </${'script'}>
</body>
</html>`
}

const iframeSrcdoc = ref('')

async function refreshActiveWidget() {
  if (!activeWidget.value) {
    iframeSrcdoc.value = ''
    return
  }
  isLoading.value = true
  errorMessage.value = null
  try {
    iframeSrcdoc.value = await buildIframeSrcdoc(activeWidget.value)
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
    iframeHeight.value = Math.max(160, Math.min(e.data.height + 8, 520))
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
  <div class="flex flex-col gap-2 border border-neutral-200/60 rounded-xl bg-neutral-900/50 p-2.5 shadow-inner backdrop-blur-md dark:border-neutral-800/60">
    <!-- Active Widgets Header / Tabs -->
    <div v-if="mountedWidgets.length > 0" class="flex items-center justify-between gap-1 border-b border-neutral-200/40 pb-1 dark:border-neutral-800/40">
      <!-- Widget switcher pills -->
      <div class="no-scrollbar flex items-center gap-1 overflow-x-auto py-0.5">
        <button
          v-for="w in mountedWidgets"
          :key="w.id"
          :class="[
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono transition-colors shrink-0',
            (selectedWidgetId === w.id || (!selectedWidgetId && activeWidget?.id === w.id))
              ? 'bg-primary-500/20 text-primary-400 font-bold border border-primary-500/30'
              : 'bg-neutral-800/40 text-neutral-400 hover:text-neutral-200 border border-transparent',
          ]"
          @click="selectedWidgetId = w.id"
        >
          <span class="i-solar:widget-5-bold-duotone text-xs" />
          <span class="max-w-[100px] truncate">{{ w.title || w.path.split('/').pop() }}</span>
        </button>
      </div>

      <!-- Actions -->
      <div class="flex shrink-0 items-center gap-1">
        <button
          title="Browse widget library"
          class="flex items-center justify-center rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-800/50 hover:text-neutral-200"
          @click="openLibrary"
        >
          <span class="i-solar:widget-add-bold-duotone text-xs" />
        </button>
        <button
          title="Reload widget canvas"
          class="flex items-center justify-center rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-800/50 hover:text-neutral-200"
          @click="refreshActiveWidget"
        >
          <span class="i-solar:refresh-linear text-xs" :class="{ 'animate-spin': isLoading }" />
        </button>
        <button
          v-if="activeWidget"
          title="Unmount this widget"
          class="flex items-center justify-center rounded p-1 text-neutral-400 transition-colors hover:bg-rose-950/30 hover:text-rose-400"
          @click="unmountWidget(activeWidget.id)"
        >
          <span class="i-solar:close-circle-bold-duotone text-xs" />
        </button>
        <button
          v-if="mountedWidgets.length > 1"
          title="Clear all widgets"
          class="flex items-center justify-center rounded p-1 text-neutral-400 transition-colors hover:bg-rose-950/30 hover:text-rose-400"
          @click="clearWidgets"
        >
          <span class="i-solar:trash-bin-trash-bold-duotone text-xs" />
        </button>
      </div>
    </div>

    <!-- Active Widget Viewport -->
    <div
      v-if="mountedWidgets.length > 0 && activeWidget"
      class="relative w-full overflow-hidden border border-neutral-800/50 rounded-lg bg-transparent"
    >
      <iframe
        :key="iframeKey"
        :srcdoc="iframeSrcdoc"
        allowtransparency="true"
        sandbox="allow-scripts allow-forms allow-same-origin"
        class="block w-full border-0 bg-transparent transition-[height] duration-200"
        :style="{ height: `${iframeHeight}px`, backgroundColor: 'transparent', colorScheme: 'dark' }"
      />
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="group relative flex flex-col cursor-pointer items-center justify-center border border-neutral-800/50 rounded-lg border-dashed bg-neutral-950/40 px-4 py-6 text-center transition-colors space-y-3 hover:border-neutral-700/70 hover:bg-neutral-950/60"
      @click="openLibrary"
    >
      <div class="h-9 w-9 flex items-center justify-center border border-primary-500/20 rounded-xl bg-primary-500/10 text-primary-400 transition-transform group-hover:scale-105">
        <span class="i-solar:widget-5-bold-duotone text-lg" />
      </div>
      <div class="space-y-1">
        <p class="text-xs text-neutral-200 font-semibold">
          No Active Micro-App
        </p>
        <p class="max-w-[260px] text-[10px] text-neutral-400 leading-normal">
          Click to browse saved widgets, or run <code class="border border-neutral-800 rounded bg-neutral-900 px-1 py-0.5 text-primary-300 font-mono">mount_widget &lt;file.ts|file.js&gt;</code> in the terminal.
        </p>
      </div>

      <button
        type="button"
        :class="[
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
          'bg-primary-500/15 text-primary-300 hover:bg-primary-500/25 border border-primary-500/30',
          'transition-all duration-200 shadow-sm',
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
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          @click.self="closeLibrary"
        >
          <div
            :class="[
              'relative max-w-md w-full overflow-hidden rounded-2xl',
              'bg-neutral-900/95 border border-neutral-700/60 shadow-2xl backdrop-blur-xl',
              'flex flex-col max-h-[85vh]',
            ]"
          >
            <!-- Modal Header -->
            <div class="flex items-center justify-between border-b border-neutral-800/80 px-4 py-3">
              <div class="flex items-center gap-2">
                <div class="h-7 w-7 flex items-center justify-center border border-primary-500/20 rounded-lg bg-primary-500/15 text-primary-400">
                  <span class="i-solar:widget-add-bold-duotone text-base" />
                </div>
                <div>
                  <h3 class="text-xs text-neutral-100 font-bold">
                    Micro-App Library
                  </h3>
                  <p class="text-[10px] text-neutral-400">
                    Persisted widgets in local storage
                  </p>
                </div>
              </div>
              <button
                class="flex items-center justify-center rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
                @click="closeLibrary"
              >
                <span class="i-solar:close-circle-bold-duotone text-lg" />
              </button>
            </div>

            <!-- Modal Content List -->
            <div class="flex-1 overflow-y-auto p-4 space-y-2">
              <div v-if="isCatalogLoading" class="flex flex-col items-center justify-center gap-2 py-12 text-neutral-400">
                <span class="i-solar:refresh-linear animate-spin text-xl text-primary-400" />
                <span class="text-xs">Loading widgets...</span>
              </div>

              <div
                v-else-if="persistedCatalog.length === 0"
                class="flex flex-col items-center justify-center py-10 text-center text-neutral-400 space-y-2"
              >
                <div class="h-10 w-10 flex items-center justify-center border border-neutral-700/30 rounded-xl bg-neutral-800/50 text-neutral-500">
                  <span class="i-solar:box-minimalistic-bold-duotone text-xl" />
                </div>
                <div class="space-y-0.5">
                  <p class="text-xs text-neutral-300 font-medium">
                    No Saved Micro-Apps
                  </p>
                  <p class="max-w-[220px] text-[10px] text-neutral-500">
                    Widgets created by Rick or mounted in terminal will appear here automatically.
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
                    ? 'bg-primary-500/10 border-primary-500/30 shadow-sm'
                    : 'bg-neutral-800/40 hover:bg-neutral-800/60 border-neutral-700/40',
                ]"
              >
                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-xs text-neutral-100 font-bold">
                      {{ widget.title || widget.path.split('/').pop() }}
                    </span>
                    <span
                      v-if="isWidgetMounted(widget)"
                      class="border border-primary-500/30 rounded bg-primary-500/20 px-1.5 py-0.2 text-[9px] text-primary-300 font-bold font-mono"
                    >
                      ACTIVE
                    </span>
                  </div>
                  <div class="flex items-center gap-2 truncate text-[10px] text-neutral-400 font-mono">
                    <span class="truncate">{{ widget.sourcePath || widget.path }}</span>
                    <span v-if="widget.updatedAt" class="shrink-0 text-neutral-500">
                      • {{ formatDate(widget.updatedAt) }}
                    </span>
                  </div>
                </div>

                <div class="flex shrink-0 items-center gap-1.5">
                  <button
                    v-if="!isWidgetMounted(widget)"
                    :class="[
                      'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold',
                      'bg-primary-500 hover:bg-primary-600 text-white transition-all shadow-sm',
                    ]"
                    @click="handleMountWidget(widget)"
                  >
                    <span class="i-solar:play-bold-duotone text-xs" />
                    <span>Mount</span>
                  </button>

                  <button
                    v-else
                    :class="[
                      'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold',
                      selectedWidgetId === widget.id
                        ? 'bg-neutral-800 text-neutral-300 hover:bg-rose-950/40 hover:text-rose-300 border border-neutral-700/50'
                        : 'bg-primary-500/20 text-primary-300 hover:bg-primary-500/30 border border-primary-500/40',
                    ]"
                    @click="handleSelectOrUnmount(widget)"
                  >
                    <span :class="selectedWidgetId === widget.id ? 'i-solar:close-circle-bold-duotone text-xs' : 'i-solar:eye-bold-duotone text-xs'" />
                    <span>{{ selectedWidgetId === widget.id ? 'Unmount' : 'View' }}</span>
                  </button>

                  <button
                    title="Delete widget from storage"
                    class="flex items-center justify-center rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-rose-950/30 hover:text-rose-400"
                    @click="handleDeleteWidget(widget)"
                  >
                    <span class="i-solar:trash-bin-trash-linear text-sm" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="flex items-center justify-between border-t border-neutral-800/80 bg-neutral-950/40 px-4 py-3">
              <span class="text-[10px] text-neutral-500 font-mono">
                {{ persistedCatalog.length }} widget{{ persistedCatalog.length === 1 ? '' : 's' }} registered
              </span>
              <button
                class="rounded-lg bg-neutral-800 px-3 py-1 text-xs text-neutral-200 font-medium transition-colors hover:bg-neutral-700"
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
