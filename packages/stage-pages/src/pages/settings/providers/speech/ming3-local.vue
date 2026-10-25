<script setup lang="ts">
import type { MingDesignVoice } from '@proj-airi/stage-ui/stores/providers/ming3-catalog'

import localforage from 'localforage'

import { ProviderSettingsLayout } from '@proj-airi/stage-ui/components'
import { clearSingleModelCache, formatBytes, getDetailedModelCacheMap } from '@proj-airi/stage-ui/libs/inference'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { getMing3AdapterInstance } from '@proj-airi/stage-ui/stores/providers/ming3-audio-utils'
import {
  isMingDesignVoiceId,
  MING3_EXPRESSION_TAGS,
  MING3_MODEL_ID,
  MING3_MODEL_NAME,
  MING_DESIGNS_STORE_NAME,
  mingDesignIdForPrompt,
} from '@proj-airi/stage-ui/stores/providers/ming3-catalog'
import { isRelaxedSimdSupported } from '@proj-airi/stage-ui/workers/ming3/loader'
import { Button, Input, Select } from '@proj-airi/ui'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

const providerId = 'ming3-local'
const { t } = useI18n()
const speechStore = useSpeechStore()
const providersStore = useProvidersStore()

const providerMetadata = computed(() => {
  return providersStore.getProviderMetadata(providerId)
})

// NOTICE: `getProviderConfig()` returns a detached snapshot copy — mutating it
// never persists, so all reads/writes below go through the live persisted row
// (`getProviderInstanceConfig(...).options`), mirroring pocket-tts-local.vue.
function getLiveOptions(): Record<string, unknown> {
  return providersStore.getProviderInstanceConfig(providerId).options as Record<string, unknown>
}

const providerConfig = computed(() => {
  return providersStore.getProviderConfig(providerId)
})

const providerModels = computed(() => {
  return providersStore.getModelsForProvider(providerId)
})

const modelsLoading = computed(() => {
  return providersStore.isLoadingModels[providerId] || false
})

const modelOptions = computed(() => {
  if (providerModels.value.length > 0) {
    return providerModels.value.map(m => ({ label: m.name, value: m.id }))
  }
  return [{ label: MING3_MODEL_NAME, value: MING3_MODEL_ID }]
})

const model = computed({
  get(): string {
    return (getLiveOptions().model as string) || (providerConfig.value?.model as string) || MING3_MODEL_ID
  },
  set(val: string) {
    getLiveOptions().model = val
  },
})

const preset = computed({
  get(): string {
    return (getLiveOptions().preset as string) || 'quality'
  },
  set(val: string) {
    getLiveOptions().preset = val
  },
})

const threads = computed({
  get(): string | number {
    const v = getLiveOptions().threads
    return (typeof v === 'number' || v === 'auto' ? v : undefined) ?? (providerConfig.value?.threads as string | number | undefined) ?? 'auto'
  },
  set(val: string | number) {
    getLiveOptions().threads = val
  },
})

const selectedVoiceId = ref('')
const voiceTab = ref<'all' | 'builtin' | 'designs'>('all')
const voiceSearch = ref('')

const threadOptions = computed(() => [
  { label: t('settings.pages.providers.provider.ming3-local.threads.auto'), value: 'auto' as string | number },
  { label: '1', value: 1 as string | number },
  { label: '2', value: 2 as string | number },
  { label: '4', value: 4 as string | number },
  { label: '8', value: 8 as string | number },
])

const presetLabel = computed(() => {
  const key = `settings.pages.providers.provider.ming3-local.preset.${preset.value}`
  const translated = t(key)
  return translated === key ? String(preset.value) : translated
})

const threadsLabel = computed(() => {
  return threads.value === 'auto'
    ? t('settings.pages.providers.provider.ming3-local.threads.auto')
    : `${threads.value}`
})

// Playground + run state is declared up front: the display computeds and the
// option watchers below reference these, and textual declaration order is
// enforced (ts/no-use-before-define), even though every use executes later.
const sampleKey = ref('')
const expressionKey = ref('')
const pendingSampleKey = ref('')

const SAMPLE_TEXTS = [
  { id: 'welcome', label: 'Welcome back', text: 'Welcome back. Let\u2019s make something wonderful together.' },
  { id: 'evening', label: 'Evening wind', text: 'The evening wind drifted down from the mountain pass, and the distant clouds slowly turned gold.' },
  { id: 'reminder', label: 'Reminder', text: 'Please remember to water the plants on Tuesday, and call the dentist about the appointment at three o\u2019clock.' },
]

const isTesting = ref(false)
const audioUrl = ref('')
const audioEl = ref<HTMLAudioElement | null>(null)
const testStats = ref<{ firstAudioMs: number | null, generationMs: number, rtf: number, frames: number, stopped: boolean } | null>(null)
const elapsedMs = ref(0)
let elapsedTimer: ReturnType<typeof setInterval> | null = null

// ---------------------------------------------------------------------------
// Compatibility probe (no headers anywhere in the app today, so this guides
// the single-threaded-first copy rather than gating anything).
// ---------------------------------------------------------------------------
const threadingAvailable = ref(false)
const relaxedSimd = ref(false)

// ---------------------------------------------------------------------------
// Model files / cache status
// ---------------------------------------------------------------------------
const cacheChecked = ref({ cached: false as boolean, sizeBytes: 0 })
const engineState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const isBusy = ref(false)
const busyMessage = ref('')
const busyPercent = ref(0)
const showDeleteModelConfirm = ref(false)
const pendingThreadsReload = ref(false)
const showDiagnostics = ref(false)
const diagBuild = ref('—')
const diagThreads = ref('—')

