<script setup lang="ts">
import type { FreeAICatalogModel } from '@proj-airi/stage-ui/stores/providers/free-ai-catalog'

import { CloudflareConnectDialog } from '@proj-airi/stage-ui/components'
import { useFreeAICatalogStore } from '@proj-airi/stage-ui/stores'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useCloudflareStore } from '@proj-airi/stage-ui/stores/modules/cloudflare'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useHearingStore } from '@proj-airi/stage-ui/stores/modules/hearing'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { resolveProviderId } from './helpers'

const router = useRouter()
const catalogStore = useFreeAICatalogStore()
const cloudflareStore = useCloudflareStore()
const providersStore = useProvidersStore()
const consciousnessStore = useConsciousnessStore()
const hearingStore = useHearingStore()
const airiCardStore = useAiriCardStore()

const { activeCard, activeCardId } = storeToRefs(airiCardStore)

const {
  searchQuery,
  selectedModality,
  selectedPlatform,
  filterOnlyTools,
  filterHighRpm,
  filterHighContext,
  sortBy,
  sortDirection,
  viewMode,
  catalogVersion,
  catalogGeneratedAt,
  totalModelsCount,
  availablePlatforms,
  countsByModality,
  filteredModels,
  selectedModelDetail,
} = storeToRefs(catalogStore)

// Persistent test API keys by platform (e.g. { navy: '...', groq: '...' })
const savedApiKeys = useLocalStorage<Record<string, string>>('settings/free-hub/test-api-keys', {})
const customBaseUrl = ref('')
const showApiKey = ref(false)
const showReasoning = ref(false)
const isTesting = ref(false)
const isReauthorizing = ref(false)
const isConnectModalOpen = ref(false)
const isSaving = ref(false)
const isActivating = ref(false)
const filterConfiguredOnly = ref(false)

const displayedModels = computed<FreeAICatalogModel[]>(() => {
  let list = filteredModels.value
  if (filterConfiguredOnly.value) {
    list = list.filter(m => isPlatformConfigured(m.platform, m.modality))
  }
  return list
})

interface TestResult {
  success: boolean
  status: number
  latencyMs: number
  content?: string
  reasoningContent?: string
  hasReasoning?: boolean
  modelReported?: string
  tokensUsage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  error?: string
}

const testResult = ref<TestResult | null>(null)

function resolvePlatformBaseUrl(rawUrl: string): string {
  if (!rawUrl)
    return ''
  if (selectedModelDetail.value?.platform.toLowerCase() === 'cloudflare' && cloudflareStore.activeAccountId) {
    return rawUrl.replace(/\{account_id\}/gi, cloudflareStore.activeAccountId)
  }
  return rawUrl
}

const isUsingCloudflareOAuth = computed(() => {
  if (!selectedModelDetail.value || selectedModelDetail.value.platform.toLowerCase() !== 'cloudflare')
    return false
  return !savedApiKeys.value.cloudflare && Boolean(cloudflareStore.activeAccessToken)
})

// Current model's API key
const currentApiKey = computed({
  get: () => {
    if (!selectedModelDetail.value)
      return ''
    const platform = selectedModelDetail.value.platform.toLowerCase()
    const saved = savedApiKeys.value[platform]
    if (saved !== undefined && saved !== '')
      return saved
    if (platform === 'cloudflare' && cloudflareStore.activeAccessToken)
      return cloudflareStore.activeAccessToken
    return ''
  },
  set: (val: string) => {
    if (!selectedModelDetail.value)
      return
    savedApiKeys.value[selectedModelDetail.value.platform.toLowerCase()] = val
  },
})

function clearManualCloudflareKey() {
  delete savedApiKeys.value.cloudflare
}

const targetProviderId = computed(() => {
  if (!selectedModelDetail.value)
    return ''
  return resolveProviderId(selectedModelDetail.value.platform, selectedModelDetail.value.modality)
})

const isProviderSaved = computed(() => {
  if (!targetProviderId.value)
    return false
  return Boolean(providersStore.configuredProviders[targetProviderId.value])
})

const isActiveModel = computed(() => {
  if (!selectedModelDetail.value || !targetProviderId.value)
    return false
  if (selectedModelDetail.value.modality === 'transcription') {
    return hearingStore.activeTranscriptionProvider === targetProviderId.value
      && hearingStore.activeTranscriptionModel === selectedModelDetail.value.modelId
  }
  return consciousnessStore.activeProvider === targetProviderId.value
    && consciousnessStore.activeModel === selectedModelDetail.value.modelId
})

function isModelActive(item: FreeAICatalogModel): boolean {
  const pid = resolveProviderId(item.platform, item.modality)
  if (item.modality === 'transcription') {
    return hearingStore.activeTranscriptionProvider === pid && hearingStore.activeTranscriptionModel === item.modelId
  }
  return consciousnessStore.activeProvider === pid && consciousnessStore.activeModel === item.modelId
}

function isPlatformConfigured(platform: string, modality?: string): boolean {
  const pid = resolveProviderId(platform, modality)
  return Boolean(providersStore.configuredProviders[pid])
}

function getTargetProviderConfig(pid: string) {
  const key = currentApiKey.value.trim()
  const rawBase = customBaseUrl.value.trim() || selectedModelDetail.value?.platformBaseUrl || ''
  const baseUrl = resolvePlatformBaseUrl(rawBase).replace(/\/+$/, '')

  if (pid === 'cloudflare-workers-ai') {
    return {
      apiKey: key || cloudflareStore.activeAccessToken,
      accountId: cloudflareStore.activeAccountId,
    }
  }

  if (pid === 'openai-compatible-audio-transcription') {
    const isCloudflare = selectedModelDetail.value?.platform.toLowerCase() === 'cloudflare'
    return {
      apiKey: key || (isCloudflare ? cloudflareStore.activeAccessToken : ''),
      baseUrl: baseUrl || (isCloudflare
        ? `https://api.cloudflare.com/client/v4/accounts/${cloudflareStore.activeAccountId}/ai/v1`
        : ''),
    }
  }

  if (pid === 'openai-compatible') {
    return {
      apiKey: key,
      baseUrl,
    }
  }

  // Other native providers
  const config: Record<string, any> = {
    apiKey: key,
  }
  if (baseUrl) {
    config.baseUrl = baseUrl
  }
  return config
}

function openProviderSettings() {
  if (!targetProviderId.value || !selectedModelDetail.value)
    return
  const category = selectedModelDetail.value.modality === 'transcription' ? 'transcription' : 'chat'
  void router.push(`/settings/providers/${category}/${targetProviderId.value}`)
}

async function handleSaveProvider(): Promise<boolean> {
  if (!selectedModelDetail.value || !targetProviderId.value)
    return false

  const pid = targetProviderId.value
  const config = getTargetProviderConfig(pid)

  if (pid === 'cloudflare-workers-ai' && (!config.apiKey || !config.accountId)) {
    toast.error('Cloudflare Workers AI requires both Account ID and API Key/OAuth Token.')
    return false
  }

  isSaving.value = true
  try {
    if (!providersStore.providers[pid]) {
      providersStore.providers[pid] = {}
    }
    Object.assign(providersStore.providers[pid], config)
    providersStore.markProviderAdded(pid)
    void providersStore.validateProvider(pid).catch(() => {})
    toast.success(`Saved ${selectedModelDetail.value.platformDisplayName} to AIRI Providers!`)
    return true
  }
  catch (err: any) {
    toast.error(err?.message || 'Failed to save provider')
    return false
  }
  finally {
    isSaving.value = false
  }
}

