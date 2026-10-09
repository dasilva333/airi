<script setup lang="ts">
import { useOnboardingDisplayText } from '../composables/use-onboarding-display-text'


import type { WebLlmLoadTarget } from '../../../../../../libs/inference/adapters/web-llm'
import type { ProgressPayload } from '../../../../../../libs/inference/protocol'
import type { ProviderMetadata } from '../../../../../../stores/providers'

import { Capacitor } from '@capacitor/core'
import { isApplePlatform, isStageTamagotchi, isStageWeb } from '@proj-airi/stage-shared'
import { detectWebGPU } from '@proj-airi/stage-shared/webgpu'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import CloudflareConnectDialog from '../../../cloudflare/CloudflareConnectDialog.vue'
import ProviderPickerGrid from '../components/provider-picker-grid.vue'

import { DEFAULT_WEB_LLM_FP32_MODEL, WEB_LLM_MODELS } from '../../../../../../libs/inference/constants'
import { NativeAI } from '../../../../../../libs/native-ai'
import { useAiriCardStore } from '../../../../../../stores/modules/airi-card'
import { useCloudflareStore } from '../../../../../../stores/modules/cloudflare'
import { useProvidersStore } from '../../../../../../stores/providers'
import { DEFAULT_APPLE_CORE_AI_MODEL } from '../../../../../../stores/providers/apple-core-ai'
import { BrainModelPicker } from '../../../../chat'
import { resolvePersona } from '../composables/useStarterCardCommit'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const { displayText } = useOnboardingDisplayText()


const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const emit = defineEmits<{
  (e: 'verified'): void
}>()

const { t } = useI18n()

// --- Stores & Draft ---
const providersStore = useProvidersStore()
const cloudflareStore = useCloudflareStore()
const draft = useOnboardingV3Draft()

const selectedProviderId = ref(draft.state.llmProvider ?? '')
const selectedModelId = ref(draft.state.llmModel ?? '')

const isConnectModalOpen = ref(false)
const activeTab = ref<'free' | 'local' | 'custom'>('free')

const isCloudflareConnected = computed(() => {
  return Boolean(cloudflareStore.activeAccountId && cloudflareStore.activeAccessToken)
})

const cloudflarePresets = [
  {
    id: '@cf/meta/llama-3.3-70b-instruct',
    name: 'Meta LLaMA 3.3 70B',
    description: 'Frontier capability, fast & versatile',
    badge: 'Frontier',
  },
  {
    id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    name: 'DeepSeek R1 Distill 32B',
    description: 'Deep chain-of-thought reasoning',
    badge: 'Reasoning',
  },
  {
    id: '@cf/zai-org/glm-4.7-flash',
    name: 'GLM-4.7 Flash',
    description: 'Fast thinking & bilingual dialogue',
    badge: 'Fast CoT',
  },
  {
    id: '@cf/qwen/qwen2.5-7b-instruct',
    name: 'Qwen 2.5 7B Instruct',
    description: 'Snappy everyday conversationalist',
    badge: 'Snappy',
  },
]

const pollinationsPresets = [
  {
    id: 'openai',
    name: 'GPT-4o Mini (Pollinations)',
    description: 'Standard smart conversationalist',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek V3 (Pollinations)',
    description: 'High-intelligence open weights',
  },
  {
    id: 'mistral',
    name: 'Mistral Small (Pollinations)',
    description: 'Snappy reasoning & instruction following',
  },
]

function getCloudflareCredentials(): { apiKey: string, accountId: string } {
  const apiKey = (cloudflareStore.activeAccessToken || cloudflareStore.cfApiToken || cloudflareStore.cfOAuthTokens?.accessToken || '').trim()
  const accountId = (cloudflareStore.activeAccountId || cloudflareStore.cfAccountId || cloudflareStore.cfOAuthTokens?.accountId || '').trim()
  return { apiKey, accountId }
}

function selectCloudflareModel(modelId: string) {
  selectedProviderId.value = 'cloudflare-workers-ai'
  selectedModelId.value = modelId

  const { apiKey, accountId } = getCloudflareCredentials()

  if (!providersStore.providers['cloudflare-workers-ai']) {
    providersStore.providers['cloudflare-workers-ai'] = {}
  }
  if (apiKey)
    providersStore.providers['cloudflare-workers-ai'].apiKey = apiKey
  if (accountId)
    providersStore.providers['cloudflare-workers-ai'].accountId = accountId

  providersStore.markProviderAdded('cloudflare-workers-ai')
  if (apiKey && accountId) {
    void providersStore.validateProvider('cloudflare-workers-ai').catch(() => {})
  }
  recordDraft()
}

function selectPollinationsModel(modelId: string) {
  selectedProviderId.value = 'pollinations'
  selectedModelId.value = modelId
  providersStore.markProviderAdded('pollinations')
  recordDraft()
}

function handleCloudflareConnected() {
  isConnectModalOpen.value = false
  const { apiKey, accountId } = getCloudflareCredentials()
  if (accountId && apiKey) {
    selectCloudflareModel(selectedModelId.value || '@cf/meta/llama-3.3-70b-instruct')
  }
}

// Keep providersStore in sync if Cloudflare authenticates or changes accounts while on this step
watch(isCloudflareConnected, (connected) => {
  if (connected && selectedProviderId.value === 'cloudflare-workers-ai') {
    const { apiKey, accountId } = getCloudflareCredentials()
    if (!providersStore.providers['cloudflare-workers-ai']) {
      providersStore.providers['cloudflare-workers-ai'] = {}
    }
    if (apiKey)
      providersStore.providers['cloudflare-workers-ai'].apiKey = apiKey
    if (accountId)
      providersStore.providers['cloudflare-workers-ai'].accountId = accountId
    providersStore.markProviderAdded('cloudflare-workers-ai')
    if (apiKey && accountId) {
      void providersStore.validateProvider('cloudflare-workers-ai').catch(() => {})
    }
    recordDraft()
  }
})

const { allChatProvidersMetadata, configuredChatProvidersMetadata } = storeToRefs(providersStore)