function refreshDiagnostics() {
  getMing3AdapterInstance().then((adapter: any) => {
    diagBuild.value = adapter.build || '—'
    diagThreads.value = adapter.activeThreads != null ? String(adapter.activeThreads) : '—'
  }).catch(() => {})
}

async function refreshCacheStatus() {
  try {
    const map = await getDetailedModelCacheMap()
    const entry = map['ming3-local']
    cacheChecked.value = { cached: !!entry?.cached, sizeBytes: entry?.sizeBytes ?? 0 }
  }
  catch {
    cacheChecked.value = { cached: false, sizeBytes: 0 }
  }
}

async function handleLoadModel() {
  if (isBusy.value)
    return
  isBusy.value = true
  busyPercent.value = 0
  busyMessage.value = t('settings.pages.providers.provider.ming3-local.model.loading')
  engineState.value = 'loading'
  try {
    const adapter = await getMing3AdapterInstance()
    await adapter.loadModel({
      model: model.value,
      threads: threads.value === 'auto' ? 'auto' : Number(threads.value),
      onProgress: (p: any) => {
        if (typeof p.percent === 'number')
          busyPercent.value = Math.min(100, Math.round(p.percent))
        busyMessage.value = p.message || p.file || p.name || ''
      },
    })
    engineState.value = 'ready'
    await speechStore.loadVoicesForProvider(providerId)
    await refreshCacheStatus()
    toast.success(t('settings.pages.providers.provider.ming3-local.model.downloaded'))
  }
  catch (err) {
    console.error('[Ming3 Settings] Model load failed:', err)
    engineState.value = 'error'
    toast.error(err instanceof Error ? err.message : String(err))
  }
  finally {
    isBusy.value = false
    busyMessage.value = ''
    busyPercent.value = 0
    refreshDiagnostics()
  }
}

