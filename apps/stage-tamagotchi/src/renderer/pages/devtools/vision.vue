<script setup lang="ts">
import type { SerializableDesktopCapturerSource } from '@proj-airi/electron-screen-capture'
import type { SourcesOptions } from 'electron'

import { useElectronScreenCapture } from '@proj-airi/electron-screen-capture/vue'
import { useVisionStore } from '@proj-airi/stage-ui/stores/modules/vision'
import { ATTENTION_GUARD_WORKLOAD_ID, useVisionOrchestratorStore, VISION_WORKLOADS } from '@proj-airi/stage-ui/stores/modules/vision/orchestrator'
import { Button, FieldCheckbox, FieldRange, FieldSelect, SelectTab } from '@proj-airi/ui'
import { useIntervalFn } from '@vueuse/core'
import { computed, onBeforeUnmount, ref } from 'vue'

import { getIpcRenderer } from '../../utils/electron'

interface ScreenCaptureSource extends SerializableDesktopCapturerSource {
  appIconURL?: string
  thumbnailURL?: string
}

type SourceCategory = 'applications' | 'displays'

const visionStore = useVisionStore()
const orchestrator = useVisionOrchestratorStore()

const sources = ref<ScreenCaptureSource[]>([])
const isRefetching = ref(false)
const hasFetchedOnce = ref(false)
const sourceCategory = ref<SourceCategory>('applications')
const selectedSourceId = ref('')
const activeStreams = ref<MediaStream[]>([])

const sourcesOptions = ref<SourcesOptions>({
  types: ['screen', 'window'],
  fetchWindowIcons: true,
})

const { getSources } = useElectronScreenCapture(getIpcRenderer(), sourcesOptions)

const isWindowSource = (source: ScreenCaptureSource) => source.id.startsWith('window:')
const isDisplaySource = (source: ScreenCaptureSource) => source.id.startsWith('screen:')

const filteredSources = computed(() => {
  if (sourceCategory.value === 'applications')
    return sources.value.filter(isWindowSource)
  return sources.value.filter(isDisplaySource)
})

const sourceCounts = computed(() => ({
  applications: sources.value.filter(isWindowSource).length,
  displays: sources.value.filter(isDisplaySource).length,
}))

const categoryOptions = [
  { label: 'Applications', value: 'applications', icon: 'i-solar:window-frame-line-duotone' },
  { label: 'Displays', value: 'displays', icon: 'i-solar:screencast-2-line-duotone' },
]

// Ticker controls (proposal §10)
const captureIntervalMs = ref(2000)
const captureDownscalePercent = ref(100)
const selectedWorkloadId = ref(ATTENTION_GUARD_WORKLOAD_ID)
const sendContextUpdates = ref(false)
const enableVlm = ref(false)
const isRunning = ref(false)
const lastPreviewDataUrl = ref('')
const captureCount = ref(0)
const promotions = ref(0)
const lastLatencyMs = ref(0)

const workloadOptions = VISION_WORKLOADS.map(w => ({ label: w.label, value: w.id }))

const refetchLabel = computed(() => (isRefetching.value ? 'Refetching...' : 'Refetch'))
const refetchIcon = computed(() => (isRefetching.value ? 'i-svg-spinners:ring-resize' : 'i-solar:refresh-line-duotone'))
const startStopLabel = computed(() => (isRunning.value ? 'Stop Ticker' : 'Start Ticker'))

async function refetchSources() {
  isRefetching.value = true
  try {
    sources.value = (await getSources()) as unknown as ScreenCaptureSource[]
    hasFetchedOnce.value = true
    if (!selectedSourceId.value && sources.value.length > 0)
      selectedSourceId.value = sources.value[0].id
  }
  finally {
    isRefetching.value = false
  }
}

async function captureAndProcess() {
  try {
    const width = Math.round(1280 * (captureDownscalePercent.value / 100))
    const height = Math.round(720 * (captureDownscalePercent.value / 100))

    const result = await visionStore.captureSnapshot({ width, height })
    if (!result?.dataUrl) {
      orchestrator.lastError = result?.error === 'permission_denied' ? 'Screen capture permission denied.' : 'Capture returned no frame.'
      return
    }

    lastPreviewDataUrl.value = result.dataUrl
    captureCount.value++

    const tickStart = performance.now()
    const processed = await orchestrator.processCapture({
      dataUrl: result.dataUrl,
      width,
      height,
      sourceId: selectedSourceId.value || 'screen:primary',
      workloadId: selectedWorkloadId.value,
      timestamp: result.timestamp,
    })
    lastLatencyMs.value = Math.round(performance.now() - tickStart)

    if (processed?.decision === 'PROMOTE')
      promotions.value++
  }
  catch (err) {
    orchestrator.lastError = (err as Error).message || String(err)
  }
}

const { pause, resume } = useIntervalFn(captureAndProcess, computed(() => captureIntervalMs.value), {
  immediate: false,
})

function toggleTicker() {
  if (isRunning.value) {
    pause()
    isRunning.value = false
  }
  else {
    // Warm the guard worker (and optional VLM) before the first tick.
    if (selectedWorkloadId.value === ATTENTION_GUARD_WORKLOAD_ID) {
      void orchestrator.ensureGuardLoaded({ enableVlm: enableVlm.value }).catch(() => {})
    }
    isRunning.value = true
    resume()
  }
}

onBeforeUnmount(() => {
  pause()
  orchestrator.terminate()
  activeStreams.value.forEach(stream => stream.getTracks().forEach(track => track.stop()))
})

void refetchSources()
</script>