async function handleUseAsActiveModel() {
  if (!selectedModelDetail.value || !targetProviderId.value)
    return

  const pid = targetProviderId.value
  const modelId = selectedModelDetail.value.modelId
  const modelName = selectedModelDetail.value.displayName

  isActivating.value = true
  try {
    // 1. Ensure provider credentials are saved
    const saved = await handleSaveProvider()
    if (!saved)
      return

    // 2. Set as active model depending on modality
    if (selectedModelDetail.value.modality === 'transcription') {
      hearingStore.activeTranscriptionProvider = pid
      hearingStore.activeTranscriptionModel = modelId

      toast.success(`Set ${modelName} as active hearing model!`, {
        action: {
          label: 'Hearing Settings',
          onClick: () => router.push('/settings/hearing'),
        },
      })
    }
    else {
      // Global default consciousness
      consciousnessStore.activeProvider = pid
      consciousnessStore.activeModel = modelId

      // Update active character card if present
      if (activeCard.value) {
        airiCardStore.updateCard(activeCardId.value, {
          extensions: {
            ...activeCard.value.extensions,
            airi: {
              ...activeCard.value.extensions?.airi,
              modules: {
                ...activeCard.value.extensions?.airi?.modules,
                consciousness: {
                  provider: pid,
                  model: modelId,
                },
              },
            },
          },
        } as any)
      }

      const charName = activeCard.value?.name || 'Active Character'
      toast.success(`Set ${modelName} as active model for AIRI and ${charName}!`, {
        action: {
          label: 'Open Chat',
          onClick: () => router.push('/chat'),
        },
      })
    }
  }
  catch (err: any) {
    toast.error(err?.message || 'Failed to set active model')
  }
  finally {
    isActivating.value = false
  }
}

// Sync customBaseUrl whenever selected model or cloudflare account changes
watch(
  [() => selectedModelDetail.value?.id, () => cloudflareStore.activeAccountId],
  () => {
    if (selectedModelDetail.value) {
      customBaseUrl.value = resolvePlatformBaseUrl(selectedModelDetail.value.platformBaseUrl || '')
      testResult.value = null
      showReasoning.value = false
    }
  },
  { immediate: true },
)

function resetBaseUrl() {
  if (selectedModelDetail.value) {
    customBaseUrl.value = resolvePlatformBaseUrl(selectedModelDetail.value.platformBaseUrl || '')
  }
}

async function handleCloudflareConnect() {
  isConnectModalOpen.value = true
}

async function handleCloudflareReauth() {
  isReauthorizing.value = true
  try {
    const tokens = await cloudflareStore.authenticateWithCloudflare()
    if (tokens?.accessToken) {
      toast.success('Successfully authorized Cloudflare with Workers AI scopes!')
      clearManualCloudflareKey()
      if (selectedModelDetail.value) {
        customBaseUrl.value = resolvePlatformBaseUrl(selectedModelDetail.value.platformBaseUrl || '')
      }
    }
  }
  catch (err: any) {
    toast.error(err?.message || 'Failed to authorize Cloudflare')
  }
  finally {
    isReauthorizing.value = false
  }
}

async function pasteApiKey() {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      currentApiKey.value = text.trim()
    }
  }
  catch (e) {
    console.warn('[FreeHub] Clipboard read failed:', e)
  }
}

async function runTestProbe() {
  if (!selectedModelDetail.value || isTesting.value)
    return
  isTesting.value = true
  testResult.value = null
  showReasoning.value = false
  const startTime = performance.now()

  let rawBase = customBaseUrl.value.trim() || selectedModelDetail.value.platformBaseUrl || ''
  if (selectedModelDetail.value.platform.toLowerCase() === 'cloudflare' && cloudflareStore.activeAccountId) {
    rawBase = rawBase.replace(/\{account_id\}/gi, cloudflareStore.activeAccountId)
  }
  const baseUrl = rawBase.replace(/\/+$/, '')

  if (baseUrl.includes('{account_id}')) {
    testResult.value = {
      success: false,
      status: 400,
      latencyMs: 0,
      error: 'Missing Cloudflare Account ID. Please connect your Cloudflare account or replace {account_id} in the Base URL.',
    }
    isTesting.value = false
    return
  }

  const endpoint = `${baseUrl}/chat/completions`
  const key = currentApiKey.value.trim()

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (key) {
      headers.Authorization = `Bearer ${key}`
    }

    const payload = {
      model: selectedModelDetail.value.modelId,
      messages: [
        {
          role: 'user',
          content: 'Respond with "Hello from [your model name]" in under 10 words.',
        },
      ],
      temperature: 0.2,
    }

    let res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    // If 401 on Cloudflare and OAuth session is active, attempt a transparent token refresh & retry
    if (res.status === 401 && selectedModelDetail.value.platform.toLowerCase() === 'cloudflare' && cloudflareStore.cfOAuthTokens?.refreshToken) {
      try {
        const refreshed = await cloudflareStore.refreshOAuthTokens()
        if (refreshed?.accessToken) {
          headers.Authorization = `Bearer ${refreshed.accessToken}`
          res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          })
        }
      }
      catch (refreshErr) {
        console.warn('[FreeHub] Cloudflare token refresh failed:', refreshErr)
      }
    }

    const latencyMs = Math.round(performance.now() - startTime)
    const data = await res.json().catch(() => null)

    if (!res.ok) {
      const errorMsg = data?.error?.message || data?.message || res.statusText || `HTTP ${res.status}`
      testResult.value = {
        success: false,
        status: res.status,
        latencyMs,
        error: typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg),
      }
      return
    }

    const choice = data?.choices?.[0]
    const message = choice?.message || {}
    const rawContent = (typeof message.content === 'string' ? message.content : '').trim()
    const rawReasoning = (typeof message.reasoning_content === 'string'
      ? message.reasoning_content
      : (typeof message.reasoning === 'string' ? message.reasoning : '')).trim()

    // Detect <think>...</think> tags if reasoning was embedded in content
    const thinkMatch = rawContent.match(/<think>([\s\S]*?)<\/think>/i)
    const extractedReasoning = rawReasoning || (thinkMatch ? thinkMatch[1].trim() : '')
    const cleanContent = thinkMatch ? rawContent.replace(/<think>[\s\S]*?<\/think>/i, '').trim() : rawContent

    testResult.value = {
      success: true,
      status: 200,
      latencyMs,
      content: cleanContent || rawContent || (extractedReasoning ? '(Thinking completed without final text output)' : '(Model returned an empty text response)'),
      hasReasoning: Boolean(extractedReasoning),
      reasoningContent: extractedReasoning,
      modelReported: data?.model || selectedModelDetail.value.modelId,
      tokensUsage: data?.usage,
    }
  }
  catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime)
    testResult.value = {
      success: false,
      status: 0,
      latencyMs,
      error: err?.message || 'Network error or CORS restriction reaching endpoint',
    }
  }
  finally {
    isTesting.value = false
  }
}

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined)
    return '—'
  if (num >= 1_000_000)
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (num >= 1_000)
    return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return num.toLocaleString()
}

