import type { WebLlmLoadTarget } from '../../../libs/inference/adapters/web-llm'
import type { WebLlmModelInfo } from '../../../libs/inference/constants'
import type { ProgressPayload } from '../../../libs/inference/protocol'
import type { ProviderMetadata } from '../../../stores/providers'

import { Capacitor } from '@capacitor/core'
import { isApplePlatform, isStageTamagotchi, isStageWeb } from '@proj-airi/stage-shared'
import { detectWebGPU } from '@proj-airi/stage-shared/webgpu'
import { storeToRefs } from 'pinia'
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { DEFAULT_WEB_LLM_FP32_MODEL, WEB_LLM_MODELS } from '../../../libs/inference/constants'
import { NativeAI } from '../../../libs/native-ai'
import { isKeylessProvider, isOptionalKeyProvider, keylessOrOptionalKey } from '../../../libs/providers/types'
import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useCloudflareStore } from '../../../stores/modules/cloudflare'
import { useConsciousnessStore } from '../../../stores/modules/consciousness'
import { useProvidersStore } from '../../../stores/providers'
import { DEFAULT_APPLE_CORE_AI_MODEL } from '../../../stores/providers/apple-core-ai'
import { resolvePersona } from '../dialogs/onboarding/v3/composables/useStarterCardCommit'
import { useOnboardingV3Draft } from '../dialogs/onboarding/v3/stores/useOnboardingV3Draft'

export interface UseConsciousnessConfigOptions {
  mode?: 'onboarding' | 'settings'
  onVerified?: () => void
  onChange?: (val: { provider: string, model: string }) => void
}

export type ProbeState = 'idle' | 'connecting' | 'inferencing' | 'verified' | 'error'
export type VerificationDisplay = 'empty' | 'not-ready' | 'ready' | 'testing' | 'verified' | 'failed'
export type CoreAiDownloadState = 'idle' | 'downloading' | 'ready' | 'error'
export type DownloadState = 'idle' | 'downloading' | 'ready' | 'error'