<template>
  <div class="mx-auto max-w-6xl flex flex-col gap-6 p-6">
    <h1 class="text-xl font-semibold">
      Vision & Ticker Dashboard
    </h1>

    <!-- Source selection -->
    <section class="flex flex-col gap-3 border border-[var(--ui-border)] rounded-xl border-solid p-4">
      <div class="flex items-center justify-between">
        <SelectTab v-model="sourceCategory" :options="categoryOptions" />
        <Button :label="refetchLabel" :icon="refetchIcon" @click="refetchSources" />
      </div>
      <div class="text-sm opacity-70">
        Displays: {{ sourceCounts.displays }} · Applications: {{ sourceCounts.applications }}
      </div>
      <div class="grid grid-cols-3 max-h-40 gap-2 overflow-y-auto">
        <button
          v-for="source in filteredSources"
          :key="source.id"
          type="button"
          class="flex flex-col gap-1 border rounded-md border-solid p-2 text-left text-xs transition-colors"
          :class="selectedSourceId === source.id ? 'border-[var(--ui-accent)]' : 'border-[var(--ui-border)]'"
          @click="selectedSourceId = source.id"
        >
          <img
            v-if="source.thumbnailURL"
            :src="source.thumbnailURL"
            alt=""
            class="h-16 w-full rounded object-cover"
          >
          <span class="truncate">{{ source.name }}</span>
        </button>
        <div v-if="filteredSources.length === 0" class="col-span-3 py-6 text-center text-xs opacity-50">
          No sources — ensure Screen Recording permission is granted.
        </div>
      </div>
    </section>

    <!-- Ticker controls -->
    <section class="flex flex-col gap-4 border border-[var(--ui-border)] rounded-xl border-solid p-4">
      <FieldRange
        v-model="captureIntervalMs"
        :min="500"
        :max="15000"
        :step="500"
        label="Capture Interval"
        :format-value="v => `${v}ms`"
      />
      <FieldRange
        v-model="captureDownscalePercent"
        :min="25"
        :max="100"
        :step="5"
        label="Input Downscale"
        :format-value="v => `${v}% (${Math.round(1280 * v / 100)}×${Math.round(720 * v / 100)})`"
      />
      <FieldSelect
        v-model="selectedWorkloadId"
        label="Vision Workload"
        :options="workloadOptions"
      />
      <FieldCheckbox
        v-model="sendContextUpdates"
        label="Publish to character context updates"
        description="Promotions surface to the character via context:update (ReplaceSelf)."
      />
      <FieldCheckbox
        v-if="selectedWorkloadId === ATTENTION_GUARD_WORKLOAD_ID"
        v-model="enableVlm"
        label="Enable Moondream2 semantic captions (opt-in)"
        description="Heavy download/VRAM. Falls back to the deterministic [Visual Event] summary when off or under memory pressure."
      />
      <Button
        :label="startStopLabel"
        :icon="isRunning ? 'i-solar:pause-line-duotone' : 'i-solar:play-line-duotone'"
        @click="toggleTicker"
      />
    </section>

    <!-- Telemetry + preview -->
    <section class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div class="flex flex-col gap-3 border border-[var(--ui-border)] rounded-xl border-solid p-4">
        <h2 class="text-sm font-semibold">
          Vision Telemetry
        </h2>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div class="flex flex-col gap-1 rounded bg-[var(--ui-surface)] p-2">
            <span class="text-xs opacity-60">Inference Latency</span>
            <span class="font-mono">{{ lastLatencyMs }}ms</span>
          </div>
          <div class="flex flex-col gap-1 rounded bg-[var(--ui-surface)] p-2">
            <span class="text-xs opacity-60">Capture Rate</span>
            <span class="font-mono">{{ Math.round(60000 / captureIntervalMs) }}/min</span>
          </div>
          <div class="flex flex-col gap-1 rounded bg-[var(--ui-surface)] p-2">
            <span class="text-xs opacity-60">Captures</span>
            <span class="font-mono">{{ captureCount }}</span>
          </div>
          <div class="flex flex-col gap-1 rounded bg-[var(--ui-surface)] p-2">
            <span class="text-xs opacity-60">Promotions</span>
            <span class="font-mono">{{ promotions }}</span>
          </div>
        </div>
        <div v-if="orchestrator.lastError" class="rounded bg-red-950/40 p-2 text-xs text-red-300">
          {{ orchestrator.lastError }}
        </div>
      </div>

      <div class="flex flex-col gap-3 border border-[var(--ui-border)] rounded-xl border-solid p-4">
        <h2 class="text-sm font-semibold">
          Snapshot & Preview
        </h2>
        <div v-if="lastPreviewDataUrl" class="aspect-video overflow-hidden rounded">
          <img :src="lastPreviewDataUrl" alt="last capture" class="h-full w-full object-cover">
        </div>
        <div v-else class="aspect-video flex items-center justify-center rounded bg-[var(--ui-surface)] text-xs opacity-50">
          No capture yet — press Start Ticker.
        </div>
      </div>
    </section>

    <!-- Last interpretation -->
    <section class="flex flex-col gap-2 border border-[var(--ui-border)] rounded-xl border-solid p-4">
      <h2 class="text-sm font-semibold">
        Last Interpretation
      </h2>
      <pre class="whitespace-pre-wrap rounded bg-[var(--ui-surface)] p-3 text-xs font-mono">{{ orchestrator.lastResultText || 'IDLE / NO OUTPUT' }}</pre>
    </section>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  title: Vision & Ticker
  subtitleKey: tamagotchi.settings.devtools.title
</route>
