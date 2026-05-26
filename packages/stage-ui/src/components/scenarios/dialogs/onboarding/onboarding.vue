<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref } from 'vue'
import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../../../stores/modules/consciousness'
import { useHearingStore } from '../../../../stores/modules/hearing'
import { useSpeechStore } from '../../../../stores/modules/speech'
import type { ProviderMetadata } from '../../../../stores/providers'
import { useProvidersStore } from '../../../../stores/providers'
import StepCharacterSelection from './step-character-selection.vue'
import StepEasySetup from './step-easy-setup.vue'
import StepModeSelection from './step-mode-selection.vue'
import StepModelSelection from './step-model-selection.vue'
import StepProviderConfiguration from './step-provider-configuration.vue'
import StepProviderSelection from './step-provider-selection.vue'
import StepWelcome from './step-welcome.vue'
import type {
  OnboardingStep,
  OnboardingStepGuard,
  OnboardingStepNextHandler,
  OnboardingStepPrevHandler,
  ProviderConfigData,
} from './types'

interface Emits {
  (e: 'configured'): void
  (e: 'skipped'): void
}

const { extraSteps = [] } = defineProps<{
  extraSteps?: OnboardingStep[]
}>()
const emit = defineEmits<Emits>()
const step = ref(0)
const direction = ref<'next' | 'previous'>('next')
const pendingProviderConfig = ref<ProviderConfigData | null>(null)
const onboardingMode = ref<'easy' | 'custom'>('easy')

const providersStore = useProvidersStore()
const { providers, allChatProvidersMetadata, addedProviders } = storeToRefs(providersStore)
const consciousnessStore = useConsciousnessStore()
const speechStore = useSpeechStore()
const hearingStore = useHearingStore()
const airiCardStore = useAiriCardStore()

const { activeProvider } = storeToRefs(consciousnessStore)

async function configureEasyMode(data: any) {
  if (!data) return

  // 1. Configure OpenRouter (Consciousness)
  if (data.openrouter) {
    const orKey = data.openrouter.trim()
    // Ensure we have the base config with defaults (like baseUrl)
    const defaultConfig = providersStore.getDefaultProviderConfig('openrouter-ai')

    // Set credentials first
    providers.value['openrouter-ai'] = {
      ...defaultConfig,
      ...providers.value['openrouter-ai'],
      apiKey: orKey,
    }
    addedProviders.value['openrouter-ai'] = true

    // Now force it as configured. This will cache the new apiKey hash.
    providersStore.forceProviderConfigured('openrouter-ai')

    // Trigger lazy fetching so models are ready for selection
    void providersStore.fetchModelsForProvider('openrouter-ai')
  }

  // 2. Configure Deepgram (Speech & Hearing)
  if (data.deepgram) {
    const dgKey = data.deepgram.trim()

    // Setup TTS credentials
    const dgtConfig = providersStore.getDefaultProviderConfig('deepgram-tts')
    providers.value['deepgram-tts'] = {
      ...dgtConfig,
      ...providers.value['deepgram-tts'],
      apiKey: dgKey,
    }
    providersStore.forceProviderConfigured('deepgram-tts')

    // Setup Transcription credentials
    const dgSttConfig = providersStore.getDefaultProviderConfig('deepgram-transcription')
    providers.value['deepgram-transcription'] = {
      ...dgSttConfig,
      ...providers.value['deepgram-transcription'],
      apiKey: dgKey,
    }
    providersStore.forceProviderConfigured('deepgram-transcription')

    // Trigger lazy fetching
    void providersStore.fetchModelsForProvider('deepgram-tts')
    void providersStore.fetchModelsForProvider('deepgram-transcription')
  }

  // CRITICAL: Wait for the providersStore to propagate the "configured" status
  // before we try to set them as active in the module stores.
  await nextTick()
  // Wait a tiny bit more for cross-window sync if needed (though nextTick + persistent store should be enough)
  await new Promise((resolve) => setTimeout(resolve, 50))

  // 3. Assign Modules
  if (data.openrouter) {
    consciousnessStore.activeProvider = 'openrouter-ai'
    consciousnessStore.activeModel = 'openrouter/free'
  }

  if (data.deepgram) {
    // Set Active Speech
    speechStore.activeSpeechProvider = 'deepgram-tts'
    speechStore.activeSpeechModel = 'aura-2'
    speechStore.activeSpeechVoiceId = 'aura-asteria-en'

    // Set Active Hearing
    hearingStore.activeTranscriptionProvider = 'deepgram-transcription'
    hearingStore.activeTranscriptionModel = 'nova-3'
  }

  // Final save
  await nextTick()
}