// Platform detection: iOS runs Apple Core AI (ANE/CoreML), Desktop/Web runs WebLLM (WebGPU), Android runs Cloud API
const isIOSNative = computed(() => isApplePlatform() || NativeAI.isNative())
const isAndroidNative = computed(() => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android')
const isWebLlmPlatform = computed(() => (isStageTamagotchi() || (isStageWeb() && !isApplePlatform())) && !isAndroidNative.value)

// Cloud model list is id-keyed and queries live providerRuntimeState
const providerModels = computed(() => {
  if (!selectedProviderId.value)
    return []
  return providersStore.getModelsForProvider(selectedProviderId.value)
})

const isLoadingActiveProviderModels = computed(() => providersStore.isLoadingModels[selectedProviderId.value] || false)

// --- Hardware Detection (WebLLM needs WebGPU) ---
const webgpuSupported = ref(false)
const fp16Supported = ref(true)

const availableWebLlmModels = computed(() => {
  return fp16Supported.value ? WEB_LLM_MODELS : WEB_LLM_MODELS.filter(m => !m.fp16)
})

onMounted(async () => {
  if (selectedProviderId.value === 'web-llm' || selectedProviderId.value === 'apple-core-ai') {
    activeTab.value = 'local'
  }
  else if (selectedProviderId.value && selectedProviderId.value !== 'cloudflare-workers-ai' && selectedProviderId.value !== 'pollinations') {
    activeTab.value = 'custom'
  }
  else {
    activeTab.value = 'free'
  }

  if (!selectedModelId.value && isCloudflareConnected.value) {
    selectCloudflareModel('@cf/meta/llama-3.3-70b-instruct')
  }

  if (isIOSNative.value) {
    await checkCoreAiResident()
    if (!selectedProviderId.value && !isCloudflareConnected.value) {
      selectCoreAiModel()
    }
  }
  else if (isWebLlmPlatform.value) {
    const caps = await detectWebGPU().catch(() => null)
    webgpuSupported.value = caps ? caps.supported : false
    fp16Supported.value = caps ? caps.fp16Supported : false
    if (webgpuSupported.value && !fp16Supported.value) {
      const current = WEB_LLM_MODELS.find(m => m.id === selectedLlmModel.value)
      if (current?.fp16) {
        selectedLlmModel.value = DEFAULT_WEB_LLM_FP32_MODEL
        if (selectedProviderId.value === 'web-llm') {
          selectedModelId.value = DEFAULT_WEB_LLM_FP32_MODEL
          recordDraft()
        }
      }
    }
    await checkModelResident()
  }
})

// --- Apple Core AI (iOS Native) State ---
type CoreAiDownloadState = 'idle' | 'downloading' | 'ready' | 'error'
const coreAiState = ref<CoreAiDownloadState>('idle')
const coreAiProgress = ref(0)
const coreAiSpeedMBs = ref(0)
const coreAiStatusText = ref('')
const coreAiErrorMessage = ref('')

const isCoreAiSelected = computed(() => selectedProviderId.value === 'apple-core-ai')

async function checkCoreAiResident() {
  if (!isIOSNative.value)
    return
  try {
    const isCached = await NativeAI.isModelCached(DEFAULT_APPLE_CORE_AI_MODEL)
    if (isCached) {
      coreAiState.value = 'ready'
      coreAiProgress.value = 100
    }
    else {
      coreAiState.value = 'idle'
      coreAiProgress.value = 0
    }
  }
  catch {
    coreAiState.value = 'idle'
  }
}

function selectCoreAiModel() {
  selectedProviderId.value = 'apple-core-ai'
  selectedModelId.value = DEFAULT_APPLE_CORE_AI_MODEL
  recordDraft()
  void checkCoreAiResident()
}

async function startCoreAiDownload() {
  coreAiState.value = 'downloading'
  coreAiProgress.value = 0
  coreAiStatusText.value = 'Preparing Apple Neural Engine model…'
  coreAiErrorMessage.value = ''
  try {
    await NativeAI.downloadModel(
      {
        modelId: DEFAULT_APPLE_CORE_AI_MODEL,
        repo: DEFAULT_APPLE_CORE_AI_MODEL,
      },
      (p) => {
        coreAiProgress.value = p.percentage || 0
        coreAiSpeedMBs.value = p.speedMBs || 0
        if (p.percentage >= 99 && !p.isCompleted) {
          coreAiStatusText.value = 'Compiling neural graphs on Apple Neural Engine (takes ~60–90s on first run)…'
        }
        else {
          coreAiStatusText.value = p.speedMBs ? `Downloading model weights (${p.speedMBs.toFixed(1)} MB/s)…` : 'Downloading & compiling on-device model…'
        }
        if (p.isCompleted) {
          coreAiState.value = 'ready'
          coreAiProgress.value = 100
          toast.success(displayText('Apple Core AI Neural Engine model ready!'))
        }
      },
    )
  }
  catch (err: any) {
    coreAiState.value = 'error'
    coreAiErrorMessage.value = err?.message || String(err)
    toast.error(displayText(`Core AI download failed: ${coreAiErrorMessage.value}`))
  }
}

// --- WebLLM In-Context Download (Desktop/Web) ---
type DownloadState = 'idle' | 'downloading' | 'ready' | 'error'
const downloadState = ref<DownloadState>('idle')
const downloadProgress = ref(0)
const downloadStatusText = ref('')
const downloadAbort = ref<AbortController>()
const selectedLlmModel = ref<string>(draft.state.llmModel || WEB_LLM_MODELS[0].id)

const isWebLlmSelected = computed(() => selectedProviderId.value === 'web-llm')

async function checkModelResident() {
  if (!isWebLlmSelected.value)
    return
  try {
    const { getWebLlmAdapter } = await import('../../../../../../libs/inference/adapters/web-llm')
    const adapter = await getWebLlmAdapter()
    if (adapter.state === 'ready' && adapter.manifest?.modelId === selectedLlmModel.value) {
      downloadState.value = 'ready'
      downloadProgress.value = 100
    }
    else {
      downloadState.value = 'idle'
      downloadProgress.value = 0
    }
  }
  catch {
    downloadState.value = 'idle'
  }
}

function selectWebLlmModel(modelId: string) {
  if (downloadState.value === 'downloading') {
    cancelWebLlmDownload()
  }
  selectedProviderId.value = 'web-llm'
  selectedLlmModel.value = modelId
  selectedModelId.value = modelId
  recordDraft()
  void checkModelResident()
}

function cancelWebLlmDownload() {
  downloadAbort.value?.abort()
  downloadState.value = 'idle'
  downloadProgress.value = 0
}

const downloadErrorMessage = ref('')

async function startWebLlmDownload() {
  downloadAbort.value?.abort()
  const controller = new AbortController()
  downloadAbort.value = controller
  downloadState.value = 'downloading'
  downloadProgress.value = 0
  downloadStatusText.value = 'Preparing model…'
  downloadErrorMessage.value = ''
  try {
    const { getWebLlmAdapter } = await import('../../../../../../libs/inference/adapters/web-llm')
    const adapter = await getWebLlmAdapter()

    const curated = WEB_LLM_MODELS.find(m => m.id === selectedLlmModel.value)
    const target: WebLlmLoadTarget = { modelId: selectedLlmModel.value, vramMB: curated?.vramMB }

    await adapter.loadModel(target, {
      signal: controller.signal,
      onProgress: (p: ProgressPayload) => {
        const percent = typeof p?.percent === 'number' && p.percent >= 0
          ? p.percent
          : (p && p.loaded && p.total ? (p.loaded / p.total) * 100 : 0)
        downloadProgress.value = Math.min(100, Math.max(0, percent))
        downloadStatusText.value = (p as any)?.status || (p as any)?.file || 'Downloading weight shards…'
      },
    })
    if (!controller.signal.aborted) {
      downloadState.value = 'ready'
      downloadProgress.value = 100
      toast.success(displayText('Local WebLLM brain ready!'))
    }
  }
  catch (err) {
    if (!controller.signal.aborted) {
      downloadState.value = 'error'
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      downloadErrorMessage.value = msg
      console.error('[V3 Consciousness] WebLLM download failed:', msg, err)
    }
  }
}

// --- Provider Selection & Inline Configuration State ---
const apiKeyInput = ref('')
const baseUrlInput = ref('')
const showApiKey = ref(false)
const showBaseUrl = ref(false)
const isSavingConfig = ref(false)

const selectedChatProvider = computed<ProviderMetadata | null>(() => {
  if (isWebLlmSelected.value || isCoreAiSelected.value)
    return null
  return allChatProvidersMetadata.value.find(p => p.id === selectedProviderId.value) || null
})

const isProviderConfigured = computed(() => {
  if (!selectedChatProvider.value)
    return false
  if (selectedChatProvider.value.requiresCredentials === false)
    return true
  return configuredChatProvidersMetadata.value.some(p => p.id === selectedChatProvider.value!.id)
})

const inlineConfigProvider = computed(() => {
  if (!selectedChatProvider.value)
    return null
  if (selectedChatProvider.value.requiresCredentials === false)
    return null
  return isProviderConfigured.value ? null : selectedChatProvider.value
})

const actionTargetRef = ref<HTMLElement | null>(null)

function scrollToTarget() {
  nextTick(() => {
    setTimeout(() => {
      actionTargetRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  })
}

function getApiKeyPlaceholder(providerId: string): string {
  const map: Record<string, string> = {
    'google-generative-ai': 'AIzaSy...',
    'openrouter-ai': 'sk-or-v1-...',
    'openai': 'sk-...',
    'anthropic': 'sk-ant-api...',
    'deepseek': 'sk-...',
    'mistral-ai': 'mis-...',
    'groq': 'gsk_...',
    'together-ai': 'togetherapi-...',
    'xai': 'xai-...',
  }
  return map[providerId] || 'Enter API Key'
}

function onSelectProvider(provider: ProviderMetadata) {
  selectedProviderId.value = provider.id
  selectedModelId.value = ''
  probeState.value = 'idle'
  probeErrorMessage.value = ''
  probeResponseMessage.value = ''

  apiKeyInput.value = (providersStore.providers[provider.id]?.apiKey as string) || ''
  const defaultOpts = provider.defaultOptions?.() || {}
  baseUrlInput.value = (providersStore.providers[provider.id]?.baseUrl as string) || (defaultOpts as any).baseUrl || ''
  recordDraft()

  if (provider.id === 'web-llm') {
    if (downloadState.value === 'idle' && webgpuSupported.value)
      void startWebLlmDownload()
    return
  }

  if (provider.id === 'apple-core-ai') {
    selectCoreAiModel()
    if (coreAiState.value === 'idle')
      void startCoreAiDownload()
    return
  }

  // Zero-credential or pre-configured providers query live models immediately
  if (provider.requiresCredentials === false || isProviderConfigured.value) {
    if (provider.requiresCredentials === false) {
      providersStore.markProviderAdded(provider.id)
    }
    void fetchLiveModels()
  }

  scrollToTarget()
}

async function fetchLiveModels() {
  if (!selectedProviderId.value)
    return

  try {
    const models = await providersStore.fetchModelsForProvider(selectedProviderId.value)
    if (models && models.length > 0 && !selectedModelId.value) {
      selectedModelId.value = models[0].id
      recordDraft()
    }
  }
  catch (err: any) {
    console.warn('[V3 Consciousness] fetchModelsForProvider failed:', err)
  }
}

async function saveAndConnectInline() {
  if (!selectedProviderId.value || !apiKeyInput.value.trim())
    return

  isSavingConfig.value = true
  try {
    const configToSave: Record<string, unknown> = {
      apiKey: apiKeyInput.value.trim(),
    }
    if (baseUrlInput.value.trim()) {
      configToSave.baseUrl = baseUrlInput.value.trim()
    }

    providersStore.providers[selectedProviderId.value] = {
      ...providersStore.providers[selectedProviderId.value],
      ...configToSave,
    }
    providersStore.markProviderAdded(selectedProviderId.value)

    await fetchLiveModels()
    toast.success(displayText(`${selectedChatProvider.value?.name || 'Provider'} connected!`))
    scrollToTarget()
  }
  catch (err: any) {
    console.error('[V3 Consciousness Save Credentials Error]:', err)
    toast.error(displayText(err?.message || 'Failed to connect provider'))
  }
  finally {
    isSavingConfig.value = false
  }
}

function handleCancelConfig() {
  selectedProviderId.value = ''
  selectedModelId.value = ''
  apiKeyInput.value = ''
  baseUrlInput.value = ''
  probeState.value = 'idle'
  recordDraft()
}

function onSelectModelFromDropdown(e: Event) {
  const target = e.target as HTMLSelectElement
  if (target && target.value) {
    selectedModelId.value = target.value
    probeState.value = 'idle'
    recordDraft()
  }
}

// --- Character Persona Context for Realistic Dialogue Simulation ---
const cardStore = useAiriCardStore()
const { activeCard } = storeToRefs(cardStore)

const userName = computed(() => draft.state.userName?.trim() || 'Richy')
const resolvedPersona = computed(() => resolvePersona(draft.state, userName.value))
const characterName = computed(() => draft.state.companionName || resolvedPersona.value.name || activeCard.value?.name || 'Airi')

const characterPersonaContext = computed(() => {
  const p = resolvedPersona.value
  const name = characterName.value
  const desc = p.description
    || (draft.state.customCharacterCardBundle as any)?.data?.description
    || (draft.state.customCharacterTags?.length ? `Tags: ${draft.state.customCharacterTags.join(', ')}` : '')
  const personality = p.personality
    || (draft.state.customCharacterCardBundle as any)?.data?.personality
  const scenario = p.scenario
    || (draft.state.customCharacterProposal as any)?.scenario
    || (draft.state.customCharacterCardBundle as any)?.data?.scenario

  const parts: string[] = [`You are ${name}. Respond in-character concisely (1-2 sentences).`]

  if (desc) {
    parts.push(`[APPEARANCE & VISUAL IDENTITY]:\n${desc}`)
  }
  if (personality) {
    parts.push(`[PERSONALITY & TRAITS]:\n${personality}`)
  }
  if (scenario) {
    parts.push(`[CHARACTER LORE & SCENARIO]:\n${scenario}`)
  }

  return parts.join('\n\n')
})

// --- Live Connection Test & Dialogue Simulator ---
type ProbeState = 'idle' | 'connecting' | 'inferencing' | 'verified' | 'error'
const probeState = ref<ProbeState>('idle')
const probeResponseMessage = ref('')
const probeErrorMessage = ref('')
const probeBenchmarkMs = ref<number | null>(draft.state.brainBenchmark?.latencyMs ?? null)
const probeTokens = ref<number | null>(null)
const probeSentences = ref<number | null>(null)
const probeHasReasoning = ref<boolean>(draft.state.brainBenchmark?.hasReasoning ?? false)
const testSimulationPrompt = ref('Say hello and introduce yourself!')

async function testBrainConnection() {
  if (probeState.value === 'connecting' || probeState.value === 'inferencing' || !selectedProviderId.value || !selectedModelId.value.trim())
    return

  probeState.value = 'connecting'
  probeErrorMessage.value = ''
  probeResponseMessage.value = ''
  probeBenchmarkMs.value = null
  probeTokens.value = null
  probeSentences.value = null

  try {
    const providerInstance = await providersStore.getProviderInstance(selectedProviderId.value)
    if (!providerInstance || typeof (providerInstance as any).chat !== 'function') {
      throw new Error(`Provider "${selectedProviderId.value}" does not expose chat completions. Check credentials.`)
    }

    probeState.value = 'inferencing'
    const startTime = performance.now()

    const { generateText } = await import('@xsai/generate-text')
    const userPromptText = testSimulationPrompt.value.trim() || 'Say hello and introduce yourself!'
    const result = await generateText({
      ...(providerInstance as any).chat(selectedModelId.value.trim()),
      messages: [
        { role: 'system', content: characterPersonaContext.value },
        { role: 'user', content: userPromptText },
      ],
    })
    const elapsedMs = Math.round(performance.now() - startTime)
    probeBenchmarkMs.value = elapsedMs

    const rawReasoning = result.reasoningText
      || (result as any).reasoning
      || (result as any).reasoning_content
      || (result.messages?.length && ((result.messages[result.messages.length - 1] as any)?.reasoning_content || (result.messages[result.messages.length - 1] as any)?.reasoning))
      || ''
    const reasoningTokens = Number(
      (result.usage as any)?.completion_tokens_details?.reasoning_tokens
      || (result.usage as any)?.reasoning_tokens
      || 0,
    )
    const textHasThinkTag = result.text ? result.text.includes('<think>') : false
    const modelLower = selectedModelId.value.trim().toLowerCase()
    const isKnownReasoning = /(r1|qwq|o1|o3|o4|reason|thinking|kimi-k1\.5)/i.test(modelLower)
    const isReasoning = !!rawReasoning || reasoningTokens > 0 || textHasThinkTag || isKnownReasoning
    probeHasReasoning.value = isReasoning

    if (result && result.text) {
      const clean = result.text.trim()
      probeState.value = 'verified'
      probeResponseMessage.value = clean

      const words = clean.split(/\s+/).filter(Boolean).length
      probeTokens.value = Math.round(clean.length / 3.8) || words
      const sentences = clean.split(/[.!?]+/).filter((s: string) => s.trim().length > 0).length
      probeSentences.value = sentences

      draft.setBrainBenchmark({
        latencyMs: elapsedMs,
        hasReasoning: isReasoning,
        reasoningSnippet: rawReasoning ? String(rawReasoning).slice(0, 120) : undefined,
        testedModel: selectedModelId.value.trim(),
        testedAt: Date.now(),
      })

      // Auto-calibrate pacingPreset based on measured latency and reasoning
      const recommendedPreset = isReasoning || elapsedMs > 2500 ? 'deep' : elapsedMs < 800 ? 'snappy' : 'balanced'
      draft.setThinking({ pacingPreset: recommendedPreset })

      toast.success(displayText(`Brain connection verified! (${elapsedMs}ms TTFT · ${isReasoning ? 'Reasoning Model' : 'Standard Model'})`))
      emit('verified')
    }
    else {
      throw new Error('Empty response received from LLM.')
    }
  }
  catch (err: any) {
    console.error('[V3 Consciousness] Probe failed:', err)
    probeState.value = 'error'
    probeErrorMessage.value = err?.message || 'Connection test failed. Check API key, model ID, and network.'
    toast.error(displayText(probeErrorMessage.value))
  }
}

// Record choice into V3 draft
function recordDraft() {
  draft.setConsciousness({
    provider: selectedProviderId.value || undefined,
    model: selectedModelId.value?.trim() || undefined,
  })
}

watch(selectedModelId, (val) => {
  if (val) {
    if (probeState.value === 'error')
      probeState.value = 'idle'
  }
  recordDraft()
})

const verified = computed(() => {
  if (isWebLlmSelected.value) {
    return downloadState.value === 'ready'
  }
  if (isCoreAiSelected.value) {
    return coreAiState.value === 'ready'
  }
  return probeState.value === 'verified' || (!!selectedProviderId.value && !!selectedModelId.value.trim())
})

const showSkipWarning = ref(false)

function handleNextClick() {
  if (verified.value) {
    props.onNext()
  }
}

function handleSkipClick() {
  if (verified.value) {
    props.onNext()
  }
  else {
    showSkipWarning.value = true
  }
}

function confirmSkipAnyway() {
  showSkipWarning.value = false
  props.onNext()
}

onBeforeUnmount(() => {
  downloadAbort.value?.abort()
  recordDraft()
})
</script>

<template>
  <div :class="['w-full max-w-4xl mx-auto h-full flex flex-col justify-between select-none animate-fadeIn']">
    <!-- Scrollable Content Body -->
    <div :class="['flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-4']">
      <!-- Step Subtitle & Header -->
      <div :class="['flex items-center justify-between text-xs text-neutral-400 font-medium']">
        <span>{{ t('onboarding.steps.consciousness.label') }}</span>
        <span>{{ t('onboarding.steps.consciousness.subtitle') }}</span>
      </div>

      <div class="flex-shrink-0">
        <h2 class="text-xl text-neutral-800 font-bold md:text-2xl dark:text-neutral-100">
          {{ t('onboarding.steps.consciousness.title') }}
        </h2>
        <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {{ t('onboarding.steps.consciousness.description') }}
        </p>
      </div>

      <!-- Blue Companion Alert Bubble -->
      <div :class="['flex items-center gap-3 p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 text-xs backdrop-blur-md']">
        <div :class="['h-8 w-8 rounded-xl bg-sky-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-sky-500/30']">
          <div :class="['i-solar:chat-round-dots-bold text-base']" />
        </div>
        <p :class="['leading-relaxed font-medium']">
          {{ displayText(isIOSNative
            ? 'Pick an AI brain for your companion. Run 100% offline with Apple Neural Engine (ANE) or connect your preferred cloud API (OpenRouter, Gemini, OpenAI, Claude)!'
            : (isAndroidNative
              ? 'Pick an AI brain for your companion. Connect a free provider or configure your preferred cloud API (OpenRouter, Gemini, OpenAI, Claude)!'
              : 'Pick an AI brain for your companion. Connect a free provider, configure your preferred cloud API (OpenRouter, Gemini, OpenAI, Claude), or run local WebLLM on WebGPU!')) }}
        </p>
      </div>

      <!-- Quick-Pick for Configured Brains (Top Option) -->
      <div
        v-if="configuredChatProvidersMetadata.length > 0 || selectedProviderId"
        class="flex flex-col gap-2.5 border border-purple-500/30 rounded-xl bg-purple-500/10 p-3.5 backdrop-blur-md"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="i-solar:stars-line-bold-duotone h-4.5 w-4.5 text-purple-500" />
            <span class="text-xs text-purple-800 font-bold tracking-wide uppercase dark:text-purple-300">{{ t('onboarding.ui.quick-pick-configured-llm-brains') }}</span>
          </div>
          <span class="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] text-purple-700 font-bold dark:text-purple-300">{{ t('onboarding.ui.1-click-selection') }}</span>
        </div>
        <BrainModelPicker
          v-model:provider="selectedProviderId"
          v-model:model="selectedModelId"
          variant="button"
          :title="t('onboarding.ui.select-consciousness-llm')"
          side="bottom"
          class="w-full"
        />
      </div>

      <!-- 3-Tier Brain Selector Tabs -->
      <div class="flex items-center gap-1 rounded-xl bg-neutral-200/50 p-1 backdrop-blur-md dark:bg-neutral-800/50">
        <button
          type="button"
          :class="[
            'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer',
            activeTab === 'free'
              ? 'bg-white text-primary-600 shadow-sm dark:bg-neutral-900 dark:text-primary-400'
              : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
          ]"
          @click="activeTab = 'free'"
        >
          <div class="i-solar:cloud-bold-duotone h-4 w-4" />
          <span>{{ t('onboarding.ui.free-cloud-ai') }}</span>
          <span class="rounded-full bg-amber-500/10 px-1.5 py-0.2 text-[9px] text-amber-600 font-bold hidden sm:inline-block dark:text-amber-400">{{ t('onboarding.ui.zero-setup') }}</span>
        </button>

        <button
          type="button"
          :class="[
            'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer',
            activeTab === 'local'
              ? 'bg-white text-primary-600 shadow-sm dark:bg-neutral-900 dark:text-primary-400'
              : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
          ]"
          @click="activeTab = 'local'"
        >
          <div class="i-solar:cpu-bolt-bold-duotone h-4 w-4" />
          <span>{{ t('onboarding.ui.local-on-device') }}</span>
          <span class="rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[9px] text-emerald-600 font-bold hidden sm:inline-block dark:text-emerald-400">{{ t('onboarding.ui.offline') }}</span>
        </button>

        <button
          type="button"
          :class="[
            'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer',
            activeTab === 'custom'
              ? 'bg-white text-primary-600 shadow-sm dark:bg-neutral-900 dark:text-primary-400'
              : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
          ]"
          @click="activeTab = 'custom'"
        >
          <div class="i-solar:key-minimalistic-square-bold-duotone h-4 w-4" />
          <span>{{ t('onboarding.ui.custom-api-key') }}</span>
        </button>
      </div>

      <!-- TAB 1: FREE CLOUD AI (Zero Setup / Recommended) -->
      <div v-if="activeTab === 'free'" class="flex flex-col gap-4">
        <!-- Cloudflare Workers AI Card -->
        <div class="flex flex-col gap-3 border border-neutral-200/60 rounded-xl bg-white/40 p-4 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/40">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="i-simple-icons:cloudflare h-4.5 w-4.5 text-[#F38020]" />
              <span class="text-xs text-neutral-700 font-bold tracking-wider uppercase dark:text-neutral-300">Cloudflare Workers AI</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span v-if="isCloudflareConnected" class="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {{ t('settings.pages.modules.messaging-discord.connectivity.connected') }}
              </span>
              <span v-else class="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 font-bold dark:text-amber-400">
                {{ t('onboarding.ui.zero-trust-oauth') }}
              </span>
            </div>
          </div>

          <!-- Connected State: 4 Model Presets Grid -->
          <template v-if="isCloudflareConnected">
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                v-for="preset in cloudflarePresets"
                :key="preset.id"
                type="button"
                :class="[
                  'relative flex items-start gap-3 border-2 rounded-xl p-3 text-left transition-all duration-200 cursor-pointer',
                  selectedProviderId === 'cloudflare-workers-ai' && selectedModelId === preset.id
                    ? 'border-primary-500 bg-primary-500/5 shadow-md shadow-primary-500/10 dark:border-primary-400'
                    : 'border-neutral-200/60 bg-white/50 dark:border-neutral-800/80 dark:bg-neutral-900/50 hover:border-primary-500/40',
                ]"
                @click="selectCloudflareModel(preset.id)"
              >
                <div
                  :class="[
                    'h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                    selectedProviderId === 'cloudflare-workers-ai' && selectedModelId === preset.id
                      ? 'bg-primary-500/15 text-primary-500'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500',
                  ]"
                >
                  <div class="i-solar:bolt-bold-duotone h-5 w-5" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-1">
                    <span class="truncate text-xs text-neutral-800 font-bold dark:text-neutral-100">{{ displayText(preset.name) }}</span>
                    <span class="flex-shrink-0 rounded bg-primary-500/10 px-1.5 py-0.2 text-[9px] text-primary-600 font-bold dark:text-primary-400">
                      {{ displayText(preset.badge) }}
                    </span>
                  </div>
                  <p class="line-clamp-1 mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                    {{ displayText(preset.description) }}
                  </p>
                </div>
              </button>
            </div>

            <!-- Connected Account footer hint -->
            <div class="flex items-center justify-between pt-1 text-[11px] text-neutral-400">
              <span class="truncate">{{ t('onboarding.ui.account') }} <span class="text-neutral-600 font-mono dark:text-neutral-300">{{ displayText(cloudflareStore.activeAccountId) }}</span></span>
              <button
                type="button"
                class="cursor-pointer text-primary-500 hover:underline"
                @click="isConnectModalOpen = true"
              >
                {{ t('onboarding.ui.switch-account') }}
              </button>
            </div>
          </template>

          <!-- Disconnected State: Connect Button -->
          <template v-else>
            <div class="flex flex-col gap-3 border border-amber-500/20 rounded-xl bg-amber-500/5 p-3.5">
              <p class="text-xs text-neutral-600 leading-relaxed dark:text-neutral-300">
                {{ t('onboarding.ui.connect-your-cloudflare-account-to-unlock-high-speed-llama-3-3-70b-deepseek-r1') }}
              </p>
              <div class="flex items-center gap-2">
                <Button
                  variant="primary"
                  class="h-[34px] flex cursor-pointer items-center gap-1.5 px-4 text-xs font-medium"
                  @click="isConnectModalOpen = true"
                >
                  <div class="i-simple-icons:cloudflare text-sm" />
                  <span>{{ t('onboarding.ui.connect-cloudflare-account') }}</span>
                </Button>
              </div>
            </div>
          </template>
        </div>

        <!-- Pollinations AI Card -->
        <div class="flex flex-col gap-3 border border-neutral-200/60 rounded-xl bg-white/40 p-4 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/40">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="i-solar:magic-stick-3-bold-duotone h-4.5 w-4.5 text-purple-500" />
              <span class="text-xs text-neutral-700 font-bold tracking-wider uppercase dark:text-neutral-300">Pollinations AI</span>
            </div>
            <span class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400">
              {{ t('onboarding.ui.100-free-no-sign-in') }}
            </span>
          </div>

          <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              v-for="preset in pollinationsPresets"
              :key="preset.id"
              type="button"
              :class="[
                'relative flex flex-col gap-1 border-2 rounded-xl p-3 text-left transition-all duration-200 cursor-pointer',
                selectedProviderId === 'pollinations' && selectedModelId === preset.id
                  ? 'border-primary-500 bg-primary-500/5 shadow-md shadow-primary-500/10 dark:border-primary-400'
                  : 'border-neutral-200/60 bg-white/50 dark:border-neutral-800/80 dark:bg-neutral-900/50 hover:border-primary-500/40',
              ]"
              @click="selectPollinationsModel(preset.id)"
            >
              <span class="truncate text-xs text-neutral-800 font-bold dark:text-neutral-100">{{ displayText(preset.name) }}</span>
              <p class="line-clamp-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                {{ displayText(preset.description) }}
              </p>
            </button>
          </div>
        </div>

        <!-- Free AI Hub Notice Banner -->
        <div class="flex items-center justify-between gap-3 border border-neutral-200/50 rounded-xl bg-neutral-100/70 p-3.5 text-xs dark:border-neutral-700/50 dark:bg-neutral-800/50">
          <div class="min-w-0 flex items-center gap-2.5">
            <div class="i-solar:stars-line-bold-duotone h-4.5 w-4.5 flex-shrink-0 text-amber-500" />
            <span class="truncate text-neutral-600 dark:text-neutral-300">
              {{ t('onboarding.ui.want-more-free-models-explore') }} <strong>{{ t('onboarding.ui.370-free-endpoints') }}</strong> {{ t('onboarding.ui.in-the-free-ai-hub') }}
            </span>
          </div>
          <span class="flex-shrink-0 text-[11px] text-neutral-400">
            {{ t('onboarding.ui.available-in-settings') }}
          </span>
        </div>
      </div>

      <!-- TAB 2: LOCAL ON-DEVICE (Offline) -->
      <div v-if="activeTab === 'local'" class="flex flex-col gap-4">
        <!-- Apple Core AI Local Engine (iOS Native) -->
        <div
          v-if="isIOSNative"
          :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3']"
        >
          <div class="flex items-center gap-2">
            <div class="i-solar:cpu-bolt-bold-duotone h-4 w-4 text-primary-500" />
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">{{ t('onboarding.ui.apple-core-ai-neural-engine') }}</span>
            <span class="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400">{{ t('onboarding.ui.ane-accelerated-100-offline') }}</span>
          </div>

          <div class="grid grid-cols-1 gap-2">
            <button
              type="button"
              :class="[
                'relative flex items-center gap-3 border-2 rounded-xl p-3.5 text-left transition-all duration-300 cursor-pointer',
                isCoreAiSelected
                  ? 'border-primary-500 bg-primary-500/5 shadow-lg shadow-primary-500/10 dark:border-primary-400'
                  : 'border-neutral-200/60 bg-white/40 dark:border-neutral-800/80 dark:bg-neutral-900/40 hover:border-primary-500/50',
              ]"
              @click="selectCoreAiModel"
            >
              <div
                class="h-10 w-10 flex flex-shrink-0 items-center justify-center rounded-xl"
                :class="[isCoreAiSelected ? 'bg-primary-500/15' : 'bg-neutral-100 dark:bg-neutral-800']"
              >
                <div class="i-solar:cpu-bolt-bold-duotone h-6 w-6" :class="isCoreAiSelected ? 'text-primary-500' : 'text-neutral-500'" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm text-neutral-800 font-bold dark:text-neutral-100">{{ t('onboarding.ui.gemma-4-e2b-it-speculative-coreml') }}</span>
                  <span class="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 font-bold dark:text-amber-400">
                    {{ t('onboarding.ui.recommended-on-device') }}
                  </span>
                </div>
                <p class="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                  {{ t('onboarding.ui.high-speed-neural-dialogue-on-apple-neural-engine-45-tok-s-100-offline-private') }}
                </p>
              </div>
              <span class="flex-shrink-0 rounded-md bg-neutral-100 px-2 py-1 text-[10px] text-neutral-600 font-bold font-mono dark:bg-neutral-800 dark:text-neutral-300">
                {{ t('onboarding.ui.1-4-gb-ram') }}
              </span>
            </button>
          </div>

          <!-- Core AI In-Context Download & Action Controls -->
          <div v-if="isCoreAiSelected" class="flex flex-col gap-2.5 border border-neutral-200/60 rounded-xl bg-white/40 p-3.5 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/40">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0 flex-1 flex-col">
                <span class="truncate text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                  {{ t('onboarding.ui.selected-gemma-4-e2b-it-speculative-coreml') }}
                </span>
                <span class="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {{ displayText(coreAiState === 'ready' ? 'Model is compiled and ready to think on Apple Neural Engine.' : (coreAiState === 'downloading' ? 'Downloading CoreML weight bundle and compiling on device…' : 'Click to download and compile model on Apple Neural Engine.')) }}
                </span>
              </div>

              <!-- Action buttons -->
              <div class="flex flex-shrink-0 items-center gap-2">
                <Button
                  v-if="coreAiState === 'idle'"
                  variant="primary"
                  class="h-[34px] flex cursor-pointer items-center gap-1.5 px-3.5 text-xs font-medium"
                  @click="startCoreAiDownload"
                >
                  <div class="i-solar:cloud-download-bold-duotone text-base" />
                  <span>{{ t('onboarding.ui.download-compile') }}</span>
                </Button>

                <div
                  v-else-if="coreAiState === 'ready'"
                  class="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 font-bold dark:text-emerald-400"
                >
                  <div class="i-solar:check-circle-bold-duotone text-base" />
                  <span>{{ t('onboarding.ui.active-ready') }}</span>
                </div>

                <Button
                  v-else-if="coreAiState === 'error'"
                  variant="primary"
                  class="h-[34px] flex cursor-pointer items-center gap-1.5 px-3.5 text-xs font-medium"
                  @click="startCoreAiDownload"
                >
                  <div class="i-solar:restart-bold-duotone text-base" />
                  <span>{{ t('onboarding.ui.retry-download') }}</span>
                </Button>
              </div>
            </div>

            <!-- Download progress bar -->
            <div v-if="coreAiState === 'downloading'" class="flex flex-col gap-1.5 pt-1">
              <div class="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span class="truncate">{{ displayText(coreAiStatusText) }}</span>
                <span class="font-bold font-mono">{{ displayText(Math.floor(coreAiProgress)) }}%</span>
              </div>
              <div class="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                <div class="h-full rounded-full from-primary-500 to-indigo-500 bg-gradient-to-r transition-all duration-150" :style="{ width: `${coreAiProgress}%` }" />
              </div>
            </div>

            <!-- Error message -->
            <div v-if="coreAiState === 'error' && coreAiErrorMessage" class="break-all text-[11px] text-red-600/80 dark:text-red-400/80">
              {{ displayText(coreAiErrorMessage) }}
            </div>

            <!-- Warmup notice -->
            <div class="flex items-start gap-2.5 border border-amber-500/20 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
              <div class="i-solar:hourglass-line-bold-duotone mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
              <div class="min-w-0 flex-1 space-y-0.5">
                <span class="font-bold">{{ t('onboarding.ui.first-launch-on-device-warmup-notice') }}</span>
                <p class="text-[11px] text-amber-800/90 leading-relaxed dark:text-amber-300/90">
                  {{ t('onboarding.ui.when-starting-the-companion-for-the-first-time-apple-neural-engine-takes') }} <strong>{{ t('onboarding.ui.60-90-seconds') }}</strong> {{ t('onboarding.ui.to-compile-model-graphs-and-warm-up-memory-buffers-please-be-patient-while-it') }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- WebGPU warning when local engine unavailable (Desktop/Web only) -->
        <div
          v-if="isWebLlmPlatform && !webgpuSupported"
          class="flex flex-shrink-0 items-start gap-2 border border-amber-300/60 rounded-xl bg-amber-50/80 p-3 text-xs text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300"
        >
          <div class="i-solar:danger-triangle-bold-duotone mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{{ t('onboarding.ui.webgpu-isn-t-available-in-this-browser-pick-a-free-or-cloud-provider-below-e-g') }}</span>
        </div>

        <!-- WebGPU FP32 Universal notice when shader-f16 is missing (Desktop/Web only) -->
        <div
          v-else-if="isWebLlmPlatform && webgpuSupported && !fp16Supported"
          class="flex flex-shrink-0 items-start gap-2 border border-blue-400/40 rounded-xl bg-blue-50/80 p-3 text-xs text-blue-900 dark:border-blue-700/60 dark:bg-blue-900/20 dark:text-blue-200"
        >
          <div class="i-solar:info-circle-bold-duotone mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
          <span>{{ t('onboarding.ui.legacy-gpu-32-bit-webgpu-mode-active-no') }} <code>shader-f16</code> {{ t('onboarding.ui.support-showing-universal-fp32-models-compatible-with-your-hardware') }}</span>
        </div>

        <!-- WebLLM Local Engine (Desktop / Web only) -->
        <div
          v-if="isWebLlmPlatform"
          :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3', !webgpuSupported ? 'opacity-60' : '']"
        >
          <div class="flex items-center gap-2">
            <div class="i-solar:cpu-bolt-bold-duotone h-4 w-4 text-primary-500" />
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">{{ t('onboarding.ui.local-webllm-webgpu-engine') }}</span>
            <span class="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-bold dark:text-emerald-400">{{ t('onboarding.ui.offline-local') }}</span>
          </div>

          <div class="grid grid-cols-1 gap-2">
            <button
              v-for="model in availableWebLlmModels"
              :key="model.id"
              type="button"
              :disabled="!webgpuSupported"
              :class="[
                'relative flex items-center gap-3 border-2 rounded-xl p-3.5 text-left transition-all duration-300 cursor-pointer',
                isWebLlmSelected && selectedLlmModel === model.id
                  ? 'border-primary-500 bg-primary-500/5 shadow-lg shadow-primary-500/10 dark:border-primary-400'
                  : 'border-neutral-200/60 bg-white/40 dark:border-neutral-800/80 dark:bg-neutral-900/40 hover:border-primary-500/50',
                !webgpuSupported ? 'cursor-not-allowed opacity-50' : '',
              ]"
              @click="selectWebLlmModel(model.id)"
            >
              <div
                class="h-10 w-10 flex flex-shrink-0 items-center justify-center rounded-xl"
                :class="[isWebLlmSelected && selectedLlmModel === model.id ? 'bg-primary-500/15' : 'bg-neutral-100 dark:bg-neutral-800']"
              >
                <div class="i-solar:cpu-bolt-bold-duotone h-6 w-6" :class="isWebLlmSelected && selectedLlmModel === model.id ? 'text-primary-500' : 'text-neutral-500'" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm text-neutral-800 font-bold dark:text-neutral-100">{{ displayText(model.name) }}</span>
                  <span
                    v-if="model.id === 'Qwen3.5-4B-q4f16_1-MLC' || (!fp16Supported && model.id === 'Hermes-3-Llama-3.2-3B-q4f32_1-MLC')"
                    class="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 font-bold dark:text-amber-400"
                  >
                    {{ t('onboarding.ui.recommended') }}
                  </span>
                </div>
                <p class="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                  {{ displayText(model.description) }}
                </p>
              </div>
              <span class="flex-shrink-0 rounded-md bg-neutral-100 px-2 py-1 text-[10px] text-neutral-600 font-bold font-mono dark:bg-neutral-800 dark:text-neutral-300">
                ~{{ displayText((model.vramMB / 1024).toFixed(1)) }} {{ t('onboarding.ui.gb-vram') }}
              </span>
            </button>
          </div>

          <!-- In-context download & action controls -->
          <div v-if="isWebLlmSelected" class="flex flex-col gap-2.5 border border-neutral-200/60 rounded-xl bg-white/40 p-3.5 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/40">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0 flex flex-1 flex-col">
                <span class="truncate text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                  {{ t('onboarding.ui.selected') }} {{ displayText(WEB_LLM_MODELS.find(m => m.id === selectedLlmModel)?.name) }}
                </span>
                <span class="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {{ displayText(downloadState === 'ready' ? 'Model is downloaded and ready to think.' : (downloadState === 'downloading' ? 'Downloading model shards into browser cache…' : 'Click to download and activate this model locally on WebGPU.')) }}
                </span>
              </div>

              <!-- Action buttons -->
              <div class="flex flex-shrink-0 items-center gap-2">
                <Button
                  v-if="downloadState === 'idle'"
                  variant="primary"
                  class="h-[34px] flex cursor-pointer items-center gap-1.5 px-3.5 text-xs font-medium"
                  :disabled="!webgpuSupported"
                  @click="startWebLlmDownload"
                >
                  <div class="i-solar:cloud-download-bold-duotone text-base" />
                  <span>{{ t('onboarding.ui.download-activate') }}</span>
                </Button>

                <Button
                  v-else-if="downloadState === 'downloading'"
                  variant="secondary"
                  class="h-[34px] flex cursor-pointer items-center gap-1.5 px-3 text-xs font-medium"
                  @click="cancelWebLlmDownload"
                >
                  <div class="i-solar:close-circle-bold-duotone text-base" />
                  <span>{{ t('onboarding.ui.shared-ui-settings-search-cancel') }}</span>
                </Button>

                <div
                  v-else-if="downloadState === 'ready'"
                  class="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 font-bold dark:text-emerald-400"
                >
                  <div class="i-solar:check-circle-bold-duotone text-base" />
                  <span>{{ t('onboarding.ui.active-ready') }}</span>
                </div>

                <Button
                  v-else-if="downloadState === 'error'"
                  variant="primary"
                  class="h-[34px] flex cursor-pointer items-center gap-1.5 px-3.5 text-xs font-medium"
                  @click="startWebLlmDownload"
                >
                  <div class="i-solar:restart-bold-duotone text-base" />
                  <span>{{ t('onboarding.ui.retry-download') }}</span>
                </Button>
              </div>
            </div>

            <!-- Download progress bar -->
            <div v-if="downloadState === 'downloading'" class="flex flex-col gap-1.5 pt-1">
              <div class="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span class="truncate">{{ displayText(downloadStatusText) }}</span>
                <span class="font-bold font-mono">{{ displayText(Math.floor(downloadProgress)) }}%</span>
              </div>
              <div class="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                <div class="h-full rounded-full from-primary-500 to-indigo-500 bg-gradient-to-r transition-all duration-150" :style="{ width: `${downloadProgress}%` }" />
              </div>
            </div>

            <!-- Error message -->
            <div v-if="downloadState === 'error' && downloadErrorMessage" class="break-all text-[11px] text-red-600/80 dark:text-red-400/80">
              {{ displayText(downloadErrorMessage) }}
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: CUSTOM API KEY -->
      <div v-if="activeTab === 'custom'" class="flex flex-col gap-4">
        <!-- Cloud / Local Provider Matrix -->
        <div :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3']">
          <div class="flex items-center justify-between">
            <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">{{ t('onboarding.ui.choose-an-ai-brain-provider') }}</span>
            <span class="text-[10px] text-neutral-400">{{ t('onboarding.ui.alphabetical-tap-to-select') }}</span>
          </div>
          <ProviderPickerGrid
            :model-value="selectedProviderId"
            :providers="allChatProvidersMetadata"
            @select="onSelectProvider"
            @update:model-value="(id: string) => { selectedProviderId = id }"
          />
        </div>

        <!-- Action Anchor -->
        <div ref="actionTargetRef" class="flex flex-col scroll-mt-4 gap-3">
          <!-- Streamlined Inline Credentials Card -->
          <div
            v-if="inlineConfigProvider"
            class="border border-neutral-200/60 rounded-xl bg-white/70 p-4 shadow-sm backdrop-blur-md space-y-3 dark:border-neutral-800/80 dark:bg-neutral-900/70"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="h-8 w-8 flex items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
                  <div :class="[inlineConfigProvider.iconColor || inlineConfigProvider.icon || 'i-solar:shield-keyhole-bold-duotone', 'h-5 w-5']" />
                </div>
                <div>
                  <h4 class="text-sm text-neutral-800 font-bold dark:text-neutral-100">
                    {{ t('onboarding.ui.configure') }} {{ displayText(inlineConfigProvider.name) }}
                  </h4>
                  <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {{ t('onboarding.ui.enter-your-api-credentials-to-load-ai-models') }}
                  </p>
                </div>
              </div>

              <a
                v-if="inlineConfigProvider.consoleUrl"
                :href="inlineConfigProvider.consoleUrl"
                target="_blank"
                class="flex items-center gap-1 text-[11px] text-primary-500 font-semibold hover:underline"
              >
                <span>{{ t('onboarding.ui.get-key') }}</span>
                <div class="i-solar:square-top-down-bold h-3.5 w-3.5" />
              </a>
            </div>

            <!-- API Key Field -->
            <div class="space-y-1.5">
              <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
                {{ t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label') }} <span class="text-red-500">*</span>
              </label>
              <div class="relative flex items-center">
                <input
                  v-model="apiKeyInput"
                  :type="showApiKey ? 'text' : 'password'"
                  :placeholder="displayText(getApiKeyPlaceholder(inlineConfigProvider.id))"
                  class="w-full border border-neutral-200 rounded-lg bg-white px-3 py-2 pr-10 text-xs text-neutral-800 font-mono outline-none transition dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-100"
                  @keydown.enter="saveAndConnectInline"
                >
                <button
                  type="button"
                  class="absolute right-2.5 cursor-pointer text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                  @click="showApiKey = !showApiKey"
                >
                  <div :class="showApiKey ? 'i-solar:eye-bold' : 'i-solar:eye-closed-bold'" class="h-4 w-4" />
                </button>
              </div>
            </div>

            <!-- Collapsible Base URL -->
            <div class="space-y-1">
              <button
                type="button"
                class="flex cursor-pointer items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                @click="showBaseUrl = !showBaseUrl"
              >
                <div :class="showBaseUrl ? 'i-solar:alt-arrow-down-line-duotone' : 'i-solar:alt-arrow-right-line-duotone'" class="h-3.5 w-3.5" />
                <span>{{ t('onboarding.ui.advanced-custom-base-url') }}</span>
              </button>
              <div v-if="showBaseUrl" class="pt-1">
                <input
                  v-model="baseUrlInput"
                  type="text"
                  placeholder="https://api.example.com/v1"
                  class="w-full border border-neutral-200 rounded-lg bg-white px-3 py-1.5 text-xs text-neutral-800 font-mono outline-none transition dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-100"
                >
              </div>
            </div>

            <!-- Action buttons -->
            <div class="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                class="cursor-pointer border border-neutral-200 rounded-lg px-3 py-1.5 text-xs text-neutral-600 font-semibold dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                @click="handleCancelConfig"
              >
                {{ t('onboarding.ui.shared-ui-settings-search-cancel') }}
              </button>
              <button
                type="button"
                :disabled="!apiKeyInput.trim() || isSavingConfig"
                class="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-1.5 text-xs text-white font-bold shadow-md transition active:scale-95 disabled:cursor-not-allowed hover:bg-primary-600 disabled:opacity-50"
                @click="saveAndConnectInline"
              >
                <div v-if="isSavingConfig" class="i-solar:restart-square-bold h-3.5 w-3.5 animate-spin" />
                <span>{{ displayText(isSavingConfig ? 'Connecting…' : 'Save & Connect') }}</span>
              </button>
            </div>
          </div>

          <!-- 4-Item Model Section: Input Box, Discovered Dropdown, Get Models Trigger, Live Probe -->
          <div
            v-if="!isWebLlmSelected && !isCoreAiSelected && selectedProviderId && (isProviderConfigured || selectedChatProvider?.requiresCredentials === false)"
            :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md space-y-4']"
          >
            <!-- Section Header -->
            <div class="flex items-center justify-between">
              <span class="text-xs text-neutral-500 font-bold uppercase dark:text-neutral-400">{{ t('onboarding.ui.model-selection-test') }}</span>
              <span v-if="selectedChatProvider" class="text-[11px] text-neutral-400 font-semibold">
                {{ displayText(selectedChatProvider.name) }}
              </span>
            </div>

            <!-- Item 1: Selected Model Input Box -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
                  {{ t('onboarding.ui.active-model-id') }} <span class="text-red-500">*</span>
                </label>
                <span class="text-[10px] text-neutral-400">{{ t('onboarding.ui.type-directly-or-pick-below') }}</span>
              </div>
              <input
                v-model="selectedModelId"
                type="text"
                :placeholder="t('onboarding.ui.e-g-gemini-2-5-flash-gpt-4o-mini-mistral-large-latest')"
                class="w-full border border-neutral-200 rounded-lg bg-white px-3 py-2 text-xs text-neutral-800 font-mono outline-none transition dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-100"
              >
            </div>

            <!-- Item 2 & Item 3: Models Dropdown + Get Models Trigger -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
                  {{ t('onboarding.ui.discovered-models') }}
                </label>
                <button
                  type="button"
                  :disabled="isLoadingActiveProviderModels"
                  class="flex cursor-pointer items-center gap-1 text-[11px] text-primary-500 font-bold hover:underline disabled:opacity-50"
                  @click="fetchLiveModels"
                >
                  <div :class="[isLoadingActiveProviderModels ? 'animate-spin' : '', 'i-solar:restart-square-bold h-3.5 w-3.5']" />
                  <span>{{ displayText(isLoadingActiveProviderModels ? 'Querying API…' : 'Get Models') }}</span>
                </button>
              </div>

              <div class="relative flex items-center">
                <select
                  :disabled="isLoadingActiveProviderModels || providerModels.length === 0"
                  :value="selectedModelId"
                  class="w-full cursor-pointer appearance-none border border-neutral-200 rounded-lg bg-white px-3 py-2 pr-8 text-xs text-neutral-800 outline-none transition dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-100 disabled:opacity-60"
                  @change="onSelectModelFromDropdown"
                >
                  <option value="" disabled selected>
                    {{ displayText(isLoadingActiveProviderModels ? 'Querying API models…' : (providerModels.length > 0 ? 'Select a discovered model' : 'No Models Found')) }}
                  </option>
                  <option
                    v-for="model in providerModels"
                    :key="model.id"
                    :value="model.id"
                  >
                    {{ model.name || model.id }}
                  </option>
                </select>
                <div class="pointer-events-none absolute right-2.5 text-neutral-400">
                  <div class="i-solar:alt-arrow-down-line-duotone h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Universal Interactive Dialogue Simulator / Brain Verification (Active for ANY selected Model) -->
      <div
        v-if="selectedModelId && (selectedProviderId === 'web-llm' || selectedProviderId === 'apple-core-ai' || selectedChatProvider?.requiresCredentials === false || isProviderConfigured)"
        class="animate-fadeIn border border-neutral-200/60 rounded-xl bg-white/40 p-4 backdrop-blur-md space-y-3 dark:border-neutral-800/80 dark:bg-neutral-900/40"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="i-solar:play-circle-bold-duotone h-4.5 w-4.5 text-primary-500" />
            <span class="text-xs text-neutral-800 font-bold tracking-wider uppercase dark:text-neutral-200">
              {{ t('onboarding.ui.dialogue-simulator-brain-verification') }}
            </span>
          </div>
          <span class="text-[10px] text-neutral-400 font-mono">
            {{ t('onboarding.ui.testing') }} {{ displayText(selectedModelId) }}
          </span>
        </div>

        <p class="text-[11px] text-neutral-500 leading-relaxed dark:text-neutral-400">
          {{ t('onboarding.ui.simulate-a-turn-to-verify-your-companion-responds-in-character-measures-live-l') }}
        </p>

        <!-- Prompt Input & Run Button -->
        <div class="flex items-center gap-2">
          <input
            v-model="testSimulationPrompt"
            type="text"
            :placeholder="t('onboarding.ui.say-hello-and-introduce-yourself')"
            :disabled="probeState === 'connecting' || probeState === 'inferencing'"
            class="flex-1 border border-neutral-200 rounded-xl bg-white px-3 py-2 text-xs text-neutral-800 outline-none transition dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-800 dark:text-neutral-100 disabled:opacity-50"
            @keydown.enter="testBrainConnection"
          >
          <button
            type="button"
            :disabled="probeState === 'connecting' || probeState === 'inferencing' || !selectedModelId.trim()"
            :class="[
              'px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer flex-shrink-0',
              probeState === 'connecting' || probeState === 'inferencing'
                ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-600/20 active:scale-95',
            ]"
            @click="testBrainConnection"
          >
            <div :class="[probeState === 'connecting' || probeState === 'inferencing' ? 'i-solar:refresh-circle-bold animate-spin h-3.5 w-3.5' : 'i-solar:play-bold h-3.5 w-3.5']" />
            <span>{{ displayText(probeState === 'connecting' || probeState === 'inferencing' ? 'Testing…' : 'Simulate Turn') }}</span>
          </button>
        </div>

        <!-- Progress Indicator -->
        <div
          v-if="probeState === 'connecting' || probeState === 'inferencing'"
          class="flex items-center gap-2 py-1 text-xs text-neutral-400 italic"
        >
          <div class="i-solar:refresh-circle-bold h-4 w-4 animate-spin text-primary-500" />
          <span>{{ displayText(probeState === 'connecting' ? 'Establishing provider connection…' : 'Generating in-character companion response…') }}</span>
        </div>

        <!-- Simulated Response Output Card -->
        <div
          v-if="probeState === 'verified' && probeResponseMessage"
          class="flex flex-col animate-fadeIn gap-2 border border-emerald-500/20 rounded-xl bg-emerald-500/5 p-3.5 text-xs"
        >
          <div class="flex items-center justify-between border-b border-emerald-500/15 pb-2">
            <div class="flex items-center gap-1.5 text-emerald-600 font-bold dark:text-emerald-400">
              <span class="h-2 w-2 rounded-full bg-emerald-500" />
              <span>{{ t('onboarding.ui.brain-active-verified') }}</span>
            </div>
            <div class="flex items-center gap-2 text-[10px] font-mono">
              <span v-if="probeBenchmarkMs !== null" class="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-700 font-bold dark:text-emerald-300">
                ⏱️ {{ displayText(probeBenchmarkMs) }}{{ t('onboarding.ui.ms-ttft') }}
              </span>
              <span v-if="probeTokens !== null" class="rounded bg-primary-500/15 px-2 py-0.5 text-primary-700 font-bold dark:text-primary-300">
                📝 ~{{ displayText(probeTokens) }} {{ t('onboarding.ui.tokens') }}
              </span>
              <span :class="['px-2 py-0.5 rounded font-bold', probeHasReasoning ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300']">
                {{ displayText(probeHasReasoning ? '🧠 Reasoning CoT' : '⚡ Direct Stream') }}
              </span>
            </div>
          </div>
          <p class="select-text whitespace-pre-wrap text-neutral-800 leading-relaxed dark:text-neutral-200">
            {{ displayText(probeResponseMessage) }}
          </p>
        </div>

        <!-- Error Details Banner -->
        <div
          v-else-if="probeState === 'error' && probeErrorMessage"
          class="flex animate-fadeIn items-start gap-2.5 border border-red-500/20 rounded-xl bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400"
        >
          <div class="i-solar:danger-triangle-bold-duotone mt-0.5 h-4.5 w-4.5 flex-shrink-0 text-red-500" />
          <div class="min-w-0 flex-1">
            <span class="font-bold">{{ t('onboarding.ui.brain-connection-failed') }}</span>
            <p class="mt-0.5 break-all text-[11px] leading-snug">
              {{ displayText(probeErrorMessage) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Navigation Bar -->
    <div
      :class="[
        'h-14 border-t border-neutral-200/80 dark:border-neutral-800/80',
        'flex items-center justify-between flex-shrink-0 pt-2 mt-2',
      ]"
    >
      <button
        type="button"
        :class="[
          'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer',
          'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
          'hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors',
        ]"
        @click="props.onPrevious"
      >
        <div :class="['i-solar:alt-arrow-left-line-duotone h-4 w-4']" />
        <span>{{ t('onboarding.shell.previous') }}</span>
      </button>

      <!-- Center Status Hint -->
      <div :class="['text-[11px] text-neutral-400 font-medium italic hidden sm:block text-center truncate max-w-sm']">
        <span v-if="verified" class="text-emerald-500 font-semibold not-italic dark:text-emerald-400">
          {{ t('onboarding.ui.brain-connection-verified-ready-to-proceed') }}
        </span>
        <span v-else>
          {{ t('onboarding.ui.configure-an-ai-model-test-connection-to-unlock-next') }}
        </span>
      </div>

      <!-- Action Group: Skip Step + Next -->
      <div :class="['flex items-center gap-3']">
        <button
          type="button"
          :class="[
            'px-3.5 py-2 text-xs text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
            'hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer',
          ]"
          @click="handleSkipClick"
        >
          {{ t('onboarding.shell.skip') }}
        </button>

        <Button
          variant="primary"
          size="md"
          :disabled="!verified"
          :class="[
            'flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 px-5 py-2',
            'text-xs font-semibold text-white shadow-md shadow-primary-600/25 transition-all active:scale-95 cursor-pointer',
            !verified ? 'opacity-40 cursor-not-allowed hover:bg-primary-600' : '',
          ]"
          @click="handleNextClick"
        >
          <span>{{ t('onboarding.shell.next') }}</span>
          <div :class="['i-solar:alt-arrow-right-line-duotone h-4 w-4']" />
        </Button>
      </div>
    </div>

    <!-- Skip Warning Guard Modal -->
    <div
      v-if="showSkipWarning"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div class="max-w-sm w-full border border-neutral-200 rounded-2xl bg-white p-5 shadow-2xl space-y-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div class="flex items-center gap-3 text-amber-500">
          <div class="i-solar:danger-triangle-bold-duotone text-2xl" />
          <h3 class="text-sm text-neutral-800 font-bold dark:text-neutral-100">
            {{ t('onboarding.ui.proceed-without-an-ai-brain') }}
          </h3>
        </div>
        <p class="text-xs text-neutral-600 leading-relaxed dark:text-neutral-300">
          {{ t('onboarding.ui.without-an-active-ai-model-your-companion-will-not-be-able-to-talk-think-or-re') }}
        </p>
        <div class="flex flex-col gap-2 pt-2">
          <button
            type="button"
            class="w-full cursor-pointer rounded-xl bg-primary-500 py-2.5 text-xs text-white font-bold shadow-md transition hover:bg-primary-600"
            @click="showSkipWarning = false"
          >
            {{ t('onboarding.ui.stay-configure-brain-recommended') }}
          </button>
          <button
            type="button"
            class="w-full cursor-pointer border border-neutral-200 rounded-xl py-2 text-xs text-neutral-500 font-semibold transition dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            @click="confirmSkipAnyway"
          >
            {{ t('onboarding.ui.skip-anyway-configure-later-in-settings') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Cloudflare Connect Dialog -->
    <CloudflareConnectDialog
      v-model="isConnectModalOpen"
      @connected="handleCloudflareConnected"
    />
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