export function useConsciousnessConfig(options: UseConsciousnessConfigOptions = {}) {
  const mode = options.mode || 'settings'
  let t = (key: string, ..._args: any[]): string => key
  try {
    const i18n = useI18n()
    t = i18n.t
  }
  catch {
    // Outside of component setup context (e.g. headless unit tests)
  }

  const providersStore = useProvidersStore()
  const cloudflareStore = useCloudflareStore()
  const consciousnessStore = useConsciousnessStore()
  const draft = useOnboardingV3Draft()
  const cardStore = useAiriCardStore()
  const { activeCard } = storeToRefs(cardStore)
  const { allChatProvidersMetadata, configuredChatProvidersMetadata } = storeToRefs(providersStore)

  // --- Initial Provider & Model IDs based on mode ---
  const initialProvider = mode === 'onboarding'
    ? (draft.state.llmProvider ?? '')
    : (consciousnessStore.activeProvider || '')

  const initialModel = mode === 'onboarding'
    ? (draft.state.llmModel ?? '')
    : (consciousnessStore.activeModel || '')

  const selectedProviderId = ref(initialProvider)
  const selectedModelId = ref(initialModel)

  const isConnectModalOpen = ref(false)
  const activeTab = ref<'free' | 'local' | 'custom'>('free')

  const isCloudflareConnected = computed(() => {
    return Boolean(cloudflareStore.activeAccountId && cloudflareStore.activeAccessToken)
  })

  // --- Presets ---
  const cloudflarePresets = [
    {
      id: '@cf/meta/llama-3.3-70b-instruct',
      name: 'Meta LLaMA 3.3 70B',
      description: 'Frontier capability, fast & versatile',
      descriptionKey: 'onboarding.steps.consciousness.cloudflarePresets.cf-meta-llama-3-3-70b-instruct.description',
      badge: 'Frontier',
      badgeKey: 'onboarding.steps.consciousness.cloudflarePresets.cf-meta-llama-3-3-70b-instruct.badge',
    },
    {
      id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
      name: 'DeepSeek R1 Distill 32B',
      description: 'Deep chain-of-thought reasoning',
      descriptionKey: 'onboarding.steps.consciousness.cloudflarePresets.cf-deepseek-ai-deepseek-r1-distill-qwen-32b.description',
      badge: 'Reasoning',
      badgeKey: 'onboarding.steps.consciousness.cloudflarePresets.cf-deepseek-ai-deepseek-r1-distill-qwen-32b.badge',
    },
    {
      id: '@cf/zai-org/glm-4.7-flash',
      name: 'GLM-4.7 Flash',
      description: 'Fast thinking & bilingual dialogue',
      descriptionKey: 'onboarding.steps.consciousness.cloudflarePresets.cf-zai-org-glm-4-7-flash.description',
      badge: 'Fast CoT',
      badgeKey: 'onboarding.steps.consciousness.cloudflarePresets.cf-zai-org-glm-4-7-flash.badge',
    },
    {
      id: '@cf/qwen/qwen2.5-7b-instruct',
      name: 'Qwen 2.5 7B Instruct',
      description: 'Snappy everyday conversationalist',
      descriptionKey: 'onboarding.steps.consciousness.cloudflarePresets.cf-qwen-qwen2-5-7b-instruct.description',
      badge: 'Snappy',
      badgeKey: 'onboarding.steps.consciousness.cloudflarePresets.cf-qwen-qwen2-5-7b-instruct.badge',
    },
  ]

  const pollinationsPresets = [
    {
      id: 'openai',
      name: 'GPT-4o Mini (Pollinations)',
      description: 'Standard smart conversationalist',
      descriptionKey: 'onboarding.steps.consciousness.pollinationsPresets.openai.description',
    },
    {
      id: 'deepseek',
      name: 'DeepSeek V3 (Pollinations)',
      description: 'High-intelligence open weights',
      descriptionKey: 'onboarding.steps.consciousness.pollinationsPresets.deepseek.description',
    },
    {
      id: 'mistral',
      name: 'Mistral Small (Pollinations)',
      description: 'Snappy reasoning & instruction following',
      descriptionKey: 'onboarding.steps.consciousness.pollinationsPresets.mistral.description',
    },
  ]

  const lanlanFreePresets = [
    {
      id: 'free-model',
      name: 'StepFun Free Model',
      description: 'Fast, zero-setup conversational model sponsored by StepFun',
      badge: 'StepFun',
    },
  ]

  const kiloPresets = [
    {
      id: 'kilo-auto/free',
      name: 'Kilo Auto Free',
      description: 'Auto-routes to best available free coding & chat model',
      badge: 'Auto',
    },
    {
      id: 'dots-studio/dots-3-note-preview:free',
      name: 'Dots3-Note Preview',
      description: 'Dots Studio preview model, 512K context',
      badge: 'Vision',
    },
    {
      id: 'nvidia/nemotron-3.5-super-vl:free',
      name: 'Nemotron 3.5 Super VL',
      description: 'NVIDIA vision-language reasoning, 1M context',
      badge: '1M Context',
    },
  ]

  function getCloudflareCredentials(): { apiKey: string, accountId: string } {
    const apiKey = (cloudflareStore.activeAccessToken || cloudflareStore.cfApiToken || cloudflareStore.cfOAuthTokens?.accessToken || '').trim()
    const accountId = (cloudflareStore.activeAccountId || cloudflareStore.cfAccountId || cloudflareStore.cfOAuthTokens?.accountId || '').trim()
    return { apiKey, accountId }
  }

  function commitState() {
    if (mode === 'onboarding') {
      draft.setConsciousness({
        provider: selectedProviderId.value || undefined,
        model: selectedModelId.value?.trim() || undefined,
      })
    }
    else {
      consciousnessStore.activeProvider = selectedProviderId.value || ''
      consciousnessStore.activeModel = selectedModelId.value?.trim() || ''
    }
    options.onChange?.({
      provider: selectedProviderId.value,
      model: selectedModelId.value,
    })
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
    commitState()
  }

  function selectPollinationsModel(modelId: string) {
    selectedProviderId.value = 'pollinations'
    selectedModelId.value = modelId
    if (!providersStore.providers.pollinations) {
      providersStore.providers.pollinations = {}
    }
    providersStore.markProviderAdded('pollinations')
    commitState()
  }

  function selectLanlanFreeModel(modelId: string = 'free-model') {
    selectedProviderId.value = 'lanlan-free'
    selectedModelId.value = modelId
    if (!providersStore.providers['lanlan-free']) {
      providersStore.providers['lanlan-free'] = { apiKey: 'free-access', baseUrl: 'https://www.lanlan.tech/text/v1/' }
    }
    providersStore.markProviderAdded('lanlan-free')
    commitState()
  }

  function selectKiloModel(modelId: string = 'kilo-auto/free') {
    selectedProviderId.value = 'kilo'
    selectedModelId.value = modelId
    if (!providersStore.providers.kilo) {
      providersStore.providers.kilo = { apiKey: '', baseUrl: 'https://api.kilo.ai/api/gateway/v1' }
    }
    providersStore.markProviderAdded('kilo')
    commitState()
  }

  function handleCloudflareConnected() {
    isConnectModalOpen.value = false
    const { apiKey, accountId } = getCloudflareCredentials()
    if (accountId && apiKey) {
      selectCloudflareModel(selectedModelId.value || '@cf/meta/llama-3.3-70b-instruct')
    }
  }

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
      commitState()
    }
  })

  // --- Platform Detection ---
  const isIOSNative = computed(() => isApplePlatform() || NativeAI.isNative())
  const isAndroidNative = computed(() => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android')
  const isWebLlmPlatform = computed(() => (isStageTamagotchi() || (isStageWeb() && !isApplePlatform())) && !isAndroidNative.value)

  const providerModels = computed(() => {
    if (!selectedProviderId.value)
      return []
    return providersStore.getModelsForProvider(selectedProviderId.value)
  })

  const isLoadingActiveProviderModels = computed(() => providersStore.isLoadingModels[selectedProviderId.value] || false)

  // --- Hardware Detection (WebLLM needs WebGPU) ---
  const webgpuSupported = ref(false)
  const fp16Supported = ref(true)
  const selectedLlmModel = ref<string>(
    (selectedProviderId.value === 'web-llm' ? selectedModelId.value : '') || WEB_LLM_MODELS[0].id,
  )

  const localModelDescriptionKeys: Record<string, string> = {
    'Qwen3.5-0.8B-q4f16_1-MLC': 'onboarding.steps.consciousness.localModels.descriptions.qwen3-5-0-8b-q4f16-1-mlc',
    'LFM3-1.7B-q6f16_a-MLC': 'onboarding.steps.consciousness.localModels.descriptions.lfm3-1-7b-q6f16-a-mlc',
    'gemma3-1b-it-q4f16_1-MLC': 'onboarding.steps.consciousness.localModels.descriptions.gemma3-1b-it-q4f16-1-mlc',
    'Ministral-3-3B-Reasoning-2512-q4f16_1-MLC': 'onboarding.steps.consciousness.localModels.descriptions.ministral-3-3b-reasoning-2512-q4f16-1-mlc',
    'Phi-4-mini-instruct-q4f16_1-MLC': 'onboarding.steps.consciousness.localModels.descriptions.phi-4-mini-instruct-q4f16-1-mlc',
    'Qwen3.5-4B-q4f16_1-MLC': 'onboarding.steps.consciousness.localModels.descriptions.qwen3-5-4b-q4f16-1-mlc',
    'Hermes-3-Llama-3.2-3B-q4f32_1-MLC': 'onboarding.steps.consciousness.localModels.descriptions.hermes-3-llama-3-2-3b-q4f32-1-mlc',
    'Phi-3.5-mini-instruct-q4f32_1-MLC': 'onboarding.steps.consciousness.localModels.descriptions.phi-3-5-mini-instruct-q4f32-1-mlc',
    'Llama-3.2-1B-Instruct-q4f32_1-MLC': 'onboarding.steps.consciousness.localModels.descriptions.llama-3-2-1b-instruct-q4f32-1-mlc',
    'Llama-3.2-3B-Instruct-q4f32_1-MLC': 'onboarding.steps.consciousness.localModels.descriptions.llama-3-2-3b-instruct-q4f32-1-mlc',
    'Phi-4-mini-instruct-q4f32_1-MLC': 'onboarding.steps.consciousness.localModels.descriptions.phi-4-mini-instruct-q4f32-1-mlc',
  }

  const availableWebLlmModels = computed(() => {
    const models = fp16Supported.value ? WEB_LLM_MODELS : WEB_LLM_MODELS.filter((m: WebLlmModelInfo) => !m.fp16)
    return models.map((model: WebLlmModelInfo) => ({ ...model, descriptionKey: localModelDescriptionKeys[model.id] }))
  })

  // --- Apple Core AI (iOS Native) State ---
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
    commitState()
    void checkCoreAiResident()
  }

  async function startCoreAiDownload() {
    coreAiState.value = 'downloading'
    coreAiProgress.value = 0
    coreAiStatusText.value = t('onboarding.steps.consciousness.messages.preparingAppleNeuralEngineModel')
    coreAiErrorMessage.value = ''
    try {
      await NativeAI.downloadModel(
        {
          modelId: DEFAULT_APPLE_CORE_AI_MODEL,
          repo: DEFAULT_APPLE_CORE_AI_MODEL,
        },
        (p: any) => {
          coreAiProgress.value = p.percentage || 0
          coreAiSpeedMBs.value = p.speedMBs || 0
          if (p.percentage >= 99 && !p.isCompleted) {
            coreAiStatusText.value = t('onboarding.steps.consciousness.messages.compilingNeuralGraphsOnAppleNeuralEngineTakes6090sOnFirstRun')
          }
          else {
            coreAiStatusText.value = p.speedMBs ? t('onboarding.steps.consciousness.messages.downloadingModelWeightsValueMbS', { value0: p.speedMBs.toFixed(1) }) : t('onboarding.steps.consciousness.download.compiling')
          }
          if (p.isCompleted) {
            coreAiState.value = 'ready'
            coreAiProgress.value = 100
            toast.success(t('onboarding.steps.consciousness.appleCoreAiNeuralEngineModelReady'))
          }
        },
      )
    }
    catch (err: any) {
      coreAiState.value = 'error'
      coreAiErrorMessage.value = err?.message || String(err)
      toast.error(t('onboarding.steps.consciousness.coreAiDownloadFailedValue', { coreAiErrorMessage: coreAiErrorMessage.value }))
    }
  }

  // --- WebLLM In-Context Download (Desktop/Web) ---
  const downloadState = ref<DownloadState>('idle')
  const downloadProgress = ref(0)
  const downloadStatusText = ref('')
  const downloadErrorMessage = ref('')
  const downloadAbort = ref<AbortController>()

  const isWebLlmSelected = computed(() => selectedProviderId.value === 'web-llm')

  async function checkModelResident() {
    if (!isWebLlmSelected.value)
      return
    try {
      const { getWebLlmAdapter } = await import('../../../libs/inference/adapters/web-llm')
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
    commitState()
    void checkModelResident()
  }

  function cancelWebLlmDownload() {
    downloadAbort.value?.abort()
    downloadState.value = 'idle'
    downloadProgress.value = 0
  }

  async function startWebLlmDownload() {
    downloadAbort.value?.abort()
    const controller = new AbortController()
    downloadAbort.value = controller
    downloadState.value = 'downloading'
    downloadProgress.value = 0
    downloadStatusText.value = t('onboarding.steps.consciousness.messages.preparingModel')
    downloadErrorMessage.value = ''
    try {
      const { getWebLlmAdapter } = await import('../../../libs/inference/adapters/web-llm')
      const adapter = await getWebLlmAdapter()

      const curated = WEB_LLM_MODELS.find((m: WebLlmModelInfo) => m.id === selectedLlmModel.value)
      const target: WebLlmLoadTarget = {
        modelId: selectedLlmModel.value,
        modelUrl: curated?.modelUrl,
        modelLib: curated?.modelLib,
        vramMB: curated?.vramMB,
      }

      await adapter.loadModel(target, {
        signal: controller.signal,
        onProgress: (p: ProgressPayload) => {
          const percent = typeof p?.percent === 'number' && p.percent >= 0
            ? p.percent
            : (p && p.loaded && p.total ? (p.loaded / p.total) * 100 : 0)
          downloadProgress.value = Math.min(100, Math.max(0, percent))
          downloadStatusText.value = (p as any)?.status || (p as any)?.file || t('onboarding.steps.consciousness.download.shards')
        },
      })
      if (!controller.signal.aborted) {
        downloadState.value = 'ready'
        downloadProgress.value = 100
        toast.success(t('onboarding.steps.consciousness.localWebllmBrainReady'))
      }
    }
    catch (err) {
      if (!controller.signal.aborted) {
        downloadState.value = 'error'
        const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
        downloadErrorMessage.value = msg
        console.error('[Consciousness] WebLLM download failed:', msg, err)
      }
    }
  }

  // --- Custom Provider Inline Configuration State ---
  const apiKeyInput = ref('')
  const baseUrlInput = ref('')
  const showApiKey = ref(false)
  const showBaseUrl = ref(false)
  const isSavingConfig = ref(false)
  const actionTargetRef = ref<HTMLElement | null>(null)

  const selectedChatProvider = computed<ProviderMetadata | null>(() => {
    if (isWebLlmSelected.value || isCoreAiSelected.value)
      return null
    return allChatProvidersMetadata.value.find((p: ProviderMetadata) => p.id === selectedProviderId.value) || null
  })

  const isProviderConfigured = computed(() => {
    if (!selectedChatProvider.value)
      return false
    const provider = selectedChatProvider.value
    if (keylessOrOptionalKey(provider.requiresCredentials))
      return true
    return configuredChatProvidersMetadata.value.some((p: ProviderMetadata) => p.id === provider.id)
  })

  const needsInlineConfig = computed(() => {
    if (!selectedChatProvider.value)
      return false
    const provider = selectedChatProvider.value
    if (isKeylessProvider(provider.requiresCredentials))
      return false
    const savedKey = (providersStore.providers[provider.id]?.apiKey as string | undefined)?.trim()
    if (isOptionalKeyProvider(provider.requiresCredentials))
      return !savedKey
    return !isProviderConfigured.value
  })

  const inlineConfigProvider = computed(() => (needsInlineConfig.value ? selectedChatProvider.value : null))
  const keyIsOptional = computed(() => isOptionalKeyProvider(selectedChatProvider.value?.requiresCredentials))

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
    return map[providerId] || t('onboarding.steps.consciousness.apiKeyPlaceholder')
  }

  // --- Live Connection Test & Dialogue Simulator ---
  const probeState = ref<ProbeState>('idle')
  const probeResponseMessage = ref('')
  const probeErrorMessage = ref('')
  const probeBenchmarkMs = ref<number | null>(mode === 'onboarding' ? (draft.state.brainBenchmark?.latencyMs ?? null) : null)
  const probeTokens = ref<number | null>(null)
  const probeSentences = ref<number | null>(null)
  const probeHasReasoning = ref<boolean>(mode === 'onboarding' ? (draft.state.brainBenchmark?.hasReasoning ?? false) : false)
  const testSimulationPrompt = ref('Say hello and introduce yourself!')
  const probeRequestId = ref(0)

  function onSelectProvider(provider: ProviderMetadata) {
    selectedProviderId.value = provider.id
    selectedModelId.value = ''
    probeState.value = 'idle'
    probeErrorMessage.value = ''
    probeResponseMessage.value = ''

    apiKeyInput.value = (providersStore.providers[provider.id]?.apiKey as string) || ''
    const defaultOpts = provider.defaultOptions?.() || {}
    baseUrlInput.value = (providersStore.providers[provider.id]?.baseUrl as string) || (defaultOpts as any).baseUrl || ''
    commitState()

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

    const zeroCredential = keylessOrOptionalKey(provider.requiresCredentials)
    if (zeroCredential || isProviderConfigured.value) {
      if (zeroCredential) {
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
        commitState()
      }
    }
    catch (err: any) {
      console.warn('[Consciousness] fetchModelsForProvider failed:', err)
    }
  }

  async function saveAndConnectInline() {
    if (!selectedProviderId.value)
      return
    if (!keyIsOptional.value && !apiKeyInput.value.trim())
      return

    probeRequestId.value++
    probeState.value = 'idle'
    probeResponseMessage.value = ''
    probeErrorMessage.value = ''

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
      toast.success(t('onboarding.steps.consciousness.valueConnected', { nameProvider: selectedChatProvider.value?.name || t('onboarding.steps.consciousness.provider.fallbackName') }))
      scrollToTarget()
    }
    catch (err: any) {
      console.error('[Consciousness Save Credentials Error]:', err)
      toast.error(err?.message || t('onboarding.steps.consciousness.failedToConnectProvider'))
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
    commitState()
  }

  function onSelectModelFromDropdown(e: Event) {
    const target = e.target as HTMLSelectElement
    if (target && target.value) {
      selectedModelId.value = target.value
      probeState.value = 'idle'
      commitState()
    }
  }

  // --- Character Persona Context for Realistic Dialogue Simulation ---
  const userName = computed(() => {
    if (mode === 'onboarding')
      return draft.state.userName?.trim() || 'User'
    return 'User'
  })

  const resolvedPersona = computed(() => {
    if (mode === 'onboarding') {
      return resolvePersona(draft.state, userName.value)
    }
    if (activeCard.value) {
      const rawData = (activeCard.value as any)?.data || activeCard.value
      return {
        name: activeCard.value.name || 'Airi',
        description: activeCard.value.description || '',
        personality: rawData?.personality || activeCard.value.description || 'Friendly, helpful assistant.',
        scenario: rawData?.scenario || '',
      }
    }
    return { name: 'Airi', description: '', personality: 'Friendly, helpful assistant.', scenario: '' }
  })

  const characterName = computed(() => {
    if (mode === 'onboarding')
      return draft.state.companionName || resolvedPersona.value.name || activeCard.value?.name || 'Airi'
    return activeCard.value?.name || resolvedPersona.value.name || 'Airi'
  })

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

  const effectiveConfigKey = computed(() => {
    return `${selectedProviderId.value}::${(selectedModelId.value || '').trim()}`
  })

  const effectiveProviderLabel = computed(() => {
    if (isWebLlmSelected.value)
      return t('onboarding.steps.consciousness.localWebllmShort')
    if (isCoreAiSelected.value)
      return 'Apple Core AI'
    return selectedChatProvider.value?.name || selectedProviderId.value || t('onboarding.steps.consciousness.noProvider')
  })

  const effectiveModelLabel = computed(() => {
    return (selectedModelId.value || '').trim() || t('onboarding.steps.consciousness.noModel')
  })

  const verificationDisplay = computed<VerificationDisplay>(() => {
    if (!selectedProviderId.value || !(selectedModelId.value || '').trim())
      return 'empty'
    if (probeState.value === 'connecting' || probeState.value === 'inferencing')
      return 'testing'
    if (probeState.value === 'verified')
      return 'verified'
    if (probeState.value === 'error')
      return 'failed'
    if (isWebLlmSelected.value) {
      if (downloadState.value === 'downloading')
        return 'testing'
      if (downloadState.value === 'error')
        return 'failed'
      if (downloadState.value !== 'ready')
        return 'not-ready'
      return 'ready'
    }
    if (isCoreAiSelected.value) {
      if (coreAiState.value === 'downloading')
        return 'testing'
      if (coreAiState.value === 'error')
        return 'failed'
      if (coreAiState.value !== 'ready')
        return 'not-ready'
      return 'ready'
    }
    return 'ready'
  })

  const canRunProbe = computed(() => {
    return Boolean(selectedProviderId.value && (selectedModelId.value || '').trim())
      && probeState.value !== 'connecting' && probeState.value !== 'inferencing'
  })

  async function testBrainConnection() {
    if (probeState.value === 'connecting' || probeState.value === 'inferencing' || !selectedProviderId.value || !selectedModelId.value.trim())
      return

    const requestId = ++probeRequestId.value
    const keyAtStart = effectiveConfigKey.value

    probeState.value = 'connecting'
    probeErrorMessage.value = ''
    probeResponseMessage.value = ''
    probeBenchmarkMs.value = null
    probeTokens.value = null
    probeSentences.value = null

    try {
      const providerInstance = await providersStore.getProviderInstance(selectedProviderId.value)
      if (requestId !== probeRequestId.value || effectiveConfigKey.value !== keyAtStart)
        return
      if (!providerInstance || typeof (providerInstance as any).chat !== 'function') {
        throw new Error(t('onboarding.steps.consciousness.providerChatUnavailable', { provider: selectedProviderId.value }))
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
      if (requestId !== probeRequestId.value || effectiveConfigKey.value !== keyAtStart)
        return
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
      const isReasoning = !rawReasoning || reasoningTokens > 0 || textHasThinkTag || isKnownReasoning
      probeHasReasoning.value = isReasoning

      if (result && result.text) {
        const clean = result.text.trim()
        probeState.value = 'verified'
        probeResponseMessage.value = clean

        const words = clean.split(/\s+/).filter(Boolean).length
        probeTokens.value = Math.round(clean.length / 3.8) || words
        const sentences = clean.split(/[.!?]+/).filter((s: string) => s.trim().length > 0).length
        probeSentences.value = sentences

        if (mode === 'onboarding') {
          draft.setBrainBenchmark({
            latencyMs: elapsedMs,
            hasReasoning: isReasoning,
            reasoningSnippet: rawReasoning ? String(rawReasoning).slice(0, 120) : undefined,
            testedModel: selectedModelId.value.trim(),
            testedAt: Date.now(),
          })

          const recommendedPreset = isReasoning || elapsedMs > 2500 ? 'deep' : elapsedMs < 800 ? 'snappy' : 'balanced'
          draft.setThinking({ pacingPreset: recommendedPreset })
        }
        else {
          commitState()
        }

        toast.success(t('onboarding.steps.consciousness.brainConnectionVerifiedValuemsTtftValue', { elapsedMs, detail: isReasoning ? t('onboarding.steps.consciousness.reasoningModel') : t('onboarding.steps.consciousness.standardModel') }))
        options.onVerified?.()
      }
      else {
        throw new Error(t('onboarding.steps.consciousness.emptyModelResponse'))
      }
    }
    catch (err: any) {
      if (requestId !== probeRequestId.value || effectiveConfigKey.value !== keyAtStart)
        return
      console.error('[Consciousness] Probe failed:', err)
      probeState.value = 'error'
      probeErrorMessage.value = err?.message || t('onboarding.steps.consciousness.verification.failed')
      toast.error(probeErrorMessage.value)
    }
  }

  watch(selectedModelId, (val) => {
    if (val) {
      if (probeState.value === 'error')
        probeState.value = 'idle'
    }
    commitState()
  })

  watch(effectiveConfigKey, (next, prev) => {
    if (next === prev)
      return
    probeRequestId.value++
    if (probeState.value === 'verified' || probeState.value === 'error') {
      probeState.value = 'idle'
      probeResponseMessage.value = ''
      probeErrorMessage.value = ''
    }
  })

  watch(selectedProviderId, (id, oldId) => {
    if (id === oldId)
      return
    if (id === 'web-llm' || id === 'apple-core-ai') {
      activeTab.value = 'local'
      return
    }
    if (id === 'cloudflare-workers-ai' || id === 'pollinations' || id === 'lanlan-free' || id === 'kilo') {
      activeTab.value = 'free'
      return
    }
    if (id) {
      activeTab.value = 'custom'
      const meta = allChatProvidersMetadata.value.find((p: ProviderMetadata) => p.id === id)
      if (meta) {
        if (!apiKeyInput.value)
          apiKeyInput.value = (providersStore.providers[id]?.apiKey as string) || ''
        if (!baseUrlInput.value) {
          const defaultOpts = meta.defaultOptions?.() || {}
          baseUrlInput.value = (providersStore.providers[id]?.baseUrl as string) || (defaultOpts as any).baseUrl || ''
        }
      }
    }
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

  if (getCurrentInstance()) {
    onMounted(async () => {
      if (selectedProviderId.value === 'web-llm' || selectedProviderId.value === 'apple-core-ai') {
        activeTab.value = 'local'
      }
      else if (
        selectedProviderId.value
        && selectedProviderId.value !== 'cloudflare-workers-ai'
        && selectedProviderId.value !== 'pollinations'
        && selectedProviderId.value !== 'lanlan-free'
        && selectedProviderId.value !== 'kilo'
      ) {
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
          const current = WEB_LLM_MODELS.find((m: WebLlmModelInfo) => m.id === selectedLlmModel.value)
          if (current?.fp16) {
            selectedLlmModel.value = DEFAULT_WEB_LLM_FP32_MODEL
            if (selectedProviderId.value === 'web-llm') {
              selectedModelId.value = DEFAULT_WEB_LLM_FP32_MODEL
              commitState()
            }
          }
        }
        await checkModelResident()
      }
    })

    onBeforeUnmount(() => {
      downloadAbort.value?.abort()
      probeRequestId.value++
      commitState()
    })
  }

  return {
    mode,
    activeTab,
    selectedProviderId,
    selectedModelId,
    selectedLlmModel,
    isConnectModalOpen,
    isCloudflareConnected,
    cloudflareStore,
    providersStore,
    allChatProvidersMetadata,
    configuredChatProvidersMetadata,
    cloudflarePresets,
    pollinationsPresets,
    lanlanFreePresets,
    kiloPresets,
    availableWebLlmModels,
    selectCloudflareModel,
    selectPollinationsModel,
    selectLanlanFreeModel,
    selectKiloModel,
    selectCoreAiModel,
    selectWebLlmModel,
    handleCloudflareConnected,
    // Local Core AI
    isIOSNative,
    coreAiState,
    coreAiProgress,
    coreAiSpeedMBs,
    coreAiStatusText,
    coreAiErrorMessage,
    startCoreAiDownload,
    // Local WebLLM
    isWebLlmPlatform,
    webgpuSupported,
    fp16Supported,
    downloadState,
    downloadProgress,
    downloadStatusText,
    downloadErrorMessage,
    startWebLlmDownload,
    cancelWebLlmDownload,
    // Custom Provider
    apiKeyInput,
    baseUrlInput,
    showApiKey,
    showBaseUrl,
    isSavingConfig,
    actionTargetRef,
    selectedChatProvider,
    isProviderConfigured,
    needsInlineConfig,
    inlineConfigProvider,
    keyIsOptional,
    getApiKeyPlaceholder,
    onSelectProvider,
    fetchLiveModels,
    saveAndConnectInline,
    handleCancelConfig,
    providerModels,
    isLoadingActiveProviderModels,
    onSelectModelFromDropdown,
    // Probe Tester
    probeState,
    probeResponseMessage,
    probeErrorMessage,
    probeBenchmarkMs,
    probeTokens,
    probeSentences,
    probeHasReasoning,
    testSimulationPrompt,
    testBrainConnection,
    canRunProbe,
    effectiveProviderLabel,
    effectiveModelLabel,
    verificationDisplay,
    verified,
  }
}

export type ConsciousnessConfig = ReturnType<typeof useConsciousnessConfig>