const availableProviders = computed(() => {
  const preferredOrder = [
    'openai',
    'anthropic',
    'amazon-bedrock',
    'google-generative-ai',
    'groq',
    'nvidia',
    'openrouter-ai',
    'ollama',
    'deepseek',
    'player2',
    'openai-compatible',
  ]
  const preferredProviders = allChatProvidersMetadata.value
    .filter((provider) => preferredOrder.includes(provider.id))
    .sort((a, b) => preferredOrder.indexOf(a.id) - preferredOrder.indexOf(b.id))
  const remainingProviders = allChatProvidersMetadata.value
    .filter((provider) => !preferredOrder.includes(provider.id))
    .sort((a, b) => (a.localizedName || a.name || a.id).localeCompare(b.localizedName || b.name || b.id))

  return [...preferredProviders, ...remainingProviders]
})

// Selected provider and form data
const selectedProviderId = ref('')
const selectedCharacterId = ref('default')

// Computed selected provider
const selectedProvider = computed(() => {
  return allChatProvidersMetadata.value.find((p) => p.id === selectedProviderId.value) || null
})

// Reset validation state when provider changes
function selectProvider(provider: ProviderMetadata) {
  selectedProviderId.value = provider.id
}

const requestPreviousStep: OnboardingStepPrevHandler = () => {
  return navigatePrevious()
}

const requestNextStep: OnboardingStepNextHandler = async (configData?: ProviderConfigData | any) => {
  pendingProviderConfig.value = configData ?? null
  await navigateNext(configData)
}

async function saveProviderConfiguration(data: ProviderConfigData) {
  if (!selectedProvider.value) return

  const config: Record<string, unknown> = {}

  if (data.apiKey) config.apiKey = data.apiKey.trim()
  if (data.baseUrl) config.baseUrl = data.baseUrl.trim()
  if (data.accountId) config.accountId = data.accountId.trim()
  if (data.accessKeyId) config.accessKeyId = data.accessKeyId.trim()
  if (data.secretAccessKey) config.secretAccessKey = data.secretAccessKey.trim()
  if (data.region) config.region = data.region.trim()

  providers.value[selectedProvider.value.id] = {
    ...providers.value[selectedProvider.value.id],
    ...config,
  }

  activeProvider.value = selectedProvider.value.id
  await nextTick()

  try {
    await consciousnessStore.loadModelsForProvider(selectedProvider.value.id)
  } catch (err) {
    console.error('error', err)
  }
}

async function handleSave() {
  emit('configured')
}