async function confirmDeleteModel() {
  showDeleteModelConfirm.value = false
  try {
    // Voice designs live in localforage metadata and are intentionally
    // preserved — only the OPFS bundle is evicted.
    await clearSingleModelCache('ming3-local')
    engineState.value = 'idle'
    await refreshCacheStatus()
  }
  catch (err) {
    console.error('[Ming3 Settings] Failed to delete model files:', err)
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

watch(model, async () => {
  await handleLoadModel()
})

async function onThreadsChange() {
  try {
    const adapter = await getMing3AdapterInstance()
    if (adapter.state === 'running') {
      // Reloading mid-synthesis would drop the in-flight request: defer until
      // the current test finishes or is stopped. The draft and playground
      // text are untouched — only the engine reload is deferred.
      pendingThreadsReload.value = true
      return
    }
    if (adapter.state === 'ready')
      await handleLoadModel()
  }
  catch {
    // Engine not initialized yet — the new value applies on next load.
  }
}

// ---------------------------------------------------------------------------
// Voice designs (localforage tuple per docs/analysis-ming3-tts-viability.md §6)
// ---------------------------------------------------------------------------
const designsStore = localforage.createInstance({ name: MING_DESIGNS_STORE_NAME })

interface DesignEditor {
  id: string | null
  name: string
  prompt: string
}

const designs = ref<MingDesignVoice[]>([])
const editor = ref<DesignEditor>({ id: null, name: '', prompt: '' })
const editorSnapshot = ref<DesignEditor>({ id: null, name: '', prompt: '' })
const pendingDeleteDesignId = ref<string | null>(null)
const showVoicePrompt = ref(false)

const editingExisting = computed(() => editor.value.id !== null)
const promptChanged = computed(() => {
  return editingExisting.value && editor.value.prompt.trim() !== (editorSnapshot.value.prompt || '').trim()
})

async function computeSha256(text: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function loadDesigns() {
  try {
    const list: MingDesignVoice[] = []
    await designsStore.iterate((value: unknown) => {
      const v = value as MingDesignVoice
      if (v && typeof v.id === 'string' && typeof v.designPrompt === 'string')
        list.push(v)
    })
    list.sort((a, b) => b.createdAt - a.createdAt)
    designs.value = list
  }
  catch (err) {
    console.error('[Ming3 Settings] Failed to load voice designs:', err)
  }
}

function newDesign() {
  editor.value = { id: null, name: '', prompt: '' }
  editorSnapshot.value = { id: null, name: '', prompt: '' }
}

function openDesign(design: MingDesignVoice) {
  // Clicking a saved voice opens it for editing. The selection marker shows
  // which design is loaded in the editor — it carries no default-voice
  // semantics; provider defaults follow AIRI's existing behavior.
  editor.value = { id: design.id, name: design.name, prompt: design.designPrompt }
  editorSnapshot.value = { id: design.id, name: design.name, prompt: design.designPrompt }
}

async function persistDesign(id: string, name: string, prompt: string, createdAt?: number) {
  const record: MingDesignVoice = {
    id,
    name: name.trim() || prompt.slice(0, 24),
    createdAt: createdAt ?? Date.now(),
    designPrompt: prompt,
  }
  await designsStore.setItem(id, record)
  return record
}

async function saveDesign() {
  const prompt = editor.value.prompt.trim()
  if (!prompt)
    return
  try {
    if (!editor.value.id) {
      // New design: content-derived id dedups identical prompts for free.
      const sha = await computeSha256(prompt)
      const id = mingDesignIdForPrompt(prompt, sha)
      const existing = await designsStore.getItem<MingDesignVoice>(id)
      const saved = await persistDesign(id, editor.value.name, prompt, existing?.createdAt)
      editor.value = { id: saved.id, name: saved.name, prompt: saved.designPrompt }
      editorSnapshot.value = { ...editor.value }
    }
    else if (!promptChanged.value) {
      // Name-only edit: update in place, id stays stable.
      const existing = await designsStore.getItem<MingDesignVoice>(editor.value.id)
      const saved = await persistDesign(editor.value.id, editor.value.name, prompt, existing?.createdAt)
      editor.value = { id: saved.id, name: saved.name, prompt: saved.designPrompt }
      editorSnapshot.value = { ...editor.value }
    }
    await loadDesigns()
    await speechStore.loadVoicesForProvider(providerId)
  }
  catch (err) {
    console.error('[Ming3 Settings] Failed to save voice design:', err)
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

async function saveAsNewDesign() {
  const prompt = editor.value.prompt.trim()
  if (!prompt)
    return
  try {
    const sha = await computeSha256(prompt)
    const id = mingDesignIdForPrompt(prompt, sha)
    const existing = await designsStore.getItem<MingDesignVoice>(id)
    const saved = await persistDesign(id, editor.value.name, prompt, existing?.createdAt)
    editor.value = { id: saved.id, name: saved.name, prompt: saved.designPrompt }
    editorSnapshot.value = { ...editor.value }
    await loadDesigns()
    await speechStore.loadVoicesForProvider(providerId)
  }
  catch (err) {
    console.error('[Ming3 Settings] Failed to save new voice design:', err)
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

async function deleteDesign(id: string) {
  pendingDeleteDesignId.value = null
  try {
    await designsStore.removeItem(id)
    if (editor.value.id === id)
      newDesign()
    if (selectedVoiceId.value === id)
      selectedVoiceId.value = ''
    await loadDesigns()
    await speechStore.loadVoicesForProvider(providerId)
  }
  catch (err) {
    console.error('[Ming3 Settings] Failed to delete voice design:', err)
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

// ---------------------------------------------------------------------------
// Voice Playground
// ---------------------------------------------------------------------------
const availableVoices = computed(() => {
  return speechStore.availableVoices[providerId] || []
})

interface PlaygroundVoiceOption {
  label: string
  value: string
  kind: 'builtin' | 'design'
  description: string
}

const voiceOptions = computed<PlaygroundVoiceOption[]>(() => {
  const q = voiceSearch.value.trim().toLowerCase()
  const all: PlaygroundVoiceOption[] = availableVoices.value.map((v: any) => ({
    label: v.name || v.id,
    value: v.id,
    kind: isMingDesignVoiceId(v.id) ? 'design' as const : 'builtin' as const,
    description: v.description || '',
  }))
  return all.filter((o) => {
    if (voiceTab.value === 'builtin' && o.kind !== 'builtin')
      return false
    if (voiceTab.value === 'designs' && o.kind !== 'design')
      return false
    if (q && !`${o.label} ${o.description}`.toLowerCase().includes(q))
      return false
    return true
  })
})

watch(voiceOptions, (options) => {
  if (options.length > 0 && !options.some(o => o.value === selectedVoiceId.value))
    selectedVoiceId.value = options[0].value
}, { immediate: true })

const selectedVoice = computed(() => {
  return availableVoices.value.find((v: any) => v.id === selectedVoiceId.value) as { id: string, name: string, description?: string } | undefined
})

const selectedVoiceKind = computed(() => {
  return isMingDesignVoiceId(selectedVoiceId.value) ? 'design' : 'builtin'
})

const voiceSelectOptions = computed(() => {
  return voiceOptions.value.map(o => ({ label: o.label, value: o.value }))
})

const sampleOptions = computed(() => {
  return SAMPLE_TEXTS.map(s => ({ label: s.label, value: s.id }))
})

const expressionOptions = computed(() => {
  return MING3_EXPRESSION_TAGS.map(tag => ({ label: tag.tag, value: tag.tag }))
})

const pendingSampleText = computed(() => {
  const sample = SAMPLE_TEXTS.find(s => s.id === pendingSampleKey.value)
  return sample
    ? `Replace the current text with the “${sample.label}” sample?`
    : ''
})

const showStreamingDiagnostics = ref(true)

function formatMs(ms: number | null | undefined): string {
  if (ms == null)
    return '—'
  if (ms < 1000)
    return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

const displayFirstAudioMs = computed(() => testStats.value?.firstAudioMs ?? null)
const displayGenerationMs = computed(() => {
  if (isTesting.value)
    return elapsedMs.value
  return testStats.value?.generationMs ?? null
})
const displayRtf = computed(() => {
  if (testStats.value == null)
    return '—'
  return testStats.value.rtf > 0 ? testStats.value.rtf.toFixed(2) : '—'
})
const displayFrames = computed(() => {
  if (testStats.value == null)
    return '—'
  return String(testStats.value.frames)
})

function registerOptionWatchers() {
  watch(sampleKey, (id) => {
  // The shared Select is a free-text combobox: on blur it commits whatever
  // text is in the box — including the placeholder itself — so only exact
  // known ids may act. Anything else is rejected back to the placeholder.
    if (!id)
      return
    if (SAMPLE_TEXTS.some(s => s.id === id)) {
      onSampleSelect(id)
    }
    else {
      sampleKey.value = ''
    }
  })

  watch(expressionKey, (tag) => {
  // Same free-text guard as above: only the 14 canonical tags act.
  // Anything else (placeholder text, casing variants, typed noise) is dropped.
    if (!tag)
      return
    if (MING3_EXPRESSION_TAGS.some(t => t.tag === tag)) {
      insertExpression(tag)
    }
    else {
      expressionKey.value = ''
    }
  })

  watch(threads, () => {
    onThreadsChange()
  })
}

const sayText = ref('Welcome back. Let\u2019s make something wonderful together.')
const sayTextarea = ref<HTMLTextAreaElement | null>(null)

function applySample(id: string) {
  const sample = SAMPLE_TEXTS.find(s => s.id === id)
  if (sample)
    sayText.value = sample.text
  pendingSampleKey.value = ''
  sampleKey.value = ''
}

function onSampleSelect(id: string) {
  if (!id)
    return
  // Dirty-text protection: never silently clobber a draft.
  if (sayText.value.trim()) {
    pendingSampleKey.value = id
    sampleKey.value = ''
    return
  }
  applySample(id)
}

function insertExpression(tag: string) {
  if (!tag)
    return
  const el = sayTextarea.value
  const insert = `${tag} `
  if (el && typeof el.selectionStart === 'number') {
    const start = el.selectionStart
    const end = el.selectionEnd ?? start
    sayText.value = `${sayText.value.slice(0, start)}${insert}${sayText.value.slice(end)}`
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + insert.length
      el.setSelectionRange(pos, pos)
    })
  }
  else {
    sayText.value = `${sayText.value}${sayText.value.endsWith(' ') || !sayText.value ? '' : ' '}${insert}`
  }
  expressionKey.value = ''
}

function openSelectedInEditor() {
  const id = selectedVoiceId.value
  if (!isMingDesignVoiceId(id))
    return
  const design = designs.value.find(d => d.id === id)
  if (design) {
    openDesign(design)
    showVoicePrompt.value = false
  }
}

// --- Test run (no live playback: the finished clip plays once generation completes) ---
async function handleTestVoice(designPrompt?: string) {
  if (isTesting.value)
    return
  const text = sayText.value.trim()
  if (!text) {
    toast.error('Enter some text to synthesize first.')
    return
  }
  const voiceId = selectedVoiceId.value || voiceOptions.value[0]?.value
  if (!voiceId && !designPrompt) {
    toast.error('Select a voice first.')
    return
  }
  isTesting.value = true
  elapsedMs.value = 0
  const t0 = performance.now()
  elapsedTimer = setInterval(() => {
    elapsedMs.value = performance.now() - t0
  }, 100)
  try {
    const adapter = await getMing3AdapterInstance()
    if (adapter.state !== 'ready') {
      await adapter.loadModel({
        model: model.value,
        threads: threads.value === 'auto' ? 'auto' : Number(threads.value),
        onProgress: (p: any) => {
          if (typeof p.percent === 'number')
            busyPercent.value = Math.min(100, Math.round(p.percent))
        },
      })
      engineState.value = 'ready'
      await refreshCacheStatus()
      await speechStore.loadVoicesForProvider(providerId)
    }
    const wav = await adapter.generate(text, voiceId, {
      preset: preset.value,
      threads: threads.value === 'auto' ? 'auto' : Number(threads.value),
      ...(designPrompt ? { designPrompt } : {}),
    })
    if (audioUrl.value)
      URL.revokeObjectURL(audioUrl.value)
    audioUrl.value = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))
    const stats = adapter.lastRunStats
    testStats.value = stats
      ? { firstAudioMs: stats.firstAudioMs, generationMs: stats.generationMs, rtf: stats.rtf, frames: stats.frames, stopped: stats.stopped }
      : null
    // Play only the finished clip — never live while the engine is still
    // synthesizing. Browser autoplay policy may reject long after the click,
    // in which case the user presses play manually.
    if (testStats.value && !testStats.value.stopped) {
      await nextTick()
      await audioEl.value?.play().catch(() => {})
    }
  }
  catch (err) {
    if ((err as Error)?.name !== 'AbortError') {
      console.error('[Ming3 Playground] Test synthesis failed:', err)
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }
  finally {
    if (elapsedTimer) {
      clearInterval(elapsedTimer)
      elapsedTimer = null
    }
    elapsedMs.value = performance.now() - t0
    isTesting.value = false
    // A threads change requested mid-run applies now that the engine is idle.
    if (pendingThreadsReload.value) {
      pendingThreadsReload.value = false
      try {
        const adapter = await getMing3AdapterInstance()
        await adapter.loadModel({ model: model.value, threads: threads.value === 'auto' ? 'auto' : Number(threads.value) })
        engineState.value = 'ready'
      }
      catch (err) {
        console.error('[Ming3 Settings] Deferred threads reload failed:', err)
      }
    }
  }
}

async function handleTryDraft() {
  const prompt = editor.value.prompt.trim()
  if (!prompt)
    return
  await handleTestVoice(prompt)
}

async function handleStop() {
  try {
    const adapter = await getMing3AdapterInstance()
    adapter.stop()
  }
  catch {
    // Engine not initialized — nothing to stop.
  }
  audioEl.value?.pause()
}

const waveformBars = Array.from({ length: 56 }, (_, i) => {
  const v = Math.abs(Math.sin(i * 0.7) * 0.7 + Math.sin(i * 0.23) * 0.3)
  return 4 + Math.round(v * 36)
})

registerOptionWatchers()

onMounted(async () => {
  try {
    threadingAvailable.value = (globalThis as { crossOriginIsolated?: unknown }).crossOriginIsolated === true
  }
  catch {
    threadingAvailable.value = false
  }
  try {
    relaxedSimd.value = isRelaxedSimdSupported()
  }
  catch {
    relaxedSimd.value = false
  }
  try {
    const adapter = await getMing3AdapterInstance()
    if (adapter.state === 'ready')
      engineState.value = 'ready'
  }
  catch {}
  await providersStore.fetchModelsForProvider(providerId).catch(() => {})
  await speechStore.loadVoicesForProvider(providerId).catch(() => {})
  await loadDesigns()
  await refreshCacheStatus()
})

onUnmounted(() => {
  if (elapsedTimer)
    clearInterval(elapsedTimer)
  audioEl.value?.pause()
  if (audioUrl.value)
    URL.revokeObjectURL(audioUrl.value)
})
</script>

<template>
  <ProviderSettingsLayout
    :provider-name="providerMetadata?.localizedName"
    :provider-description="providerMetadata?.localizedDescription"
    :provider-icon="providerMetadata?.icon"
    :deployment="providerMetadata?.deployment"
    :pricing="providerMetadata?.pricing"
  >
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] text-sky-600 font-bold dark:text-sky-400">
          {{ t('settings.pages.providers.provider.ming3-local.header.preview') }}
        </span>
        <span class="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600 font-semibold dark:bg-neutral-800 dark:text-neutral-300">
          <div class="i-solar:volume-loud-bold-duotone" />
          {{ t('settings.pages.providers.provider.ming3-local.chips.voiceDesign') }}
        </span>
        <span class="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600 font-semibold dark:bg-neutral-800 dark:text-neutral-300">
          <div class="i-solar:earth-bold-duotone" />
          {{ t('settings.pages.providers.provider.ming3-local.chips.multilingual') }}
        </span>
        <span class="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600 font-semibold dark:bg-neutral-800 dark:text-neutral-300">
          <div class="i-solar:chart-2-bold-duotone" />
          {{ t('settings.pages.providers.provider.ming3-local.chips.sampleRate') }}
        </span>
      </div>

      <div class="grid items-start gap-4 xl:grid-cols-2">
        <!-- Left column -->
        <div class="flex flex-col gap-4">
          <!-- Model & performance -->
          <div class="flex flex-col gap-3.5 border border-neutral-200 rounded-xl bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div>
              <h3 class="m-0 flex items-center gap-2 text-sm font-bold">
                <div class="i-solar:settings-bold-duotone text-neutral-400" />
                {{ t('settings.pages.providers.provider.ming3-local.model.title') }}
              </h3>
              <p class="m-0 mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                {{ t('settings.pages.providers.provider.ming3-local.model.description') }}
              </p>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold">{{ t('settings.pages.providers.provider.ming3-local.model.label') }}</label>
              <Select v-model="model" :options="modelOptions" :disabled="modelsLoading || isBusy" />
              <p class="m-0 text-[11px] text-neutral-400">
                {{ t('settings.pages.providers.provider.ming3-local.model.caption') }}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-semibold">{{ t('settings.pages.providers.provider.ming3-local.model.files') }}</span>
              <span
                v-if="cacheChecked.cached"
                class="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400"
              >
                <div class="i-solar:check-circle-bold text-xs" />
                {{ t('settings.pages.providers.provider.ming3-local.model.downloaded') }}
                <span v-if="cacheChecked.sizeBytes > 0" class="font-normal font-mono opacity-80">· {{ formatBytes(cacheChecked.sizeBytes) }}</span>
              </span>
              <span v-else class="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500 font-bold dark:bg-neutral-800 dark:text-neutral-400">
                {{ t('settings.pages.providers.provider.ming3-local.diagnostics.notCached') }}
              </span>
              <div class="ml-auto flex items-center gap-1.5">
                <Button
                  size="sm"
                  :disabled="isBusy"
                  :loading="isBusy"
                  @click="handleLoadModel"
                >
                  {{ cacheChecked.cached
                    ? t('settings.pages.providers.provider.ming3-local.model.loadModel')
                    : t('settings.pages.providers.provider.ming3-local.model.downloadModel') }}
                </Button>
                <Button
                  v-if="cacheChecked.cached && !showDeleteModelConfirm"
                  variant="danger"
                  size="sm"
                  icon="i-solar:trash-bin-trash-linear"
                  :disabled="isBusy"
                  :title="t('settings.pages.providers.provider.ming3-local.model.deleteFiles')"
                  @click="showDeleteModelConfirm = true"
                />
              </div>
            </div>
            <div v-if="showDeleteModelConfirm" class="flex flex-wrap items-center gap-2 rounded-lg bg-red-500/10 p-2.5 text-xs">
              <span class="flex-1">{{ t('settings.pages.providers.provider.ming3-local.model.deleteConfirm') }}</span>
              <Button size="sm" variant="secondary-muted" @click="showDeleteModelConfirm = false">
                {{ t('settings.pages.providers.provider.ming3-local.model.cancel') }}
              </Button>
              <Button size="sm" variant="danger" @click="confirmDeleteModel">
                {{ t('settings.pages.providers.provider.ming3-local.model.delete') }}
              </Button>
            </div>
            <div v-if="isBusy" class="flex flex-col gap-1">
              <div class="flex justify-between text-xs opacity-70">
                <span class="font-medium">{{ busyMessage || t('settings.pages.providers.provider.ming3-local.model.loading') }}</span>
                <span class="font-mono">{{ busyPercent }}%</span>
              </div>
              <div class="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                <div class="h-full rounded-full bg-sky-500 transition-all" :style="{ width: `${busyPercent}%` }" />
              </div>
            </div>

            <div class="flex items-center gap-1.5 text-xs">
              <div v-if="threadingAvailable" class="i-solar:check-circle-bold text-emerald-500" />
              <div v-else class="i-solar:info-circle-bold text-amber-500" />
              <span class="font-semibold">
                {{ threadingAvailable
                  ? t('settings.pages.providers.provider.ming3-local.model.compatible')
                  : t('settings.pages.providers.provider.ming3-local.model.compatibleSingle') }}
              </span>
              <span
                v-if="!threadingAvailable"
                class="text-[11px] text-neutral-400"
                :title="t('settings.pages.providers.provider.ming3-local.model.compatHint')"
              >
                {{ t('settings.pages.providers.provider.ming3-local.model.compatHint') }}
              </span>
            </div>

            <div class="flex flex-col gap-1.5">
              <span class="text-xs font-semibold">{{ t('settings.pages.providers.provider.ming3-local.preset.label') }}</span>
              <div class="grid grid-cols-3 gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
                <button
                  v-for="p in (['quality', 'balanced', 'fast'] as const)"
                  :key="p"
                  class="rounded-md px-2 py-1.5 text-xs font-semibold transition"
                  :class="preset === p
                    ? 'bg-white text-sky-600 shadow-sm dark:bg-neutral-900 dark:text-sky-400'
                    : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'"
                  @click="preset = p"
                >
                  {{ t(`settings.pages.providers.provider.ming3-local.preset.${p}`) }}
                </button>
              </div>
              <p class="m-0 text-[11px] text-neutral-400">
                {{ t('settings.pages.providers.provider.ming3-local.preset.caption') }}
              </p>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold">{{ t('settings.pages.providers.provider.ming3-local.threads.label') }}</label>
              <Select v-model="threads" :options="threadOptions" :disabled="isBusy" />
              <p class="m-0 text-[11px] text-neutral-400">
                {{ t('settings.pages.providers.provider.ming3-local.threads.caption') }}
              </p>
            </div>

            <div class="border border-neutral-100 rounded-lg dark:border-neutral-800/60">
              <button class="w-full flex items-center gap-2 p-2.5 text-xs font-semibold" @click="showDiagnostics = !showDiagnostics">
                <div class="i-solar:chart-bold-duotone text-neutral-400" />
                {{ t('settings.pages.providers.provider.ming3-local.diagnostics.title') }}
                <div class="i-solar:alt-arrow-down-bold ml-auto text-neutral-400 transition" :class="showDiagnostics ? 'rotate-180' : ''" />
              </button>
              <div v-if="showDiagnostics" class="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-neutral-100 p-2.5 text-[11px] dark:border-neutral-800/60">
                <span class="text-neutral-400">{{ t('settings.pages.providers.provider.ming3-local.diagnostics.build') }}</span>
                <span class="text-right font-mono">{{ diagBuild }}</span>
                <span class="text-neutral-400">{{ t('settings.pages.providers.provider.ming3-local.diagnostics.threads') }}</span>
                <span class="text-right font-mono">{{ diagThreads }}</span>
                <span class="text-neutral-400">{{ t('settings.pages.providers.provider.ming3-local.diagnostics.cache') }}</span>
                <span class="text-right font-mono">{{ cacheChecked.cached ? formatBytes(cacheChecked.sizeBytes) : t('settings.pages.providers.provider.ming3-local.diagnostics.notCached') }}</span>
              </div>
            </div>
          </div>

          <!-- Voice designs -->
          <div class="flex flex-col gap-3.5 border border-neutral-200 rounded-xl bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="m-0 flex items-center gap-2 text-sm font-bold">
                  <div class="i-solar:user-bold-duotone text-neutral-400" />
                  {{ t('settings.pages.providers.provider.ming3-local.designs.title') }}
                </h3>
                <p class="m-0 mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {{ t('settings.pages.providers.provider.ming3-local.designs.description') }}
                </p>
              </div>
              <Button size="sm" icon="i-solar:add-circle-bold" @click="newDesign">
                {{ t('settings.pages.providers.provider.ming3-local.designs.new') }}
              </Button>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold">{{ t('settings.pages.providers.provider.ming3-local.designs.nameLabel') }}</label>
              <Input v-model="editor.name" :placeholder="t('settings.pages.providers.provider.ming3-local.designs.namePlaceholder')" />
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold">{{ t('settings.pages.providers.provider.ming3-local.designs.promptLabel') }}</label>
              <textarea
                v-model="editor.prompt"
                rows="3"
                class="w-full border border-neutral-200 rounded-lg bg-transparent p-2.5 text-xs outline-none dark:border-neutral-700 focus:border-sky-500"
                :placeholder="t('settings.pages.providers.provider.ming3-local.designs.promptPlaceholder')"
              />
              <p class="m-0 text-[11px] text-neutral-400">
                {{ t('settings.pages.providers.provider.ming3-local.designs.promptHint') }}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary-muted" icon="i-solar:play-bold" :disabled="!editor.prompt.trim() || isTesting" @click="handleTryDraft">
                {{ t('settings.pages.providers.provider.ming3-local.designs.try') }}
              </Button>
              <Button
                v-if="!promptChanged"
                size="sm"
                icon="i-solar:disk-bold-duotone"
                :disabled="!editor.prompt.trim()"
                @click="saveDesign"
              >
                {{ t('settings.pages.providers.provider.ming3-local.designs.save') }}
              </Button>
              <Button
                v-else
                size="sm"
                icon="i-solar:disk-bold-duotone"
                :disabled="!editor.prompt.trim()"
                @click="saveAsNewDesign"
              >
                {{ t('settings.pages.providers.provider.ming3-local.designs.saveAsNew') }}
              </Button>
              <p v-if="promptChanged" class="m-0 w-full text-[11px] text-amber-600 dark:text-amber-400">
                {{ t('settings.pages.providers.provider.ming3-local.designs.saveAsNewHint') }}
              </p>
            </div>

            <div class="flex flex-col gap-1.5">
              <span class="text-xs font-semibold">{{ t('settings.pages.providers.provider.ming3-local.designs.savedTitle') }}</span>
              <div v-if="designs.length > 0" class="flex flex-col gap-1.5">
                <div
                  v-for="design in designs"
                  :key="design.id"
                  class="flex items-center gap-2.5 border rounded-lg p-2.5 text-xs transition"
                  :class="editor.id === design.id
                    ? 'border-sky-500/40 bg-sky-500/5'
                    : 'border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800/60 dark:hover:bg-neutral-800/40'"
                >
                  <div
                    class="h-4 w-4 shrink-0 border-2 rounded-full"
                    :class="editor.id === design.id ? 'border-sky-500 bg-sky-500/30' : 'border-neutral-300 dark:border-neutral-600'"
                  />
                  <button class="min-w-0 flex flex-1 flex-col items-start gap-0.5 truncate text-left" @click="openDesign(design)">
                    <span class="truncate font-bold">{{ design.name }}</span>
                    <span class="w-full truncate text-[11px] text-neutral-400">{{ design.designPrompt }}</span>
                  </button>
                  <button
                    class="shrink-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                    :title="t('settings.pages.providers.provider.ming3-local.designs.viewDescription')"
                    @click="openDesign(design)"
                  >
                    <div class="i-solar:pen-bold text-sm" />
                  </button>
                  <button
                    v-if="pendingDeleteDesignId !== design.id"
                    class="shrink-0 text-neutral-400 hover:text-red-500"
                    @click="pendingDeleteDesignId = design.id"
                  >
                    <div class="i-solar:trash-bin-trash-linear text-sm" />
                  </button>
                  <span v-else class="flex shrink-0 items-center gap-1">
                    <button class="rounded px-1.5 py-0.5 text-[10px] text-neutral-400 font-bold hover:text-neutral-600" @click="pendingDeleteDesignId = null">
                      {{ t('settings.pages.providers.provider.ming3-local.model.cancel') }}
                    </button>
                    <button class="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-500 font-bold" @click="deleteDesign(design.id)">
                      {{ t('settings.pages.providers.provider.ming3-local.model.delete') }}
                    </button>
                  </span>
                </div>
              </div>
              <p v-else class="m-0 text-xs text-neutral-400">
                {{ t('settings.pages.providers.provider.ming3-local.designs.empty') }}
              </p>
              <p class="m-0 flex items-center gap-1.5 text-[11px] text-neutral-400">
                <span class="i-solar:info-circle-bold shrink-0" />
                <span>{{ t('settings.pages.providers.provider.ming3-local.designs.noCloning') }}</span>
              </p>
            </div>
          </div>
        </div>

        <!-- Right column: Voice Playground -->
        <div class="flex flex-col gap-3.5 border border-neutral-200 rounded-xl bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div>
            <h3 class="m-0 flex items-center gap-2 text-sm font-bold">
              <div class="i-solar:volume-loud-bold-duotone text-neutral-400" />
              {{ t('settings.pages.providers.provider.ming3-local.playground.title') }}
            </h3>
            <p class="m-0 mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {{ t('settings.pages.providers.provider.ming3-local.playground.hint') }}
            </p>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold">{{ t('settings.pages.providers.provider.ming3-local.playground.voiceLabel') }}</label>
            <div class="flex items-center gap-2">
              <Select v-model="selectedVoiceId" :options="voiceSelectOptions" class="min-w-0 flex-1" />
              <span
                v-if="selectedVoiceId"
                class="shrink-0 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] text-sky-600 font-bold dark:text-sky-400"
              >
                {{ selectedVoiceKind === 'design'
                  ? t('settings.pages.providers.provider.ming3-local.playground.savedDesignBadge')
                  : t('settings.pages.providers.provider.ming3-local.playground.builtinBadge') }}
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <div class="flex gap-1 rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
                <button
                  v-for="tab in (['all', 'builtin', 'designs'] as const)"
                  :key="tab"
                  class="rounded-md px-2 py-1 text-[11px] font-semibold transition"
                  :class="voiceTab === tab
                    ? 'bg-white text-sky-600 shadow-sm dark:bg-neutral-900 dark:text-sky-400'
                    : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'"
                  @click="voiceTab = tab"
                >
                  {{ t(`settings.pages.providers.provider.ming3-local.playground.tabs${tab === 'all' ? 'All' : tab === 'builtin' ? 'Builtin' : 'Designs'}`) }}
                </button>
              </div>
              <div class="relative min-w-32 flex-1">
                <Input v-model="voiceSearch" :placeholder="t('settings.pages.providers.provider.ming3-local.playground.searchPlaceholder')" />
              </div>
            </div>
          </div>

          <div v-if="selectedVoice" class="border border-neutral-100 rounded-lg dark:border-neutral-800/60">
            <button class="w-full flex items-center gap-1.5 p-2.5 text-xs font-semibold" @click="showVoicePrompt = !showVoicePrompt">
              <div class="i-solar:alt-arrow-down-bold text-neutral-400 transition" :class="showVoicePrompt ? 'rotate-180' : ''" />
              {{ t('settings.pages.providers.provider.ming3-local.playground.voicePrompt') }}
              <span class="ml-auto truncate pl-2 text-[11px] text-neutral-400 font-normal">{{ selectedVoice.name }}</span>
            </button>
            <div v-if="showVoicePrompt" class="border-t border-neutral-100 p-2.5 text-xs text-neutral-500 dark:border-neutral-800/60 dark:text-neutral-400">
              <p class="m-0 whitespace-pre-wrap">
                {{ selectedVoice.description || selectedVoice.name }}
              </p>
              <button
                v-if="selectedVoiceKind === 'design'"
                class="mt-1.5 text-[11px] text-sky-600 font-semibold dark:text-sky-400 hover:underline"
                @click="openSelectedInEditor"
              >
                {{ t('settings.pages.providers.provider.ming3-local.designs.viewDescription') }} →
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold">{{ t('settings.pages.providers.provider.ming3-local.playground.sayLabel') }}</label>
            <textarea
              ref="sayTextarea"
              v-model="sayText"
              rows="4"
              maxlength="2000"
              class="w-full border border-neutral-200 rounded-lg bg-transparent p-2.5 text-xs outline-none dark:border-neutral-700 focus:border-sky-500"
            />
            <div class="flex items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-1.5">
                <Select v-model="sampleKey" :options="sampleOptions" :placeholder="t('settings.pages.providers.provider.ming3-local.playground.sampleLabel')" />
                <Select v-model="expressionKey" :options="expressionOptions" :placeholder="t('settings.pages.providers.provider.ming3-local.playground.insertExpression')" />
              </div>
              <span class="shrink-0 text-[10px] text-neutral-400 font-mono">{{ sayText.length }}/2000</span>
            </div>
            <div v-if="pendingSampleKey" class="flex flex-wrap items-center gap-2 rounded-lg bg-amber-500/10 p-2 text-[11px]">
              <span class="flex-1">{{ pendingSampleText }}</span>
              <Button size="sm" variant="secondary-muted" @click="pendingSampleKey = ''; sampleKey = ''">
                {{ t('settings.pages.providers.provider.ming3-local.playground.keepEditing') }}
              </Button>
              <Button size="sm" @click="applySample(pendingSampleKey)">
                {{ t('settings.pages.providers.provider.ming3-local.playground.replaceText') }}
              </Button>
            </div>
            <p class="m-0 text-[11px] text-neutral-400">
              {{ t('settings.pages.providers.provider.ming3-local.playground.experimentalNote') }}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <Button
              class="flex-1"
              size="sm"
              icon="i-solar:play-bold"
              :disabled="isTesting || isBusy"
              :loading="isTesting || isBusy"
              @click="handleTestVoice()"
            >
              {{ !cacheChecked.cached || engineState !== 'ready'
                ? t('settings.pages.providers.provider.ming3-local.playground.loadAndTest')
                : t('settings.pages.providers.provider.ming3-local.playground.testVoice') }}
            </Button>
            <Button size="sm" variant="secondary-muted" icon="i-solar:stop-bold" :disabled="!isTesting" @click="handleStop">
              {{ t('settings.pages.providers.provider.ming3-local.playground.stop') }}
            </Button>
          </div>
          <p class="m-0 text-[11px] text-neutral-400">
            {{ t('settings.pages.providers.provider.ming3-local.playground.runningNote') }}
          </p>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold">{{ t('settings.pages.providers.provider.ming3-local.playground.audioOutput') }}</span>
              <a v-if="audioUrl" :href="audioUrl" download="ming.wav">
                <Button size="sm" variant="secondary-muted" icon="i-solar:download-bold">
                  {{ t('settings.pages.providers.provider.ming3-local.playground.downloadWav') }}
                </Button>
              </a>
              <Button v-else size="sm" variant="secondary-muted" icon="i-solar:download-bold" disabled>
                {{ t('settings.pages.providers.provider.ming3-local.playground.downloadWav') }}
              </Button>
            </div>
            <div v-if="audioUrl" class="flex flex-col gap-2">
              <div class="h-12 flex items-end justify-center gap-[3px]" :class="isTesting ? 'animate-pulse' : ''" aria-hidden="true">
                <div
                  v-for="(h, i) in waveformBars"
                  :key="i"
                  class="w-[3px] rounded-full bg-sky-500/60"
                  :style="{ height: `${h}px` }"
                />
              </div>
              <audio ref="audioEl" :src="audioUrl" controls class="w-full" />
            </div>
            <p v-else class="m-0 py-4 text-center text-xs text-neutral-400">
              {{ t('settings.pages.providers.provider.ming3-local.playground.previewEmpty') }}
            </p>
          </div>

          <div class="border border-neutral-100 rounded-lg dark:border-neutral-800/60">
            <button class="w-full flex items-center gap-2 p-2.5 text-xs font-semibold" @click="showStreamingDiagnostics = !showStreamingDiagnostics">
              <div class="i-solar:chart-bold-duotone text-neutral-400" />
              {{ t('settings.pages.providers.provider.ming3-local.playground.streamingDiagnostics') }}
              <div class="i-solar:alt-arrow-down-bold ml-auto text-neutral-400 transition" :class="showStreamingDiagnostics ? 'rotate-180' : ''" />
            </button>
            <div v-if="showStreamingDiagnostics" class="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-neutral-100 p-2.5 text-[11px] dark:border-neutral-800/60">
              <span class="text-neutral-400">{{ t('settings.pages.providers.provider.ming3-local.playground.firstAudio') }}</span>
              <span class="text-right font-mono">{{ formatMs(displayFirstAudioMs) }}</span>
              <span class="text-neutral-400">{{ t('settings.pages.providers.provider.ming3-local.playground.generationTime') }}</span>
              <span class="text-right font-mono">{{ formatMs(displayGenerationMs) }}</span>
              <span class="text-neutral-400">{{ t('settings.pages.providers.provider.ming3-local.playground.rtf') }}</span>
              <span class="text-right font-mono">{{ displayRtf }}</span>
              <span class="text-neutral-400">{{ t('settings.pages.providers.provider.ming3-local.playground.frames') }}</span>
              <span class="text-right font-mono">{{ displayFrames }}</span>
            </div>
          </div>
          <p class="m-0 text-center text-[10px] text-neutral-400">
            {{ presetLabel }} {{ t('settings.pages.providers.provider.ming3-local.playground.presetSuffix') }} · {{ threadsLabel }} · 44.1 kHz {{ t('settings.pages.providers.provider.ming3-local.playground.outputSuffix') }}
          </p>
        </div>
      </div>
    </div>
  </ProviderSettingsLayout>
</template>

<route lang="yaml">
  meta:
    layout: settings
    stageTransition:
      name: slide
</route>