function formatContext(tokens: number | null | undefined): string {
  if (!tokens)
    return '—'
  if (tokens >= 1_000_000)
    return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (tokens >= 1_000)
    return `${Math.round(tokens / 1_000)}k`
  return `${tokens}`
}

function openExternalUrl(url: string) {
  if (!url)
    return
  window.open(url, '_blank', 'noopener,noreferrer')
}

const activeFiltersCount = computed(() => {
  let count = 0
  if (selectedModality.value !== 'all')
    count++
  if (selectedPlatform.value !== 'all')
    count++
  if (filterOnlyTools.value)
    count++
  if (filterHighRpm.value)
    count++
  if (filterHighContext.value)
    count++
  if (filterConfiguredOnly.value)
    count++
  if (searchQuery.value.trim())
    count++
  return count
})

function handleResetFilters() {
  catalogStore.resetFilters()
  filterConfiguredOnly.value = false
}
</script>

<template>
  <div class="mx-auto max-w-6xl flex flex-col gap-5 pb-16">
    <!-- Hero Header Banner -->
    <div
      :class="[
        'relative overflow-hidden rounded-2xl border p-6',
        'bg-gradient-to-br from-primary-500/10 via-amber-500/5 to-transparent',
        'border-primary-500/20 dark:border-primary-500/30',
      ]"
    >
      <div class="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-2.5">
            <div class="i-solar:magic-stick-3-bold-duotone text-2xl text-primary-500" />
            <h1 class="text-2xl text-neutral-900 font-bold tracking-tight dark:text-neutral-100">
              Free AI Hub
            </h1>
            <span
              class="rounded-full bg-primary-500/20 px-2.5 py-0.5 text-xs text-primary-700 font-semibold tracking-wider uppercase dark:text-primary-300"
            >
              Phase 1 Preview
            </span>
          </div>
          <p class="max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
            Explore 370+ free model endpoints across 24 AI providers with live rate limits, speed and intelligence scores, context windows, and operational quirks.
          </p>
        </div>

        <div class="flex flex-col items-start gap-1 text-xs text-neutral-500 md:items-end">
          <div class="flex items-center gap-2">
            <span class="text-neutral-700 font-medium dark:text-neutral-300">Catalog Version:</span>
            <code class="rounded bg-neutral-200/60 px-1.5 py-0.5 text-[11px] font-mono dark:bg-neutral-800">
              {{ catalogVersion }}
            </code>
          </div>
          <span v-if="catalogGeneratedAt" class="text-[11px]">
            Generated: {{ new Date(catalogGeneratedAt).toLocaleDateString() }}
          </span>
          <span class="text-[11px] text-primary-600 font-medium dark:text-primary-400">
            {{ totalModelsCount }} total models cataloged
          </span>
        </div>
      </div>
    </div>

    <!-- Search & View Bar -->
    <div class="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
      <!-- Search input -->
      <div class="relative flex-1">
        <div class="i-solar:magnifer-linear absolute left-3.5 top-1/2 text-base text-neutral-400 -translate-y-1/2" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search models, providers, architectures (e.g. Llama 3.3, Groq, Gemini, Qwen)..."
          class="w-full border border-neutral-200/80 rounded-xl bg-white/70 py-2.5 pl-10 pr-9 text-sm transition-all dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900/50 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        >
        <button
          v-if="searchQuery"
          class="absolute right-3 top-1/2 p-0.5 text-neutral-400 -translate-y-1/2 hover:text-neutral-600 dark:hover:text-neutral-200"
          @click="searchQuery = ''"
        >
          <div class="i-solar:close-circle-linear text-base" />
        </button>
      </div>

      <!-- View Switcher -->
      <div class="flex items-center border border-neutral-200/80 rounded-xl bg-neutral-100/80 p-1 dark:border-neutral-800 dark:bg-neutral-900/60">
        <button
          type="button"
          :class="[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
            viewMode === 'table'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
          ]"
          @click="viewMode = 'table'"
        >
          <div class="i-solar:list-linear text-sm" />
          <span>Table</span>
        </button>
        <button
          type="button"
          :class="[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
            viewMode === 'cards'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
          ]"
          @click="viewMode = 'cards'"
        >
          <div class="i-solar:widget-4-linear text-sm" />
          <span>Cards</span>
        </button>
      </div>
    </div>

    <!-- Filter Control Island -->
    <div class="flex flex-col gap-3 border border-neutral-200/70 rounded-2xl bg-neutral-50/60 p-4 dark:border-neutral-800/70 dark:bg-neutral-900/30">
      <!-- Modality Tabs -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="mr-1 text-xs text-neutral-400 font-semibold tracking-wider uppercase">Modality:</span>
        <button
          type="button"
          :class="[
            'px-3 py-1 rounded-lg text-xs font-medium transition-all',
            selectedModality === 'all'
              ? 'bg-primary-500 text-white shadow-sm'
              : 'bg-neutral-200/60 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300/60',
          ]"
          @click="selectedModality = 'all'"
        >
          All ({{ countsByModality.all }})
        </button>
        <button
          type="button"
          :class="[
            'px-3 py-1 rounded-lg text-xs font-medium transition-all',
            selectedModality === 'chat'
              ? 'bg-primary-500 text-white shadow-sm'
              : 'bg-neutral-200/60 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300/60',
          ]"
          @click="selectedModality = 'chat'"
        >
          Chat ({{ countsByModality.chat }})
        </button>
        <button
          type="button"
          :class="[
            'px-3 py-1 rounded-lg text-xs font-medium transition-all',
            selectedModality === 'vision'
              ? 'bg-primary-500 text-white shadow-sm'
              : 'bg-neutral-200/60 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300/60',
          ]"
          @click="selectedModality = 'vision'"
        >
          Vision ({{ countsByModality.vision }})
        </button>
        <button
          type="button"
          :class="[
            'px-3 py-1 rounded-lg text-xs font-medium transition-all',
            selectedModality === 'transcription'
              ? 'bg-primary-500 text-white shadow-sm'
              : 'bg-neutral-200/60 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300/60',
          ]"
          @click="selectedModality = 'transcription'"
        >
          STT Hearing ({{ countsByModality.transcription }})
        </button>
        <button
          type="button"
          :class="[
            'px-3 py-1 rounded-lg text-xs font-medium transition-all',
            selectedModality === 'embedding'
              ? 'bg-primary-500 text-white shadow-sm'
              : 'bg-neutral-200/60 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300/60',
          ]"
          @click="selectedModality = 'embedding'"
        >
          Embeddings ({{ countsByModality.embedding }})
        </button>
      </div>

      <div class="h-px bg-neutral-200/50 dark:bg-neutral-800/50" />

      <!-- Deep Filters: Provider, Capabilities & Sorting -->
      <div class="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex flex-wrap items-center gap-3">
          <!-- Platform Filter -->
          <div class="flex items-center gap-1.5">
            <span class="text-neutral-500 font-medium">Provider:</span>
            <select
              v-model="selectedPlatform"
              class="border border-neutral-200 rounded-lg bg-white px-2.5 py-1 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">
                All Providers ({{ availablePlatforms.length }})
              </option>
              <option
                v-for="p in availablePlatforms"
                :key="p.id"
                :value="p.id"
              >
                {{ p.name }} ({{ p.count }})
              </option>
            </select>
          </div>

          <!-- Feature Toggles -->
          <button
            type="button"
            :class="[
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all',
              filterOnlyTools
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300 font-medium'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
            ]"
            @click="filterOnlyTools = !filterOnlyTools"
          >
            <div class="i-solar:wrench-bold-duotone text-sm text-blue-500" />
            <span>Tools Supported</span>
          </button>

          <button
            type="button"
            :class="[
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all',
              filterHighRpm
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 font-medium'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
            ]"
            @click="filterHighRpm = !filterHighRpm"
          >
            <div class="i-solar:bolt-bold-duotone text-sm text-amber-500" />
            <span>High RPM (&ge; 20)</span>
          </button>

          <button
            type="button"
            :class="[
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all',
              filterHighContext
                ? 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300 font-medium'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
            ]"
            @click="filterHighContext = !filterHighContext"
          >
            <div class="i-solar:document-text-bold-duotone text-sm text-purple-500" />
            <span>Context &ge; 128k</span>
          </button>

          <button
            type="button"
            :class="[
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all',
              filterConfiguredOnly
                ? 'bg-primary-500/15 border-primary-500/40 text-primary-700 dark:text-primary-300 font-medium'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
            ]"
            @click="filterConfiguredOnly = !filterConfiguredOnly"
          >
            <div class="i-solar:check-circle-bold text-sm text-primary-500" />
            <span>Configured Only</span>
          </button>
        </div>

        <!-- Sort Controls -->
        <div class="flex items-center gap-2">
          <span class="text-neutral-500 font-medium">Sort By:</span>
          <select
            v-model="sortBy"
            class="border border-neutral-200 rounded-lg bg-white px-2.5 py-1 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="intelligence">
              Intelligence Rank
            </option>
            <option value="speed">
              Speed Rank
            </option>
            <option value="context">
              Context Window
            </option>
            <option value="rpm">
              Rate Limit (RPM)
            </option>
          </select>

          <button
            type="button"
            class="border border-neutral-200 rounded-lg p-1 text-neutral-600 dark:border-neutral-700 hover:bg-neutral-200/50 dark:text-neutral-300 dark:hover:bg-neutral-800"
            title="Toggle sort direction"
            @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'"
          >
            <div
              :class="sortDirection === 'asc' ? 'i-solar:sort-from-bottom-to-top-linear' : 'i-solar:sort-from-top-to-bottom-linear'"
              class="text-sm"
            />
          </button>

          <button
            v-if="activeFiltersCount > 0"
            type="button"
            class="ml-2 text-xs text-neutral-400 transition-colors hover:text-rose-500"
            @click="handleResetFilters()"
          >
            Reset ({{ activeFiltersCount }})
          </button>
        </div>
      </div>
    </div>

    <!-- Active Filter Count Display -->
    <div class="flex items-center justify-between px-1 text-xs text-neutral-500">
      <span>
        Showing <strong class="text-neutral-800 dark:text-neutral-200">{{ displayedModels.length }}</strong> of {{ totalModelsCount }} models
      </span>
      <span v-if="selectedPlatform !== 'all'">
        Filtered to platform: <strong class="text-primary-600 dark:text-primary-400">{{ selectedPlatform }}</strong>
      </span>
    </div>

    <!-- EMPTY STATE -->
    <div
      v-if="displayedModels.length === 0"
      class="flex flex-col items-center justify-center border border-neutral-300 rounded-2xl border-dashed p-12 text-center dark:border-neutral-800"
    >
      <div class="i-solar:ghost-linear mb-2 text-4xl text-neutral-400" />
      <h3 class="mb-1 text-base text-neutral-800 font-semibold dark:text-neutral-200">
        No matching models found
      </h3>
      <p class="mb-4 max-w-md text-xs text-neutral-500">
        Try clearing your search query or loosening your capability filters.
      </p>
      <button
        type="button"
        class="rounded-xl bg-primary-500 px-4 py-2 text-xs text-white font-semibold transition-all hover:bg-primary-600"
        @click="handleResetFilters()"
      >
        Reset All Filters
      </button>
    </div>

    <!-- VIEW: DATA TABLE -->
    <div
      v-else-if="viewMode === 'table'"
      class="overflow-hidden border border-neutral-200/80 rounded-2xl bg-white/70 shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900/40"
    >
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-neutral-200/80 bg-neutral-50/80 text-neutral-500 font-semibold tracking-wider uppercase dark:border-neutral-800 dark:bg-neutral-900/80">
            <tr>
              <th class="px-4 py-3">
                Model & Platform
              </th>
              <th class="px-4 py-3 text-center">
                Intel / Speed
              </th>
              <th class="px-4 py-3 text-center">
                Context
              </th>
              <th class="px-4 py-3">
                Free Quota & Limits
              </th>
              <th class="px-4 py-3 text-center">
                Caps
              </th>
              <th class="px-4 py-3 text-center">
                Advisories
              </th>
              <th class="px-4 py-3 text-right">
                Details
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
            <tr
              v-for="model in displayedModels"
              :key="model.id"
              class="group cursor-pointer transition-colors hover:bg-primary-500/5 dark:hover:bg-primary-500/10"
              @click="catalogStore.selectModel(model.id)"
            >
              <!-- Model & Platform -->
              <td class="max-w-xs px-4 py-3">
                <div class="flex flex-col gap-0.5">
                  <div class="flex items-center gap-1.5">
                    <span class="text-neutral-900 font-semibold transition-colors dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                      {{ model.displayName }}
                    </span>
                    <span
                      v-if="model.sizeLabel === 'Frontier'"
                      class="rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] text-amber-700 font-bold uppercase dark:text-amber-300"
                    >
                      Frontier
                    </span>
                    <span
                      v-if="isModelActive(model)"
                      class="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] text-emerald-700 font-bold uppercase dark:text-emerald-300"
                    >
                      <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5 text-[11px] text-neutral-500">
                    <span class="rounded bg-neutral-200/50 px-1.5 py-0.2 text-[10px] font-mono dark:bg-neutral-800">
                      {{ model.platformDisplayName }}
                    </span>
                    <span
                      v-if="isPlatformConfigured(model.platform)"
                      class="inline-flex items-center gap-0.5 rounded bg-primary-500/15 px-1.5 py-0.2 text-[10px] text-primary-700 font-medium dark:text-primary-300"
                      title="Platform configured in AIRI"
                    >
                      <div class="i-solar:check-circle-bold text-[10px]" />
                      Configured
                    </span>
                    <span class="max-w-[180px] truncate text-[10px] font-mono" :title="model.modelId">
                      {{ model.modelId }}
                    </span>
                  </div>
                </div>
              </td>

              <!-- Intel & Speed Ranks -->
              <td class="px-4 py-3 text-center">
                <div class="inline-flex flex-col items-center gap-0.5">
                  <span class="text-neutral-700 font-semibold dark:text-neutral-300">
                    Rank #{{ model.intelligenceRank || '—' }}
                  </span>
                  <span class="text-[10px] text-neutral-400">
                    Speed: {{ model.speedRank || '—' }}/11
                  </span>
                </div>
              </td>

              <!-- Context Window -->
              <td class="px-4 py-3 text-center font-mono">
                <span class="rounded bg-neutral-100 px-2 py-0.5 text-neutral-700 font-medium dark:bg-neutral-800 dark:text-neutral-300">
                  {{ formatContext(model.contextWindow) }}
                </span>
              </td>

              <!-- Quota & Rate Limits -->
              <td class="px-4 py-3">
                <div class="flex flex-col gap-0.5">
                  <span class="text-neutral-800 font-medium dark:text-neutral-200">
                    {{ model.monthlyTokenBudget || 'Free Tier' }}
                  </span>
                  <span class="text-[11px] text-neutral-500 font-mono">
                    {{ model.limits?.rpm ? `${model.limits.rpm} RPM` : 'Uncapped RPM' }}
                    {{ model.limits?.rpd ? `· ${formatNumber(model.limits.rpd)} RPD` : '' }}
                  </span>
                </div>
              </td>

              <!-- Capabilities -->
              <td class="px-4 py-3 text-center">
                <div class="inline-flex items-center gap-1.5">
                  <div
                    v-if="model.supportsTools"
                    class="i-solar:wrench-bold-duotone text-base text-blue-500"
                    title="Tools & Function Calling Supported"
                  />
                  <div
                    v-if="model.supportsVision"
                    class="i-solar:eye-bold-duotone text-base text-purple-500"
                    title="Vision (VLM) Supported"
                  />
                  <div
                    v-if="model.modality === 'transcription'"
                    class="i-solar:microphone-3-bold-duotone text-base text-emerald-500"
                    title="Audio Transcription"
                  />
                </div>
              </td>

              <!-- Advisories / Quirks -->
              <td class="px-4 py-3 text-center">
                <span
                  v-if="model.allQuirks.length > 0"
                  class="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-700 font-semibold dark:text-amber-300"
                  :title="model.allQuirks.map(q => q.title).join(', ')"
                >
                  <div class="i-solar:shield-warning-bold-duotone text-xs" />
                  <span>{{ model.allQuirks.length }}</span>
                </span>
                <span v-else class="text-xs text-neutral-300 dark:text-neutral-700">
                  —
                </span>
              </td>

              <!-- Action -->
              <td class="px-4 py-3 text-right">
                <button
                  type="button"
                  class="rounded-lg bg-primary-500/10 px-2.5 py-1 text-xs text-primary-600 font-medium transition-all hover:bg-primary-500/20 dark:text-primary-400"
                  @click.stop="catalogStore.selectModel(model.id)"
                >
                  Inspect
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- VIEW: CARDS GRID -->
    <div
      v-else-if="viewMode === 'cards'"
      class="grid grid-cols-1 gap-3.5 lg:grid-cols-3 md:grid-cols-2"
    >
      <div
        v-for="model in displayedModels"
        :key="model.id"
        :class="[
          'flex flex-col justify-between p-4 rounded-2xl border transition-all cursor-pointer group',
          'border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/40',
          'hover:border-primary-500/50 hover:shadow-md hover:-translate-y-0.5',
        ]"
        @click="catalogStore.selectModel(model.id)"
      >
        <div class="flex flex-col gap-2">
          <!-- Top Row: Platform & Badges -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <span class="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 font-semibold dark:bg-neutral-800 dark:text-neutral-300">
                {{ model.platformDisplayName }}
              </span>
              <span
                v-if="isPlatformConfigured(model.platform)"
                class="inline-flex items-center gap-0.5 rounded bg-primary-500/15 px-1.5 py-0.5 text-[10px] text-primary-700 font-medium dark:text-primary-300"
                title="Platform configured in AIRI"
              >
                <div class="i-solar:check-circle-bold text-[10px]" />
                Configured
              </span>
            </div>
            <div class="flex items-center gap-1.5">
              <span
                v-if="isModelActive(model)"
                class="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-700 font-bold uppercase dark:text-emerald-300"
              >
                <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Active
              </span>
              <span
                v-if="model.sizeLabel === 'Frontier'"
                class="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-700 font-bold uppercase dark:text-amber-300"
              >
                Frontier
              </span>
              <div
                v-if="model.supportsTools"
                class="i-solar:wrench-bold-duotone text-sm text-blue-500"
                title="Tools Supported"
              />
              <div
                v-if="model.supportsVision"
                class="i-solar:eye-bold-duotone text-sm text-purple-500"
                title="Vision Supported"
              />
            </div>
          </div>

          <!-- Model Name & ID -->
          <div>
            <h3 class="text-sm text-neutral-900 font-bold transition-colors dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-400">
              {{ model.displayName }}
            </h3>
            <p class="truncate text-[11px] text-neutral-400 font-mono" :title="model.modelId">
              {{ model.modelId }}
            </p>
          </div>

          <!-- Metrics Matrix -->
          <div class="grid grid-cols-2 mt-2 gap-2 border-t border-neutral-100 pt-2 text-xs dark:border-neutral-800/80">
            <div>
              <span class="block text-[10px] text-neutral-400 tracking-wider uppercase">Context</span>
              <span class="text-neutral-800 font-semibold dark:text-neutral-200">
                {{ formatContext(model.contextWindow) }} tokens
              </span>
            </div>
            <div>
              <span class="block text-[10px] text-neutral-400 tracking-wider uppercase">Rate Limits</span>
              <span class="text-neutral-800 font-semibold dark:text-neutral-200">
                {{ model.limits?.rpm ? `${model.limits.rpm} RPM` : 'Uncapped' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Card Footer -->
        <div class="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 dark:border-neutral-800/80">
          <span
            v-if="model.allQuirks.length > 0"
            class="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium dark:text-amber-400"
          >
            <div class="i-solar:shield-warning-bold-duotone" />
            <span>{{ model.allQuirks.length }} {{ model.allQuirks.length === 1 ? 'advisory' : 'advisories' }}</span>
          </span>
          <span v-else class="text-[11px] text-neutral-400">
            {{ model.monthlyTokenBudget }}
          </span>

          <span class="flex items-center gap-1 text-xs text-primary-600 font-medium transition-transform group-hover:translate-x-0.5 dark:text-primary-400">
            <span>Inspect</span>
            <div class="i-solar:alt-arrow-right-linear text-xs" />
          </span>
        </div>
      </div>
    </div>

    <!-- SLIDE-OVER METADATA INSPECTOR DRAWER -->
    <Teleport to="body">
      <div
        v-if="selectedModelDetail"
        class="fixed inset-0 z-50 overflow-hidden"
        @keydown.escape="catalogStore.selectModel(null)"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
          @click="catalogStore.selectModel(null)"
        />

        <!-- Slide Drawer Panel -->
        <div class="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <div class="max-w-lg w-screen flex flex-col justify-between border-l border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
            <!-- Drawer Header -->
            <div class="flex flex-col gap-3 border-b border-neutral-200/80 p-5 dark:border-neutral-800">
              <div class="flex items-start justify-between">
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-2">
                    <span class="rounded bg-primary-500/15 px-2 py-0.5 text-xs text-primary-700 font-semibold dark:text-primary-300">
                      {{ selectedModelDetail.platformDisplayName }}
                    </span>
                    <span
                      v-if="selectedModelDetail.sizeLabel"
                      class="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600 font-bold uppercase dark:bg-neutral-800 dark:text-neutral-400"
                    >
                      {{ selectedModelDetail.sizeLabel }}
                    </span>
                    <span
                      v-if="isProviderSaved"
                      class="inline-flex items-center gap-1 rounded bg-primary-500/15 px-2 py-0.5 text-xs text-primary-700 font-medium dark:text-primary-300"
                    >
                      <div class="i-solar:check-circle-bold text-xs" />
                      Configured
                    </span>
                    <span
                      v-if="isActiveModel"
                      class="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-700 font-bold uppercase dark:text-emerald-300"
                    >
                      <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      {{ selectedModelDetail.modality === 'transcription' ? 'Active Hearing Model' : 'Active Model' }}
                    </span>
                  </div>
                  <h2 class="mt-1 text-lg text-neutral-900 font-bold dark:text-neutral-100">
                    {{ selectedModelDetail.displayName }}
                  </h2>
                  <code class="text-xs text-neutral-400 font-mono">
                    {{ selectedModelDetail.modelId }}
                  </code>
                </div>

                <button
                  type="button"
                  class="rounded-xl p-2 text-neutral-400 transition-all hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                  @click="catalogStore.selectModel(null)"
                >
                  <div class="i-solar:close-circle-linear text-xl" />
                </button>
              </div>

              <!-- Quick Platform & API Key Link -->
              <a
                :href="selectedModelDetail.platformSignupUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center justify-between border border-primary-500/25 rounded-xl bg-primary-500/10 px-3.5 py-2.5 text-xs text-primary-700 font-medium transition-all dark:border-primary-500/30 hover:bg-primary-500/15 dark:text-primary-300"
              >
                <div class="flex items-center gap-2">
                  <div class="i-solar:key-minimalistic-square-bold-duotone text-base text-primary-600 dark:text-primary-400" />
                  <span>Get API Key & Dashboard ({{ selectedModelDetail.platformDisplayName }})</span>
                </div>
                <div class="i-solar:arrow-right-up-linear text-sm" />
              </a>
            </div>

            <!-- Drawer Body -->
            <div class="flex flex-1 flex-col gap-6 overflow-y-auto p-5 text-sm">
              <!-- LIVE MODEL VALIDATOR WORKBENCH -->
              <div class="flex flex-col gap-3 border border-primary-500/30 rounded-2xl bg-primary-500/5 p-4 dark:border-primary-500/25 dark:bg-primary-500/8">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div class="i-solar:bolt-circle-bold-duotone text-lg text-primary-500" />
                    <h4 class="text-xs text-neutral-900 font-bold tracking-wider uppercase dark:text-neutral-100">
                      Live Endpoint Validator
                    </h4>
                  </div>
                  <span class="rounded bg-primary-500/15 px-1.5 py-0.5 text-[10px] text-primary-700 font-medium dark:text-primary-300">
                    Ephemeral Test
                  </span>
                </div>
                <p class="text-[11px] text-neutral-500 leading-relaxed dark:text-neutral-400">
                  Send a lightweight probe prompt directly to this model endpoint to verify keys, response latency, and reasoning capability.
                </p>

                <!-- Cloudflare OAuth Integration Status Card -->
                <div
                  v-if="selectedModelDetail.platform.toLowerCase() === 'cloudflare'"
                  class="flex flex-col gap-2 border border-amber-500/30 rounded-xl bg-amber-500/10 p-3 text-xs dark:border-amber-500/25 dark:bg-amber-500/10"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5 text-amber-900 font-semibold dark:text-amber-200">
                      <div class="i-solar:shield-network-bold-duotone text-base text-amber-500" />
                      <span>Cloudflare Workers AI</span>
                    </div>
                    <span
                      v-if="cloudflareStore.isAuthenticated"
                      class="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-700 font-bold dark:text-emerald-300"
                    >
                      <span class="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Connected
                    </span>
                    <span
                      v-else
                      class="rounded-full bg-neutral-200/60 px-2 py-0.5 text-[10px] text-neutral-600 font-medium dark:bg-neutral-800 dark:text-neutral-400"
                    >
                      Not Connected
                    </span>
                  </div>

                  <div v-if="cloudflareStore.isAuthenticated" class="flex flex-col gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-300">
                    <div class="flex items-center justify-between font-mono">
                      <span class="text-neutral-500">Account ID:</span>
                      <span class="text-neutral-800 font-bold dark:text-neutral-200">{{ cloudflareStore.activeAccountId || 'Unknown' }}</span>
                    </div>
                    <p class="text-[11px] text-neutral-500 leading-relaxed dark:text-neutral-400">
                      Auto-injected into endpoint URL and API Key field. If your session was created before AI scopes were added, click re-authorize to grant <code>ai:read</code>.
                    </p>
                    <div class="mt-0.5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        :disabled="isReauthorizing"
                        class="shadow-xs flex items-center gap-1 border border-amber-500/40 rounded-lg bg-white/80 px-2.5 py-1 text-[11px] text-amber-900 font-semibold dark:border-amber-500/30 dark:bg-neutral-800 hover:bg-white dark:text-amber-200 dark:hover:bg-neutral-700"
                        @click="handleCloudflareReauth"
                      >
                        <div v-if="isReauthorizing" class="i-solar:spinner-linear animate-spin text-xs" />
                        <div v-else class="i-solar:restart-bold text-xs" />
                        <span>{{ isReauthorizing ? 'Re-authorizing...' : 'Re-authorize with AI Scopes' }}</span>
                      </button>
                    </div>
                  </div>

                  <div v-else class="flex flex-col gap-2 text-[11px] text-neutral-600 dark:text-neutral-300">
                    <p class="text-neutral-500 leading-relaxed dark:text-neutral-400">
                      Connect your Cloudflare account to automatically fill your Account ID and OAuth access token with Workers AI permissions.
                    </p>
                    <button
                      type="button"
                      :disabled="isReauthorizing"
                      class="w-fit flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs text-white font-semibold shadow-sm hover:bg-amber-500"
                      @click="handleCloudflareConnect"
                    >
                      <div v-if="isReauthorizing" class="i-solar:spinner-linear animate-spin text-xs" />
                      <div v-else class="i-solar:shield-keyhole-bold-duotone text-xs" />
                      <span>{{ isReauthorizing ? 'Connecting...' : 'Connect Cloudflare Account' }}</span>
                    </button>
                  </div>
                </div>

                <!-- Base URL Input -->
                <div class="flex flex-col gap-1">
                  <div class="flex items-center justify-between text-[11px] text-neutral-500">
                    <span>Base URL (OpenAI-compatible)</span>
                    <button
                      v-if="customBaseUrl !== selectedModelDetail.platformBaseUrl"
                      type="button"
                      class="text-primary-600 dark:text-primary-400 hover:underline"
                      @click="resetBaseUrl"
                    >
                      Reset default
                    </button>
                  </div>
                  <input
                    v-model="customBaseUrl"
                    type="text"
                    placeholder="https://..."
                    class="w-full border border-neutral-200 rounded-lg bg-white px-3 py-1.5 text-xs font-mono transition-all dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 focus:outline-none"
                  >
                </div>

                <!-- API Key Input -->
                <div class="flex flex-col gap-1">
                  <div class="flex items-center justify-between text-[11px] text-neutral-500">
                    <span>API Key</span>
                    <span v-if="isUsingCloudflareOAuth" class="text-[10px] text-emerald-600 font-medium dark:text-emerald-400">
                      Auto-filled from Cloudflare OAuth
                    </span>
                    <span v-else-if="selectedModelDetail.platform.toLowerCase() === 'cloudflare' && savedApiKeys.cloudflare" class="flex items-center gap-1 text-[10px]">
                      <span class="text-neutral-400">Manual override</span>
                      <button
                        v-if="cloudflareStore.activeAccessToken"
                        type="button"
                        class="text-primary-600 dark:text-primary-400 hover:underline"
                        @click="clearManualCloudflareKey"
                      >
                        (Use OAuth)
                      </button>
                    </span>
                    <span v-else class="text-[10px] text-neutral-400">Saved locally for {{ selectedModelDetail.platformDisplayName }}</span>
                  </div>
                  <div class="relative flex items-center">
                    <input
                      v-model="currentApiKey"
                      :type="showApiKey ? 'text' : 'password'"
                      :placeholder="isUsingCloudflareOAuth ? 'Auto-filled from Cloudflare OAuth session' : 'Paste API key (optional for open endpoints)...'"
                      class="w-full border border-neutral-200 rounded-lg bg-white py-1.5 pl-3 pr-16 text-xs font-mono transition-all dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 focus:outline-none"
                      @keydown.enter="runTestProbe"
                    >
                    <div class="absolute right-1.5 flex items-center gap-0.5">
                      <button
                        type="button"
                        class="rounded p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                        :title="showApiKey ? 'Hide Key' : 'Show Key'"
                        @click="showApiKey = !showApiKey"
                      >
                        <div :class="showApiKey ? 'i-solar:eye-closed-linear' : 'i-solar:eye-linear'" class="text-sm" />
                      </button>
                      <button
                        type="button"
                        class="rounded p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                        title="Paste from clipboard"
                        @click="pasteApiKey"
                      >
                        <div class="i-solar:clipboard-text-linear text-sm" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Test Action Button -->
                <button
                  type="button"
                  :disabled="isTesting"
                  :class="[
                    'w-full flex items-center justify-center gap-2 rounded-xl py-2 px-4 text-xs font-semibold text-white shadow-sm transition-all',
                    isTesting
                      ? 'bg-primary-400 cursor-not-allowed opacity-80'
                      : 'bg-primary-600 hover:bg-primary-500 active:scale-[0.99]',
                  ]"
                  @click="runTestProbe"
                >
                  <div v-if="isTesting" class="i-solar:spinner-linear animate-spin text-base" />
                  <div v-else class="i-solar:play-bold text-xs" />
                  <span>{{ isTesting ? 'Sending test prompt...' : 'Test Model Endpoint' }}</span>
                </button>

                <!-- Live Test Result Output Card -->
                <div
                  v-if="testResult"
                  :class="[
                    'mt-1 flex flex-col gap-2 rounded-xl border p-3.5 text-xs transition-all',
                    testResult.success
                      ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
                      : 'border-rose-500/35 bg-rose-500/10 text-rose-900 dark:text-rose-100',
                  ]"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5 font-bold">
                      <div :class="testResult.success ? 'i-solar:check-circle-bold text-emerald-500' : 'i-solar:close-circle-bold text-rose-500'" class="text-base" />
                      <span>{{ testResult.success ? '● 200 OK' : (testResult.status ? `HTTP ${testResult.status}` : 'Connection Failed') }}</span>
                    </div>
                    <div class="flex items-center gap-2 text-[11px] font-mono opacity-80">
                      <span>{{ testResult.latencyMs }}ms</span>
                      <span v-if="testResult.tokensUsage?.total_tokens">· {{ testResult.tokensUsage.total_tokens }} tokens</span>
                    </div>
                  </div>

                  <!-- Badges -->
                  <div v-if="testResult.success" class="flex flex-wrap items-center gap-1.5">
                    <span
                      v-if="testResult.hasReasoning"
                      class="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] text-purple-700 font-bold dark:text-purple-300"
                    >
                      🧠 Reasoning Content Detected
                    </span>
                    <span
                      v-else
                      class="rounded-full bg-neutral-200/60 px-2 py-0.5 text-[10px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                    >
                      Standard Text
                    </span>
                    <span
                      v-if="testResult.modelReported"
                      class="rounded-full bg-neutral-200/60 px-2 py-0.5 text-[10px] text-neutral-600 font-mono dark:bg-neutral-800 dark:text-neutral-400"
                    >
                      {{ testResult.modelReported }}
                    </span>
                  </div>

                  <!-- Reasoning Collapsible -->
                  <div v-if="testResult.reasoningContent" class="mt-1 flex flex-col gap-1">
                    <button
                      type="button"
                      class="flex items-center gap-1 text-[11px] text-purple-700 font-semibold dark:text-purple-300 hover:underline"
                      @click="showReasoning = !showReasoning"
                    >
                      <div :class="showReasoning ? 'i-solar:alt-arrow-down-linear' : 'i-solar:alt-arrow-right-linear'" class="text-xs" />
                      <span>{{ showReasoning ? 'Hide Thinking Process' : 'View Thinking Process' }}</span>
                    </button>
                    <pre
                      v-if="showReasoning"
                      class="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-purple-500/10 p-2 text-[11px] leading-relaxed font-mono"
                    >{{ testResult.reasoningContent }}</pre>
                  </div>

                  <!-- Response Content Preview -->
                  <div v-if="testResult.content" class="mt-1 rounded-lg bg-black/5 p-2 text-[11px] leading-relaxed font-mono dark:bg-white/5">
                    "{{ testResult.content }}"
                  </div>

                  <!-- Error Details -->
                  <div v-if="testResult.error" class="flex flex-col gap-1 text-[11px]">
                    <span class="font-semibold">{{ testResult.error }}</span>
                    <span v-if="testResult.status === 401 && selectedModelDetail.platform.toLowerCase() === 'cloudflare'" class="text-amber-700 dark:text-amber-300">
                      Tip: Authentication error. Your OAuth token may be missing the <code>ai:read</code> scope. Click "Re-authorize with AI Scopes" above to refresh permissions.
                    </span>
                    <span v-else-if="testResult.status === 401" class="text-neutral-500 dark:text-neutral-400">
                      Tip: Ensure your API key is correct and has active free tier quota.
                    </span>
                    <span v-else-if="testResult.status === 429" class="text-neutral-500 dark:text-neutral-400">
                      Tip: Rate limit reached. This free endpoint is currently throttled.
                    </span>
                    <span v-else-if="testResult.status === 0" class="text-neutral-500 dark:text-neutral-400">
                      Tip: Direct browser network request failed. In web mode, third-party APIs may block CORS.
                    </span>
                  </div>
                </div>
              </div>

              <!-- AIRI INTEGRATION ACTIONS -->
              <div class="flex flex-col gap-2.5 border border-primary-500/30 rounded-2xl bg-primary-500/5 p-4 dark:border-primary-500/25 dark:bg-primary-500/8">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div class="i-solar:transfer-horizontal-bold-duotone text-lg text-primary-500" />
                    <h4 class="text-xs text-neutral-900 font-bold tracking-wider uppercase dark:text-neutral-100">
                      AIRI Integration
                    </h4>
                  </div>
                  <span
                    v-if="isActiveModel"
                    class="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-700 font-bold dark:text-emerald-300"
                  >
                    <span class="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                    {{ selectedModelDetail.modality === 'transcription' ? 'Active Hearing Model' : 'Active Chat Model' }}
                  </span>
                  <span
                    v-else-if="isProviderSaved"
                    class="rounded-full bg-primary-500/20 px-2 py-0.5 text-[10px] text-primary-700 font-semibold dark:text-primary-300"
                  >
                    Provider Configured
                  </span>
                </div>

                <p class="text-[11px] text-neutral-500 leading-relaxed dark:text-neutral-400">
                  Save this endpoint to your AIRI Providers registry, or set it as the active model for conversation across your companion and character cards.
                </p>

                <div class="grid grid-cols-2 gap-2">
                  <!-- Save Provider Button -->
                  <button
                    type="button"
                    :disabled="isSaving"
                    :class="[
                      'flex items-center justify-center gap-1.5 rounded-xl border py-2 px-3 text-xs font-semibold shadow-xs transition-all',
                      isProviderSaved
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-750',
                    ]"
                    @click="handleSaveProvider"
                  >
                    <div v-if="isSaving" class="i-solar:spinner-linear animate-spin text-sm" />
                    <div v-else-if="isProviderSaved" class="i-solar:check-circle-bold text-sm text-emerald-500" />
                    <div v-else class="i-solar:archive-down-minim-bold-duotone text-sm" />
                    <span>{{ isSaving ? 'Saving...' : (isProviderSaved ? 'Provider Saved' : 'Save Provider') }}</span>
                  </button>

                  <!-- Use as Active Model Button -->
                  <button
                    type="button"
                    :disabled="isActivating"
                    :class="[
                      'flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-semibold text-white shadow-sm transition-all',
                      isActiveModel
                        ? 'bg-emerald-600 hover:bg-emerald-500'
                        : 'bg-primary-600 hover:bg-primary-500 active:scale-[0.99]',
                    ]"
                    @click="handleUseAsActiveModel"
                  >
                    <div v-if="isActivating" class="i-solar:spinner-linear animate-spin text-sm" />
                    <div v-else-if="isActiveModel" class="i-solar:check-circle-bold text-sm text-white" />
                    <div v-else class="i-solar:magic-stick-3-bold-duotone text-sm" />
                    <span>{{ isActivating ? 'Setting...' : (isActiveModel ? (selectedModelDetail.modality === 'transcription' ? 'Active Hearing Model' : 'Active Model') : (selectedModelDetail.modality === 'transcription' ? 'Use as Hearing Model' : 'Use as Active Model')) }}</span>
                  </button>
                </div>

                <!-- Subtle link to provider settings -->
                <div v-if="isProviderSaved && targetProviderId" class="mt-1 flex items-center justify-end">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    @click="openProviderSettings"
                  >
                    <span>Open in {{ selectedModelDetail.platformDisplayName }} Settings</span>
                    <div class="i-solar:arrow-right-up-linear text-xs" />
                  </button>
                </div>
              </div>

              <!-- Technical Specifications -->
              <div class="flex flex-col gap-2">
                <h4 class="text-xs text-neutral-400 font-semibold tracking-wider uppercase">
                  Technical Specifications
                </h4>
                <div class="grid grid-cols-2 gap-2.5">
                  <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/40">
                    <span class="block text-xs text-neutral-400">Context Window</span>
                    <span class="text-base text-neutral-900 font-bold dark:text-neutral-100">
                      {{ formatNumber(selectedModelDetail.contextWindow) }}
                    </span>
                    <span class="block text-[10px] text-neutral-500">tokens</span>
                  </div>

                  <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/40">
                    <span class="block text-xs text-neutral-400">Intelligence Rank</span>
                    <span class="text-base text-neutral-900 font-bold dark:text-neutral-100">
                      #{{ selectedModelDetail.intelligenceRank || '—' }}
                    </span>
                    <span class="block text-[10px] text-neutral-500">Relative capability</span>
                  </div>

                  <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/40">
                    <span class="block text-xs text-neutral-400">Speed Rank</span>
                    <span class="text-base text-neutral-900 font-bold dark:text-neutral-100">
                      {{ selectedModelDetail.speedRank || '—' }} / 11
                    </span>
                    <span class="block text-[10px] text-neutral-500">Empirical latency</span>
                  </div>

                  <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/40">
                    <span class="block text-xs text-neutral-400">Monthly Budget</span>
                    <span class="text-base text-neutral-900 font-bold dark:text-neutral-100">
                      {{ selectedModelDetail.monthlyTokenBudget || 'Free Tier' }}
                    </span>
                    <span class="block text-[10px] text-neutral-500">Estimated capacity</span>
                  </div>
                </div>
              </div>

              <!-- Rate Limits Details -->
              <div class="flex flex-col gap-2">
                <h4 class="text-xs text-neutral-400 font-semibold tracking-wider uppercase">
                  Rate Limits & Quota
                </h4>
                <div class="flex flex-col gap-2 border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-4 text-xs font-mono dark:border-neutral-800 dark:bg-neutral-800/40">
                  <div class="flex justify-between">
                    <span class="text-neutral-500">Requests Per Minute (RPM):</span>
                    <span class="text-neutral-800 font-bold dark:text-neutral-200">{{ selectedModelDetail.limits?.rpm || 'Uncapped / Not Published' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-neutral-500">Requests Per Day (RPD):</span>
                    <span class="text-neutral-800 font-bold dark:text-neutral-200">{{ selectedModelDetail.limits?.rpd ? formatNumber(selectedModelDetail.limits.rpd) : 'Uncapped / Not Published' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-neutral-500">Tokens Per Minute (TPM):</span>
                    <span class="text-neutral-800 font-bold dark:text-neutral-200">{{ selectedModelDetail.limits?.tpm ? formatNumber(selectedModelDetail.limits.tpm) : 'Uncapped / Not Published' }}</span>
                  </div>
                </div>
              </div>

              <!-- Operational Quirks & Advisories -->
              <div class="flex flex-col gap-2">
                <h4 class="flex items-center justify-between text-xs text-neutral-400 font-semibold tracking-wider uppercase">
                  <span>Operational Advisories ({{ selectedModelDetail.allQuirks.length }})</span>
                </h4>

                <div v-if="selectedModelDetail.allQuirks.length === 0" class="border border-neutral-200/60 rounded-xl p-3 text-xs text-neutral-500 dark:border-neutral-800">
                  ✓ No operational quirks or idiosyncrasies recorded for this model.
                </div>

                <div
                  v-for="quirk in selectedModelDetail.allQuirks"
                  :key="quirk.slug"
                  :class="[
                    'p-3.5 rounded-xl border flex flex-col gap-1 text-xs',
                    quirk.severity === 'blocker'
                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200'
                      : quirk.severity === 'warning'
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                        : 'border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-200',
                  ]"
                >
                  <div class="flex items-center gap-1.5 font-bold">
                    <div class="i-solar:shield-warning-bold-duotone text-sm" />
                    <span>{{ quirk.title }}</span>
                  </div>
                  <p class="text-[11px] leading-relaxed opacity-90">
                    {{ quirk.body }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Drawer Footer Action -->
            <div class="flex flex-col gap-2 border-t border-neutral-200/80 bg-neutral-50/50 p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
              <button
                type="button"
                class="w-full flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-xs text-white font-semibold shadow-sm transition-all hover:bg-primary-500"
                @click="openExternalUrl(selectedModelDetail.platformSignupUrl)"
              >
                <span>Visit {{ selectedModelDetail.platformDisplayName }} Dashboard</span>
                <div class="i-solar:arrow-right-up-linear text-sm" />
              </button>

              <div class="mt-0.5 text-center text-[10px] text-neutral-400">
                Free AI Hub · Interactive Model Validation Workbench
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Cloudflare Connect Modal Dialog -->
    <CloudflareConnectDialog v-model="isConnectModalOpen" />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  title: Free AI Hub
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