const allSteps = computed<OnboardingStep[]>(() => {
  const steps: OnboardingStep[] = [
    {
      component: StepWelcome,
      id: 'welcome',
    },
    {
      component: StepModeSelection,
      id: 'mode-selection',
      props: () => ({
        onSelectMode: (mode: 'easy' | 'custom') => {
          onboardingMode.value = mode
        },
      }),
    },
  ]

  if (onboardingMode.value === 'easy') {
    steps.push({
      beforeNext: async (data: any) => {
        await configureEasyMode(data)
        return true
      },
      component: StepEasySetup,
      id: 'easy-setup',
    })
  } else if (onboardingMode.value === 'custom') {
    steps.push(
      {
        component: StepProviderSelection,
        id: 'provider-selection',
        props: () => ({
          availableProviders: availableProviders.value,
          onSelectProvider: selectProvider,
          selectedProviderId: selectedProviderId.value,
        }),
      },
      {
        beforeNext: async () => {
          if (!pendingProviderConfig.value) return false

          await saveProviderConfiguration(pendingProviderConfig.value)
          pendingProviderConfig.value = null
          return true
        },
        component: StepProviderConfiguration,
        id: 'provider-configuration',
        props: () => ({
          selectedProvider: selectedProvider.value,
          selectedProviderId: selectedProviderId.value,
        }),
      },
      ...extraSteps.map((s) => ({
        ...s,
        props: () => ({
          ...s.props?.(),
        }),
      })),
      {
        component: StepModelSelection,
        id: 'model-selection',
      },
    )
  }

  steps.push({
    beforeNext: async () => {
      await airiCardStore.seedDefaults(selectedCharacterId.value)
      await airiCardStore.activateCard(selectedCharacterId.value)
      return true
    },
    component: StepCharacterSelection,
    id: 'character-selection',
    props: () => ({
      onSelectCharacter: (id: string) => {
        selectedCharacterId.value = id
      },
      selectedCharacterId: selectedCharacterId.value,
    }),
  })

  return steps
})

const currentStep = computed(() => allSteps.value[step.value] ?? null)
const isLastStep = computed(() => step.value === allSteps.value.length - 1)
const currentStepProps = computed(() => currentStep.value?.props?.() ?? {})

async function canPassGuard(guard?: OnboardingStepGuard, data?: any) {
  if (!guard) return true

  return await guard(data)
}

async function navigateNext(data?: any) {
  if (!currentStep.value) return

  if (!(await canPassGuard(currentStep.value.beforeNext, data))) return

  if (isLastStep.value) {
    await handleSave()
    return
  }

  direction.value = 'next'
  step.value++
}

async function navigatePrevious() {
  if (!currentStep.value || step.value <= 0) return

  if (!(await canPassGuard(currentStep.value.beforePrev))) return

  direction.value = 'previous'
  step.value--
}
</script>

<template>
  <div class="onboarding-step-container h-full w-full">
    <Transition :name="direction === 'next' ? 'slide-next' : 'slide-prev'" mode="out-in">
      <component
        :is="currentStep.component"
        v-if="currentStep"
        :key="currentStep.id"
        v-bind="currentStepProps"
        :on-next="requestNextStep"
        :on-previous="requestPreviousStep"
      />
    </Transition>
  </div>
</template>

<style scoped>
.onboarding-step-container {
  overflow-x: hidden;
}

.slide-next-enter-active,
.slide-next-leave-active,
.slide-prev-enter-active,
.slide-prev-leave-active {
  will-change: transform, opacity;
}

.slide-next-enter-active {
  animation: onboarding-slide-next-in 0.2s ease-in-out both;
}

.slide-next-leave-active {
  animation: onboarding-slide-next-out 0.2s ease-in-out both;
}

.slide-prev-enter-active {
  animation: onboarding-slide-prev-in 0.2s ease-in-out both;
}

.slide-prev-leave-active {
  animation: onboarding-slide-prev-out 0.2s ease-in-out both;
}

@keyframes onboarding-slide-next-in {
  from {
    transform: translateX(2rem);
    opacity: 0;
  }

  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes onboarding-slide-next-out {
  from {
    transform: translateX(0);
    opacity: 1;
  }

  to {
    transform: translateX(-2rem);
    opacity: 0;
  }
}

@keyframes onboarding-slide-prev-in {
  from {
    transform: translateX(-2rem);
    opacity: 0;
  }

  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes onboarding-slide-prev-out {
  from {
    transform: translateX(0);
    opacity: 1;
  }

  to {
    transform: translateX(2rem);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .slide-next-enter-active,
  .slide-next-leave-active,
  .slide-prev-enter-active,
  .slide-prev-leave-active {
    animation-duration: 1ms;
  }
}
</style>
