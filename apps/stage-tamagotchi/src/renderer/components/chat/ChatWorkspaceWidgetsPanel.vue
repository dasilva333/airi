<script setup lang="ts">
import type { MountedWidget } from '@proj-airi/stage-ui/libs/sandbox'

import { useSandbox } from '@proj-airi/stage-ui/composables/use-sandbox'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const {
  mountedWidgets,
  unmountWidget,
  clearWidgets,
  readFile,
} = useSandbox()

const selectedWidgetId = ref<string>('')
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const iframeKey = ref(0)
const iframeHeight = ref(240)

const activeWidget = computed<MountedWidget | null>(() => {
  if (mountedWidgets.value.length === 0)
    return null
  const found = mountedWidgets.value.find(w => w.id === selectedWidgetId.value)
  return found || mountedWidgets.value[mountedWidgets.value.length - 1]
})

// Auto-select latest widget on mount
watch(() => mountedWidgets.value, (list) => {
  if (list.length > 0) {
    const exists = list.some(w => w.id === selectedWidgetId.value)
    if (!exists) {
      selectedWidgetId.value = list[list.length - 1].id
    }
  }
  else {
    selectedWidgetId.value = ''
  }
}, { immediate: true, deep: true })

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

    const context = {
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

    // Duck-type context so it acts as HTMLElement container if called as mount(container)
    Object.defineProperty(context, 'innerHTML', {
      get() { return root.innerHTML; },
      set(v) { root.innerHTML = v; setTimeout(reportH, 50); },
    });
    Object.defineProperty(context, 'querySelector', {
      value: (...a) => root.querySelector(...a),
    });
    Object.defineProperty(context, 'querySelectorAll', {
      value: (...a) => root.querySelectorAll(...a),
    });
    Object.defineProperty(context, 'appendChild', {
      value: (...a) => { const r = root.appendChild(...a); setTimeout(reportH, 50); return r; },
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
      class="flex flex-col items-center justify-center border border-neutral-800/50 rounded-lg border-dashed bg-neutral-950/40 px-4 py-6 text-center space-y-2"
    >
      <div class="h-9 w-9 flex items-center justify-center border border-primary-500/20 rounded-xl bg-primary-500/10 text-primary-400">
        <span class="i-solar:widget-5-bold-duotone text-lg" />
      </div>
      <div class="space-y-0.5">
        <p class="text-xs text-neutral-200 font-semibold">
          No Active Micro-App
        </p>
        <p class="max-w-[240px] text-[10px] text-neutral-400">
          Run <code class="border border-neutral-800 rounded bg-neutral-900 px-1 py-0.5 text-primary-300 font-mono">mount_widget &lt;file.ts|file.js&gt;</code> in the terminal to mount live widgets here.
        </p>
      </div>
    </div>
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
